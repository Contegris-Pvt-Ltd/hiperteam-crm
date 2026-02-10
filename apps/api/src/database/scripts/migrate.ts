import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { MigrationRunnerService } from '../migration-runner.service';
import { TenantSchemaService } from '../tenant-schema.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const migrationRunner = app.get(MigrationRunnerService);
  const tenantSchemaService = app.get(TenantSchemaService);

  const command = process.argv[2];
  const arg = process.argv[3];

  try {
    switch (command) {
      case 'run':
        // Run migrations for all tenants
        console.log('Running migrations for all tenants...');
        const results = await migrationRunner.runMigrationsForAllTenants();
        results.forEach((migrations, schema) => {
          if (migrations.length > 0) {
            console.log(`\n${schema}:`);
            migrations.forEach(m => console.log(`  ✓ ${m}`));
          } else {
            console.log(`\n${schema}: Up to date`);
          }
        });
        break;

      case 'run:tenant':
        // Run migrations for a specific tenant
        if (!arg) {
          console.error('Please provide tenant schema name');
          process.exit(1);
        }
        console.log(`Running migrations for ${arg}...`);
        const tenantMigrations = await migrationRunner.runMigrationsForTenant(arg);
        tenantMigrations.forEach(m => console.log(`  ✓ ${m}`));
        break;

      case 'status':
        // Show migration status
        console.log('Migration status:');
        const status = await migrationRunner.getMigrationStatus();
        status.forEach(s => {
          const statusText = s.pending > 0 ? `${s.pending} pending` : 'Up to date';
          console.log(`  ${s.schema}: ${s.executed} executed, ${statusText}`);
        });
        break;

      case 'create:tenant':
        // Create a new tenant schema
        if (!arg) {
          console.error('Please provide tenant schema name');
          process.exit(1);
        }
        console.log(`Creating tenant schema: ${arg}...`);
        await tenantSchemaService.createTenantSchema(arg);
        console.log(`Tenant schema created: ${arg}`);
        break;

      case 'list:tenants':
        // List all tenant schemas
        const schemas = await tenantSchemaService.getAllTenantSchemas();
        console.log('Tenant schemas:');
        schemas.forEach(s => console.log(`  - ${s}`));
        break;

      default:
        console.log(`
Intellicon CRM Database Migration Tool

Usage:
  npm run migrate <command> [options]

Commands:
  run                    Run all pending migrations for all tenants
  run:tenant <schema>    Run migrations for a specific tenant
  status                 Show migration status for all tenants
  create:tenant <schema> Create a new tenant schema
  list:tenants           List all tenant schemas

Examples:
  npm run migrate run
  npm run migrate run:tenant tenant_contegris
  npm run migrate status
  npm run migrate create:tenant tenant_newclient
        `);
    }
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();