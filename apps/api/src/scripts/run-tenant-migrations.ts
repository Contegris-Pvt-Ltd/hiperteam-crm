import { DataSource } from 'typeorm';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'hiperteam_master',
  logging: true,
});

async function runTenantMigrations() {
  try {
    await dataSource.initialize();
    console.log('Database connected');

    const tenants = await dataSource.query(`
      SELECT schema_name FROM master.tenants WHERE status = 'active'
    `);

    console.log(`Found ${tenants.length} tenant schemas`);

    for (const tenant of tenants) {
      const schema = tenant.schema_name;
      console.log(`\n📦 Migrating schema: ${schema}`);

      // Create tracking table if not exists
      await dataSource.query(`
        CREATE TABLE IF NOT EXISTS "${schema}".schema_migrations (
          id SERIAL PRIMARY KEY,
          migration_name VARCHAR(255) NOT NULL UNIQUE,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const migrations = [
        {
          name: '001_create_page_layouts',
          sql: `
            CREATE TABLE IF NOT EXISTS "${schema}".page_layouts (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              module VARCHAR(50) NOT NULL,
              layout_type VARCHAR(20) NOT NULL,
              name VARCHAR(100) NOT NULL,
              description TEXT,
              is_default BOOLEAN DEFAULT false,
              is_active BOOLEAN DEFAULT true,
              config JSONB NOT NULL,
              created_by UUID,
              updated_by UUID,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_page_layouts_module_type 
            ON "${schema}".page_layouts(module, layout_type);
          `
        },
        {
          name: '002_create_module_layout_settings',
          sql: `
            CREATE TABLE IF NOT EXISTS "${schema}".module_layout_settings (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              module VARCHAR(50) NOT NULL,
              layout_type VARCHAR(20) NOT NULL,
              use_custom_layout BOOLEAN DEFAULT false,
              layout_id UUID REFERENCES "${schema}".page_layouts(id) ON DELETE SET NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(module, layout_type)
            );
            CREATE INDEX IF NOT EXISTS idx_module_layout_settings_module_type 
            ON "${schema}".module_layout_settings(module, layout_type);
          `
        }
      ];

      for (const migration of migrations) {
        // Check if migration already ran
        const existing = await dataSource.query(`
          SELECT 1 FROM "${schema}".schema_migrations WHERE migration_name = $1
        `, [migration.name]).catch(() => []);

        if (existing.length === 0) {
          console.log(`  ▶ Running: ${migration.name}`);
          await dataSource.query(migration.sql);
          await dataSource.query(`
            INSERT INTO "${schema}".schema_migrations (migration_name) VALUES ($1)
          `, [migration.name]);
          console.log(`  ✓ Completed: ${migration.name}`);
        } else {
          console.log(`  ⏭ Skipping: ${migration.name} (already executed)`);
        }
      }

      console.log(`✅ Schema ${schema} up to date`);
    }

    console.log('\n🎉 All tenant migrations complete!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

runTenantMigrations();