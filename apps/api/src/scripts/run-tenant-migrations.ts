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
            name: '012_lead_products',
            sql: `
              CREATE TABLE IF NOT EXISTS "${schema}".lead_products (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                lead_id UUID NOT NULL REFERENCES "${schema}".leads(id) ON DELETE CASCADE,
                product_id UUID NOT NULL REFERENCES "${schema}".products(id) ON DELETE CASCADE,
                notes TEXT,
                created_by UUID REFERENCES "${schema}".users(id),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(lead_id, product_id)
              );

              CREATE INDEX IF NOT EXISTS idx_lead_products_lead ON "${schema}".lead_products(lead_id);
              CREATE INDEX IF NOT EXISTS idx_lead_products_product ON "${schema}".lead_products(product_id);
            `
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
          {
            name: '005_add_products_pricing',
            sql: `
              CREATE TABLE IF NOT EXISTS "${schema}".product_categories (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                slug VARCHAR(255) NOT NULL UNIQUE,
                description TEXT,
                parent_id UUID REFERENCES "${schema}".product_categories(id) ON DELETE SET NULL,
                display_order INT DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
              );
              CREATE INDEX IF NOT EXISTS idx_product_categories_parent ON "${schema}".product_categories(parent_id);

              CREATE TABLE IF NOT EXISTS "${schema}".products (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                code VARCHAR(100),
                short_description VARCHAR(500),
                description TEXT,
                type VARCHAR(50) NOT NULL DEFAULT 'product',
                category_id UUID REFERENCES "${schema}".product_categories(id) ON DELETE SET NULL,
                unit VARCHAR(50) DEFAULT 'each',
                base_price DECIMAL(15,2) DEFAULT 0,
                cost DECIMAL(15,2),
                currency VARCHAR(3) DEFAULT 'USD',
                tax_category VARCHAR(100),
                status VARCHAR(50) DEFAULT 'active',
                image_url TEXT,
                external_url TEXT,
                custom_fields JSONB DEFAULT '{}',
                owner_id UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
                created_by UUID REFERENCES "${schema}".users(id),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                deleted_at TIMESTAMPTZ
              );
              CREATE UNIQUE INDEX IF NOT EXISTS idx_products_code ON "${schema}".products(code) WHERE code IS NOT NULL AND deleted_at IS NULL;
              CREATE INDEX IF NOT EXISTS idx_products_type ON "${schema}".products(type);
              CREATE INDEX IF NOT EXISTS idx_products_status ON "${schema}".products(status);
              CREATE INDEX IF NOT EXISTS idx_products_category ON "${schema}".products(category_id);

              CREATE TABLE IF NOT EXISTS "${schema}".price_books (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                is_standard BOOLEAN DEFAULT false,
                is_active BOOLEAN DEFAULT true,
                valid_from TIMESTAMPTZ,
                valid_to TIMESTAMPTZ,
                created_by UUID REFERENCES "${schema}".users(id),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
              );
              INSERT INTO "${schema}".price_books (name, description, is_standard, is_active)
              VALUES ('Standard', 'Default pricing for all products', true, true)
              ON CONFLICT DO NOTHING;

              CREATE TABLE IF NOT EXISTS "${schema}".price_book_entries (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                price_book_id UUID NOT NULL REFERENCES "${schema}".price_books(id) ON DELETE CASCADE,
                product_id UUID NOT NULL REFERENCES "${schema}".products(id) ON DELETE CASCADE,
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
              CREATE INDEX IF NOT EXISTS idx_pbe_book ON "${schema}".price_book_entries(price_book_id);
              CREATE INDEX IF NOT EXISTS idx_pbe_product ON "${schema}".price_book_entries(product_id);

              CREATE TABLE IF NOT EXISTS "${schema}".product_bundles (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                product_id UUID NOT NULL REFERENCES "${schema}".products(id) ON DELETE CASCADE,
                bundle_type VARCHAR(20) DEFAULT 'fixed',
                min_items INT DEFAULT 0,
                max_items INT,
                discount_type VARCHAR(20) DEFAULT 'percentage',
                discount_value DECIMAL(15,2) DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
              );

              CREATE TABLE IF NOT EXISTS "${schema}".bundle_items (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                bundle_id UUID NOT NULL REFERENCES "${schema}".product_bundles(id) ON DELETE CASCADE,
                product_id UUID NOT NULL REFERENCES "${schema}".products(id) ON DELETE CASCADE,
                quantity INT DEFAULT 1,
                is_optional BOOLEAN DEFAULT false,
                override_price DECIMAL(15,2),
                display_order INT DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(bundle_id, product_id)
              );

              CREATE TABLE IF NOT EXISTS "${schema}".opportunity_line_items (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                opportunity_id UUID NOT NULL,
                product_id UUID REFERENCES "${schema}".products(id) ON DELETE SET NULL,
                price_book_entry_id UUID REFERENCES "${schema}".price_book_entries(id) ON DELETE SET NULL,
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
              CREATE INDEX IF NOT EXISTS idx_oli_opportunity ON "${schema}".opportunity_line_items(opportunity_id);
              CREATE INDEX IF NOT EXISTS idx_oli_product ON "${schema}".opportunity_line_items(product_id);
            `
          },
          {
            name: '006_add_leads_module',
            sql: buildLeadsMigration(schema),
          },
          {
            name: '007_add_user_table_preferences',
            sql: `
              CREATE TABLE IF NOT EXISTS "${schema}".user_table_preferences (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id UUID NOT NULL REFERENCES "${schema}".users(id) ON DELETE CASCADE,
              module VARCHAR(50) NOT NULL,           -- 'leads', 'contacts', 'accounts', 'products', etc.
              visible_columns JSONB DEFAULT '[]',    -- ordered array of column keys: ["firstName","email","company"]
              column_widths JSONB DEFAULT '{}',      -- { "firstName": 180, "email": 220 }
              page_size INTEGER DEFAULT 25,
              default_sort_column VARCHAR(100) DEFAULT 'created_at',
              default_sort_order VARCHAR(4) DEFAULT 'DESC',
              created_at TIMESTAMPTZ DEFAULT NOW(),
              updated_at TIMESTAMPTZ DEFAULT NOW(),
              UNIQUE(user_id, module)
            );

            CREATE INDEX IF NOT EXISTS idx_user_table_prefs_user_module 
              ON "${schema}".user_table_preferences(user_id, module);
            `
          },
          {
            name: '006_add_pipelines',
            sql: `
              -- ============================================================
              -- PIPELINES TABLE (shared across modules)
              -- ============================================================
              CREATE TABLE IF NOT EXISTS "${schema}".pipelines (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(150) NOT NULL,
                description TEXT,
                is_default BOOLEAN DEFAULT false,
                is_active BOOLEAN DEFAULT true,
                sort_order INT DEFAULT 0,
                created_by UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
              );
              CREATE INDEX IF NOT EXISTS idx_pipelines_active ON "${schema}".pipelines(is_active);

              -- ============================================================
              -- PIPELINE STAGES TABLE
              -- ============================================================
              CREATE TABLE IF NOT EXISTS "${schema}".pipeline_stages (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                pipeline_id UUID NOT NULL REFERENCES "${schema}".pipelines(id) ON DELETE CASCADE,
                module VARCHAR(50) NOT NULL,
                name VARCHAR(100) NOT NULL,
                slug VARCHAR(100) NOT NULL,
                color VARCHAR(20) DEFAULT '#3B82F6',
                description TEXT,
                probability INT DEFAULT 0,
                sort_order INT NOT NULL DEFAULT 0,
                is_system BOOLEAN DEFAULT false,
                is_active BOOLEAN DEFAULT true,
                is_won BOOLEAN DEFAULT false,
                is_lost BOOLEAN DEFAULT false,
                required_fields JSONB DEFAULT '[]',
                visible_fields JSONB DEFAULT '[]',
                auto_actions JSONB DEFAULT '[]',
                exit_criteria JSONB DEFAULT '[]',
                lock_previous_fields BOOLEAN DEFAULT false,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(pipeline_id, module, slug)
              );
              CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline ON "${schema}".pipeline_stages(pipeline_id);
              CREATE INDEX IF NOT EXISTS idx_pipeline_stages_module ON "${schema}".pipeline_stages(pipeline_id, module);

              -- ============================================================
              -- PIPELINE STAGE FIELDS TABLE
              -- ============================================================
              CREATE TABLE IF NOT EXISTS "${schema}".pipeline_stage_fields (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                stage_id UUID NOT NULL REFERENCES "${schema}".pipeline_stages(id) ON DELETE CASCADE,
                field_key VARCHAR(100) NOT NULL,
                field_label VARCHAR(200) NOT NULL,
                field_type VARCHAR(50) DEFAULT 'text',
                field_options JSONB DEFAULT '[]',
                is_required BOOLEAN DEFAULT false,
                is_visible BOOLEAN DEFAULT true,
                sort_order INT DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(stage_id, field_key)
              );
              CREATE INDEX IF NOT EXISTS idx_pipeline_stage_fields_stage ON "${schema}".pipeline_stage_fields(stage_id);

              -- ============================================================
              -- SEED: Default Pipeline
              -- ============================================================
              INSERT INTO "${schema}".pipelines (name, description, is_default, is_active, sort_order)
              SELECT 'Default Pipeline', 'Default sales pipeline for leads and opportunities', true, true, 0
              WHERE NOT EXISTS (SELECT 1 FROM "${schema}".pipelines WHERE is_default = true);

              -- ============================================================
              -- MIGRATE: lead_stages → pipeline_stages (preserve UUIDs)
              -- ============================================================
              INSERT INTO "${schema}".pipeline_stages
                (id, pipeline_id, module, name, slug, color, description,
                 probability, sort_order, is_system, is_active, is_won, is_lost,
                 required_fields, visible_fields, auto_actions, exit_criteria,
                 lock_previous_fields, created_at, updated_at)
              SELECT
                ls.id, p.id, 'leads',
                ls.name, ls.slug, ls.color, ls.description,
                CASE WHEN ls.is_won THEN 100 WHEN ls.is_lost THEN 0 ELSE (ls.sort_order * 15) END,
                ls.sort_order, ls.is_system, ls.is_active, ls.is_won, ls.is_lost,
                ls.required_fields, ls.visible_fields, ls.auto_actions, '[]'::jsonb,
                ls.lock_previous_fields, ls.created_at, ls.updated_at
              FROM "${schema}".lead_stages ls
              CROSS JOIN (SELECT id FROM "${schema}".pipelines WHERE is_default = true LIMIT 1) p
              WHERE NOT EXISTS (SELECT 1 FROM "${schema}".pipeline_stages ps WHERE ps.id = ls.id);

              -- MIGRATE: lead_stage_fields → pipeline_stage_fields
              INSERT INTO "${schema}".pipeline_stage_fields
                (id, stage_id, field_key, field_label, field_type, field_options,
                 is_required, is_visible, sort_order, created_at)
              SELECT lsf.id, lsf.stage_id, lsf.field_key, lsf.field_label,
                lsf.field_type, lsf.field_options, lsf.is_required,
                lsf.is_visible, lsf.sort_order, lsf.created_at
              FROM "${schema}".lead_stage_fields lsf
              WHERE EXISTS (SELECT 1 FROM "${schema}".pipeline_stages ps WHERE ps.id = lsf.stage_id)
              AND NOT EXISTS (SELECT 1 FROM "${schema}".pipeline_stage_fields psf WHERE psf.id = lsf.id);

              -- ============================================================
              -- ADD pipeline_id to leads table + re-point stage FK
              -- ============================================================
              ALTER TABLE "${schema}".leads ADD COLUMN IF NOT EXISTS pipeline_id UUID;

              UPDATE "${schema}".leads
              SET pipeline_id = (SELECT id FROM "${schema}".pipelines WHERE is_default = true LIMIT 1)
              WHERE pipeline_id IS NULL;

              -- Add pipeline FK
              DO $do$
              BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM information_schema.table_constraints
                  WHERE constraint_name = 'fk_leads_pipeline' AND table_schema = '${schema}'
                ) THEN
                  ALTER TABLE "${schema}".leads
                    ADD CONSTRAINT fk_leads_pipeline
                    FOREIGN KEY (pipeline_id) REFERENCES "${schema}".pipelines(id) ON DELETE SET NULL;
                END IF;
              END $do$;
              CREATE INDEX IF NOT EXISTS idx_leads_pipeline ON "${schema}".leads(pipeline_id);

              -- Drop old stage FK (lead_stages) and add new one (pipeline_stages)
              DO $do$
              DECLARE fk_name TEXT;
              BEGIN
                SELECT tc.constraint_name INTO fk_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
                  AND ccu.constraint_schema = tc.constraint_schema
                WHERE tc.table_schema = '${schema}'
                  AND tc.table_name = 'leads'
                  AND tc.constraint_type = 'FOREIGN KEY'
                  AND ccu.table_name = 'lead_stages'
                  AND ccu.column_name = 'id';
                IF fk_name IS NOT NULL THEN
                  EXECUTE format('ALTER TABLE "${schema}".leads DROP CONSTRAINT %I', fk_name);
                END IF;
              END $do$;

              DO $do$
              BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM information_schema.table_constraints
                  WHERE constraint_name = 'fk_leads_pipeline_stage' AND table_schema = '${schema}'
                ) THEN
                  ALTER TABLE "${schema}".leads
                    ADD CONSTRAINT fk_leads_pipeline_stage
                    FOREIGN KEY (stage_id) REFERENCES "${schema}".pipeline_stages(id) ON DELETE SET NULL;
                END IF;
              END $do$;

              -- ============================================================
              -- SEED: Default Opportunity stages
              -- ============================================================
              INSERT INTO "${schema}".pipeline_stages
                (pipeline_id, module, name, slug, color, probability, sort_order, is_system, required_fields, exit_criteria)
              SELECT p.id, 'opportunities', v.name, v.slug, v.color, v.probability, v.sort_order, false,
                v.required_fields::jsonb, v.exit_criteria::jsonb
              FROM (SELECT id FROM "${schema}".pipelines WHERE is_default = true LIMIT 1) p,
              (VALUES
                ('Qualification',  'qualification',  '#3B82F6', 10, 1,  '[]', '[]'),
                ('Needs Analysis', 'needs_analysis', '#F59E0B', 20, 2,  '[]', '["Identify key stakeholders","Document pain points"]'),
                ('Proposal',       'proposal',       '#8B5CF6', 40, 3,  '["amount"]', '["Proposal sent to decision maker"]'),
                ('Negotiation',    'negotiation',    '#EC4899', 60, 4,  '["amount","closeDate"]', '["Terms discussed","Pricing agreed"]'),
                ('Review',         'review',         '#F97316', 80, 5,  '["amount","closeDate"]', '["Legal review complete","Contract drafted"]'),
                ('Closed Won',     'closed_won',     '#059669', 100, 90, '["amount","closeDate"]', '[]'),
                ('Closed Lost',    'closed_lost',    '#EF4444', 0,  91, '[]', '[]')
              ) AS v(name, slug, color, probability, sort_order, required_fields, exit_criteria)
              WHERE NOT EXISTS (
                SELECT 1 FROM "${schema}".pipeline_stages ps
                WHERE ps.pipeline_id = p.id AND ps.module = 'opportunities'
              );

              UPDATE "${schema}".pipeline_stages SET is_won = true
              WHERE module = 'opportunities' AND slug = 'closed_won'
              AND pipeline_id = (SELECT id FROM "${schema}".pipelines WHERE is_default = true LIMIT 1);

              UPDATE "${schema}".pipeline_stages SET is_lost = true
              WHERE module = 'opportunities' AND slug = 'closed_lost'
              AND pipeline_id = (SELECT id FROM "${schema}".pipelines WHERE is_default = true LIMIT 1);
            `
          },
          {
            name: '009_add_opportunities',
            sql: buildOpportunitiesMigration(schema),
          },
          {
            name: '010_opportunity_settings',
            sql: buildOpportunitySettingsMigration(schema),
          },
          {
            name: '010_opportunity_settings',
            sql: buildOpportunitySettingsMigration(schema),
          },
          {
            name: "011_build_line_item_bundle_support",
            sql: buildLineItemBundleSupportMigration(schema),
          },
          {
            name: "011_add_opportunities_to_roles",
            sql: buildOpportunitiesRolesMigration(schema),
          },
          {
            name: '011_accounts_b2b_b2c',
            sql: `
              -- B2B/B2C Account Classification
              ALTER TABLE "${schema}".accounts
                ADD COLUMN IF NOT EXISTS account_classification VARCHAR(20) DEFAULT 'business';
              ALTER TABLE "${schema}".accounts
                ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
              ALTER TABLE "${schema}".accounts
                ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
              ALTER TABLE "${schema}".accounts
                ADD COLUMN IF NOT EXISTS date_of_birth DATE;
              ALTER TABLE "${schema}".accounts
                ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
              ALTER TABLE "${schema}".accounts
                ADD COLUMN IF NOT EXISTS national_id VARCHAR(100);

              CREATE INDEX IF NOT EXISTS idx_accounts_classification
                ON "${schema}".accounts(account_classification);

              -- Set existing accounts to 'business'
              UPDATE "${schema}".accounts
                SET account_classification = 'business'
                WHERE account_classification IS NULL;
            `
          },
          // ▼ ADD THIS NEW ENTRY ▼
          {
            name: '0021_module_settings',
            sql: `
              CREATE TABLE IF NOT EXISTS "${schema}".module_settings (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                module VARCHAR(50) NOT NULL,
                setting_key VARCHAR(100) NOT NULL,
                setting_value JSONB NOT NULL DEFAULT '{}',
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(module, setting_key)
              );

              CREATE INDEX IF NOT EXISTS idx_module_settings_module ON "${schema}".module_settings(module);

              INSERT INTO "${schema}".module_settings (module, setting_key, setting_value) VALUES
                ('leads', 'fieldValidation', '{"rules":[{"id":"default-leads-1","fields":["lastName"],"type":"required","label":"Last Name","message":"Last name is required","isActive":true},{"id":"default-leads-2","fields":["email","phone","mobile"],"type":"any_one","label":"Contact Info","message":"At least one of email, phone, or mobile is required","isActive":true}]}'),
                ('contacts', 'fieldValidation', '{"rules":[{"id":"default-contacts-1","fields":["lastName"],"type":"required","label":"Last Name","message":"Last name is required","isActive":true}]}'),
                ('accounts', 'fieldValidation', '{"rules":[{"id":"default-accounts-1","fields":["name"],"type":"required","label":"Account Name","message":"Account name is required","isActive":true}]}'),
                ('opportunities', 'fieldValidation', '{"rules":[{"id":"default-opps-1","fields":["name"],"type":"required","label":"Opportunity Name","message":"Opportunity name is required","isActive":true}]}')
              ON CONFLICT (module, setting_key) DO NOTHING;
            `,
          }
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

