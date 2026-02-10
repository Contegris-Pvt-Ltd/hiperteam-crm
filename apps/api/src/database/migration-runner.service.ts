import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

interface MigrationFile {
  name: string;
  sql: string;
}

@Injectable()
export class MigrationRunnerService {
  private readonly logger = new Logger(MigrationRunnerService.name);
  private readonly migrationsPath = path.join(__dirname, 'migrations');

  constructor(private dataSource: DataSource) {}

  /**
   * Run all pending migrations for a specific tenant
   */
  async runMigrationsForTenant(schemaName: string): Promise<string[]> {
    this.logger.log(`Running migrations for tenant: ${schemaName}`);

    const executedMigrations: string[] = [];

    try {
      // Ensure migrations table exists
      await this.ensureMigrationsTable(schemaName);

      // Get pending migrations
      const pendingMigrations = await this.getPendingMigrations(schemaName);

      if (pendingMigrations.length === 0) {
        this.logger.log(`No pending migrations for ${schemaName}`);
        return executedMigrations;
      }

      // Execute each migration
      for (const migration of pendingMigrations) {
        await this.executeMigration(schemaName, migration);
        executedMigrations.push(migration.name);
      }

      this.logger.log(`Executed ${executedMigrations.length} migrations for ${schemaName}`);
      return executedMigrations;
    } catch (error) {
      this.logger.error(`Migration failed for ${schemaName}`, error);
      throw error;
    }
  }

  /**
   * Run migrations for all tenants
   */
  async runMigrationsForAllTenants(): Promise<Map<string, string[]>> {
    const results = new Map<string, string[]>();

    // Get all tenant schemas
    const schemas = await this.getAllTenantSchemas();
    this.logger.log(`Found ${schemas.length} tenant schemas`);

    for (const schema of schemas) {
      try {
        const migrations = await this.runMigrationsForTenant(schema);
        results.set(schema, migrations);
      } catch (error) {
        this.logger.error(`Failed to migrate ${schema}`, error);
        results.set(schema, [`ERROR: ${error.message}`]);
      }
    }

    return results;
  }

  /**
   * Get all tenant schemas
   */
  private async getAllTenantSchemas(): Promise<string[]> {
    const result = await this.dataSource.query(`
      SELECT schema_name FROM information_schema.schemata 
      WHERE schema_name LIKE 'tenant_%'
      ORDER BY schema_name
    `);
    return result.map((r: { schema_name: string }) => r.schema_name);
  }

  /**
   * Ensure the migrations tracking table exists
   */
  private async ensureMigrationsTable(schemaName: string): Promise<void> {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  }

  /**
   * Get list of already executed migrations
   */
  private async getExecutedMigrations(schemaName: string): Promise<Set<string>> {
    const result = await this.dataSource.query(`
      SELECT migration_name FROM "${schemaName}".schema_migrations
    `);
    return new Set(result.map((r: { migration_name: string }) => r.migration_name));
  }

  /**
   * Get all migration files
   */
  private getMigrationFiles(): MigrationFile[] {
    if (!fs.existsSync(this.migrationsPath)) {
      this.logger.warn(`Migrations directory not found: ${this.migrationsPath}`);
      return [];
    }

    const files = fs.readdirSync(this.migrationsPath)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Sort alphabetically (migrations should be prefixed with timestamp)

    return files.map(file => ({
      name: file.replace('.sql', ''),
      sql: fs.readFileSync(path.join(this.migrationsPath, file), 'utf8'),
    }));
  }

  /**
   * Get pending migrations for a tenant
   */
  private async getPendingMigrations(schemaName: string): Promise<MigrationFile[]> {
    const executedMigrations = await this.getExecutedMigrations(schemaName);
    const allMigrations = this.getMigrationFiles();

    return allMigrations.filter(m => !executedMigrations.has(m.name));
  }

  /**
   * Execute a single migration
   */
  private async executeMigration(schemaName: string, migration: MigrationFile): Promise<void> {
    this.logger.log(`Executing migration ${migration.name} for ${schemaName}`);

    // Replace schema placeholder
    const sql = migration.sql.replace(/TENANT_SCHEMA/g, schemaName);

    // Execute in a transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Set search path
      await queryRunner.query(`SET search_path TO "${schemaName}"`);

      // Execute migration SQL
      await queryRunner.query(sql);

      // Record migration
      await queryRunner.query(`
        INSERT INTO "${schemaName}".schema_migrations (migration_name)
        VALUES ($1)
      `, [migration.name]);

      await queryRunner.commitTransaction();
      this.logger.log(`Migration ${migration.name} completed for ${schemaName}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Migration ${migration.name} failed for ${schemaName}`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get migration status for all tenants
   */
  async getMigrationStatus(): Promise<{ schema: string; pending: number; executed: number }[]> {
    const schemas = await this.getAllTenantSchemas();
    const allMigrations = this.getMigrationFiles();
    const results: { schema: string; pending: number; executed: number }[] = [];

    for (const schema of schemas) {
      try {
        const executedMigrations = await this.getExecutedMigrations(schema);
        results.push({
          schema,
          executed: executedMigrations.size,
          pending: allMigrations.length - executedMigrations.size,
        });
      } catch {
        results.push({ schema, executed: 0, pending: allMigrations.length });
      }
    }

    return results;
  }
}