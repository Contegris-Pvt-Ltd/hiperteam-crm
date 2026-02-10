import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class TenantSchemaService {
  private readonly logger = new Logger(TenantSchemaService.name);

  constructor(private dataSource: DataSource) {}

  /**
   * Create a new tenant schema with all required tables
   */
  async createTenantSchema(schemaName: string): Promise<void> {
    this.logger.log(`Creating tenant schema: ${schemaName}`);

    try {
      // Create the schema
      await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

      // Read and execute the tenant schema SQL
      const sqlPath = path.join(__dirname, 'scripts', 'tenant-schema.sql');
      let sql = fs.readFileSync(sqlPath, 'utf8');

      // Replace placeholder with actual schema name
      sql = sql.replace(/TENANT_SCHEMA/g, schemaName);

      // Execute the SQL
      await this.dataSource.query(sql);

      // Record the schema version
      await this.initMigrationTracking(schemaName);

      this.logger.log(`Tenant schema created successfully: ${schemaName}`);
    } catch (error) {
      this.logger.error(`Failed to create tenant schema: ${schemaName}`, error);
      throw error;
    }
  }

  /**
   * Initialize migration tracking for a tenant
   */
  private async initMigrationTracking(schemaName: string): Promise<void> {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Mark initial schema as migrated
    await this.dataSource.query(`
      INSERT INTO "${schemaName}".schema_migrations (migration_name)
      VALUES ('0000_initial_schema')
      ON CONFLICT (migration_name) DO NOTHING
    `);
  }

  /**
   * Drop a tenant schema (use with caution!)
   */
  async dropTenantSchema(schemaName: string): Promise<void> {
    this.logger.warn(`Dropping tenant schema: ${schemaName}`);
    await this.dataSource.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    this.logger.log(`Tenant schema dropped: ${schemaName}`);
  }

  /**
   * Check if a tenant schema exists
   */
  async schemaExists(schemaName: string): Promise<boolean> {
    const result = await this.dataSource.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.schemata WHERE schema_name = $1
      ) as exists
    `, [schemaName]);
    return result[0].exists;
  }

  /**
   * Get all tenant schemas
   */
  async getAllTenantSchemas(): Promise<string[]> {
    const result = await this.dataSource.query(`
      SELECT schema_name FROM information_schema.schemata 
      WHERE schema_name LIKE 'tenant_%'
      ORDER BY schema_name
    `);
    return result.map((r: { schema_name: string }) => r.schema_name);
  }

  /**
   * Run a specific migration on all tenant schemas
   */
  async runMigrationOnAllTenants(migrationName: string): Promise<void> {
    const tenantSchemas = await this.getAllTenantSchemas();
    
    const sqlPath = path.join(__dirname, 'scripts', 'migrations', `${migrationName}.sql`);
    
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Migration file not found: ${sqlPath}`);
    }
    
    const sqlTemplate = fs.readFileSync(sqlPath, 'utf8');
    
    for (const schemaName of tenantSchemas) {
      try {
        // Check if migration already ran
        const [existing] = await this.dataSource.query(`
          SELECT 1 FROM "${schemaName}".schema_migrations 
          WHERE migration_name = $1
        `, [migrationName]);
        
        if (existing) {
          this.logger.log(`Migration ${migrationName} already applied to ${schemaName}, skipping...`);
          continue;
        }
        
        // Run migration
        const sql = sqlTemplate.replace(/TENANT_SCHEMA/g, schemaName);
        await this.dataSource.query(sql);
        
        // Record migration
        await this.dataSource.query(`
          INSERT INTO "${schemaName}".schema_migrations (migration_name)
          VALUES ($1)
        `, [migrationName]);
        
        this.logger.log(`Migration ${migrationName} applied to ${schemaName}`);
      } catch (error) {
        this.logger.error(`Failed to run migration ${migrationName} on ${schemaName}`, error);
        throw error;
      }
    }
  }

  /**
   * Run all pending migrations on all tenant schemas
   */
  async runAllPendingMigrations(): Promise<void> {
    const migrationsDir = path.join(__dirname, 'scripts', 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      this.logger.log('No migrations directory found');
      return;
    }
    
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    for (const file of migrationFiles) {
      const migrationName = file.replace('.sql', '');
      await this.runMigrationOnAllTenants(migrationName);
    }
  }
}