function buildLeadsMigration(schema: string): string {
  return `
    -- ============================================================
    -- RECORD TEAM ROLES (shared, cross-module)
    -- ============================================================
    CREATE TABLE IF NOT EXISTS "${schema}".record_team_roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_system BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    INSERT INTO "${schema}".record_team_roles (name, description, is_system, sort_order) VALUES
      ('Lead Generator', 'Originally created or sourced the record', true, 1),
      ('Account Manager', 'Primary account relationship owner', true, 2),
      ('Sales Manager', 'Oversight and approval authority', true, 3),
      ('Observer', 'Read-only visibility into the record', true, 4),
      ('Collaborator', 'Active participant with edit access', true, 5)
    ON CONFLICT DO NOTHING;

    -- ============================================================
    -- RECORD TEAM MEMBERS (shared, cross-module)
    -- ============================================================
    CREATE TABLE IF NOT EXISTS "${schema}".record_team_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_type VARCHAR(50) NOT NULL,
      entity_id UUID NOT NULL,
      user_id UUID NOT NULL REFERENCES "${schema}".users(id) ON DELETE CASCADE,
      role_id UUID REFERENCES "${schema}".record_team_roles(id) ON DELETE SET NULL,
      role_name VARCHAR(100),
      access_level VARCHAR(20) DEFAULT 'read',
      added_by UUID REFERENCES "${schema}".users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(entity_type, entity_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_record_team_entity ON "${schema}".record_team_members(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_record_team_user ON "${schema}".record_team_members(user_id, entity_type);

    -- ============================================================
    -- LEAD STAGES
    -- ============================================================
    CREATE TABLE IF NOT EXISTS "${schema}".lead_stages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(100) NOT NULL UNIQUE,
      color VARCHAR(20) DEFAULT '#3B82F6',
      description TEXT,
      sort_order INT NOT NULL DEFAULT 0,
      is_system BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      is_won BOOLEAN DEFAULT false,
      is_lost BOOLEAN DEFAULT false,
      required_fields JSONB DEFAULT '[]',
      visible_fields JSONB DEFAULT '[]',
      auto_actions JSONB DEFAULT '[]',
      lock_previous_fields BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    INSERT INTO "${schema}".lead_stages (name, slug, color, sort_order, is_system) VALUES
      ('New',          'new',          '#3B82F6', 1, false),
      ('Contacted',    'contacted',    '#F59E0B', 2, false),
      ('Qualified',    'qualified',    '#10B981', 3, false),
      ('Proposal',     'proposal',     '#8B5CF6', 4, false),
      ('Negotiation',  'negotiation',  '#EC4899', 5, false),
      ('Converted',    'converted',    '#059669', 90, true),
      ('Disqualified', 'disqualified', '#EF4444', 91, true)
    ON CONFLICT (slug) DO NOTHING;

    UPDATE "${schema}".lead_stages SET is_won = true WHERE slug = 'converted';
    UPDATE "${schema}".lead_stages SET is_lost = true WHERE slug = 'disqualified';

    -- ============================================================
    -- LEAD STAGE FIELDS
    -- ============================================================
    CREATE TABLE IF NOT EXISTS "${schema}".lead_stage_fields (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      stage_id UUID NOT NULL REFERENCES "${schema}".lead_stages(id) ON DELETE CASCADE,
      field_key VARCHAR(100) NOT NULL,
      field_label VARCHAR(200) NOT NULL,
      field_type VARCHAR(50) DEFAULT 'text',
      field_options JSONB DEFAULT '[]',
      is_required BOOLEAN DEFAULT false,
      is_visible BOOLEAN DEFAULT true,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(stage_id, field_key)
    );

    -- ============================================================
    -- LEAD PRIORITIES
    -- ============================================================
    CREATE TABLE IF NOT EXISTS "${schema}".lead_priorities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      color VARCHAR(20) NOT NULL DEFAULT '#9CA3AF',
      icon VARCHAR(50),
      sort_order INT NOT NULL DEFAULT 0,
      is_default BOOLEAN DEFAULT false,
      is_system BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      score_min INT,
      score_max INT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    INSERT INTO "${schema}".lead_priorities (name, color, icon, sort_order, is_system, score_min, score_max) VALUES
      ('Critical', '#EF4444', 'flame',       1, false, 80, 100),
      ('Hot',      '#F97316', 'thermometer', 2, false, 60, 79),
      ('Warm',     '#EAB308', 'sun',         3, false, 40, 59),
      ('Cold',     '#3B82F6', 'snowflake',   4, false, 1,  39),
      ('None',     '#9CA3AF', 'minus',       5, false, NULL, NULL)
    ON CONFLICT DO NOTHING;
    UPDATE "${schema}".lead_priorities SET is_default = true WHERE name = 'None';

    -- ============================================================
    -- LEAD QUALIFICATION FRAMEWORKS
    -- ============================================================
    CREATE TABLE IF NOT EXISTS "${schema}".lead_qualification_frameworks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      is_active BOOLEAN DEFAULT false,
      is_system BOOLEAN DEFAULT false,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    INSERT INTO "${schema}".lead_qualification_frameworks (name, slug, description, is_active, is_system, sort_order) VALUES
      ('BANT',  'bant',  'Budget, Authority, Need, Timeline', true,  true, 1),
      ('CHAMP', 'champ', 'Challenges, Authority, Money, Prioritization', false, true, 2)
    ON CONFLICT (slug) DO NOTHING;

    -- ============================================================
    -- LEAD QUALIFICATION FIELDS
    -- ============================================================
    CREATE TABLE IF NOT EXISTS "${schema}".lead_qualification_fields (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      framework_id UUID NOT NULL REFERENCES "${schema}".lead_qualification_frameworks(id) ON DELETE CASCADE,
      field_key VARCHAR(100) NOT NULL,
      field_label VARCHAR(200) NOT NULL,
      field_type VARCHAR(50) NOT NULL DEFAULT 'select',
      field_options JSONB DEFAULT '[]',
      description TEXT,
      score_weight INT DEFAULT 0,
      sort_order INT DEFAULT 0,
      is_required BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(framework_id, field_key)
    );

    -- BANT fields
    INSERT INTO "${schema}".lead_qualification_fields (framework_id, field_key, field_label, field_type, field_options, score_weight, sort_order, is_required)
    SELECT f.id, v.fk, v.fl, v.ft, v.fo::jsonb, v.sw, v.so, true
    FROM "${schema}".lead_qualification_frameworks f,
    (VALUES
      ('budget','Budget','select','[{"label":"Confirmed","value":"confirmed"},{"label":"Estimated","value":"estimated"},{"label":"Unknown","value":"unknown"},{"label":"No Budget","value":"no_budget"}]',25,1),
      ('authority','Authority','select','[{"label":"Decision Maker","value":"decision_maker"},{"label":"Influencer","value":"influencer"},{"label":"Champion","value":"champion"},{"label":"End User","value":"end_user"},{"label":"Unknown","value":"unknown"}]',20,2),
      ('need','Need','select','[{"label":"Confirmed","value":"confirmed"},{"label":"Implied","value":"implied"},{"label":"Not Confirmed","value":"not_confirmed"}]',15,3),
      ('timeline','Timeline','select','[{"label":"Immediate","value":"immediate"},{"label":"Short-term (1-3m)","value":"short_term"},{"label":"Medium-term (3-6m)","value":"medium_term"},{"label":"Long-term (6m+)","value":"long_term"},{"label":"No Timeline","value":"none"}]',15,4)
    ) AS v(fk,fl,ft,fo,sw,so)
    WHERE f.slug = 'bant'
    ON CONFLICT (framework_id, field_key) DO NOTHING;

    -- CHAMP fields
    INSERT INTO "${schema}".lead_qualification_fields (framework_id, field_key, field_label, field_type, field_options, score_weight, sort_order, is_required)
    SELECT f.id, v.fk, v.fl, v.ft, v.fo::jsonb, v.sw, v.so, true
    FROM "${schema}".lead_qualification_frameworks f,
    (VALUES
      ('challenges','Challenges','select','[{"label":"Clearly Identified","value":"identified"},{"label":"Partially","value":"partial"},{"label":"Not Identified","value":"not_identified"}]',25,1),
      ('authority','Authority','select','[{"label":"Decision Maker","value":"decision_maker"},{"label":"Influencer","value":"influencer"},{"label":"Champion","value":"champion"},{"label":"Unknown","value":"unknown"}]',20,2),
      ('money','Money','select','[{"label":"Budget Approved","value":"approved"},{"label":"Available","value":"available"},{"label":"Required","value":"required"},{"label":"No Budget","value":"no_budget"}]',20,3),
      ('prioritization','Prioritization','select','[{"label":"Top Priority","value":"top"},{"label":"High","value":"high"},{"label":"Medium","value":"medium"},{"label":"Low","value":"low"}]',15,4)
    ) AS v(fk,fl,ft,fo,sw,so)
    WHERE f.slug = 'champ'
    ON CONFLICT (framework_id, field_key) DO NOTHING;

    -- ============================================================
    -- LEAD SCORING TEMPLATES & RULES
    -- ============================================================
    CREATE TABLE IF NOT EXISTS "${schema}".lead_scoring_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      max_score INT DEFAULT 100,
      is_active BOOLEAN DEFAULT true,
      is_default BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    INSERT INTO "${schema}".lead_scoring_templates (name, description, max_score, is_active, is_default) VALUES
      ('Default Scoring', 'Standard lead scoring based on demographics and qualification', 100, true, true)
    ON CONFLICT DO NOTHING;

    CREATE TABLE IF NOT EXISTS "${schema}".lead_scoring_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      template_id UUID NOT NULL REFERENCES "${schema}".lead_scoring_templates(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(50) NOT NULL DEFAULT 'demographic',
      type VARCHAR(50) NOT NULL DEFAULT 'field_match',
      field_key VARCHAR(200) NOT NULL,
      operator VARCHAR(30) NOT NULL DEFAULT 'equals',
      value JSONB NOT NULL DEFAULT '""',
      score_delta INT NOT NULL DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_lead_scoring_rules_template ON "${schema}".lead_scoring_rules(template_id);

    -- ============================================================
    -- LEAD ROUTING RULES
    -- ============================================================
    CREATE TABLE IF NOT EXISTS "${schema}".lead_routing_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      priority INT DEFAULT 0,
      conditions JSONB NOT NULL DEFAULT '[]',
      assignment_type VARCHAR(50) NOT NULL DEFAULT 'round_robin',
      assigned_to JSONB DEFAULT '[]',
      round_robin_index INT DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- ============================================================
    -- LEAD AUTOMATION RULES
    -- ============================================================
    CREATE TABLE IF NOT EXISTS "${schema}".lead_automation_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      trigger_event VARCHAR(50) NOT NULL,
      conditions JSONB DEFAULT '[]',
      actions JSONB DEFAULT '[]',
      is_active BOOLEAN DEFAULT true,
      run_count INT DEFAULT 0,
      last_run_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- ============================================================
    -- LEAD DISQUALIFICATION REASONS
    -- ============================================================
    CREATE TABLE IF NOT EXISTS "${schema}".lead_disqualification_reasons (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(200) NOT NULL,
      description TEXT,
      is_system BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    INSERT INTO "${schema}".lead_disqualification_reasons (name, is_system, sort_order) VALUES
      ('No Budget',true,1),('No Authority',true,2),('No Need',true,3),('No Timeline',true,4),
      ('Competitor Chosen',true,5),('Invalid / Spam',true,6),('Duplicate',true,7),('Unresponsive',true,8),('Other',true,9)
    ON CONFLICT DO NOTHING;

    -- ============================================================
    -- LEAD SOURCES
    -- ============================================================
    CREATE TABLE IF NOT EXISTS "${schema}".lead_sources (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(200) NOT NULL,
      description TEXT,
      is_system BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    INSERT INTO "${schema}".lead_sources (name, is_system, sort_order) VALUES
      ('Website',true,1),('Referral',true,2),('LinkedIn',true,3),('Cold Call',true,4),('Email Campaign',true,5),
      ('Trade Show',true,6),('Partner',true,7),('Social Media',true,8),('Advertising',true,9),('Inbound Call',true,10),('Other',true,11)
    ON CONFLICT DO NOTHING;

    -- ============================================================
    -- LEAD SETTINGS
    -- ============================================================
    CREATE TABLE IF NOT EXISTS "${schema}".lead_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      setting_key VARCHAR(100) NOT NULL UNIQUE,
      setting_value JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    INSERT INTO "${schema}".lead_settings (setting_key, setting_value) VALUES
      ('general', '{"defaultStatus":"new","defaultPriority":"none","autoScoring":true,"autoPriorityFromScore":true,"activeQualificationFramework":"bant"}'),
      ('conversion', '{"makeReadOnly":true,"allowNotes":true,"allowActivities":true,"allowFieldEdit":false,"showConversionLinks":true,"copyActivities":true,"copyNotes":true,"copyDocuments":true}'),
      ('stages', '{"lockPreviousStages":false,"showUpcomingStages":true,"requireUnlockReason":false}'),
      ('duplicateDetection', '{"enabled":true,"checkLeads":true,"checkContacts":true,"checkAccounts":true,"exactEmailMatch":"block","exactPhoneMatch":"block","fuzzyNameMatch":"warn","fuzzyNameThreshold":85,"similarDomain":"warn","showDuplicatePanel":true}'),
      ('ownership', '{"addPreviousOwnerToTeam":true,"previousOwnerRole":"Lead Generator","previousOwnerAccess":"read","notifyPreviousOwner":false,"notifyNewOwner":true}')
    ON CONFLICT (setting_key) DO NOTHING;

    -- ============================================================
    -- LEADS TABLE
    -- ============================================================
    CREATE TABLE IF NOT EXISTS "${schema}".leads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      first_name VARCHAR(100),
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255),
      phone VARCHAR(50),
      mobile VARCHAR(50),
      company VARCHAR(255),
      job_title VARCHAR(255),
      website VARCHAR(500),
      address_line1 VARCHAR(255), address_line2 VARCHAR(255),
      city VARCHAR(100), state VARCHAR(100), postal_code VARCHAR(20), country VARCHAR(100),
      emails JSONB DEFAULT '[]', phones JSONB DEFAULT '[]', addresses JSONB DEFAULT '[]',
      social_profiles JSONB DEFAULT '{}',
      source VARCHAR(100), source_details JSONB DEFAULT '{}',
      stage_id UUID REFERENCES "${schema}".lead_stages(id) ON DELETE SET NULL,
      priority_id UUID REFERENCES "${schema}".lead_priorities(id) ON DELETE SET NULL,
      score INT DEFAULT 0, score_breakdown JSONB DEFAULT '{}',
      qualification JSONB DEFAULT '{}',
      qualification_framework_id UUID REFERENCES "${schema}".lead_qualification_frameworks(id) ON DELETE SET NULL,
      converted_at TIMESTAMPTZ, converted_by UUID REFERENCES "${schema}".users(id),
      converted_contact_id UUID, converted_account_id UUID, converted_opportunity_id UUID,
      conversion_notes TEXT,
      disqualified_at TIMESTAMPTZ, disqualified_by UUID REFERENCES "${schema}".users(id),
      disqualification_reason_id UUID REFERENCES "${schema}".lead_disqualification_reasons(id) ON DELETE SET NULL,
      disqualification_notes TEXT,
      stage_entered_at TIMESTAMPTZ DEFAULT NOW(), stage_history JSONB DEFAULT '[]',
      do_not_contact BOOLEAN DEFAULT false, do_not_email BOOLEAN DEFAULT false, do_not_call BOOLEAN DEFAULT false,
      tags TEXT[] DEFAULT '{}', custom_fields JSONB DEFAULT '{}',
      owner_id UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
      created_by UUID REFERENCES "${schema}".users(id),
      updated_by UUID REFERENCES "${schema}".users(id),
      last_activity_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), deleted_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_leads_email ON "${schema}".leads(email);
    CREATE INDEX IF NOT EXISTS idx_leads_phone ON "${schema}".leads(phone);
    CREATE INDEX IF NOT EXISTS idx_leads_company ON "${schema}".leads(company);
    CREATE INDEX IF NOT EXISTS idx_leads_stage ON "${schema}".leads(stage_id);
    CREATE INDEX IF NOT EXISTS idx_leads_priority ON "${schema}".leads(priority_id);
    CREATE INDEX IF NOT EXISTS idx_leads_source ON "${schema}".leads(source);
    CREATE INDEX IF NOT EXISTS idx_leads_score ON "${schema}".leads(score);
    CREATE INDEX IF NOT EXISTS idx_leads_owner ON "${schema}".leads(owner_id);
    CREATE INDEX IF NOT EXISTS idx_leads_created_by ON "${schema}".leads(created_by);
    CREATE INDEX IF NOT EXISTS idx_leads_deleted ON "${schema}".leads(deleted_at);
  `;
}

