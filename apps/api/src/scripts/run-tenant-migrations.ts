import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load .env from apps/api/.env first, then project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { DataSource } from 'typeorm';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'hiperteam_dev',
  logging: false,
});

async function runTenantMigrations() {
  try {
    await dataSource.initialize();
    console.log('✅ Database connected');

    const tenants = await dataSource.query(`
      SELECT schema_name FROM master.tenants WHERE status = 'active'
    `);

    console.log(`Found ${tenants.length} tenant schemas\n`);

    for (const tenant of tenants) {
      const schema = tenant.schema_name;
      console.log(`📦 Migrating schema: ${schema}`);

      try {
        // ── Pre-check: does schema have core tables? ──────────────
        const coreTables = await dataSource.query(`
          SELECT table_name FROM information_schema.tables
          WHERE table_schema = $1 AND table_name IN ('roles', 'users')
        `, [schema]);

        const tableNames = coreTables.map((t: { table_name: string }) => t.table_name);

        if (!tableNames.includes('roles') || !tableNames.includes('users')) {
          console.log(`  ⚠️  ${schema} missing core tables — auto-initializing from tenant-schema.sql...`);
          try {
            //const sqlPath = path.join(__dirname, 'tenant-schema.sql');
            const sqlPath = path.join(__dirname, '..', 'database', 'scripts', 'tenant-schema.sql');
            let schemaSql = fs.readFileSync(sqlPath, 'utf8');
            schemaSql = schemaSql.replace(/TENANT_SCHEMA/g, schema);
            await dataSource.query(schemaSql);
            console.log(`  ✅ ${schema} initialized successfully`);
          } catch (initError: unknown) {
            const initMsg = initError instanceof Error ? initError.message : String(initError);
            console.error(`  ❌ Failed to initialize ${schema}: ${initMsg}`);
            console.log(`  ⏩ Continuing to next schema...\n`);
            continue;
          }
        }

        // ── Ensure migrations tracking table ──────────────────────
        await dataSource.query(`
          CREATE TABLE IF NOT EXISTS "${schema}".schema_migrations (
            id SERIAL PRIMARY KEY,
            migration_name VARCHAR(255) NOT NULL UNIQUE,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // ── Define migrations ─────────────────────────────────────
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
          },
          {
            name: '003_rbac_columns',
            sql: buildRbacMigration(schema),
          },
          {
            name: '004_password_reset_tokens',
            sql: `
            CREATE TABLE IF NOT EXISTS "${schema}".password_reset_tokens (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id UUID NOT NULL REFERENCES "${schema}".users(id) ON DELETE CASCADE,
              token VARCHAR(255) NOT NULL UNIQUE,
              expires_at TIMESTAMPTZ NOT NULL,
              used_at TIMESTAMPTZ,
              created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_password_reset_token ON "${schema}".password_reset_tokens(token);
            CREATE INDEX IF NOT EXISTS idx_password_reset_user ON "${schema}".password_reset_tokens(user_id);
          `
        },
        ];

        // ── Execute pending migrations ────────────────────────────
        for (const migration of migrations) {
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

        console.log(`  ✅ ${schema} up to date\n`);

      } catch (schemaError: unknown) {
        const errMsg = schemaError instanceof Error ? schemaError.message : String(schemaError);
        console.error(`  ❌ Failed on ${schema}: ${errMsg}`);
        console.log(`  ⏩ Continuing to next schema...\n`);
      }
    }

    console.log('🎉 All tenant migrations complete!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

// ── Build 003 RBAC migration SQL ────────────────────────────────────
function buildRbacMigration(schema: string): string {
  return `
    -- ROLES: Add missing columns
    ALTER TABLE "${schema}".roles ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT false;
    ALTER TABLE "${schema}".roles ADD COLUMN IF NOT EXISTS level INT DEFAULT 0;
    ALTER TABLE "${schema}".roles ADD COLUMN IF NOT EXISTS record_access JSONB DEFAULT '{}';
    ALTER TABLE "${schema}".roles ADD COLUMN IF NOT EXISTS field_permissions JSONB DEFAULT '{}';

    -- Update system roles with proper RBAC permissions
    UPDATE "${schema}".roles SET
      level = 100, is_custom = false,
      record_access = '{"contacts":"all","accounts":"all","leads":"all","deals":"all","tasks":"all","reports":"all"}',
      permissions = '{"contacts":{"view":true,"create":true,"edit":true,"delete":true,"export":true,"import":true},"accounts":{"view":true,"create":true,"edit":true,"delete":true,"export":true,"import":true},"leads":{"view":true,"create":true,"edit":true,"delete":true,"export":true,"import":true},"deals":{"view":true,"create":true,"edit":true,"delete":true,"export":true,"import":true},"tasks":{"view":true,"create":true,"edit":true,"delete":true,"export":true,"import":true},"reports":{"view":true,"create":true,"edit":true,"delete":true,"export":true,"import":true},"users":{"view":true,"create":true,"edit":true,"delete":true,"invite":true},"roles":{"view":true,"create":true,"edit":true,"delete":true},"settings":{"view":true,"edit":true},"admin":{"view":true,"edit":true}}'
    WHERE name = 'admin';

    UPDATE "${schema}".roles SET
      level = 50, is_custom = false,
      record_access = '{"contacts":"team","accounts":"team","leads":"team","deals":"team","tasks":"team","reports":"team"}',
      permissions = '{"contacts":{"view":true,"create":true,"edit":true,"delete":true,"export":true,"import":false},"accounts":{"view":true,"create":true,"edit":true,"delete":true,"export":true,"import":false},"leads":{"view":true,"create":true,"edit":true,"delete":true,"export":true,"import":false},"deals":{"view":true,"create":true,"edit":true,"delete":true,"export":true,"import":false},"tasks":{"view":true,"create":true,"edit":true,"delete":true,"export":false,"import":false},"reports":{"view":true,"create":true,"edit":false,"delete":false,"export":true,"import":false},"users":{"view":true,"create":false,"edit":false,"delete":false,"invite":false},"roles":{"view":true,"create":false,"edit":false,"delete":false},"settings":{"view":true,"edit":false},"admin":{"view":false,"edit":false}}'
    WHERE name = 'manager';

    UPDATE "${schema}".roles SET
      level = 10, is_custom = false,
      record_access = '{"contacts":"own","accounts":"own","leads":"own","deals":"own","tasks":"own","reports":"own"}',
      permissions = '{"contacts":{"view":true,"create":true,"edit":true,"delete":false,"export":false,"import":false},"accounts":{"view":true,"create":true,"edit":true,"delete":false,"export":false,"import":false},"leads":{"view":true,"create":true,"edit":true,"delete":false,"export":false,"import":false},"deals":{"view":true,"create":true,"edit":true,"delete":false,"export":false,"import":false},"tasks":{"view":true,"create":true,"edit":true,"delete":true,"export":false,"import":false},"reports":{"view":true,"create":false,"edit":false,"delete":false,"export":false,"import":false},"users":{"view":false,"create":false,"edit":false,"delete":false,"invite":false},"roles":{"view":false,"create":false,"edit":false,"delete":false},"settings":{"view":false,"edit":false},"admin":{"view":false,"edit":false}}'
    WHERE name = 'user';

    -- USERS: Add missing columns
    ALTER TABLE "${schema}".users ADD COLUMN IF NOT EXISTS department_id UUID;
    ALTER TABLE "${schema}".users ADD COLUMN IF NOT EXISTS manager_id UUID;
    ALTER TABLE "${schema}".users ADD COLUMN IF NOT EXISTS job_title VARCHAR(150);
    ALTER TABLE "${schema}".users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);
    ALTER TABLE "${schema}".users ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC';
    ALTER TABLE "${schema}".users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50);
    ALTER TABLE "${schema}".users ADD COLUMN IF NOT EXISTS invited_by UUID;
    ALTER TABLE "${schema}".users ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;

    CREATE INDEX IF NOT EXISTS idx_users_department ON "${schema}".users(department_id);
    CREATE INDEX IF NOT EXISTS idx_users_manager ON "${schema}".users(manager_id);
    CREATE INDEX IF NOT EXISTS idx_users_status ON "${schema}".users(status);

    -- DEPARTMENTS
    CREATE TABLE IF NOT EXISTS "${schema}".departments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      code VARCHAR(30) UNIQUE,
      description TEXT,
      parent_department_id UUID REFERENCES "${schema}".departments(id) ON DELETE SET NULL,
      head_id UUID,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_departments_parent ON "${schema}".departments(parent_department_id);
    CREATE INDEX IF NOT EXISTS idx_departments_head ON "${schema}".departments(head_id);

    INSERT INTO "${schema}".departments (name, code, description, is_active)
    VALUES ('General', 'GEN', 'Default department', true)
    ON CONFLICT DO NOTHING;

    -- TEAMS
    CREATE TABLE IF NOT EXISTS "${schema}".teams (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      description TEXT,
      department_id UUID REFERENCES "${schema}".departments(id) ON DELETE SET NULL,
      team_lead_id UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_teams_department ON "${schema}".teams(department_id);
    CREATE INDEX IF NOT EXISTS idx_teams_lead ON "${schema}".teams(team_lead_id);
    CREATE INDEX IF NOT EXISTS idx_teams_active ON "${schema}".teams(is_active);

    -- USER_TEAMS
    CREATE TABLE IF NOT EXISTS "${schema}".user_teams (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES "${schema}".users(id) ON DELETE CASCADE,
      team_id UUID NOT NULL REFERENCES "${schema}".teams(id) ON DELETE CASCADE,
      role VARCHAR(50) DEFAULT 'member',
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, team_id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_teams_user ON "${schema}".user_teams(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_teams_team ON "${schema}".user_teams(team_id);

    -- TERRITORIES
    CREATE TABLE IF NOT EXISTS "${schema}".territories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      code VARCHAR(30),
      description TEXT,
      type VARCHAR(50) DEFAULT 'geographic',
      parent_territory_id UUID REFERENCES "${schema}".territories(id) ON DELETE SET NULL,
      metadata JSONB DEFAULT '{}',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_territories_parent ON "${schema}".territories(parent_territory_id);
    CREATE INDEX IF NOT EXISTS idx_territories_type ON "${schema}".territories(type);

    -- USER_TERRITORIES
    CREATE TABLE IF NOT EXISTS "${schema}".user_territories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES "${schema}".users(id) ON DELETE CASCADE,
      territory_id UUID NOT NULL REFERENCES "${schema}".territories(id) ON DELETE CASCADE,
      role VARCHAR(50) DEFAULT 'member',
      assigned_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, territory_id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_territories_user ON "${schema}".user_territories(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_territories_territory ON "${schema}".user_territories(territory_id);

    -- USER INVITATIONS
    CREATE TABLE IF NOT EXISTS "${schema}".user_invitations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL,
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      role_id UUID REFERENCES "${schema}".roles(id) ON DELETE SET NULL,
      department_id UUID REFERENCES "${schema}".departments(id) ON DELETE SET NULL,
      team_ids UUID[] DEFAULT '{}',
      job_title VARCHAR(150),
      invited_by UUID NOT NULL REFERENCES "${schema}".users(id),
      token VARCHAR(255) NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      accepted_at TIMESTAMPTZ,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON "${schema}".user_invitations(email);
    CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON "${schema}".user_invitations(token);
    CREATE INDEX IF NOT EXISTS idx_user_invitations_status ON "${schema}".user_invitations(status);

    -- ============================================================
    -- PRODUCT CATEGORIES TABLE (hierarchical)
    -- ============================================================
    CREATE TABLE IF NOT EXISTS product_categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      parent_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
      display_order INT DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_product_categories_parent ON product_categories(parent_id);
    CREATE INDEX IF NOT EXISTS idx_product_categories_slug ON product_categories(slug);

    -- ============================================================
    -- PRODUCTS TABLE
    -- ============================================================
    CREATE TABLE IF NOT EXISTS products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      code VARCHAR(100),
      short_description VARCHAR(500),
      description TEXT,
      type VARCHAR(50) NOT NULL DEFAULT 'product',
      category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
      unit VARCHAR(50) DEFAULT 'each',
      base_price DECIMAL(15,2) DEFAULT 0,
      cost DECIMAL(15,2),
      currency VARCHAR(3) DEFAULT 'USD',
      tax_category VARCHAR(100),
      status VARCHAR(50) DEFAULT 'active',
      image_url TEXT,
      external_url TEXT,
      custom_fields JSONB DEFAULT '{}',
      owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_products_code ON products(code) WHERE code IS NOT NULL AND deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_products_type ON products(type);
    CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_products_deleted ON products(deleted_at);

    -- ============================================================
    -- PRICE BOOKS TABLE
    -- ============================================================
    CREATE TABLE IF NOT EXISTS price_books (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_standard BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      valid_from TIMESTAMPTZ,
      valid_to TIMESTAMPTZ,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_price_books_active ON price_books(is_active);

    -- Insert default Standard price book
    INSERT INTO price_books (name, description, is_standard, is_active)
    VALUES ('Standard', 'Default pricing for all products', true, true)
    ON CONFLICT DO NOTHING;

    -- ============================================================
    -- PRICE BOOK ENTRIES TABLE
    -- ============================================================
    CREATE TABLE IF NOT EXISTS price_book_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      price_book_id UUID NOT NULL REFERENCES price_books(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      unit_price DECIMAL(15,2) NOT NULL,
      min_quantity INT DEFAULT 1,
      max_quantity INT,
      is_active BOOLEAN DEFAULT true,
      valid_from TIMESTAMPTZ,
      valid_to TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(price_book_id, product_id, min_quantity)
    );

    CREATE INDEX IF NOT EXISTS idx_price_book_entries_book ON price_book_entries(price_book_id);
    CREATE INDEX IF NOT EXISTS idx_price_book_entries_product ON price_book_entries(product_id);

    -- ============================================================
    -- PRODUCT BUNDLES TABLE
    -- ============================================================
    CREATE TABLE IF NOT EXISTS product_bundles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      bundle_type VARCHAR(20) DEFAULT 'fixed',
      min_items INT DEFAULT 0,
      max_items INT,
      discount_type VARCHAR(20) DEFAULT 'percentage',
      discount_value DECIMAL(15,2) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_product_bundles_product ON product_bundles(product_id);

    -- ============================================================
    -- BUNDLE ITEMS TABLE
    -- ============================================================
    CREATE TABLE IF NOT EXISTS bundle_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      bundle_id UUID NOT NULL REFERENCES product_bundles(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      quantity INT DEFAULT 1,
      is_optional BOOLEAN DEFAULT false,
      override_price DECIMAL(15,2),
      display_order INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(bundle_id, product_id)
    );

    CREATE INDEX IF NOT EXISTS idx_bundle_items_bundle ON bundle_items(bundle_id);

    -- ============================================================
    -- OPPORTUNITY LINE ITEMS TABLE (future Opportunities module)
    -- ============================================================
    CREATE TABLE IF NOT EXISTS opportunity_line_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      opportunity_id UUID NOT NULL,
      product_id UUID REFERENCES products(id) ON DELETE SET NULL,
      price_book_entry_id UUID REFERENCES price_book_entries(id) ON DELETE SET NULL,
      description TEXT,
      quantity DECIMAL(15,2) DEFAULT 1,
      unit_price DECIMAL(15,2) NOT NULL,
      discount_percent DECIMAL(5,2) DEFAULT 0,
      discount_amount DECIMAL(15,2) DEFAULT 0,
      total_price DECIMAL(15,2) NOT NULL,
      billing_frequency VARCHAR(20) DEFAULT 'one_time',
      sort_order INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_line_items_opportunity ON opportunity_line_items(opportunity_id);
    CREATE INDEX IF NOT EXISTS idx_line_items_product ON opportunity_line_items(product_id);
  `;

  
}

runTenantMigrations();