function buildOpportunitiesMigration(schema: string): string {
  return `
    -- ============================================================
    -- OPPORTUNITY PRIORITIES
    -- ============================================================
    CREATE TABLE IF NOT EXISTS "${schema}".opportunity_priorities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      color VARCHAR(20) DEFAULT '#9CA3AF',
      icon VARCHAR(50),
      sort_order INT DEFAULT 0,
      is_default BOOLEAN DEFAULT false,
      is_system BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    INSERT INTO "${schema}".opportunity_priorities (name, color, icon, sort_order, is_default, is_system) VALUES
      ('Critical',  '#EF4444', 'flame',       1, false, true),
      ('High',      '#F97316', 'thermometer', 2, false, true),
      ('Medium',    '#F59E0B', 'sun',         3, true,  true),
      ('Low',       '#3B82F6', 'snowflake',   4, false, true)
    ON CONFLICT DO NOTHING;

    -- ============================================================
    -- OPPORTUNITY CLOSE REASONS (admin-configurable)
    -- ============================================================
    CREATE TABLE IF NOT EXISTS "${schema}".opportunity_close_reasons (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type VARCHAR(10) NOT NULL,
      name VARCHAR(200) NOT NULL,
      description TEXT,
      sort_order INT DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      is_system BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(type, name)
    );

    INSERT INTO "${schema}".opportunity_close_reasons (type, name, sort_order, is_system) VALUES
      ('won', 'Product Fit',             1, true),
      ('won', 'Price Competitive',       2, true),
      ('won', 'Relationship/Trust',      3, true),
      ('won', 'Implementation Timeline', 4, true),
      ('won', 'Customer References',     5, true),
      ('won', 'Superior Support',        6, true),
      ('won', 'Other',                   99, true)
    ON CONFLICT DO NOTHING;

    INSERT INTO "${schema}".opportunity_close_reasons (type, name, sort_order, is_system) VALUES
      ('lost', 'Price Too High',         1, true),
      ('lost', 'Feature Gap',            2, true),
      ('lost', 'Lost to Competitor',     3, true),
      ('lost', 'No Decision / Stalled',  4, true),
      ('lost', 'Budget Cut',             5, true),
      ('lost', 'Timeline Mismatch',      6, true),
      ('lost', 'Went Dark',              7, true),
      ('lost', 'Internal Solution',      8, true),
      ('lost', 'Other',                  99, true)
    ON CONFLICT DO NOTHING;

    -- ============================================================
    -- OPPORTUNITIES TABLE
    -- ============================================================
    CREATE TABLE IF NOT EXISTS "${schema}".opportunities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(500) NOT NULL,
      pipeline_id UUID REFERENCES "${schema}".pipelines(id) ON DELETE SET NULL,
      stage_id UUID REFERENCES "${schema}".pipeline_stages(id) ON DELETE SET NULL,
      amount DECIMAL(15,2),
      currency VARCHAR(3) DEFAULT 'USD',
      close_date DATE,
      probability INT,
      weighted_amount DECIMAL(15,2) GENERATED ALWAYS AS (amount * probability / 100) STORED,
      forecast_category VARCHAR(50),
      owner_id UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
      account_id UUID,
      primary_contact_id UUID,
      priority_id UUID REFERENCES "${schema}".opportunity_priorities(id) ON DELETE SET NULL,
      type VARCHAR(50),
      source VARCHAR(100),
      lead_id UUID,
      close_reason_id UUID REFERENCES "${schema}".opportunity_close_reasons(id) ON DELETE SET NULL,
      close_notes TEXT,
      competitor VARCHAR(255),
      next_step TEXT,
      description TEXT,
      tags TEXT[] DEFAULT '{}',
      custom_fields JSONB DEFAULT '{}',
      stage_entered_at TIMESTAMPTZ DEFAULT NOW(),
      last_activity_at TIMESTAMPTZ,
      won_at TIMESTAMPTZ,
      lost_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      created_by UUID REFERENCES "${schema}".users(id),
      updated_by UUID REFERENCES "${schema}".users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_opportunities_pipeline ON "${schema}".opportunities(pipeline_id) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON "${schema}".opportunities(stage_id) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_opportunities_owner ON "${schema}".opportunities(owner_id) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_opportunities_account ON "${schema}".opportunities(account_id) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_opportunities_priority ON "${schema}".opportunities(priority_id) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_opportunities_close_date ON "${schema}".opportunities(close_date) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_opportunities_created ON "${schema}".opportunities(created_at DESC) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_opportunities_amount ON "${schema}".opportunities(amount) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_opportunities_deleted ON "${schema}".opportunities(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_opportunities_search ON "${schema}".opportunities USING gin(to_tsvector('english', name));

    -- ============================================================
    -- OPPORTUNITY STAGE HISTORY
    -- ============================================================
    CREATE TABLE IF NOT EXISTS "${schema}".opportunity_stage_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      opportunity_id UUID NOT NULL REFERENCES "${schema}".opportunities(id) ON DELETE CASCADE,
      from_stage_id UUID REFERENCES "${schema}".pipeline_stages(id),
      to_stage_id UUID NOT NULL REFERENCES "${schema}".pipeline_stages(id),
      changed_by UUID REFERENCES "${schema}".users(id),
      time_in_stage INTERVAL,
      note TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_opp_stage_history_opp ON "${schema}".opportunity_stage_history(opportunity_id);
    CREATE INDEX IF NOT EXISTS idx_opp_stage_history_date ON "${schema}".opportunity_stage_history(created_at DESC);

    -- ============================================================
    -- OPPORTUNITY CONTACTS (Contact Roles)
    -- ============================================================
    CREATE TABLE IF NOT EXISTS "${schema}".opportunity_contacts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      opportunity_id UUID NOT NULL REFERENCES "${schema}".opportunities(id) ON DELETE CASCADE,
      contact_id UUID NOT NULL,
      role VARCHAR(100) NOT NULL,
      is_primary BOOLEAN DEFAULT false,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(opportunity_id, contact_id)
    );

    CREATE INDEX IF NOT EXISTS idx_opp_contacts_opp ON "${schema}".opportunity_contacts(opportunity_id);
    CREATE INDEX IF NOT EXISTS idx_opp_contacts_contact ON "${schema}".opportunity_contacts(contact_id);

    -- ============================================================
    -- ADD FKs
    -- ============================================================
    DO $do$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_opp_account' AND table_schema = '${schema}'
      ) THEN
        ALTER TABLE "${schema}".opportunities
          ADD CONSTRAINT fk_opp_account
          FOREIGN KEY (account_id) REFERENCES "${schema}".accounts(id) ON DELETE SET NULL;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_opp_contact' AND table_schema = '${schema}'
      ) THEN
        ALTER TABLE "${schema}".opportunities
          ADD CONSTRAINT fk_opp_contact
          FOREIGN KEY (primary_contact_id) REFERENCES "${schema}".contacts(id) ON DELETE SET NULL;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_opp_lead' AND table_schema = '${schema}'
      ) THEN
        ALTER TABLE "${schema}".opportunities
          ADD CONSTRAINT fk_opp_lead
          FOREIGN KEY (lead_id) REFERENCES "${schema}".leads(id) ON DELETE SET NULL;
      END IF;

      -- FK on existing opportunity_line_items
      IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_schema = '${schema}' AND table_name = 'opportunity_line_items'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_oli_opportunity' AND table_schema = '${schema}'
      ) THEN
        ALTER TABLE "${schema}".opportunity_line_items
          ADD CONSTRAINT fk_oli_opportunity
          FOREIGN KEY (opportunity_id) REFERENCES "${schema}".opportunities(id) ON DELETE CASCADE;
      END IF;
    END $do$;

    -- ============================================================
    -- PROFILE COMPLETION CONFIG
    -- ============================================================
    INSERT INTO "${schema}".profile_completion_config (module, field_weights)
    SELECT 'opportunities', '{
      "name": {"weight": 10, "label": "Opportunity Name", "category": "basic"},
      "account_id": {"weight": 15, "label": "Account", "category": "basic"},
      "primary_contact_id": {"weight": 10, "label": "Primary Contact", "category": "basic"},
      "amount": {"weight": 15, "label": "Amount", "category": "basic"},
      "close_date": {"weight": 15, "label": "Close Date", "category": "basic"},
      "type": {"weight": 8, "label": "Type", "category": "basic"},
      "source": {"weight": 8, "label": "Source", "category": "basic"},
      "description": {"weight": 10, "label": "Description", "category": "other"},
      "next_step": {"weight": 9, "label": "Next Step", "category": "other"}
    }'::jsonb
    WHERE NOT EXISTS (
      SELECT 1 FROM "${schema}".profile_completion_config WHERE module = 'opportunities'
    );

    -- Grant privileges
    GRANT ALL ON ALL TABLES IN SCHEMA "${schema}" TO intelli_hiper_app;
  `;
}

function buildOpportunitySettingsMigration(schema: string): string {
  return `
    -- opportunity_types
    CREATE TABLE IF NOT EXISTS "${schema}".opportunity_types (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        VARCHAR(100) NOT NULL,
      slug        VARCHAR(100) NOT NULL,
      description TEXT,
      color       VARCHAR(20) DEFAULT '#6B7280',
      sort_order  INT DEFAULT 0,
      is_default  BOOLEAN DEFAULT false,
      is_system   BOOLEAN DEFAULT false,
      is_active   BOOLEAN DEFAULT true,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );

    INSERT INTO "${schema}".opportunity_types (name, slug, color, sort_order, is_system) VALUES
      ('New Business', 'new_business', '#3B82F6', 1, true),
      ('Renewal',      'renewal',      '#10B981', 2, true),
      ('Upsell',       'upsell',       '#F59E0B', 3, true),
      ('Cross Sell',   'cross_sell',   '#8B5CF6', 4, true)
    ON CONFLICT DO NOTHING;

    -- opportunity_forecast_categories
    CREATE TABLE IF NOT EXISTS "${schema}".opportunity_forecast_categories (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name              VARCHAR(100) NOT NULL,
      slug              VARCHAR(100) NOT NULL,
      description       TEXT,
      color             VARCHAR(20) DEFAULT '#6B7280',
      probability_min   INT DEFAULT 0,
      probability_max   INT DEFAULT 100,
      sort_order        INT DEFAULT 0,
      is_system         BOOLEAN DEFAULT false,
      is_active         BOOLEAN DEFAULT true,
      created_at        TIMESTAMPTZ DEFAULT NOW(),
      updated_at        TIMESTAMPTZ DEFAULT NOW()
    );

    INSERT INTO "${schema}".opportunity_forecast_categories (name, slug, color, probability_min, probability_max, sort_order, is_system) VALUES
      ('Pipeline',   'pipeline',   '#6B7280', 0,  25,  1, true),
      ('Best Case',  'best_case',  '#F59E0B', 26, 50,  2, true),
      ('Commit',     'commit',     '#3B82F6', 51, 80,  3, true),
      ('Closed',     'closed',     '#10B981', 81, 100, 4, true),
      ('Omitted',    'omitted',    '#EF4444', 0,  0,   5, true)
    ON CONFLICT DO NOTHING;

    -- Add competitor column if missing
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = '${schema}' AND table_name = 'opportunities' AND column_name = 'competitor'
      ) THEN
        ALTER TABLE "${schema}".opportunities ADD COLUMN competitor VARCHAR(255);
      END IF;
    END $$;

    -- Grant privileges
    GRANT ALL ON ALL TABLES IN SCHEMA "${schema}" TO intelli_hiper_app;
  `;
}

function buildLineItemBundleSupportMigration(schema: string): string {
  return `
    -- Add bundle tracking columns to opportunity_line_items
    ALTER TABLE "${schema}".opportunity_line_items
      ADD COLUMN IF NOT EXISTS parent_line_item_id UUID
        REFERENCES "${schema}".opportunity_line_items(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS line_item_type VARCHAR(20) DEFAULT 'standard',
      ADD COLUMN IF NOT EXISTS is_optional BOOLEAN DEFAULT false;

    CREATE INDEX IF NOT EXISTS idx_oli_parent
      ON "${schema}".opportunity_line_items(parent_line_item_id)
      WHERE parent_line_item_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_oli_type
      ON "${schema}".opportunity_line_items(line_item_type);

    -- Grant privileges
    GRANT ALL ON ALL TABLES IN SCHEMA "${schema}" TO intelli_hiper_app;
  `;
}

function buildOpportunitiesRolesMigration(schema: string): string {
  return `
    -- Add opportunities permissions to existing system roles
    -- Uses jsonb_set to inject into existing permissions without overwriting other modules

    -- Admin: full access, record_access = all
    UPDATE "${schema}".roles SET
      permissions = permissions || '{"opportunities": {"view": true, "create": true, "edit": true, "delete": true, "export": true, "import": true}}'::jsonb,
      record_access = record_access || '{"opportunities": "all"}'::jsonb,
      updated_at = NOW()
    WHERE name = 'admin' AND is_system = true
      AND NOT (permissions ? 'opportunities');

    -- Manager: team access
    UPDATE "${schema}".roles SET
      permissions = permissions || '{"opportunities": {"view": true, "create": true, "edit": true, "delete": true, "export": true, "import": false}}'::jsonb,
      record_access = record_access || '{"opportunities": "team"}'::jsonb,
      updated_at = NOW()
    WHERE name = 'manager' AND is_system = true
      AND NOT (permissions ? 'opportunities');

    -- User: own access
    UPDATE "${schema}".roles SET
      permissions = permissions || '{"opportunities": {"view": true, "create": true, "edit": true, "delete": false, "export": false, "import": false}}'::jsonb,
      record_access = record_access || '{"opportunities": "own"}'::jsonb,
      updated_at = NOW()
    WHERE name = 'user' AND is_system = true
      AND NOT (permissions ? 'opportunities');
  `;
}

runTenantMigrations();