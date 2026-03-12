import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load .env from apps/api/.env first, then project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { DataSource } from 'typeorm';
//import { SqlInMemory } from 'typeorm/driver/SqlInMemory';

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
            schemaSql = schemaSql.replace(/${schema}/g, schema);
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
            name: '013_lead_sla',
            sql: `
              -- Add SLA tracking columns to leads table
              ALTER TABLE "${schema}".leads
                ADD COLUMN IF NOT EXISTS sla_first_contact_due_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS sla_first_contact_met_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS sla_breached BOOLEAN DEFAULT false,
                ADD COLUMN IF NOT EXISTS sla_breached_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS sla_escalated BOOLEAN DEFAULT false,
                ADD COLUMN IF NOT EXISTS sla_escalated_at TIMESTAMPTZ;

              -- Index for breach detection queries (find leads where SLA is due but not met)
              CREATE INDEX IF NOT EXISTS idx_leads_sla_due
                ON "${schema}".leads(sla_first_contact_due_at)
                WHERE sla_first_contact_met_at IS NULL
                  AND sla_breached = false
                  AND deleted_at IS NULL;

              -- Index for SLA dashboard/reporting
              CREATE INDEX IF NOT EXISTS idx_leads_sla_breached
                ON "${schema}".leads(sla_breached)
                WHERE sla_breached = true AND deleted_at IS NULL;

              -- Seed default SLA settings (if not already present)
              INSERT INTO "${schema}".lead_settings (setting_key, setting_value)
              VALUES (
                'sla',
                '${JSON.stringify({
                  enabled: false,
                  firstContactHours: 4,
                  workingHoursStart: "09:00",
                  workingHoursEnd: "18:00",
                  workingDays: [1, 2, 3, 4, 5],
                  timezone: "UTC",
                  breachNotifyOwner: true,
                  breachNotifyManager: true,
                  escalationEnabled: true,
                  escalationHours: 8,
                  escalationNotifyManager: true,
                  escalationNotifyAdmin: false,
                  excludeWeekends: true
                })}'
              )
              ON CONFLICT (setting_key) DO NOTHING;

              -- Grant privileges
              GRANT ALL ON ALL TABLES IN SCHEMA "${schema}" TO intelli_hiper_app;
            `
          },
          {
            name: '014_tasks',
            sql: `-- ============================================================
              -- MIGRATION: 014_tasks
              -- Full Tasks module: types, statuses, priorities, tasks, subtasks,
              -- recurring config, entity linking
              -- ============================================================

              -- ────────────────────────────────────────────────────────────
              -- TASK TYPES (admin-configurable)
              -- ────────────────────────────────────────────────────────────
              CREATE TABLE IF NOT EXISTS "${schema}".task_types (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(100) NOT NULL,
                slug VARCHAR(100) NOT NULL,
                icon VARCHAR(50) DEFAULT 'check-square',
                color VARCHAR(20) DEFAULT '#3B82F6',
                description TEXT,
                default_duration_minutes INT,
                is_system BOOLEAN DEFAULT false,
                is_active BOOLEAN DEFAULT true,
                sort_order INT DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(slug)
              );

              INSERT INTO "${schema}".task_types (name, slug, icon, color, is_system, sort_order) VALUES
                ('To-Do',    'todo',    'check-square', '#3B82F6', true, 1),
                ('Call',     'call',    'phone',        '#10B981', true, 2),
                ('Email',    'email',   'mail',         '#F59E0B', true, 3),
                ('Meeting',  'meeting', 'calendar',     '#8B5CF6', true, 4),
                ('Follow-Up','follow-up','arrow-right', '#EC4899', true, 5),
                ('Demo',     'demo',    'monitor',      '#06B6D4', true, 6),
                ('Proposal', 'proposal','file-text',    '#F97316', true, 7),
                ('Onboarding','onboarding','users',     '#14B8A6', true, 8)
              ON CONFLICT (slug) DO NOTHING;

              -- ────────────────────────────────────────────────────────────
              -- TASK STATUSES (admin-configurable)
              -- ────────────────────────────────────────────────────────────
              CREATE TABLE IF NOT EXISTS "${schema}".task_statuses (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(100) NOT NULL,
                slug VARCHAR(100) NOT NULL,
                color VARCHAR(20) DEFAULT '#6B7280',
                icon VARCHAR(50),
                is_open BOOLEAN DEFAULT true,
                is_completed BOOLEAN DEFAULT false,
                is_system BOOLEAN DEFAULT false,
                is_active BOOLEAN DEFAULT true,
                sort_order INT DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(slug)
              );

              INSERT INTO "${schema}".task_statuses (name, slug, color, is_open, is_completed, is_system, sort_order) VALUES
                ('Not Started', 'not_started', '#9CA3AF', true,  false, true, 1),
                ('In Progress', 'in_progress', '#3B82F6', true,  false, true, 2),
                ('Waiting',     'waiting',     '#F59E0B', true,  false, true, 3),
                ('Deferred',    'deferred',    '#6B7280', true,  false, true, 4),
                ('Completed',   'completed',   '#10B981', false, true,  true, 5),
                ('Cancelled',   'cancelled',   '#EF4444', false, false, true, 6)
              ON CONFLICT (slug) DO NOTHING;

              -- ────────────────────────────────────────────────────────────
              -- TASK PRIORITIES
              -- ────────────────────────────────────────────────────────────
              CREATE TABLE IF NOT EXISTS "${schema}".task_priorities (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(100) NOT NULL,
                slug VARCHAR(100) NOT NULL,
                color VARCHAR(20) DEFAULT '#6B7280',
                icon VARCHAR(50),
                level INT DEFAULT 0,
                is_default BOOLEAN DEFAULT false,
                is_system BOOLEAN DEFAULT false,
                is_active BOOLEAN DEFAULT true,
                sort_order INT DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(slug)
              );

              INSERT INTO "${schema}".task_priorities (name, slug, color, icon, level, is_default, is_system, sort_order) VALUES
                ('Urgent', 'urgent', '#EF4444', 'alert-circle', 4, false, true, 1),
                ('High',   'high',   '#F59E0B', 'arrow-up',     3, false, true, 2),
                ('Medium', 'medium', '#3B82F6', 'minus',         2, true,  true, 3),
                ('Low',    'low',    '#10B981', 'arrow-down',    1, false, true, 4)
              ON CONFLICT (slug) DO NOTHING;

              -- ────────────────────────────────────────────────────────────
              -- TASKS TABLE (main)
              -- ────────────────────────────────────────────────────────────
              CREATE TABLE IF NOT EXISTS "${schema}".tasks (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

                -- Core fields
                title VARCHAR(500) NOT NULL,
                description TEXT,
                task_type_id UUID REFERENCES "${schema}".task_types(id) ON DELETE SET NULL,
                status_id UUID REFERENCES "${schema}".task_statuses(id) ON DELETE SET NULL,
                priority_id UUID REFERENCES "${schema}".task_priorities(id) ON DELETE SET NULL,

                -- Dates
                due_date TIMESTAMPTZ,
                start_date TIMESTAMPTZ,
                completed_at TIMESTAMPTZ,
                reminder_at TIMESTAMPTZ,

                -- Duration
                estimated_minutes INT,
                actual_minutes INT,

                -- Assignment
                owner_id UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
                assigned_to UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,

                -- Entity linking (polymorphic)
                related_entity_type VARCHAR(50),   -- 'leads', 'contacts', 'accounts', 'opportunities'
                related_entity_id UUID,

                -- Subtasks (parent-child)
                parent_task_id UUID REFERENCES "${schema}".tasks(id) ON DELETE CASCADE,

                -- Recurring
                is_recurring BOOLEAN DEFAULT false,
                recurrence_rule JSONB,
                -- recurrence_rule example:
                -- { "frequency": "weekly", "interval": 1, "daysOfWeek": [1,3,5],
                --   "endType": "never"|"after"|"on", "endAfterCount": 10, "endDate": "2026-12-31" }
                recurrence_parent_id UUID REFERENCES "${schema}".tasks(id) ON DELETE SET NULL,
                recurrence_index INT,

                -- Metadata
                tags TEXT[] DEFAULT '{}',
                custom_fields JSONB DEFAULT '{}',
                result TEXT,  -- outcome/notes after completion

                -- Audit
                created_by UUID REFERENCES "${schema}".users(id),
                updated_by UUID,
                deleted_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
              );

              -- Indexes
              CREATE INDEX IF NOT EXISTS idx_tasks_owner ON "${schema}".tasks(owner_id) WHERE deleted_at IS NULL;
              CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON "${schema}".tasks(assigned_to) WHERE deleted_at IS NULL;
              CREATE INDEX IF NOT EXISTS idx_tasks_status ON "${schema}".tasks(status_id) WHERE deleted_at IS NULL;
              CREATE INDEX IF NOT EXISTS idx_tasks_type ON "${schema}".tasks(task_type_id) WHERE deleted_at IS NULL;
              CREATE INDEX IF NOT EXISTS idx_tasks_priority ON "${schema}".tasks(priority_id) WHERE deleted_at IS NULL;
              CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON "${schema}".tasks(due_date) WHERE deleted_at IS NULL AND completed_at IS NULL;
              CREATE INDEX IF NOT EXISTS idx_tasks_entity ON "${schema}".tasks(related_entity_type, related_entity_id) WHERE deleted_at IS NULL;
              CREATE INDEX IF NOT EXISTS idx_tasks_parent ON "${schema}".tasks(parent_task_id) WHERE deleted_at IS NULL;
              CREATE INDEX IF NOT EXISTS idx_tasks_recurring_parent ON "${schema}".tasks(recurrence_parent_id) WHERE deleted_at IS NULL;
              CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON "${schema}".tasks(deleted_at);

              -- ────────────────────────────────────────────────────────────
              -- TASK SETTINGS (key-value config)
              -- ────────────────────────────────────────────────────────────
              CREATE TABLE IF NOT EXISTS "${schema}".task_settings (
                setting_key VARCHAR(100) PRIMARY KEY,
                setting_value JSONB DEFAULT '{}',
                updated_at TIMESTAMPTZ DEFAULT NOW()
              );

              INSERT INTO "${schema}".task_settings (setting_key, setting_value) VALUES
                ('general', '{"defaultTaskType":"todo","defaultPriority":"medium","autoAssignToCreator":true,"requireDueDate":false,"allowSubtasks":true,"maxSubtaskDepth":2}'),
                ('reminders', '{"enabled":true,"defaultReminderMinutes":30,"options":[5,10,15,30,60,120,1440]}'),
                ('recurring', '{"enabled":true,"maxRecurrenceCount":365,"allowedFrequencies":["daily","weekly","biweekly","monthly","quarterly","yearly"]}'),
                ('kanban', '{"groupBy":"status","showSubtasks":true,"cardFields":["dueDate","priority","assignee","entityLink"]}')
              ON CONFLICT (setting_key) DO NOTHING;

              -- ────────────────────────────────────────────────────────────
              -- GRANT PRIVILEGES
              -- ────────────────────────────────────────────────────────────
              GRANT ALL ON ALL TABLES IN SCHEMA "${schema}" TO intelli_hiper_app;`
          },
          {
            name: '015_notifications',
            sql: buildNotificationsMigration(schema),
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
          {
            name: '013_calendar_sync',
            sql: `
              -- ============================================================
              -- CALENDAR CONNECTIONS (per-user OAuth tokens)
              -- ============================================================
              CREATE TABLE IF NOT EXISTS "${schema}".calendar_connections (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES "${schema}".users(id) ON DELETE CASCADE,
                provider VARCHAR(20) NOT NULL DEFAULT 'google',
                email VARCHAR(255),
                access_token TEXT NOT NULL,
                refresh_token TEXT,
                token_expires_at TIMESTAMPTZ,
                calendar_id VARCHAR(255) DEFAULT 'primary',
                sync_token TEXT,
                sync_direction VARCHAR(20) DEFAULT 'two_way',
                last_synced_at TIMESTAMPTZ,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(user_id, provider)
              );

              CREATE INDEX IF NOT EXISTS idx_calendar_conn_user
                ON "${schema}".calendar_connections(user_id);
              CREATE INDEX IF NOT EXISTS idx_calendar_conn_active
                ON "${schema}".calendar_connections(user_id, is_active) WHERE is_active = true;

              -- ============================================================
              -- CALENDAR EVENTS (sync mapping table)
              -- ============================================================
              CREATE TABLE IF NOT EXISTS "${schema}".calendar_events (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES "${schema}".users(id) ON DELETE CASCADE,
                connection_id UUID NOT NULL REFERENCES "${schema}".calendar_connections(id) ON DELETE CASCADE,
                provider_event_id VARCHAR(512) NOT NULL,
                task_id UUID REFERENCES "${schema}".tasks(id) ON DELETE SET NULL,
                title VARCHAR(500),
                description TEXT,
                start_time TIMESTAMPTZ,
                end_time TIMESTAMPTZ,
                all_day BOOLEAN DEFAULT false,
                location VARCHAR(500),
                status VARCHAR(50) DEFAULT 'confirmed',
                source VARCHAR(20) NOT NULL DEFAULT 'google',
                raw_data JSONB,
                last_synced_at TIMESTAMPTZ DEFAULT NOW(),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(connection_id, provider_event_id)
              );

              CREATE INDEX IF NOT EXISTS idx_calendar_events_user
                ON "${schema}".calendar_events(user_id);
              CREATE INDEX IF NOT EXISTS idx_calendar_events_conn
                ON "${schema}".calendar_events(connection_id);
              CREATE INDEX IF NOT EXISTS idx_calendar_events_task
                ON "${schema}".calendar_events(task_id) WHERE task_id IS NOT NULL;
              CREATE INDEX IF NOT EXISTS idx_calendar_events_date
                ON "${schema}".calendar_events(user_id, start_time);
              CREATE INDEX IF NOT EXISTS idx_calendar_events_source
                ON "${schema}".calendar_events(connection_id, source);
            `,
          },
          {
            name: '016_lead_stage_history_and_user_activity',
            sql: `
              -- ============================================================
              -- MIGRATION 016: Dashboard Prerequisites
              -- 1. lead_stage_history (mirrors opportunity_stage_history)
              -- 2. user_activity_daily (rollup table for dashboard trending)
              -- ============================================================

              -- ============================================================
              -- LEAD STAGE HISTORY
              -- ============================================================
              CREATE TABLE IF NOT EXISTS "${schema}".lead_stage_history (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                lead_id UUID NOT NULL REFERENCES "${schema}".leads(id) ON DELETE CASCADE,
                from_stage_id UUID REFERENCES "${schema}".pipeline_stages(id),
                to_stage_id UUID NOT NULL REFERENCES "${schema}".pipeline_stages(id),
                changed_by UUID REFERENCES "${schema}".users(id),
                time_in_stage INTERVAL,
                note TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
              );

              CREATE INDEX IF NOT EXISTS idx_lead_stage_history_lead
                ON "${schema}".lead_stage_history(lead_id);
              CREATE INDEX IF NOT EXISTS idx_lead_stage_history_created
                ON "${schema}".lead_stage_history(created_at DESC);
              CREATE INDEX IF NOT EXISTS idx_lead_stage_history_changed_by
                ON "${schema}".lead_stage_history(changed_by);

              -- ============================================================
              -- USER ACTIVITY DAILY (rollup for dashboard sparklines)
              -- Populated by cron or on-demand aggregation
              -- ============================================================
              CREATE TABLE IF NOT EXISTS "${schema}".user_activity_daily (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES "${schema}".users(id) ON DELETE CASCADE,
                activity_date DATE NOT NULL,
                leads_created INT DEFAULT 0,
                leads_converted INT DEFAULT 0,
                opps_created INT DEFAULT 0,
                opps_won INT DEFAULT 0,
                opps_lost INT DEFAULT 0,
                tasks_completed INT DEFAULT 0,
                tasks_created INT DEFAULT 0,
                activities_logged INT DEFAULT 0,
                calls_made INT DEFAULT 0,
                emails_sent INT DEFAULT 0,
                meetings_held INT DEFAULT 0,
                notes_added INT DEFAULT 0,
                total_revenue_won NUMERIC(15,2) DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(user_id, activity_date)
              );

              CREATE INDEX IF NOT EXISTS idx_user_activity_daily_user_date
                ON "${schema}".user_activity_daily(user_id, activity_date DESC);
              CREATE INDEX IF NOT EXISTS idx_user_activity_daily_date
                ON "${schema}".user_activity_daily(activity_date DESC);
                `,
          },
          {
            name: '016_dashboard_prerequisites',
            sql: buildDashboardMigration(schema),
          },
          {
            name: '017_targets_gamification',
            sql: buildTargetsGamificationMigration(schema),
          },
          {
            name: '017_targets_gamification_seed_values',
            sql: buildTargetsGamificationSeedData(schema)
          },
          {
            name: '019_add_new_module_permissions',
            sql: `
              -- Grant view to all roles for new modules
              UPDATE "${schema}".roles
              SET permissions = permissions
                || '{"targets": {"view": true, "create": false, "edit": false, "delete": false}}'::jsonb
                || '{"gamification": {"view": true, "create": false, "edit": false, "delete": false}}'::jsonb
                || '{"notifications": {"view": true, "create": false, "edit": false, "delete": false}}'::jsonb
              WHERE NOT (permissions ? 'notifications');

              -- Full access for admin roles
              UPDATE "${schema}".roles
              SET permissions = permissions
                || '{"targets": {"view": true, "create": true, "edit": true, "delete": true}}'::jsonb
                || '{"gamification": {"view": true, "create": true, "edit": true, "delete": true}}'::jsonb
                || '{"notifications": {"view": true, "create": true, "edit": true, "delete": true}}'::jsonb
              WHERE name IN ('Super Admin', 'Admin', 'super_admin', 'admin')
                OR level >= 90;
            `,
          },
          {
            name: '005_audit_metadata',
            sql: `
              ALTER TABLE "${schema}".audit_logs
                ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;

              -- Rename old_values → previous_values if needed
              DO $$
              BEGIN
                IF EXISTS (
                  SELECT 1 FROM information_schema.columns
                  WHERE table_schema = '${schema}'
                  AND table_name = 'audit_logs'
                  AND column_name = 'old_values'
                ) AND NOT EXISTS (
                  SELECT 1 FROM information_schema.columns
                  WHERE table_schema = '${schema}'
                  AND table_name = 'audit_logs'
                  AND column_name = 'previous_values'
                ) THEN
                  ALTER TABLE "${schema}".audit_logs RENAME COLUMN old_values TO previous_values;
                END IF;

                IF NOT EXISTS (
                  SELECT 1 FROM information_schema.columns
                  WHERE table_schema = '${schema}'
                  AND table_name = 'audit_logs'
                  AND column_name = 'previous_values'
                ) THEN
                  ALTER TABLE "${schema}".audit_logs ADD COLUMN previous_values JSONB DEFAULT NULL;
                END IF;
              END $$;

              ALTER TABLE "${schema}".audit_logs
                ADD COLUMN IF NOT EXISTS new_values JSONB DEFAULT NULL;

              ALTER TABLE "${schema}".audit_logs
                ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

              ALTER TABLE "${schema}".audit_logs
                ADD COLUMN IF NOT EXISTS performed_by UUID;

              CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
                ON "${schema}".audit_logs(created_at DESC);

              CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by
                ON "${schema}".audit_logs(performed_by);
            `,
          },
          {
            name: '022_seed_account_forecast_reports',
            sql: `
              -- Ensure Revenue & Forecasting folder exists
              INSERT INTO "${schema}".report_folders (name, is_system)
              SELECT 'Revenue & Forecasting', true
              WHERE NOT EXISTS (
                SELECT 1 FROM "${schema}".report_folders
                WHERE name = 'Revenue & Forecasting' AND is_system = true
              );

              -- 1. Account Forecast by Account
              INSERT INTO "${schema}".reports
                (name, description, category, report_type, chart_type, data_source, config, is_system, is_public, folder_id)
              SELECT
                'Account Forecast by Account',
                'Accounts ranked by total pipeline value with forecast category breakdown for open deals in the quarter',
                'revenue', 'summary', 'table', 'opportunities',
                '{"measures":[{"field":"amount","aggregate":"sum","label":"Total Pipeline","format":"currency"},{"field":"weighted_amount","aggregate":"sum","label":"Weighted Value","format":"currency"},{"field":"id","aggregate":"count","label":"Deals","format":"number"},{"field":"probability","aggregate":"avg","label":"Avg Probability","format":"percent"}],"dimensions":[{"field":"account_name","type":"field","label":"Account"},{"field":"forecast_category","type":"field","label":"Forecast Category"}],"filters":[{"field":"won_at","operator":"is_null","value":null},{"field":"lost_at","operator":"is_null","value":null},{"field":"close_date","operator":"relative_date","value":null,"dateRelative":"next_quarter"}],"orderBy":[{"field":"amount_sum","direction":"DESC"}]}'::jsonb,
                true, true,
                (SELECT id FROM "${schema}".report_folders WHERE name = 'Revenue & Forecasting' AND is_system = true LIMIT 1)
              WHERE NOT EXISTS (
                SELECT 1 FROM "${schema}".reports WHERE name = 'Account Forecast by Account' AND is_system = true
              );

              -- 2. Account Forecast by Category
              INSERT INTO "${schema}".reports
                (name, description, category, report_type, chart_type, data_source, config, is_system, is_public, folder_id)
              SELECT
                'Account Forecast by Category',
                'Forecast category totals with account breakdown showing where next quarter revenue will come from',
                'revenue', 'summary', 'bar', 'opportunities',
                '{"measures":[{"field":"amount","aggregate":"sum","label":"Total Value","format":"currency"},{"field":"weighted_amount","aggregate":"sum","label":"Weighted","format":"currency"},{"field":"id","aggregate":"count","label":"Deals","format":"number"}],"dimensions":[{"field":"forecast_category","type":"field","label":"Category"},{"field":"account_name","type":"field","label":"Account"}],"filters":[{"field":"won_at","operator":"is_null","value":null},{"field":"lost_at","operator":"is_null","value":null},{"field":"close_date","operator":"relative_date","value":null,"dateRelative":"next_quarter"}],"orderBy":[{"field":"amount_sum","direction":"DESC"}]}'::jsonb,
                true, true,
                (SELECT id FROM "${schema}".report_folders WHERE name = 'Revenue & Forecasting' AND is_system = true LIMIT 1)
              WHERE NOT EXISTS (
                SELECT 1 FROM "${schema}".reports WHERE name = 'Account Forecast by Category' AND is_system = true
              );

              -- 3. Account Pipeline Summary
              INSERT INTO "${schema}".reports
                (name, description, category, report_type, chart_type, data_source, config, is_system, is_public, folder_id)
              SELECT
                'Account Pipeline Summary',
                'Flat account list with total deals, pipeline value, weighted amount and dominant forecast category for next quarter',
                'revenue', 'summary', 'table', 'opportunities',
                '{"measures":[{"field":"id","aggregate":"count","label":"Deals","format":"number"},{"field":"amount","aggregate":"sum","label":"Pipeline Value","format":"currency"},{"field":"weighted_amount","aggregate":"sum","label":"Weighted Value","format":"currency"},{"field":"probability","aggregate":"avg","label":"Avg Prob %","format":"percent"}],"dimensions":[{"field":"account_name","type":"field","label":"Account"}],"filters":[{"field":"won_at","operator":"is_null","value":null},{"field":"lost_at","operator":"is_null","value":null},{"field":"close_date","operator":"relative_date","value":null,"dateRelative":"next_quarter"}],"orderBy":[{"field":"amount_sum","direction":"DESC"}],"limit":50}'::jsonb,
                true, true,
                (SELECT id FROM "${schema}".report_folders WHERE name = 'Revenue & Forecasting' AND is_system = true LIMIT 1)
              WHERE NOT EXISTS (
                SELECT 1 FROM "${schema}".reports WHERE name = 'Account Pipeline Summary' AND is_system = true
              );
            `,
          },
          {
            name: '020_reports_migration',
            sql: buildReportsMigration(schema),
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
          },
          {
            name: '022_lead_import',
            sql: buildLeadImportMigration(schema),
          },
          {
            name: '023_lead_team_id',
            sql: `
              ALTER TABLE "${schema}".leads ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES "${schema}".teams(id) ON DELETE SET NULL;
              CREATE INDEX IF NOT EXISTS idx_leads_team ON "${schema}".leads(team_id);
            `,
          },
          {
            name: '024_opportunity_team_id',
            sql: `
              ALTER TABLE "${schema}".opportunities ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES "${schema}".teams(id) ON DELETE SET NULL;
              CREATE INDEX IF NOT EXISTS idx_opportunities_team ON "${schema}".opportunities(team_id) WHERE deleted_at IS NULL;
            `,
          },
          {
            name: '025_stage_ownership',
            sql: `
              -- PART 1: Add stage ownership columns to pipeline_stages
              ALTER TABLE "${schema}".pipeline_stages
                ADD COLUMN IF NOT EXISTS stage_owner_type VARCHAR(20) NOT NULL DEFAULT 'inherit';

              DO $$ BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM pg_constraint
                  WHERE conname = 'chk_stage_owner_type'
                ) THEN
                  ALTER TABLE "${schema}".pipeline_stages
                    ADD CONSTRAINT chk_stage_owner_type
                    CHECK (stage_owner_type IN ('inherit','user','team_lead','auto_assign'));
                END IF;
              END $$;

              ALTER TABLE "${schema}".pipeline_stages
                ADD COLUMN IF NOT EXISTS stage_owner_user_id UUID;

              DO $$ BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM pg_constraint
                  WHERE conname = 'fk_ps_stage_owner_user'
                ) THEN
                  ALTER TABLE "${schema}".pipeline_stages
                    ADD CONSTRAINT fk_ps_stage_owner_user
                    FOREIGN KEY (stage_owner_user_id)
                    REFERENCES "${schema}".users(id) ON DELETE SET NULL;
                END IF;
              END $$;

              ALTER TABLE "${schema}".pipeline_stages
                ADD COLUMN IF NOT EXISTS stage_owner_team_id UUID;

              DO $$ BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM pg_constraint
                  WHERE conname = 'fk_ps_stage_owner_team'
                ) THEN
                  ALTER TABLE "${schema}".pipeline_stages
                    ADD CONSTRAINT fk_ps_stage_owner_team
                    FOREIGN KEY (stage_owner_team_id)
                    REFERENCES "${schema}".teams(id) ON DELETE SET NULL;
                END IF;
              END $$;

              ALTER TABLE "${schema}".pipeline_stages
                ADD COLUMN IF NOT EXISTS stage_owner_role_id UUID;

              DO $$ BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM pg_constraint
                  WHERE conname = 'fk_ps_stage_owner_role'
                ) THEN
                  ALTER TABLE "${schema}".pipeline_stages
                    ADD CONSTRAINT fk_ps_stage_owner_role
                    FOREIGN KEY (stage_owner_role_id)
                    REFERENCES "${schema}".roles(id) ON DELETE SET NULL;
                END IF;
              END $$;

              ALTER TABLE "${schema}".pipeline_stages
                ADD COLUMN IF NOT EXISTS field_visibility JSONB NOT NULL DEFAULT '{}';

              -- PART 2: Create record_stage_assignments table
              CREATE TABLE IF NOT EXISTS "${schema}".record_stage_assignments (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                entity_type     VARCHAR(50) NOT NULL,
                entity_id       UUID NOT NULL,
                stage_id        UUID NOT NULL REFERENCES "${schema}".pipeline_stages(id) ON DELETE CASCADE,
                assigned_to     UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
                assigned_by     UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
                assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                completed_at    TIMESTAMPTZ,
                stage_data      JSONB NOT NULL DEFAULT '{}',
                notes           TEXT,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
              );

              CREATE INDEX IF NOT EXISTS idx_rsa_entity
                ON "${schema}".record_stage_assignments(entity_type, entity_id);

              CREATE INDEX IF NOT EXISTS idx_rsa_stage
                ON "${schema}".record_stage_assignments(stage_id);
            `,
          },
          {
            name: '026_proposals',
            sql: `
              -- proposals table
              CREATE TABLE IF NOT EXISTS "${schema}".proposals (
                id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                opportunity_id    UUID NOT NULL REFERENCES "${schema}".opportunities(id) ON DELETE CASCADE,
                title             VARCHAR(255) NOT NULL,
                cover_message     TEXT,
                terms             TEXT,
                valid_until       DATE,
                status            VARCHAR(20) NOT NULL DEFAULT 'draft',
                public_token      UUID UNIQUE DEFAULT gen_random_uuid(),
                currency          VARCHAR(10) NOT NULL DEFAULT 'USD',
                total_amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
                sent_at           TIMESTAMPTZ,
                viewed_at         TIMESTAMPTZ,
                accepted_at       TIMESTAMPTZ,
                declined_at       TIMESTAMPTZ,
                created_by        UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
                created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                deleted_at        TIMESTAMPTZ
              );

              DO $$ BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM pg_constraint
                  WHERE conname = 'chk_proposal_status'
                ) THEN
                  ALTER TABLE "${schema}".proposals
                    ADD CONSTRAINT chk_proposal_status
                    CHECK (status IN ('draft','sent','viewed','accepted','declined','expired'));
                END IF;
              END $$;

              CREATE INDEX IF NOT EXISTS idx_proposals_opportunity_id
                ON "${schema}".proposals(opportunity_id);
              CREATE INDEX IF NOT EXISTS idx_proposals_public_token
                ON "${schema}".proposals(public_token);
              CREATE INDEX IF NOT EXISTS idx_proposals_status
                ON "${schema}".proposals(status);

              -- proposal_line_items table
              CREATE TABLE IF NOT EXISTS "${schema}".proposal_line_items (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                proposal_id     UUID NOT NULL REFERENCES "${schema}".proposals(id) ON DELETE CASCADE,
                product_id      UUID REFERENCES "${schema}".products(id) ON DELETE SET NULL,
                description     VARCHAR(500) NOT NULL,
                quantity        NUMERIC(10,2) NOT NULL DEFAULT 1,
                unit_price      NUMERIC(15,2) NOT NULL DEFAULT 0,
                discount        NUMERIC(10,2) NOT NULL DEFAULT 0,
                discount_type   VARCHAR(10) NOT NULL DEFAULT 'percentage',
                total           NUMERIC(15,2) NOT NULL DEFAULT 0,
                sort_order      INTEGER NOT NULL DEFAULT 0,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
              );

              DO $$ BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM pg_constraint
                  WHERE conname = 'chk_proposal_line_discount_type'
                ) THEN
                  ALTER TABLE "${schema}".proposal_line_items
                    ADD CONSTRAINT chk_proposal_line_discount_type
                    CHECK (discount_type IN ('percentage','fixed'));
                END IF;
              END $$;

              CREATE INDEX IF NOT EXISTS idx_proposal_line_items_proposal
                ON "${schema}".proposal_line_items(proposal_id);

              -- proposal_views table
              CREATE TABLE IF NOT EXISTS "${schema}".proposal_views (
                id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                proposal_id  UUID NOT NULL REFERENCES "${schema}".proposals(id) ON DELETE CASCADE,
                viewed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                ip_address   VARCHAR(45),
                user_agent   TEXT
              );

              CREATE INDEX IF NOT EXISTS idx_proposal_views_proposal
                ON "${schema}".proposal_views(proposal_id);
            `,
          },
          {
            name: '027_proposals_tenant_id',
            sql: `
              ALTER TABLE "${schema}".proposals
                ADD COLUMN IF NOT EXISTS tenant_id UUID;
            `,
          },
          {
            name: '028_proposals_published_status',
            sql: `
              -- Add 'published' to the allowed proposal status values
              ALTER TABLE "${schema}".proposals
                DROP CONSTRAINT IF EXISTS chk_proposal_status;
              ALTER TABLE "${schema}".proposals
                ADD CONSTRAINT chk_proposal_status
                CHECK (status IN ('draft','published','sent','viewed','accepted','declined','expired'));

              -- Track when a proposal was published
              ALTER TABLE "${schema}".proposals
                ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
              ALTER TABLE "${schema}".proposals
                ADD COLUMN IF NOT EXISTS published_by UUID;
            `,
          },

          // ── Sprint 3: Approval Engine ──────────────────────────────
          {
            name: '029_approval_engine',
            sql: `
              -- 1. approval_rules
              CREATE TABLE IF NOT EXISTS "${schema}".approval_rules (
                id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name          VARCHAR(255) NOT NULL,
                entity_type   VARCHAR(50)  NOT NULL,
                trigger_event VARCHAR(50)  NOT NULL,
                is_active     BOOLEAN      NOT NULL DEFAULT true,
                conditions    JSONB,
                created_by    UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
                created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                deleted_at    TIMESTAMPTZ
              );

              DO $$ BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM pg_constraint WHERE conname = 'chk_approval_rule_entity'
                ) THEN
                  ALTER TABLE "${schema}".approval_rules
                    ADD CONSTRAINT chk_approval_rule_entity
                    CHECK (entity_type IN ('proposals','opportunities','deals','leads','custom'));
                END IF;
              END $$;

              DO $$ BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM pg_constraint WHERE conname = 'chk_approval_rule_trigger'
                ) THEN
                  ALTER TABLE "${schema}".approval_rules
                    ADD CONSTRAINT chk_approval_rule_trigger
                    CHECK (trigger_event IN ('publish','close_won','discount_threshold','manual'));
                END IF;
              END $$;

              CREATE INDEX IF NOT EXISTS idx_approval_rules_entity
                ON "${schema}".approval_rules(entity_type);
              CREATE INDEX IF NOT EXISTS idx_approval_rules_trigger
                ON "${schema}".approval_rules(trigger_event);
              CREATE INDEX IF NOT EXISTS idx_approval_rules_active
                ON "${schema}".approval_rules(is_active) WHERE deleted_at IS NULL;

              -- 2. approval_rule_steps
              CREATE TABLE IF NOT EXISTS "${schema}".approval_rule_steps (
                id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                rule_id          UUID NOT NULL REFERENCES "${schema}".approval_rules(id) ON DELETE CASCADE,
                step_order       INTEGER NOT NULL,
                approver_type    VARCHAR(20) NOT NULL DEFAULT 'user',
                approver_user_id UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
                approver_role_id UUID REFERENCES "${schema}".roles(id) ON DELETE SET NULL,
                created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
              );

              DO $$ BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM pg_constraint WHERE conname = 'chk_approval_step_approver_type'
                ) THEN
                  ALTER TABLE "${schema}".approval_rule_steps
                    ADD CONSTRAINT chk_approval_step_approver_type
                    CHECK (approver_type IN ('user','role'));
                END IF;
              END $$;

              CREATE INDEX IF NOT EXISTS idx_approval_rule_steps_rule
                ON "${schema}".approval_rule_steps(rule_id);

              -- 3. approval_requests
              CREATE TABLE IF NOT EXISTS "${schema}".approval_requests (
                id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                rule_id       UUID REFERENCES "${schema}".approval_rules(id) ON DELETE SET NULL,
                entity_type   VARCHAR(50)  NOT NULL,
                entity_id     UUID         NOT NULL,
                trigger_event VARCHAR(50)  NOT NULL,
                status        VARCHAR(20)  NOT NULL DEFAULT 'pending',
                current_step  INTEGER      NOT NULL DEFAULT 1,
                requested_by  UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
                completed_at  TIMESTAMPTZ,
                rejected_at   TIMESTAMPTZ,
                created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
              );

              DO $$ BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM pg_constraint WHERE conname = 'chk_approval_request_status'
                ) THEN
                  ALTER TABLE "${schema}".approval_requests
                    ADD CONSTRAINT chk_approval_request_status
                    CHECK (status IN ('pending','approved','rejected','cancelled'));
                END IF;
              END $$;

              CREATE INDEX IF NOT EXISTS idx_approval_requests_entity
                ON "${schema}".approval_requests(entity_type, entity_id);
              CREATE INDEX IF NOT EXISTS idx_approval_requests_status
                ON "${schema}".approval_requests(status);
              CREATE INDEX IF NOT EXISTS idx_approval_requests_rule
                ON "${schema}".approval_requests(rule_id);

              -- 4. approval_request_steps
              CREATE TABLE IF NOT EXISTS "${schema}".approval_request_steps (
                id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                request_id       UUID NOT NULL REFERENCES "${schema}".approval_requests(id) ON DELETE CASCADE,
                step_order       INTEGER NOT NULL,
                approver_user_id UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
                approver_role_id UUID REFERENCES "${schema}".roles(id) ON DELETE SET NULL,
                status           VARCHAR(20) NOT NULL DEFAULT 'pending',
                comment          TEXT,
                actioned_at      TIMESTAMPTZ,
                created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
              );

              DO $$ BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM pg_constraint WHERE conname = 'chk_approval_req_step_status'
                ) THEN
                  ALTER TABLE "${schema}".approval_request_steps
                    ADD CONSTRAINT chk_approval_req_step_status
                    CHECK (status IN ('pending','approved','rejected','skipped'));
                END IF;
              END $$;

              CREATE INDEX IF NOT EXISTS idx_approval_req_steps_request
                ON "${schema}".approval_request_steps(request_id);
              CREATE INDEX IF NOT EXISTS idx_approval_req_steps_approver
                ON "${schema}".approval_request_steps(approver_user_id)
                WHERE approver_user_id IS NOT NULL;
            `,
          },
          {
            name: '030_contracts',
            sql: `
              -- =====================================================
              -- 1. tenant_integrations (PUBLIC schema)
              -- =====================================================
              CREATE TABLE IF NOT EXISTS public.tenant_integrations (
                id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id    UUID NOT NULL REFERENCES master.tenants(id) ON DELETE CASCADE,
                provider     VARCHAR(50) NOT NULL,
                is_enabled   BOOLEAN NOT NULL DEFAULT false,
                config       JSONB NOT NULL DEFAULT '{}',
                created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(tenant_id, provider)
              );

              CREATE INDEX IF NOT EXISTS idx_tenant_integrations_tenant
                ON public.tenant_integrations(tenant_id);

              DO $$ BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM pg_constraint WHERE conname = 'chk_tenant_integration_provider'
                ) THEN
                  ALTER TABLE public.tenant_integrations
                    ADD CONSTRAINT chk_tenant_integration_provider
                    CHECK (provider IN ('docusign','xero','slack','twilio','sendgrid','stripe'));
                END IF;
              END $$;

              -- =====================================================
              -- 2. contract_number_seq (tenant schema)
              -- =====================================================
              CREATE SEQUENCE IF NOT EXISTS "${schema}".contract_number_seq START 1000;

              -- =====================================================
              -- 3. contracts (tenant schema)
              -- =====================================================
              CREATE TABLE IF NOT EXISTS "${schema}".contracts (
                id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                contract_number      VARCHAR(50) NOT NULL UNIQUE,
                opportunity_id       UUID REFERENCES "${schema}".opportunities(id) ON DELETE SET NULL,
                proposal_id          UUID REFERENCES "${schema}".proposals(id) ON DELETE SET NULL,
                title                VARCHAR(255) NOT NULL,
                type                 VARCHAR(30) NOT NULL DEFAULT 'service_agreement',
                status               VARCHAR(30) NOT NULL DEFAULT 'draft',
                sign_mode            VARCHAR(20) NOT NULL DEFAULT 'internal',
                value                NUMERIC(15,2) NOT NULL DEFAULT 0,
                currency             VARCHAR(10) NOT NULL DEFAULT 'USD',
                start_date           DATE,
                end_date             DATE,
                renewal_date         DATE,
                auto_renewal         BOOLEAN NOT NULL DEFAULT false,
                terms                TEXT,
                docusign_envelope_id VARCHAR(255),
                docusign_status      VARCHAR(50),
                created_by           UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
                created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                deleted_at           TIMESTAMPTZ
              );

              DO $$ BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM pg_constraint WHERE conname = 'chk_contract_type'
                ) THEN
                  ALTER TABLE "${schema}".contracts
                    ADD CONSTRAINT chk_contract_type
                    CHECK (type IN ('nda','msa','sow','service_agreement','custom'));
                END IF;
              END $$;

              DO $$ BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM pg_constraint WHERE conname = 'chk_contract_status'
                ) THEN
                  ALTER TABLE "${schema}".contracts
                    ADD CONSTRAINT chk_contract_status
                    CHECK (status IN ('draft','sent_for_signing','partially_signed','fully_signed','expired','terminated','renewed'));
                END IF;
              END $$;

              DO $$ BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM pg_constraint WHERE conname = 'chk_contract_sign_mode'
                ) THEN
                  ALTER TABLE "${schema}".contracts
                    ADD CONSTRAINT chk_contract_sign_mode
                    CHECK (sign_mode IN ('docusign','internal'));
                END IF;
              END $$;

              CREATE INDEX IF NOT EXISTS idx_contracts_opportunity ON "${schema}".contracts(opportunity_id);
              CREATE INDEX IF NOT EXISTS idx_contracts_proposal ON "${schema}".contracts(proposal_id);
              CREATE INDEX IF NOT EXISTS idx_contracts_status ON "${schema}".contracts(status);
              CREATE INDEX IF NOT EXISTS idx_contracts_number ON "${schema}".contracts(contract_number);
              CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON "${schema}".contracts(end_date) WHERE deleted_at IS NULL;

              -- =====================================================
              -- 4. contract_signatories (tenant schema)
              -- =====================================================
              CREATE TABLE IF NOT EXISTS "${schema}".contract_signatories (
                id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                contract_id      UUID NOT NULL REFERENCES "${schema}".contracts(id) ON DELETE CASCADE,
                signatory_type   VARCHAR(20) NOT NULL DEFAULT 'external',
                sign_order       INTEGER NOT NULL DEFAULT 1,
                user_id          UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
                contact_id       UUID REFERENCES "${schema}".contacts(id) ON DELETE SET NULL,
                name             VARCHAR(255) NOT NULL,
                email            VARCHAR(255) NOT NULL,
                status           VARCHAR(20) NOT NULL DEFAULT 'pending',
                signed_at        TIMESTAMPTZ,
                signature_data   TEXT,
                ip_address       VARCHAR(45),
                token            UUID UNIQUE DEFAULT gen_random_uuid(),
                created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
              );

              DO $$ BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM pg_constraint WHERE conname = 'chk_signatory_type'
                ) THEN
                  ALTER TABLE "${schema}".contract_signatories
                    ADD CONSTRAINT chk_signatory_type
                    CHECK (signatory_type IN ('internal','external'));
                END IF;
              END $$;

              DO $$ BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM pg_constraint WHERE conname = 'chk_signatory_status'
                ) THEN
                  ALTER TABLE "${schema}".contract_signatories
                    ADD CONSTRAINT chk_signatory_status
                    CHECK (status IN ('pending','sent','signed','declined'));
                END IF;
              END $$;

              CREATE INDEX IF NOT EXISTS idx_contract_signatories_contract ON "${schema}".contract_signatories(contract_id);
              CREATE INDEX IF NOT EXISTS idx_contract_signatories_token ON "${schema}".contract_signatories(token);
              CREATE INDEX IF NOT EXISTS idx_contract_signatories_email ON "${schema}".contract_signatories(email);
            `,
          },
          {
            name: '031_invoicing',
            sql: `
              -- =====================================================
              -- 1. Add xero_contact_id to accounts
              -- =====================================================
              ALTER TABLE "${schema}".accounts
                ADD COLUMN IF NOT EXISTS xero_contact_id VARCHAR(255);

              CREATE INDEX IF NOT EXISTS idx_accounts_xero_contact
                ON "${schema}".accounts(xero_contact_id)
                WHERE xero_contact_id IS NOT NULL;

              -- =====================================================
              -- 2. Add xero_contact_id to contacts
              -- =====================================================
              ALTER TABLE "${schema}".contacts
                ADD COLUMN IF NOT EXISTS xero_contact_id VARCHAR(255);

              CREATE INDEX IF NOT EXISTS idx_contacts_xero_contact
                ON "${schema}".contacts(xero_contact_id)
                WHERE xero_contact_id IS NOT NULL;

              -- =====================================================
              -- 3. invoice_number_seq
              -- =====================================================
              CREATE SEQUENCE IF NOT EXISTS "${schema}".invoice_number_seq START 1000;

              -- =====================================================
              -- 4. invoices table
              -- =====================================================
              CREATE TABLE IF NOT EXISTS "${schema}".invoices (
                id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                invoice_number      VARCHAR(50) NOT NULL UNIQUE,
                opportunity_id      UUID REFERENCES "${schema}".opportunities(id) ON DELETE SET NULL,
                contract_id         UUID REFERENCES "${schema}".contracts(id) ON DELETE SET NULL,
                proposal_id         UUID REFERENCES "${schema}".proposals(id) ON DELETE SET NULL,
                account_id          UUID REFERENCES "${schema}".accounts(id) ON DELETE SET NULL,
                contact_id          UUID REFERENCES "${schema}".contacts(id) ON DELETE SET NULL,
                title               VARCHAR(255) NOT NULL,
                status              VARCHAR(30)  NOT NULL DEFAULT 'draft',
                currency            VARCHAR(10)  NOT NULL DEFAULT 'USD',
                subtotal            NUMERIC(15,2) NOT NULL DEFAULT 0,
                discount_amount     NUMERIC(15,2) NOT NULL DEFAULT 0,
                tax_amount          NUMERIC(15,2) NOT NULL DEFAULT 0,
                total_amount        NUMERIC(15,2) NOT NULL DEFAULT 0,
                amount_paid         NUMERIC(15,2) NOT NULL DEFAULT 0,
                amount_due          NUMERIC(15,2) NOT NULL DEFAULT 0,
                issue_date          DATE NOT NULL DEFAULT CURRENT_DATE,
                due_date            DATE,
                paid_at             TIMESTAMPTZ,
                notes               TEXT,
                terms               TEXT,
                is_recurring        BOOLEAN NOT NULL DEFAULT false,
                recurrence_interval VARCHAR(20),
                recurrence_end_date DATE,
                next_invoice_date   DATE,
                xero_invoice_id     VARCHAR(255),
                xero_status         VARCHAR(50),
                stripe_payment_id   VARCHAR(255),
                created_by          UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
                created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                deleted_at          TIMESTAMPTZ
              );

              DO $$ BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoice_status'
                ) THEN
                  ALTER TABLE "${schema}".invoices
                    ADD CONSTRAINT chk_invoice_status
                    CHECK (status IN ('draft','sent','partially_paid','paid','overdue','cancelled','void'));
                END IF;
              END $$;

              DO $$ BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoice_recurrence'
                ) THEN
                  ALTER TABLE "${schema}".invoices
                    ADD CONSTRAINT chk_invoice_recurrence
                    CHECK (recurrence_interval IN ('weekly','monthly','quarterly','annually') OR recurrence_interval IS NULL);
                END IF;
              END $$;

              CREATE INDEX IF NOT EXISTS idx_invoices_opportunity ON "${schema}".invoices(opportunity_id);
              CREATE INDEX IF NOT EXISTS idx_invoices_contract ON "${schema}".invoices(contract_id);
              CREATE INDEX IF NOT EXISTS idx_invoices_account ON "${schema}".invoices(account_id);
              CREATE INDEX IF NOT EXISTS idx_invoices_status ON "${schema}".invoices(status);
              CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON "${schema}".invoices(due_date) WHERE deleted_at IS NULL;
              CREATE INDEX IF NOT EXISTS idx_invoices_xero ON "${schema}".invoices(xero_invoice_id) WHERE xero_invoice_id IS NOT NULL;

              -- =====================================================
              -- 5. invoice_line_items table
              -- =====================================================
              CREATE TABLE IF NOT EXISTS "${schema}".invoice_line_items (
                id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                invoice_id    UUID NOT NULL REFERENCES "${schema}".invoices(id) ON DELETE CASCADE,
                product_id    UUID REFERENCES "${schema}".products(id) ON DELETE SET NULL,
                description   VARCHAR(500) NOT NULL,
                quantity      NUMERIC(10,2) NOT NULL DEFAULT 1,
                unit_price    NUMERIC(15,2) NOT NULL DEFAULT 0,
                discount      NUMERIC(10,2) NOT NULL DEFAULT 0,
                discount_type VARCHAR(10)   NOT NULL DEFAULT 'percentage',
                tax_rate      NUMERIC(5,2)  NOT NULL DEFAULT 0,
                total         NUMERIC(15,2) NOT NULL DEFAULT 0,
                sort_order    INTEGER       NOT NULL DEFAULT 0,
                created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
              );

              DO $$ BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoice_line_discount_type'
                ) THEN
                  ALTER TABLE "${schema}".invoice_line_items
                    ADD CONSTRAINT chk_invoice_line_discount_type
                    CHECK (discount_type IN ('percentage','fixed'));
                END IF;
              END $$;

              CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON "${schema}".invoice_line_items(invoice_id);

              -- =====================================================
              -- 6. invoice_payments table
              -- =====================================================
              CREATE TABLE IF NOT EXISTS "${schema}".invoice_payments (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                invoice_id      UUID NOT NULL REFERENCES "${schema}".invoices(id) ON DELETE CASCADE,
                amount          NUMERIC(15,2) NOT NULL,
                currency        VARCHAR(10)   NOT NULL DEFAULT 'USD',
                payment_method  VARCHAR(50)   NOT NULL DEFAULT 'manual',
                reference       VARCHAR(255),
                notes           TEXT,
                paid_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
                recorded_by     UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
                xero_payment_id VARCHAR(255),
                created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
              );

              DO $$ BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoice_payment_method'
                ) THEN
                  ALTER TABLE "${schema}".invoice_payments
                    ADD CONSTRAINT chk_invoice_payment_method
                    CHECK (payment_method IN ('manual','bank_transfer','credit_card','xero','stripe','cash','cheque'));
                END IF;
              END $$;

              CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON "${schema}".invoice_payments(invoice_id);
              CREATE INDEX IF NOT EXISTS idx_invoice_payments_paid_at ON "${schema}".invoice_payments(paid_at);
            `,
          },
          {
            name: '032_project_management',
            sql: `
              -- =====================================================
              -- PART 1: project_statuses
              -- =====================================================
              CREATE TABLE IF NOT EXISTS "${schema}".project_statuses (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(100) NOT NULL,
                slug VARCHAR(100) NOT NULL,
                color VARCHAR(20) DEFAULT '#3B82F6',
                icon VARCHAR(50) DEFAULT 'circle',
                description TEXT,
                is_default BOOLEAN DEFAULT false,
                is_closed BOOLEAN DEFAULT false,
                is_system BOOLEAN DEFAULT false,
                is_active BOOLEAN DEFAULT true,
                sort_order INT DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(slug)
              );

              INSERT INTO "${schema}".project_statuses
                (name, slug, color, icon, is_default, is_closed, is_system, sort_order)
              VALUES
                ('Not Started', 'not_started', '#94A3B8', 'circle',        true,  false, true, 1),
                ('In Progress', 'in_progress', '#3B82F6', 'play-circle',   false, false, true, 2),
                ('On Hold',     'on_hold',     '#F59E0B', 'pause-circle',  false, false, true, 3),
                ('Completed',   'completed',   '#10B981', 'check-circle',  false, true,  true, 4),
                ('Cancelled',   'cancelled',   '#EF4444', 'x-circle',      false, true,  true, 5)
              ON CONFLICT (slug) DO NOTHING;

              -- =====================================================
              -- PART 2: project_task_statuses
              -- =====================================================
              CREATE TABLE IF NOT EXISTS "${schema}".project_task_statuses (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(100) NOT NULL,
                slug VARCHAR(100) NOT NULL,
                color VARCHAR(20) DEFAULT '#3B82F6',
                is_default BOOLEAN DEFAULT false,
                is_done BOOLEAN DEFAULT false,
                is_system BOOLEAN DEFAULT false,
                sort_order INT DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(slug)
              );

              INSERT INTO "${schema}".project_task_statuses
                (name, slug, color, is_default, is_done, is_system, sort_order)
              VALUES
                ('To Do',       'todo',        '#94A3B8', true,  false, true, 1),
                ('In Progress', 'in_progress', '#3B82F6', false, false, true, 2),
                ('In Review',   'in_review',   '#F59E0B', false, false, true, 3),
                ('Done',        'done',        '#10B981', false, true,  true, 4),
                ('Blocked',     'blocked',     '#EF4444', false, false, true, 5)
              ON CONFLICT (slug) DO NOTHING;

              -- =====================================================
              -- PART 3: project_templates
              -- =====================================================
              CREATE TABLE IF NOT EXISTS "${schema}".project_templates (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                color VARCHAR(20) DEFAULT '#3B82F6',
                icon VARCHAR(50) DEFAULT 'folder',
                estimated_days INT,
                is_active BOOLEAN DEFAULT true,
                is_system BOOLEAN DEFAULT false,
                created_by UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
              );

              CREATE INDEX IF NOT EXISTS idx_project_templates_active
                ON "${schema}".project_templates(is_active);

              -- =====================================================
              -- PART 4: project_template_phases
              -- =====================================================
              CREATE TABLE IF NOT EXISTS "${schema}".project_template_phases (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                template_id UUID NOT NULL REFERENCES "${schema}".project_templates(id) ON DELETE CASCADE,
                name VARCHAR(150) NOT NULL,
                description TEXT,
                color VARCHAR(20) DEFAULT '#3B82F6',
                sort_order INT DEFAULT 0,
                estimated_days INT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
              );

              CREATE INDEX IF NOT EXISTS idx_project_template_phases_template
                ON "${schema}".project_template_phases(template_id);

              -- =====================================================
              -- PART 5: project_template_tasks
              -- =====================================================
              CREATE TABLE IF NOT EXISTS "${schema}".project_template_tasks (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                phase_id UUID NOT NULL REFERENCES "${schema}".project_template_phases(id) ON DELETE CASCADE,
                template_id UUID NOT NULL REFERENCES "${schema}".project_templates(id) ON DELETE CASCADE,
                title VARCHAR(500) NOT NULL,
                description TEXT,
                assignee_role VARCHAR(100),
                due_days_from_start INT,
                estimated_hours DECIMAL(8,2),
                priority VARCHAR(20) DEFAULT 'medium',
                tags TEXT[] DEFAULT '{}',
                dependencies JSONB DEFAULT '[]',
                sort_order INT DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW()
              );

              CREATE INDEX IF NOT EXISTS idx_project_template_tasks_phase
                ON "${schema}".project_template_tasks(phase_id);
              CREATE INDEX IF NOT EXISTS idx_project_template_tasks_template
                ON "${schema}".project_template_tasks(template_id);

              -- =====================================================
              -- PART 6: projects
              -- =====================================================
              CREATE TABLE IF NOT EXISTS "${schema}".projects (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                status_id UUID REFERENCES "${schema}".project_statuses(id) ON DELETE SET NULL,
                color VARCHAR(20) DEFAULT '#3B82F6',
                opportunity_id UUID REFERENCES "${schema}".opportunities(id) ON DELETE SET NULL,
                account_id UUID REFERENCES "${schema}".accounts(id) ON DELETE SET NULL,
                contact_id UUID REFERENCES "${schema}".contacts(id) ON DELETE SET NULL,
                template_id UUID REFERENCES "${schema}".project_templates(id) ON DELETE SET NULL,
                health_score INT DEFAULT 100,
                health_status VARCHAR(20) DEFAULT 'on_track',
                start_date DATE,
                end_date DATE,
                actual_end_date DATE,
                budget DECIMAL(15,2),
                actual_cost DECIMAL(15,2) DEFAULT 0,
                currency VARCHAR(3) DEFAULT 'USD',
                owner_id UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
                team_id UUID REFERENCES "${schema}".teams(id) ON DELETE SET NULL,
                tags TEXT[] DEFAULT '{}',
                custom_fields JSONB DEFAULT '{}',
                client_portal_enabled BOOLEAN DEFAULT false,
                created_by UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
                updated_by UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
                deleted_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
              );

              CREATE INDEX IF NOT EXISTS idx_projects_opportunity ON "${schema}".projects(opportunity_id);
              CREATE INDEX IF NOT EXISTS idx_projects_account     ON "${schema}".projects(account_id);
              CREATE INDEX IF NOT EXISTS idx_projects_owner       ON "${schema}".projects(owner_id);
              CREATE INDEX IF NOT EXISTS idx_projects_status      ON "${schema}".projects(status_id);
              CREATE INDEX IF NOT EXISTS idx_projects_deleted     ON "${schema}".projects(deleted_at) WHERE deleted_at IS NULL;

              -- =====================================================
              -- PART 7: project_members
              -- =====================================================
              CREATE TABLE IF NOT EXISTS "${schema}".project_members (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_id UUID NOT NULL REFERENCES "${schema}".projects(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES "${schema}".users(id) ON DELETE CASCADE,
                role VARCHAR(50) DEFAULT 'member',
                is_client_contact BOOLEAN DEFAULT false,
                added_by UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(project_id, user_id)
              );

              CREATE INDEX IF NOT EXISTS idx_project_members_project ON "${schema}".project_members(project_id);
              CREATE INDEX IF NOT EXISTS idx_project_members_user    ON "${schema}".project_members(user_id);

              -- =====================================================
              -- PART 8: project_phases
              -- =====================================================
              CREATE TABLE IF NOT EXISTS "${schema}".project_phases (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_id UUID NOT NULL REFERENCES "${schema}".projects(id) ON DELETE CASCADE,
                name VARCHAR(150) NOT NULL,
                description TEXT,
                color VARCHAR(20) DEFAULT '#3B82F6',
                sort_order INT DEFAULT 0,
                is_complete BOOLEAN DEFAULT false,
                completed_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
              );

              CREATE INDEX IF NOT EXISTS idx_project_phases_project ON "${schema}".project_phases(project_id);

              -- =====================================================
              -- PART 9: project_tasks
              -- =====================================================
              CREATE TABLE IF NOT EXISTS "${schema}".project_tasks (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_id UUID NOT NULL REFERENCES "${schema}".projects(id) ON DELETE CASCADE,
                phase_id UUID REFERENCES "${schema}".project_phases(id) ON DELETE SET NULL,
                parent_task_id UUID REFERENCES "${schema}".project_tasks(id) ON DELETE CASCADE,
                title VARCHAR(500) NOT NULL,
                description TEXT,
                status_id UUID REFERENCES "${schema}".project_task_statuses(id) ON DELETE SET NULL,
                priority VARCHAR(20) DEFAULT 'medium',
                assignee_id UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
                start_date DATE,
                due_date DATE,
                completed_at TIMESTAMPTZ,
                estimated_hours DECIMAL(8,2),
                logged_hours DECIMAL(8,2) DEFAULT 0,
                sort_order INT DEFAULT 0,
                tags TEXT[] DEFAULT '{}',
                custom_fields JSONB DEFAULT '{}',
                created_by UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
                updated_by UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
                deleted_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
              );

              CREATE INDEX IF NOT EXISTS idx_project_tasks_project  ON "${schema}".project_tasks(project_id, phase_id);
              CREATE INDEX IF NOT EXISTS idx_project_tasks_assignee ON "${schema}".project_tasks(assignee_id, status_id);
              CREATE INDEX IF NOT EXISTS idx_project_tasks_parent   ON "${schema}".project_tasks(parent_task_id);
              CREATE INDEX IF NOT EXISTS idx_project_tasks_due      ON "${schema}".project_tasks(due_date) WHERE deleted_at IS NULL;
              CREATE INDEX IF NOT EXISTS idx_project_tasks_deleted  ON "${schema}".project_tasks(deleted_at) WHERE deleted_at IS NULL;

              -- =====================================================
              -- PART 10: project_task_dependencies
              -- =====================================================
              CREATE TABLE IF NOT EXISTS "${schema}".project_task_dependencies (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                task_id UUID NOT NULL REFERENCES "${schema}".project_tasks(id) ON DELETE CASCADE,
                depends_on_task_id UUID NOT NULL REFERENCES "${schema}".project_tasks(id) ON DELETE CASCADE,
                dependency_type VARCHAR(30) DEFAULT 'finish_to_start',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(task_id, depends_on_task_id)
              );

              CREATE INDEX IF NOT EXISTS idx_task_deps_task        ON "${schema}".project_task_dependencies(task_id);
              CREATE INDEX IF NOT EXISTS idx_task_deps_depends_on  ON "${schema}".project_task_dependencies(depends_on_task_id);

              -- =====================================================
              -- PART 11: project_task_comments, attachments, time entries, milestones
              -- =====================================================
              CREATE TABLE IF NOT EXISTS "${schema}".project_task_comments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                task_id UUID NOT NULL REFERENCES "${schema}".project_tasks(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES "${schema}".users(id) ON DELETE CASCADE,
                content TEXT NOT NULL,
                mentions JSONB DEFAULT '[]',
                is_edited BOOLEAN DEFAULT false,
                edited_at TIMESTAMPTZ,
                deleted_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
              );
              CREATE INDEX IF NOT EXISTS idx_task_comments_task ON "${schema}".project_task_comments(task_id);

              CREATE TABLE IF NOT EXISTS "${schema}".project_task_attachments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                task_id UUID NOT NULL REFERENCES "${schema}".project_tasks(id) ON DELETE CASCADE,
                project_id UUID NOT NULL REFERENCES "${schema}".projects(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                original_name VARCHAR(255),
                mime_type VARCHAR(100),
                size_bytes BIGINT,
                storage_path VARCHAR(500),
                storage_url VARCHAR(500),
                uploaded_by UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
              );
              CREATE INDEX IF NOT EXISTS idx_task_attachments_task    ON "${schema}".project_task_attachments(task_id);
              CREATE INDEX IF NOT EXISTS idx_task_attachments_project ON "${schema}".project_task_attachments(project_id);

              CREATE TABLE IF NOT EXISTS "${schema}".project_time_entries (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_id UUID NOT NULL REFERENCES "${schema}".projects(id) ON DELETE CASCADE,
                task_id UUID REFERENCES "${schema}".project_tasks(id) ON DELETE SET NULL,
                user_id UUID NOT NULL REFERENCES "${schema}".users(id) ON DELETE CASCADE,
                description TEXT,
                minutes INT NOT NULL DEFAULT 0,
                logged_at DATE NOT NULL DEFAULT CURRENT_DATE,
                is_billable BOOLEAN DEFAULT true,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
              );
              CREATE INDEX IF NOT EXISTS idx_time_entries_project ON "${schema}".project_time_entries(project_id);
              CREATE INDEX IF NOT EXISTS idx_time_entries_task    ON "${schema}".project_time_entries(task_id, user_id);
              CREATE INDEX IF NOT EXISTS idx_time_entries_user    ON "${schema}".project_time_entries(user_id, logged_at);

              CREATE TABLE IF NOT EXISTS "${schema}".project_milestones (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_id UUID NOT NULL REFERENCES "${schema}".projects(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                due_date DATE,
                is_complete BOOLEAN DEFAULT false,
                completed_at TIMESTAMPTZ,
                linked_task_ids JSONB DEFAULT '[]',
                created_by UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
              );
              CREATE INDEX IF NOT EXISTS idx_project_milestones_project ON "${schema}".project_milestones(project_id);
              CREATE INDEX IF NOT EXISTS idx_project_milestones_due     ON "${schema}".project_milestones(due_date);

              -- =====================================================
              -- PART 12: client_portal_tokens + default template seed
              -- =====================================================
              CREATE TABLE IF NOT EXISTS "${schema}".client_portal_tokens (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_id UUID NOT NULL REFERENCES "${schema}".projects(id) ON DELETE CASCADE,
                token VARCHAR(128) NOT NULL UNIQUE,
                label VARCHAR(255),
                email VARCHAR(255),
                permissions JSONB DEFAULT '{"view_tasks":true,"view_files":true,"view_timeline":false,"add_comments":false}',
                expires_at TIMESTAMPTZ,
                last_accessed_at TIMESTAMPTZ,
                created_by UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
              );
              CREATE INDEX IF NOT EXISTS idx_portal_tokens_project ON "${schema}".client_portal_tokens(project_id);
              CREATE INDEX IF NOT EXISTS idx_portal_tokens_token   ON "${schema}".client_portal_tokens(token);

              -- Seed default template
              DO $$
              DECLARE
                tmpl_id UUID;
                phase1_id UUID;
                phase2_id UUID;
                phase3_id UUID;
              BEGIN
                INSERT INTO "${schema}".project_templates
                  (name, description, color, icon, estimated_days, is_system, is_active)
                VALUES
                  ('General Project', 'Default template for new projects', '#3B82F6', 'folder', 30, true, true)
                ON CONFLICT DO NOTHING
                RETURNING id INTO tmpl_id;

                IF tmpl_id IS NOT NULL THEN
                  INSERT INTO "${schema}".project_template_phases
                    (template_id, name, color, sort_order, estimated_days)
                  VALUES (tmpl_id, 'Planning',  '#8B5CF6', 1, 7)  RETURNING id INTO phase1_id;

                  INSERT INTO "${schema}".project_template_phases
                    (template_id, name, color, sort_order, estimated_days)
                  VALUES (tmpl_id, 'Execution', '#3B82F6', 2, 16) RETURNING id INTO phase2_id;

                  INSERT INTO "${schema}".project_template_phases
                    (template_id, name, color, sort_order, estimated_days)
                  VALUES (tmpl_id, 'Handover',  '#10B981', 3, 7)  RETURNING id INTO phase3_id;

                  INSERT INTO "${schema}".project_template_tasks
                    (template_id, phase_id, title, due_days_from_start, sort_order)
                  VALUES
                    (tmpl_id, phase1_id, 'Define project scope',         2, 1),
                    (tmpl_id, phase1_id, 'Identify stakeholders',        3, 2),
                    (tmpl_id, phase1_id, 'Set up project workspace',     5, 3),
                    (tmpl_id, phase2_id, 'Kick-off meeting with client', 8, 1),
                    (tmpl_id, phase2_id, 'Deliver first milestone',     15, 2),
                    (tmpl_id, phase2_id, 'Mid-project review',          20, 3),
                    (tmpl_id, phase3_id, 'Final delivery review',       26, 1),
                    (tmpl_id, phase3_id, 'Client sign-off',             28, 2),
                    (tmpl_id, phase3_id, 'Project closure report',      30, 3);
                END IF;
              END $$;

              DO $$
              BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'intelli_hiper_app') THEN
                  EXECUTE 'GRANT ALL ON ALL TABLES IN SCHEMA "${schema}" TO intelli_hiper_app';
                  EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "${schema}" TO intelli_hiper_app';
                END IF;
              END $$;
            `,
          },
          {
            name: '033_projects_enhancements',
            sql: build033ProjectsEnhancements(schema),
          },
          {
            name: '034_template_subtasks_and_project_approvals',
            sql: `
              -- 1. Add parent_task_id to project_template_tasks for nested subtasks
              ALTER TABLE "${schema}".project_template_tasks
                ADD COLUMN IF NOT EXISTS parent_task_id UUID
                REFERENCES "${schema}".project_template_tasks(id) ON DELETE CASCADE;

              CREATE INDEX IF NOT EXISTS idx_ptt_parent_task_id
                ON "${schema}".project_template_tasks(parent_task_id);

              -- 2. Add approval_config to project_templates
              ALTER TABLE "${schema}".project_templates
                ADD COLUMN IF NOT EXISTS approval_config JSONB DEFAULT NULL;

              -- 3. Update approval_rules CHECK constraint for entity_type to include 'projects'
              DO $$
              BEGIN
                -- Drop existing constraint if it exists
                IF EXISTS (
                  SELECT 1 FROM information_schema.table_constraints
                  WHERE table_schema = '${schema}'
                    AND table_name = 'approval_rules'
                    AND constraint_name = 'approval_rules_entity_type_check'
                ) THEN
                  ALTER TABLE "${schema}".approval_rules
                    DROP CONSTRAINT approval_rules_entity_type_check;
                END IF;

                -- Add new constraint with 'projects' included
                ALTER TABLE "${schema}".approval_rules
                  ADD CONSTRAINT approval_rules_entity_type_check
                  CHECK (entity_type IN ('proposals', 'opportunities', 'deals', 'leads', 'projects', 'custom'));
              END $$;

              -- 4. Update approval_rules CHECK constraint for trigger_event to include project triggers
              DO $$
              BEGIN
                -- Drop existing constraint if it exists
                IF EXISTS (
                  SELECT 1 FROM information_schema.table_constraints
                  WHERE table_schema = '${schema}'
                    AND table_name = 'approval_rules'
                    AND constraint_name = 'approval_rules_trigger_event_check'
                ) THEN
                  ALTER TABLE "${schema}".approval_rules
                    DROP CONSTRAINT approval_rules_trigger_event_check;
                END IF;

                -- Add new constraint with project triggers included
                ALTER TABLE "${schema}".approval_rules
                  ADD CONSTRAINT approval_rules_trigger_event_check
                  CHECK (trigger_event IN (
                    'publish', 'close_won', 'discount_threshold', 'manual',
                    'project_created', 'project_completed', 'budget_exceeded'
                  ));
              END $$;

              -- 5. Grant permissions (if needed)
              DO $$
              BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'intelli_hiper_app') THEN
                  EXECUTE 'GRANT ALL ON ALL TABLES IN SCHEMA "${schema}" TO intelli_hiper_app';
                  EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "${schema}" TO intelli_hiper_app';
                END IF;
              END $$;
            `,
          },
          {
            name: '035_forms_module',
            sql: `
              -- Forms table
              CREATE TABLE IF NOT EXISTS "${schema}".forms (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                slug VARCHAR(255),
                status VARCHAR(20) NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'active', 'inactive', 'archived')),
                fields JSONB NOT NULL DEFAULT '[]',
                settings JSONB NOT NULL DEFAULT '{}',
                submit_actions JSONB NOT NULL DEFAULT '[]',
                branding JSONB NOT NULL DEFAULT '{}',
                token VARCHAR(100),
                tenant_slug VARCHAR(100),
                submission_count INT NOT NULL DEFAULT 0,
                created_by UUID,
                updated_by UUID,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                deleted_at TIMESTAMPTZ
              );
              CREATE INDEX IF NOT EXISTS idx_forms_status ON "${schema}".forms(status);
              CREATE INDEX IF NOT EXISTS idx_forms_token ON "${schema}".forms(token);
              CREATE INDEX IF NOT EXISTS idx_forms_deleted ON "${schema}".forms(deleted_at);
              CREATE UNIQUE INDEX IF NOT EXISTS idx_forms_slug ON "${schema}".forms(slug) WHERE deleted_at IS NULL;

              -- Form submissions table
              CREATE TABLE IF NOT EXISTS "${schema}".form_submissions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                form_id UUID NOT NULL REFERENCES "${schema}".forms(id) ON DELETE CASCADE,
                data JSONB NOT NULL DEFAULT '{}',
                metadata JSONB NOT NULL DEFAULT '{}',
                action_results JSONB NOT NULL DEFAULT '[]',
                ip_address VARCHAR(45),
                user_agent TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
              );
              CREATE INDEX IF NOT EXISTS idx_form_submissions_form ON "${schema}".form_submissions(form_id);
              CREATE INDEX IF NOT EXISTS idx_form_submissions_created ON "${schema}".form_submissions(created_at);

              -- Populate tenant_slug from tenants table
              DO $$
              DECLARE
                t_slug TEXT;
              BEGIN
                SELECT slug INTO t_slug FROM master.tenants
                WHERE schema_name = '${schema}' LIMIT 1;
                IF t_slug IS NOT NULL THEN
                  UPDATE "${schema}".forms SET tenant_slug = t_slug WHERE tenant_slug IS NULL;
                END IF;
              END $$;

              -- Grant permissions
              DO $$
              BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'intelli_hiper_app') THEN
                  EXECUTE 'GRANT ALL ON ALL TABLES IN SCHEMA "${schema}" TO intelli_hiper_app';
                  EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "${schema}" TO intelli_hiper_app';
                END IF;
              END $$;
            `,
          },
          {
            name: '036_forms_role_permissions',
            sql: `
              -- Add forms permissions to admin role
              UPDATE "${schema}".roles SET
                permissions = permissions || '{"forms":{"view":true,"create":true,"edit":true,"delete":true}}'::jsonb
              WHERE name = 'admin' AND NOT (permissions ? 'forms');

              -- Add forms permissions to manager role
              UPDATE "${schema}".roles SET
                permissions = permissions || '{"forms":{"view":true,"create":true,"edit":true,"delete":false}}'::jsonb
              WHERE name = 'manager' AND NOT (permissions ? 'forms');

              -- Add forms permissions to user role
              UPDATE "${schema}".roles SET
                permissions = permissions || '{"forms":{"view":true,"create":false,"edit":false,"delete":false}}'::jsonb
              WHERE name = 'user' AND NOT (permissions ? 'forms');
            `,
          },
          {
            name: '037_email_inbox',
            sql: `
              -- Connected email accounts (per user or shared/tenant)
              CREATE TABLE IF NOT EXISTS "${schema}".email_accounts (
                id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id        UUID REFERENCES "${schema}".users(id) ON DELETE CASCADE,
                is_shared      BOOLEAN NOT NULL DEFAULT false,
                provider       VARCHAR(20) NOT NULL,
                email          VARCHAR(255) NOT NULL,
                display_name   VARCHAR(255),
                access_token   TEXT,
                refresh_token  TEXT,
                token_expiry   TIMESTAMPTZ,
                imap_host      VARCHAR(255),
                imap_port      INT,
                imap_secure    BOOLEAN DEFAULT true,
                smtp_host      VARCHAR(255),
                smtp_port      INT,
                smtp_secure    BOOLEAN DEFAULT true,
                imap_password  TEXT,
                sync_enabled        BOOLEAN DEFAULT true,
                webhook_resource_id VARCHAR(255),
                webhook_expiry      TIMESTAMPTZ,
                ms_subscription_id  VARCHAR(255),
                history_id          VARCHAR(255),
                last_synced_at      TIMESTAMPTZ,
                created_at     TIMESTAMPTZ DEFAULT NOW(),
                updated_at     TIMESTAMPTZ DEFAULT NOW()
              );

              DO $$ BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM pg_constraint WHERE conname = 'uq_email_accounts_email_user'
                ) THEN
                  ALTER TABLE "${schema}".email_accounts
                    ADD CONSTRAINT uq_email_accounts_email_user UNIQUE (email, user_id);
                END IF;
              END $$;

              CREATE INDEX IF NOT EXISTS idx_email_accounts_user
                ON "${schema}".email_accounts(user_id);

              -- Stored emails
              CREATE TABLE IF NOT EXISTS "${schema}".emails (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                account_id      UUID NOT NULL REFERENCES "${schema}".email_accounts(id) ON DELETE CASCADE,
                message_id      VARCHAR(512) NOT NULL,
                thread_id       VARCHAR(512),
                direction       VARCHAR(10) NOT NULL,
                subject         TEXT,
                body_text       TEXT,
                body_html       TEXT,
                from_email      VARCHAR(255),
                from_name       VARCHAR(255),
                to_emails       JSONB DEFAULT '[]',
                cc_emails       JSONB DEFAULT '[]',
                bcc_emails      JSONB DEFAULT '[]',
                sent_at         TIMESTAMPTZ,
                received_at     TIMESTAMPTZ,
                is_read         BOOLEAN DEFAULT false,
                is_starred      BOOLEAN DEFAULT false,
                is_draft        BOOLEAN DEFAULT false,
                has_attachments BOOLEAN DEFAULT false,
                snippet         TEXT,
                labels          JSONB DEFAULT '[]',
                tracking_token  VARCHAR(100) UNIQUE,
                opens_count     INT DEFAULT 0,
                clicks_count    INT DEFAULT 0,
                created_at      TIMESTAMPTZ DEFAULT NOW()
              );

              CREATE UNIQUE INDEX IF NOT EXISTS idx_emails_message_id
                ON "${schema}".emails(account_id, message_id);
              CREATE INDEX IF NOT EXISTS idx_emails_thread
                ON "${schema}".emails(thread_id);
              CREATE INDEX IF NOT EXISTS idx_emails_from
                ON "${schema}".emails(from_email);
              CREATE INDEX IF NOT EXISTS idx_emails_sent_at
                ON "${schema}".emails(sent_at DESC);
              CREATE INDEX IF NOT EXISTS idx_emails_account_id
                ON "${schema}".emails(account_id);

              -- Polymorphic CRM record links
              CREATE TABLE IF NOT EXISTS "${schema}".email_links (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email_id    UUID NOT NULL REFERENCES "${schema}".emails(id) ON DELETE CASCADE,
                entity_type VARCHAR(30) NOT NULL,
                entity_id   UUID NOT NULL,
                linked_by   UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
                auto_linked BOOLEAN DEFAULT false,
                created_at  TIMESTAMPTZ DEFAULT NOW()
              );

              DO $$ BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM pg_constraint WHERE conname = 'uq_email_links_email_entity'
                ) THEN
                  ALTER TABLE "${schema}".email_links
                    ADD CONSTRAINT uq_email_links_email_entity UNIQUE (email_id, entity_type, entity_id);
                END IF;
              END $$;

              CREATE INDEX IF NOT EXISTS idx_email_links_entity
                ON "${schema}".email_links(entity_type, entity_id);
              CREATE INDEX IF NOT EXISTS idx_email_links_email
                ON "${schema}".email_links(email_id);

              -- Attachments metadata
              CREATE TABLE IF NOT EXISTS "${schema}".email_attachments (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email_id    UUID NOT NULL REFERENCES "${schema}".emails(id) ON DELETE CASCADE,
                filename    VARCHAR(512),
                mime_type   VARCHAR(255),
                size_bytes  INT,
                storage_url TEXT,
                created_at  TIMESTAMPTZ DEFAULT NOW()
              );

              CREATE INDEX IF NOT EXISTS idx_email_attachments_email
                ON "${schema}".email_attachments(email_id);

              -- Open/click tracking events
              CREATE TABLE IF NOT EXISTS "${schema}".email_tracking_events (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email_id    UUID NOT NULL REFERENCES "${schema}".emails(id) ON DELETE CASCADE,
                type        VARCHAR(10) NOT NULL,
                url         TEXT,
                ip          VARCHAR(45),
                user_agent  TEXT,
                occurred_at TIMESTAMPTZ DEFAULT NOW()
              );

              CREATE INDEX IF NOT EXISTS idx_email_tracking_email
                ON "${schema}".email_tracking_events(email_id);
            `,
          },
          {
            name: '038_email_role_permissions',
            sql: `
              UPDATE "${schema}".roles SET
                permissions = permissions || '{"email":{"view":true,"create":true,"edit":true,"delete":true}}'::jsonb
              WHERE name = 'admin' AND NOT (permissions ? 'email');

              UPDATE "${schema}".roles SET
                permissions = permissions || '{"email":{"view":true,"create":true,"edit":true,"delete":false}}'::jsonb
              WHERE name = 'manager' AND NOT (permissions ? 'email');

              UPDATE "${schema}".roles SET
                permissions = permissions || '{"email":{"view":true,"create":true,"edit":true,"delete":false}}'::jsonb
              WHERE name = 'user' AND NOT (permissions ? 'email');
            `,
          },

          // ── 039 Email Inbox Rules ──────────────────────────────
          {
            name: '039_email_inbox_rules',
            sql: `
              CREATE TABLE IF NOT EXISTS "${schema}".email_inbox_rules (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT true,
                apply_to VARCHAR(20) NOT NULL DEFAULT 'inbound',
                conditions JSONB NOT NULL DEFAULT '[]',
                actions JSONB NOT NULL DEFAULT '[]',
                stop_processing BOOLEAN NOT NULL DEFAULT false,
                priority INT NOT NULL DEFAULT 0,
                created_by UUID REFERENCES "${schema}".users(id),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                deleted_at TIMESTAMPTZ
              );
              CREATE INDEX IF NOT EXISTS idx_email_inbox_rules_active
                ON "${schema}".email_inbox_rules(is_active) WHERE deleted_at IS NULL;
            `,
          },
          {
            name: '040_user_email_signature',
            sql: `
              ALTER TABLE "${schema}".users
                ADD COLUMN IF NOT EXISTS email_signature TEXT;
            `,
          },
          {
            name: '041_emails_deleted_at',
            sql: `
              ALTER TABLE "${schema}".emails
                ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
              CREATE INDEX IF NOT EXISTS idx_emails_deleted_at
                ON "${schema}".emails(deleted_at)
                WHERE deleted_at IS NOT NULL;
            `,
          },
          {
            name: '043_add_pinned_column_to_table_preferences',
            sql: `
              ALTER TABLE "${schema}".user_table_preferences
                ADD COLUMN IF NOT EXISTS pinned_column VARCHAR(100);
            `,
          },
          {
            name: '044_general_settings',
            sql: `
              -- ── Company Settings (one row per tenant) ──────────────────────
              CREATE TABLE IF NOT EXISTS "${schema}".company_settings (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                company_name    VARCHAR(255),
                tagline         VARCHAR(500),
                email           VARCHAR(255),
                phone           VARCHAR(100),
                website         VARCHAR(500),
                logo_url        VARCHAR(1000),
                address_line1   VARCHAR(255),
                address_line2   VARCHAR(255),
                city            VARCHAR(100),
                state           VARCHAR(100),
                country         VARCHAR(100),
                postal_code     VARCHAR(30),
                tax_id          VARCHAR(100),
                registration_no VARCHAR(100),
                currency        VARCHAR(10) DEFAULT 'USD',
                updated_at      TIMESTAMPTZ DEFAULT NOW()
              );

              INSERT INTO "${schema}".company_settings (company_name)
              VALUES (NULL)
              ON CONFLICT DO NOTHING;

              -- ── Industries (dynamic admin-managed list) ────────────────────
              CREATE TABLE IF NOT EXISTS "${schema}".industries (
                id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name       VARCHAR(150) NOT NULL,
                is_active  BOOLEAN DEFAULT true,
                is_system  BOOLEAN DEFAULT false,
                sort_order INT DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(name)
              );

              INSERT INTO "${schema}".industries (name, is_system, sort_order) VALUES
                ('Technology',           true,  1),
                ('Healthcare',           true,  2),
                ('Finance & Banking',    true,  3),
                ('Retail / E-commerce',  true,  4),
                ('Education',            true,  5),
                ('Manufacturing',        true,  6),
                ('Real Estate',          true,  7),
                ('Logistics',            true,  8),
                ('Insurance',            true,  9),
                ('Telecommunications',   true, 10),
                ('Media & Entertainment',true, 11),
                ('Food & Beverages',     true, 12),
                ('Automotive',           true, 13),
                ('Pharmaceutical',       true, 14),
                ('Construction',         true, 15),
                ('NGO / Non-Profit',     true, 16),
                ('Government',           true, 17),
                ('Other',                true, 99)
              ON CONFLICT (name) DO NOTHING;

              -- ── Add industry column to leads, contacts, opportunities ──────
              ALTER TABLE "${schema}".leads
                ADD COLUMN IF NOT EXISTS industry VARCHAR(150);

              ALTER TABLE "${schema}".contacts
                ADD COLUMN IF NOT EXISTS industry VARCHAR(150);

              ALTER TABLE "${schema}".opportunities
                ADD COLUMN IF NOT EXISTS industry VARCHAR(150);

              CREATE INDEX IF NOT EXISTS idx_industries_active
                ON "${schema}".industries(is_active);
              CREATE INDEX IF NOT EXISTS idx_leads_industry
                ON "${schema}".leads(industry);
              CREATE INDEX IF NOT EXISTS idx_contacts_industry
                ON "${schema}".contacts(industry);
              CREATE INDEX IF NOT EXISTS idx_opportunities_industry
                ON "${schema}".opportunities(industry);
            `,
          },
          {
            name: '042_fix_leads_field_validation_rules',
            sql: `
              -- Ensure leads field validation rules are correctly configured:
              -- Rule 1: any_one for name (firstName OR lastName OR company)
              -- Rule 2: any_one for contact (email OR phone OR mobile)
              -- Remove any duplicate/empty-message rules
              UPDATE "${schema}".module_settings
              SET setting_value = jsonb_build_object(
                'rules', jsonb_build_array(
                  jsonb_build_object(
                    'id',       'default-leads-1',
                    'type',     'any_one',
                    'label',    'Name or Company',
                    'fields',   '["lastName","firstName","company"]'::jsonb,
                    'message',  'At least one of first name, last name, or company is required',
                    'isActive', true
                  ),
                  jsonb_build_object(
                    'id',       'default-leads-2',
                    'type',     'any_one',
                    'label',    'Contact Info',
                    'fields',   '["email","phone","mobile"]'::jsonb,
                    'message',  'At least one of email, phone, or mobile is required',
                    'isActive', true
                  )
                )
              ),
              updated_at = NOW()
              WHERE module = 'leads' AND setting_key = 'fieldValidation';
            `,
          },
          {
            name: '045_industry_column',
            sql: `
              ALTER TABLE "${schema}".leads
                ADD COLUMN IF NOT EXISTS industry VARCHAR(255);

              ALTER TABLE "${schema}".opportunities
                ADD COLUMN IF NOT EXISTS industry VARCHAR(255);

              ALTER TABLE "${schema}".contacts
                ADD COLUMN IF NOT EXISTS industry VARCHAR(255);
            `,
          },
          {
            name: '046_sales_reports',
            sql: `
              -- ── Ensure folder exists ──
              INSERT INTO "${schema}".report_folders (name, is_system)
              SELECT 'Revenue & Forecasting', true
              WHERE NOT EXISTS (
                SELECT 1 FROM "${schema}".report_folders
                WHERE name = 'Revenue & Forecasting' AND is_system = true
              );

              -- 1. Rep Performance Summary
              INSERT INTO "${schema}".reports
                (name, description, category, report_type, chart_type, data_source, config, is_system, is_public, folder_id)
              SELECT
                'Rep Performance Summary',
                'Closed-won deals, total revenue, average deal size and win rate per sales rep',
                'revenue', 'summary', 'table', 'opportunities',
                '{"measures":[{"field":"id","aggregate":"count","label":"Deals Won","format":"number"},{"field":"amount","aggregate":"sum","label":"Revenue","format":"currency"},{"field":"amount","aggregate":"avg","label":"Avg Deal Size","format":"currency"},{"field":"days_to_close","aggregate":"avg","label":"Avg Days to Close","format":"number"}],"dimensions":[{"field":"owner_name","type":"field","label":"Rep"}],"filters":[{"field":"won_at","operator":"is_not_null","value":null}],"orderBy":[{"field":"amount_sum","direction":"DESC"}]}'::jsonb,
                true, true,
                (SELECT id FROM "${schema}".report_folders WHERE name = 'Revenue & Forecasting' AND is_system = true LIMIT 1)
              WHERE NOT EXISTS (
                SELECT 1 FROM "${schema}".reports WHERE name = 'Rep Performance Summary' AND is_system = true
              );

              -- 2. Revenue by Quarter
              INSERT INTO "${schema}".reports
                (name, description, category, report_type, chart_type, data_source, config, is_system, is_public, folder_id)
              SELECT
                'Revenue by Quarter',
                'Closed-won revenue totals grouped by quarter — tracks YTD and seasonal trends',
                'revenue', 'summary', 'bar', 'opportunities',
                '{"measures":[{"field":"amount","aggregate":"sum","label":"Revenue","format":"currency"},{"field":"id","aggregate":"count","label":"Deals Won","format":"number"}],"dimensions":[{"field":"won_at","type":"date","dateGranularity":"quarter","label":"Quarter"}],"filters":[{"field":"won_at","operator":"is_not_null","value":null}],"orderBy":[{"field":"won_at","direction":"ASC"}]}'::jsonb,
                true, true,
                (SELECT id FROM "${schema}".report_folders WHERE name = 'Revenue & Forecasting' AND is_system = true LIMIT 1)
              WHERE NOT EXISTS (
                SELECT 1 FROM "${schema}".reports WHERE name = 'Revenue by Quarter' AND is_system = true
              );

              -- 3. Rep Quarterly Breakdown
              INSERT INTO "${schema}".reports
                (name, description, category, report_type, chart_type, data_source, config, is_system, is_public, folder_id)
              SELECT
                'Rep Quarterly Breakdown',
                'Revenue contribution per sales rep grouped by quarter — shows seasonal and individual trends',
                'revenue', 'summary', 'stacked_bar', 'opportunities',
                '{"measures":[{"field":"amount","aggregate":"sum","label":"Revenue","format":"currency"}],"dimensions":[{"field":"won_at","type":"date","dateGranularity":"quarter","label":"Quarter"},{"field":"owner_name","type":"field","label":"Rep"}],"filters":[{"field":"won_at","operator":"is_not_null","value":null}],"orderBy":[{"field":"won_at","direction":"ASC"}]}'::jsonb,
                true, true,
                (SELECT id FROM "${schema}".report_folders WHERE name = 'Revenue & Forecasting' AND is_system = true LIMIT 1)
              WHERE NOT EXISTS (
                SELECT 1 FROM "${schema}".reports WHERE name = 'Rep Quarterly Breakdown' AND is_system = true
              );

              -- 4. Revenue by Industry
              INSERT INTO "${schema}".reports
                (name, description, category, report_type, chart_type, data_source, config, is_system, is_public, folder_id)
              SELECT
                'Revenue by Industry',
                'Closed-won revenue split by industry — identifies highest-value verticals',
                'revenue', 'summary', 'pie', 'opportunities',
                '{"measures":[{"field":"amount","aggregate":"sum","label":"Revenue","format":"currency"},{"field":"id","aggregate":"count","label":"Deals","format":"number"}],"dimensions":[{"field":"industry","type":"field","label":"Industry"}],"filters":[{"field":"won_at","operator":"is_not_null","value":null}],"orderBy":[{"field":"amount_sum","direction":"DESC"}],"limit":10}'::jsonb,
                true, true,
                (SELECT id FROM "${schema}".report_folders WHERE name = 'Revenue & Forecasting' AND is_system = true LIMIT 1)
              WHERE NOT EXISTS (
                SELECT 1 FROM "${schema}".reports WHERE name = 'Revenue by Industry' AND is_system = true
              );

              -- 5. Revenue by Deal Type
              INSERT INTO "${schema}".reports
                (name, description, category, report_type, chart_type, data_source, config, is_system, is_public, folder_id)
              SELECT
                'Revenue by Deal Type',
                'Closed-won revenue split by deal type — e.g. New Business vs Cross-sell vs Renewal',
                'revenue', 'summary', 'pie', 'opportunities',
                '{"measures":[{"field":"amount","aggregate":"sum","label":"Revenue","format":"currency"},{"field":"id","aggregate":"count","label":"Deals","format":"number"}],"dimensions":[{"field":"type","type":"field","label":"Deal Type"}],"filters":[{"field":"won_at","operator":"is_not_null","value":null}],"orderBy":[{"field":"amount_sum","direction":"DESC"}]}'::jsonb,
                true, true,
                (SELECT id FROM "${schema}".report_folders WHERE name = 'Revenue & Forecasting' AND is_system = true LIMIT 1)
              WHERE NOT EXISTS (
                SELECT 1 FROM "${schema}".reports WHERE name = 'Revenue by Deal Type' AND is_system = true
              );

              -- 6. Closed Deals List
              INSERT INTO "${schema}".reports
                (name, description, category, report_type, chart_type, data_source, config, is_system, is_public, folder_id)
              SELECT
                'Closed Deals List',
                'All closed-won deals with rep, account, industry, type and revenue — exportable transactions log',
                'revenue', 'tabular', 'table', 'opportunities',
                '{"measures":[],"dimensions":[],"fields":["owner_name","account_name","industry","type","amount","won_at"],"filters":[{"field":"won_at","operator":"is_not_null","value":null}],"orderBy":[{"field":"won_at","direction":"DESC"}],"limit":200}'::jsonb,
                true, true,
                (SELECT id FROM "${schema}".report_folders WHERE name = 'Revenue & Forecasting' AND is_system = true LIMIT 1)
              WHERE NOT EXISTS (
                SELECT 1 FROM "${schema}".reports WHERE name = 'Closed Deals List' AND is_system = true
              );
            `,
          },
          {
            name: '047_task_reports',
            sql: `
              -- Ensure folder exists
              INSERT INTO "${schema}".report_folders (name, is_system)
              SELECT 'Activities & Productivity', true
              WHERE NOT EXISTS (
                SELECT 1 FROM "${schema}".report_folders
                WHERE name = 'Activities & Productivity' AND is_system = true
              );

              -- 1. Tasks by Type per User
              INSERT INTO "${schema}".reports
                (name, description, category, report_type, chart_type, data_source, config, is_system, is_public, folder_id)
              SELECT
                'Tasks by Type per User',
                'Count of tasks grouped by task type and assigned user — filter by type to see demos, calls, meetings etc. per rep',
                'activity', 'summary', 'bar', 'tasks',
                '{"measures":[{"field":"id","aggregate":"count","label":"Tasks","format":"number"}],"dimensions":[{"field":"owner_name","type":"field","label":"Assigned To"},{"field":"task_type_name","type":"field","label":"Task Type"}],"filters":[],"orderBy":[{"field":"id_count","direction":"DESC"}]}'::jsonb,
                true, true,
                (SELECT id FROM "${schema}".report_folders WHERE name = 'Activities & Productivity' AND is_system = true LIMIT 1)
              WHERE NOT EXISTS (
                SELECT 1 FROM "${schema}".reports WHERE name = 'Tasks by Type per User' AND is_system = true
              );

              -- 2. Task Volume Trend by Type
              INSERT INTO "${schema}".reports
                (name, description, category, report_type, chart_type, data_source, config, is_system, is_public, folder_id)
              SELECT
                'Task Volume Trend by Type',
                'Monthly task creation trend split by task type — see which activity types are growing or declining',
                'activity', 'summary', 'stacked_bar', 'tasks',
                '{"measures":[{"field":"id","aggregate":"count","label":"Tasks","format":"number"}],"dimensions":[{"field":"created_at","type":"date","dateGranularity":"month","label":"Month"},{"field":"task_type_name","type":"field","label":"Task Type"}],"filters":[],"orderBy":[{"field":"created_at","direction":"ASC"}]}'::jsonb,
                true, true,
                (SELECT id FROM "${schema}".report_folders WHERE name = 'Activities & Productivity' AND is_system = true LIMIT 1)
              WHERE NOT EXISTS (
                SELECT 1 FROM "${schema}".reports WHERE name = 'Task Volume Trend by Type' AND is_system = true
              );

              -- 3. Task Completion Rate by User
              INSERT INTO "${schema}".reports
                (name, description, category, report_type, chart_type, data_source, config, is_system, is_public, folder_id)
              SELECT
                'Task Completion Rate by User',
                'Total, completed and overdue tasks per user — measures follow-through on all task types',
                'activity', 'summary', 'table', 'tasks',
                '{"measures":[{"field":"id","aggregate":"count","label":"Total Tasks","format":"number"},{"field":"completed_at","aggregate":"count","label":"Completed","format":"number"}],"dimensions":[{"field":"owner_name","type":"field","label":"Assigned To"}],"filters":[],"orderBy":[{"field":"id_count","direction":"DESC"}]}'::jsonb,
                true, true,
                (SELECT id FROM "${schema}".report_folders WHERE name = 'Activities & Productivity' AND is_system = true LIMIT 1)
              WHERE NOT EXISTS (
                SELECT 1 FROM "${schema}".reports WHERE name = 'Task Completion Rate by User' AND is_system = true
              );

              -- 4. Overdue Tasks by User
              INSERT INTO "${schema}".reports
                (name, description, category, report_type, chart_type, data_source, config, is_system, is_public, folder_id)
              SELECT
                'Overdue Tasks by User',
                'Open tasks past their due date grouped by assigned user — identifies follow-up gaps',
                'activity', 'summary', 'bar', 'tasks',
                '{"measures":[{"field":"id","aggregate":"count","label":"Overdue Tasks","format":"number"}],"dimensions":[{"field":"owner_name","type":"field","label":"Assigned To"}],"filters":[{"field":"task_status","operator":"eq","value":"Overdue"}],"orderBy":[{"field":"id_count","direction":"DESC"}]}'::jsonb,
                true, true,
                (SELECT id FROM "${schema}".report_folders WHERE name = 'Activities & Productivity' AND is_system = true LIMIT 1)
              WHERE NOT EXISTS (
                SELECT 1 FROM "${schema}".reports WHERE name = 'Overdue Tasks by User' AND is_system = true
              );

              -- 5. Tasks Linked to Leads by Type
              INSERT INTO "${schema}".reports
                (name, description, category, report_type, chart_type, data_source, config, is_system, is_public, folder_id)
              SELECT
                'Tasks Linked to Leads by Type',
                'Tasks created against leads, grouped by task type per user — shows lead gen activity breakdown',
                'activity', 'summary', 'bar', 'tasks',
                '{"measures":[{"field":"id","aggregate":"count","label":"Tasks","format":"number"}],"dimensions":[{"field":"owner_name","type":"field","label":"Assigned To"},{"field":"task_type_name","type":"field","label":"Task Type"}],"filters":[{"field":"entity_type","operator":"eq","value":"leads"}],"orderBy":[{"field":"id_count","direction":"DESC"}]}'::jsonb,
                true, true,
                (SELECT id FROM "${schema}".report_folders WHERE name = 'Activities & Productivity' AND is_system = true LIMIT 1)
              WHERE NOT EXISTS (
                SELECT 1 FROM "${schema}".reports WHERE name = 'Tasks Linked to Leads by Type' AND is_system = true
              );
            `,
          },
          {
            name: '048_general_settings_country_currency',
            sql: `
              -- ── company_settings: add locale columns ─────────────────
              ALTER TABLE "${schema}".company_settings
                ADD COLUMN IF NOT EXISTS base_country      VARCHAR(2)   DEFAULT NULL,
                ADD COLUMN IF NOT EXISTS base_city         VARCHAR(100) DEFAULT NULL,
                ADD COLUMN IF NOT EXISTS default_currency  VARCHAR(3)   DEFAULT 'USD',
                ADD COLUMN IF NOT EXISTS timezone          VARCHAR(50)  DEFAULT 'UTC';

              -- ── currencies ────────────────────────────────────────────
              CREATE TABLE IF NOT EXISTS "${schema}".currencies (
                id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                code           VARCHAR(3)   NOT NULL,
                name           VARCHAR(100) NOT NULL,
                symbol         VARCHAR(10)  NOT NULL,
                decimal_places INT          NOT NULL DEFAULT 2,
                is_active      BOOLEAN      NOT NULL DEFAULT true,
                is_default     BOOLEAN      NOT NULL DEFAULT false,
                sort_order     INT          NOT NULL DEFAULT 0,
                created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                UNIQUE(code)
              );
              CREATE INDEX IF NOT EXISTS idx_currencies_active  ON "${schema}".currencies(is_active);
              CREATE INDEX IF NOT EXISTS idx_currencies_default ON "${schema}".currencies(is_default);

              INSERT INTO "${schema}".currencies
                (code, name, symbol, decimal_places, is_active, is_default, sort_order)
              VALUES
                ('USD','US Dollar',         '$',   2,true,true, 1),
                ('EUR','Euro',              '€',   2,true,false, 2),
                ('GBP','British Pound',     '£',   2,true,false, 3),
                ('AED','UAE Dirham',        'د.إ', 2,true,false, 4),
                ('SAR','Saudi Riyal',       '﷼',   2,true,false, 5),
                ('PKR','Pakistani Rupee',   '₨',   0,true,false, 6),
                ('INR','Indian Rupee',      '₹',   2,true,false, 7),
                ('CAD','Canadian Dollar',   'CA$', 2,true,false, 8),
                ('AUD','Australian Dollar', 'A$',  2,true,false, 9),
                ('CHF','Swiss Franc',       'Fr',  2,true,false,10),
                ('JPY','Japanese Yen',      '¥',   0,true,false,11),
                ('CNY','Chinese Yuan',      '¥',   2,true,false,12),
                ('SGD','Singapore Dollar',  'S$',  2,true,false,13),
                ('HKD','Hong Kong Dollar',  'HK$', 2,true,false,14),
                ('SEK','Swedish Krona',     'kr',  2,true,false,15),
                ('NOK','Norwegian Krone',   'kr',  2,true,false,16),
                ('DKK','Danish Krone',      'kr',  2,true,false,17),
                ('MYR','Malaysian Ringgit', 'RM',  2,true,false,18),
                ('QAR','Qatari Riyal',      'QR',  2,true,false,19),
                ('KWD','Kuwaiti Dinar',     'KD',  3,true,false,20)
              ON CONFLICT (code) DO NOTHING;

              -- ── contacts: add country_code + phone_country_code ───────
              ALTER TABLE "${schema}".contacts
                ADD COLUMN IF NOT EXISTS country_code        VARCHAR(2) DEFAULT NULL,
                ADD COLUMN IF NOT EXISTS phone_country_code  VARCHAR(2) DEFAULT NULL,
                ADD COLUMN IF NOT EXISTS mobile_country_code VARCHAR(2) DEFAULT NULL;

              -- ── leads: add country_code + phone_country_code ──────────
              ALTER TABLE "${schema}".leads
                ADD COLUMN IF NOT EXISTS country_code        VARCHAR(2) DEFAULT NULL,
                ADD COLUMN IF NOT EXISTS phone_country_code  VARCHAR(2) DEFAULT NULL,
                ADD COLUMN IF NOT EXISTS mobile_country_code VARCHAR(2) DEFAULT NULL;

              -- ── accounts: add country_code + phone_country_code ───────
              ALTER TABLE "${schema}".accounts
                ADD COLUMN IF NOT EXISTS country_code        VARCHAR(2) DEFAULT NULL,
                ADD COLUMN IF NOT EXISTS phone_country_code  VARCHAR(2) DEFAULT NULL;
            `,
          },
          {
            name: '049_workflow_engine',
            sql: `
              -- Drop old routing table (no customers, safe to drop)
              DROP TABLE IF EXISTS "${schema}".lead_routing_rules;

              -- ── WORKFLOWS ─────────────────────────────────────────────
              CREATE TABLE IF NOT EXISTS "${schema}".workflows (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name            VARCHAR(255) NOT NULL,
                description     TEXT,
                trigger_module  VARCHAR(50)  NOT NULL,
                trigger_type    VARCHAR(100) NOT NULL,
                trigger_filters JSONB        NOT NULL DEFAULT '{"match":"all","items":[]}',
                is_active       BOOLEAN      NOT NULL DEFAULT true,
                version         INT          NOT NULL DEFAULT 1,
                created_by      UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
                created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
              );
              CREATE INDEX IF NOT EXISTS idx_workflows_module
                ON "${schema}".workflows(trigger_module);
              CREATE INDEX IF NOT EXISTS idx_workflows_active
                ON "${schema}".workflows(is_active);
              CREATE INDEX IF NOT EXISTS idx_workflows_trigger
                ON "${schema}".workflows(trigger_module, trigger_type);

              -- ── WORKFLOW ACTIONS ──────────────────────────────────────
              CREATE TABLE IF NOT EXISTS "${schema}".workflow_actions (
                id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                workflow_id      UUID NOT NULL
                                   REFERENCES "${schema}".workflows(id) ON DELETE CASCADE,
                action_type      VARCHAR(50) NOT NULL,
                config           JSONB       NOT NULL DEFAULT '{}',
                sort_order       INT         NOT NULL DEFAULT 0,
                parent_action_id UUID REFERENCES "${schema}".workflow_actions(id) ON DELETE CASCADE,
                branch           VARCHAR(10) DEFAULT NULL,
                created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
              );
              CREATE INDEX IF NOT EXISTS idx_workflow_actions_workflow
                ON "${schema}".workflow_actions(workflow_id);
              CREATE INDEX IF NOT EXISTS idx_workflow_actions_parent
                ON "${schema}".workflow_actions(parent_action_id);
              CREATE INDEX IF NOT EXISTS idx_workflow_actions_order
                ON "${schema}".workflow_actions(workflow_id, sort_order);

              -- ── WORKFLOW RUNS ─────────────────────────────────────────
              CREATE TABLE IF NOT EXISTS "${schema}".workflow_runs (
                id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                workflow_id       UUID NOT NULL
                                    REFERENCES "${schema}".workflows(id) ON DELETE CASCADE,
                trigger_module    VARCHAR(50)  NOT NULL,
                trigger_type      VARCHAR(100) NOT NULL,
                trigger_entity_id UUID,
                trigger_payload   JSONB        NOT NULL DEFAULT '{}',
                status            VARCHAR(20)  NOT NULL DEFAULT 'running',
                error             TEXT,
                started_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                finished_at       TIMESTAMPTZ
              );
              CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow
                ON "${schema}".workflow_runs(workflow_id);
              CREATE INDEX IF NOT EXISTS idx_workflow_runs_entity
                ON "${schema}".workflow_runs(trigger_entity_id);
              CREATE INDEX IF NOT EXISTS idx_workflow_runs_status
                ON "${schema}".workflow_runs(status);
              CREATE INDEX IF NOT EXISTS idx_workflow_runs_started
                ON "${schema}".workflow_runs(started_at DESC);

              -- ── WORKFLOW RUN STEPS ────────────────────────────────────
              CREATE TABLE IF NOT EXISTS "${schema}".workflow_run_steps (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                run_id      UUID NOT NULL
                              REFERENCES "${schema}".workflow_runs(id) ON DELETE CASCADE,
                action_id   UUID REFERENCES "${schema}".workflow_actions(id) ON DELETE SET NULL,
                action_type VARCHAR(50)  NOT NULL,
                status      VARCHAR(20)  NOT NULL DEFAULT 'pending',
                result      JSONB,
                error       TEXT,
                started_at  TIMESTAMPTZ,
                finished_at TIMESTAMPTZ
              );
              CREATE INDEX IF NOT EXISTS idx_workflow_run_steps_run
                ON "${schema}".workflow_run_steps(run_id);
              CREATE INDEX IF NOT EXISTS idx_workflow_run_steps_action
                ON "${schema}".workflow_run_steps(action_id);

              -- ── RBAC: add automation permission to roles ──────────────
              UPDATE "${schema}".roles
              SET permissions = permissions || '{"automation":{"view":true,"create":true,"edit":true,"delete":true}}'::jsonb
              WHERE name = 'admin';

              UPDATE "${schema}".roles
              SET permissions = permissions || '{"automation":{"view":true,"create":false,"edit":false,"delete":false}}'::jsonb
              WHERE name IN ('manager', 'user');
            `,
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
      team_id UUID REFERENCES "${schema}".teams(id) ON DELETE SET NULL,
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
    CREATE INDEX IF NOT EXISTS idx_leads_team ON "${schema}".leads(team_id);
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
      team_id UUID REFERENCES "${schema}".teams(id) ON DELETE SET NULL,
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
    CREATE INDEX IF NOT EXISTS idx_opportunities_team ON "${schema}".opportunities(team_id) WHERE deleted_at IS NULL;
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

    -- Permissions
    GRANT ALL ON ALL TABLES IN SCHEMA "${schema}" TO intelli_hiper_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "${schema}" TO intelli_hiper_app;
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

    -- Permissions
    GRANT ALL ON ALL TABLES IN SCHEMA "${schema}" TO intelli_hiper_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "${schema}" TO intelli_hiper_app;
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
      
    -- Permissions
    GRANT ALL ON ALL TABLES IN SCHEMA "${schema}" TO intelli_hiper_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "${schema}" TO intelli_hiper_app;
  `;
}

function buildNotificationsMigration(schema: string): string {
  return `
    -- 1. Notifications
    CREATE TABLE IF NOT EXISTS "${schema}".notifications (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID NOT NULL REFERENCES "${schema}".users(id) ON DELETE CASCADE,
        type            VARCHAR(50) NOT NULL,
        title           VARCHAR(500) NOT NULL,
        body            TEXT,
        icon            VARCHAR(50),
        action_url      VARCHAR(500),
        entity_type     VARCHAR(50),
        entity_id       UUID,
        metadata        JSONB DEFAULT '{}',
        channels        TEXT[] DEFAULT '{}',
        is_read         BOOLEAN DEFAULT false,
        read_at         TIMESTAMPTZ,
        is_dismissed    BOOLEAN DEFAULT false,
        created_at      TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON "${schema}".notifications(user_id, is_read, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notifications_entity ON "${schema}".notifications(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_type ON "${schema}".notifications(type, created_at DESC);

    -- 2. Notification preferences
    CREATE TABLE IF NOT EXISTS "${schema}".notification_preferences (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID NOT NULL REFERENCES "${schema}".users(id) ON DELETE CASCADE,
        event_type      VARCHAR(50) NOT NULL,
        in_app          BOOLEAN DEFAULT true,
        email           BOOLEAN DEFAULT true,
        browser_push    BOOLEAN DEFAULT false,
        sms             BOOLEAN DEFAULT false,
        whatsapp        BOOLEAN DEFAULT false,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, event_type)
    );
    CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON "${schema}".notification_preferences(user_id);

    -- 3. Notification templates
    CREATE TABLE IF NOT EXISTS "${schema}".notification_templates (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type      VARCHAR(50) NOT NULL UNIQUE,
        name            VARCHAR(200) NOT NULL,
        email_subject   VARCHAR(500),
        email_body_html TEXT,
        email_body_text TEXT,
        sms_body        VARCHAR(500),
        whatsapp_template_id VARCHAR(100),
        is_active       BOOLEAN DEFAULT true,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW()
    );

    -- 4. Push subscriptions
    CREATE TABLE IF NOT EXISTS "${schema}".push_subscriptions (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID NOT NULL REFERENCES "${schema}".users(id) ON DELETE CASCADE,
        endpoint        TEXT NOT NULL,
        p256dh          TEXT NOT NULL,
        auth            TEXT NOT NULL,
        user_agent      VARCHAR(500),
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, endpoint)
    );
    CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON "${schema}".push_subscriptions(user_id);

    -- 5. Notification settings
    CREATE TABLE IF NOT EXISTS "${schema}".notification_settings (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        setting_key     VARCHAR(100) NOT NULL UNIQUE,
        setting_value   JSONB NOT NULL DEFAULT '{}',
        updated_at      TIMESTAMPTZ DEFAULT NOW()
    );

    -- SEED: Templates
    INSERT INTO "${schema}".notification_templates (event_type, name, email_subject, email_body_html, email_body_text, sms_body) VALUES
      ('task_assigned', 'Task Assigned',
       'New task assigned: {{taskTitle}}',
       '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#1e293b">New Task Assigned</h2><p>Hi {{assigneeName}},</p><p>You have been assigned a new task:</p><div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:16px 0"><p style="font-weight:600;font-size:16px;margin:0 0 8px">{{taskTitle}}</p><p style="color:#64748b;margin:0">Due: {{dueDate}}</p><p style="color:#64748b;margin:4px 0 0">Priority: {{priority}}</p></div><p><a href="{{actionUrl}}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">View Task</a></p></div>',
       'Hi {{assigneeName}}, you have been assigned: {{taskTitle}} - Due {{dueDate}}. View: {{actionUrl}}',
       'New task: {{taskTitle}} - Due {{dueDate}}'),
      ('task_due_reminder', 'Task Due Reminder',
       'Reminder: {{taskTitle}} is due {{dueLabel}}',
       '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#1e293b">Task Reminder</h2><p>Hi {{userName}},</p><p>Your task <strong>{{taskTitle}}</strong> is due <strong>{{dueLabel}}</strong>.</p><p><a href="{{actionUrl}}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">View Task</a></p></div>',
       'Hi {{userName}}, your task "{{taskTitle}}" is due {{dueLabel}}. View: {{actionUrl}}',
       'Reminder: {{taskTitle}} due {{dueLabel}}'),
      ('task_overdue', 'Task Overdue',
       'Overdue: {{taskTitle}}',
       '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#dc2626">Task Overdue</h2><p>Hi {{userName}},</p><p>Your task <strong>{{taskTitle}}</strong> is now <span style="color:#dc2626;font-weight:600">overdue</span> (was due {{dueDate}}).</p><p><a href="{{actionUrl}}" style="display:inline-block;background:#dc2626;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">View Task</a></p></div>',
       'Hi {{userName}}, your task "{{taskTitle}}" is OVERDUE (was due {{dueDate}}). View: {{actionUrl}}',
       'OVERDUE: {{taskTitle}} was due {{dueDate}}'),
      ('task_completed', 'Task Completed',
       'Task completed: {{taskTitle}}',
       '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#16a34a">Task Completed</h2><p>Hi {{ownerName}},</p><p>Task <strong>{{taskTitle}}</strong> has been completed by {{completedBy}}.</p><p><a href="{{actionUrl}}" style="display:inline-block;background:#16a34a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">View Task</a></p></div>',
       'Hi {{ownerName}}, task "{{taskTitle}}" completed by {{completedBy}}.',
       NULL),
      ('meeting_reminder', 'Meeting Reminder',
       'Reminder: {{meetingTitle}} {{dueLabel}}',
       '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#1e293b">Meeting Reminder</h2><p>Hi {{userName}},</p><p>Your meeting <strong>{{meetingTitle}}</strong> starts <strong>{{dueLabel}}</strong>.</p><div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:16px 0"><p style="margin:0">When: {{dateTime}}</p><p style="margin:4px 0 0">Where: {{location}}</p></div><p><a href="{{actionUrl}}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">View Meeting</a></p></div>',
       'Hi {{userName}}, meeting "{{meetingTitle}}" starts {{dueLabel}}. {{location}}',
       'Meeting: {{meetingTitle}} {{dueLabel}}'),
      ('meeting_booked', 'Meeting Booked',
       'New meeting booked: {{meetingTitle}}',
       '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#1e293b">New Meeting Booked</h2><p>Hi {{hostName}},</p><p>A new meeting has been booked:</p><div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:16px 0"><p style="font-weight:600;font-size:16px;margin:0 0 8px">{{meetingTitle}}</p><p style="color:#64748b;margin:0">With: {{guestName}} ({{guestEmail}})</p><p style="color:#64748b;margin:4px 0 0">When: {{dateTime}}</p><p style="color:#64748b;margin:4px 0 0">Where: {{location}}</p></div><p><a href="{{actionUrl}}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">View Meeting</a></p></div>',
       'Hi {{hostName}}, new meeting booked: "{{meetingTitle}}" with {{guestName}} on {{dateTime}}.',
       'New meeting: {{meetingTitle}} with {{guestName}} on {{dateTime}}'),
      ('meeting_cancelled', 'Meeting Cancelled',
       'Meeting cancelled: {{meetingTitle}}',
       '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#dc2626">Meeting Cancelled</h2><p>Hi {{userName}},</p><p>The meeting <strong>{{meetingTitle}}</strong> scheduled for {{dateTime}} has been cancelled.</p><p style="color:#64748b">Reason: {{reason}}</p></div>',
       'Hi {{userName}}, meeting "{{meetingTitle}}" on {{dateTime}} has been cancelled.',
       'Meeting cancelled: {{meetingTitle}} on {{dateTime}}'),
      ('meeting_rescheduled', 'Meeting Rescheduled',
       'Meeting rescheduled: {{meetingTitle}}',
       '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#f59e0b">Meeting Rescheduled</h2><p>Hi {{userName}},</p><p>The meeting <strong>{{meetingTitle}}</strong> has been rescheduled.</p><div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:16px 0"><p style="color:#dc2626;text-decoration:line-through;margin:0">Old: {{oldDateTime}}</p><p style="color:#16a34a;font-weight:600;margin:4px 0 0">New: {{newDateTime}}</p></div><p><a href="{{actionUrl}}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">View Meeting</a></p></div>',
       'Hi {{userName}}, meeting "{{meetingTitle}}" rescheduled to {{newDateTime}}.',
       'Meeting rescheduled: {{meetingTitle}} to {{newDateTime}}'),
      ('lead_assigned', 'Lead Assigned',
       'New lead assigned: {{leadName}}',
       '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#1e293b">New Lead Assigned</h2><p>Hi {{assigneeName}},</p><p>A new lead has been assigned to you:</p><div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:16px 0"><p style="font-weight:600;font-size:16px;margin:0 0 8px">{{leadName}}</p><p style="color:#64748b;margin:0">Company: {{company}}</p><p style="color:#64748b;margin:4px 0 0">Source: {{source}}</p></div><p><a href="{{actionUrl}}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">View Lead</a></p></div>',
       'Hi {{assigneeName}}, new lead assigned: {{leadName}} from {{company}}. View: {{actionUrl}}',
       'New lead: {{leadName}} from {{company}}'),
      ('mention', 'Mentioned in Note',
       'You were mentioned in a note',
       '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#1e293b">You Were Mentioned</h2><p>Hi {{userName}},</p><p><strong>{{mentionedBy}}</strong> mentioned you in a note on <strong>{{entityName}}</strong>:</p><div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:16px 0;border-left:4px solid #2563eb"><p style="margin:0;color:#475569">{{notePreview}}</p></div><p><a href="{{actionUrl}}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">View Note</a></p></div>',
       'Hi {{userName}}, {{mentionedBy}} mentioned you on {{entityName}}: "{{notePreview}}" View: {{actionUrl}}',
       '{{mentionedBy}} mentioned you on {{entityName}}')
    ON CONFLICT (event_type) DO NOTHING;

    -- SEED: Settings
    INSERT INTO "${schema}".notification_settings (setting_key, setting_value) VALUES
      ('default_preferences', '{"task_assigned":{"in_app":true,"email":true,"browser_push":false,"sms":false,"whatsapp":false},"task_due_reminder":{"in_app":true,"email":true,"browser_push":true,"sms":false,"whatsapp":false},"task_overdue":{"in_app":true,"email":true,"browser_push":true,"sms":false,"whatsapp":false},"task_completed":{"in_app":true,"email":false,"browser_push":false,"sms":false,"whatsapp":false},"meeting_reminder":{"in_app":true,"email":true,"browser_push":true,"sms":false,"whatsapp":false},"meeting_booked":{"in_app":true,"email":true,"browser_push":false,"sms":false,"whatsapp":false},"meeting_cancelled":{"in_app":true,"email":true,"browser_push":false,"sms":false,"whatsapp":false},"meeting_rescheduled":{"in_app":true,"email":true,"browser_push":false,"sms":false,"whatsapp":false},"lead_assigned":{"in_app":true,"email":true,"browser_push":false,"sms":false,"whatsapp":false},"mention":{"in_app":true,"email":true,"browser_push":true,"sms":false,"whatsapp":false}}'),
      ('smtp_config', '{"host":"","port":587,"secure":false,"user":"","pass":"","from":"noreply@hiperteam.com","fromName":"HiperTeam CRM"}'),
      ('twilio_config', '{"accountSid":"","authToken":"","fromPhone":"","whatsappFrom":""}'),
      ('push_config', '{"publicKey":"","privateKey":"","contact":"mailto:admin@hiperteam.com"}')
    ON CONFLICT (setting_key) DO NOTHING;

    -- Permissions
    GRANT ALL ON ALL TABLES IN SCHEMA "${schema}" TO intelli_hiper_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "${schema}" TO intelli_hiper_app;
  `;
}

function buildDashboardMigration(schema: string): string {
  return `
    CREATE TABLE IF NOT EXISTS "${schema}".lead_stage_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id UUID NOT NULL REFERENCES "${schema}".leads(id) ON DELETE CASCADE,
      from_stage_id UUID REFERENCES "${schema}".pipeline_stages(id),
      to_stage_id UUID NOT NULL REFERENCES "${schema}".pipeline_stages(id),
      changed_by UUID REFERENCES "${schema}".users(id),
      time_in_stage INTERVAL,
      note TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_lead_stage_history_lead
      ON "${schema}".lead_stage_history(lead_id);
    CREATE INDEX IF NOT EXISTS idx_lead_stage_history_created
      ON "${schema}".lead_stage_history(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_lead_stage_history_changed_by
      ON "${schema}".lead_stage_history(changed_by);

    CREATE TABLE IF NOT EXISTS "${schema}".user_activity_daily (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES "${schema}".users(id) ON DELETE CASCADE,
      activity_date DATE NOT NULL,
      leads_created INT DEFAULT 0,
      leads_converted INT DEFAULT 0,
      opps_created INT DEFAULT 0,
      opps_won INT DEFAULT 0,
      opps_lost INT DEFAULT 0,
      tasks_completed INT DEFAULT 0,
      tasks_created INT DEFAULT 0,
      activities_logged INT DEFAULT 0,
      calls_made INT DEFAULT 0,
      emails_sent INT DEFAULT 0,
      meetings_held INT DEFAULT 0,
      notes_added INT DEFAULT 0,
      total_revenue_won NUMERIC(15,2) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, activity_date)
    );

    CREATE INDEX IF NOT EXISTS idx_user_activity_daily_user_date
      ON "${schema}".user_activity_daily(user_id, activity_date DESC);
    CREATE INDEX IF NOT EXISTS idx_user_activity_daily_date
      ON "${schema}".user_activity_daily(activity_date DESC);

    -- Permissions
    GRANT ALL ON ALL TABLES IN SCHEMA "${schema}" TO intelli_hiper_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "${schema}" TO intelli_hiper_app;
  `;
}

function buildTargetsGamificationMigration(schema: string): string {
  return `
    -- ============================================================
    -- MIGRATION 017: TARGETS & GAMIFICATION ENGINE
    -- ============================================================

    -- 1. TARGETS (metric definitions)
    CREATE TABLE IF NOT EXISTS "${schema}".targets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      module VARCHAR(50) NOT NULL,
      metric_key VARCHAR(100) NOT NULL,
      metric_type VARCHAR(20) NOT NULL DEFAULT 'count',
      metric_unit VARCHAR(20) DEFAULT '',
      aggregation_field VARCHAR(100),
      filter_criteria JSONB DEFAULT '{}',
      custom_query TEXT,
      period VARCHAR(20) NOT NULL DEFAULT 'monthly',
      cascade_enabled BOOLEAN DEFAULT false,
      cascade_method VARCHAR(20) DEFAULT 'equal',
      badge_on_achieve BOOLEAN DEFAULT true,
      streak_tracking BOOLEAN DEFAULT true,
      milestone_notifications BOOLEAN DEFAULT true,
      is_active BOOLEAN DEFAULT true,
      sort_order INT DEFAULT 0,
      created_by UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_targets_module ON "${schema}".targets(module);
    CREATE INDEX IF NOT EXISTS idx_targets_metric ON "${schema}".targets(metric_key);
    CREATE INDEX IF NOT EXISTS idx_targets_active ON "${schema}".targets(is_active) WHERE is_active = true;

    -- 2. TARGET ASSIGNMENTS
    CREATE TABLE IF NOT EXISTS "${schema}".target_assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      target_id UUID NOT NULL REFERENCES "${schema}".targets(id) ON DELETE CASCADE,
      scope_type VARCHAR(20) NOT NULL,
      user_id UUID REFERENCES "${schema}".users(id) ON DELETE CASCADE,
      team_id UUID REFERENCES "${schema}".teams(id) ON DELETE CASCADE,
      department VARCHAR(100),
      target_value NUMERIC(15,2) NOT NULL,
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      is_cascaded BOOLEAN DEFAULT false,
      is_overridden BOOLEAN DEFAULT false,
      parent_assignment_id UUID REFERENCES "${schema}".target_assignments(id) ON DELETE SET NULL,
      cascade_weights JSONB DEFAULT '{}',
      is_active BOOLEAN DEFAULT true,
      created_by UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_ta_target ON "${schema}".target_assignments(target_id);
    CREATE INDEX IF NOT EXISTS idx_ta_user ON "${schema}".target_assignments(user_id) WHERE user_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_ta_team ON "${schema}".target_assignments(team_id) WHERE team_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_ta_period ON "${schema}".target_assignments(period_start, period_end);
    CREATE INDEX IF NOT EXISTS idx_ta_scope ON "${schema}".target_assignments(scope_type);

    -- 3. TARGET PROGRESS (cached actuals)
    CREATE TABLE IF NOT EXISTS "${schema}".target_progress (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assignment_id UUID NOT NULL REFERENCES "${schema}".target_assignments(id) ON DELETE CASCADE,
      actual_value NUMERIC(15,2) NOT NULL DEFAULT 0,
      percentage NUMERIC(5,1) NOT NULL DEFAULT 0,
      pace_status VARCHAR(20) DEFAULT 'on_track',
      expected_by_now NUMERIC(15,2) DEFAULT 0,
      days_elapsed INT DEFAULT 0,
      days_total INT DEFAULT 0,
      milestone_50 BOOLEAN DEFAULT false,
      milestone_75 BOOLEAN DEFAULT false,
      milestone_100 BOOLEAN DEFAULT false,
      milestone_exceeded BOOLEAN DEFAULT false,
      last_computed_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(assignment_id)
    );
    CREATE INDEX IF NOT EXISTS idx_tp_assignment ON "${schema}".target_progress(assignment_id);
    CREATE INDEX IF NOT EXISTS idx_tp_pace ON "${schema}".target_progress(pace_status);

    -- 4. BADGES
    CREATE TABLE IF NOT EXISTS "${schema}".badges (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      description TEXT,
      icon VARCHAR(50) NOT NULL DEFAULT '🏆',
      color VARCHAR(20) DEFAULT '#F59E0B',
      trigger_type VARCHAR(30) NOT NULL,
      trigger_config JSONB DEFAULT '{}',
      tier VARCHAR(20) DEFAULT 'bronze',
      points INT DEFAULT 10,
      is_active BOOLEAN DEFAULT true,
      is_system BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_badges_trigger ON "${schema}".badges(trigger_type);

    -- 5. BADGE AWARDS
    CREATE TABLE IF NOT EXISTS "${schema}".badge_awards (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      badge_id UUID NOT NULL REFERENCES "${schema}".badges(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES "${schema}".users(id) ON DELETE CASCADE,
      awarded_for TEXT,
      target_assignment_id UUID REFERENCES "${schema}".target_assignments(id) ON DELETE SET NULL,
      points_earned INT DEFAULT 0,
      awarded_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_ba_user ON "${schema}".badge_awards(user_id);
    CREATE INDEX IF NOT EXISTS idx_ba_badge ON "${schema}".badge_awards(badge_id);
    CREATE INDEX IF NOT EXISTS idx_ba_awarded ON "${schema}".badge_awards(awarded_at DESC);

    -- 6. USER STREAKS
    CREATE TABLE IF NOT EXISTS "${schema}".user_streaks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES "${schema}".users(id) ON DELETE CASCADE,
      target_id UUID NOT NULL REFERENCES "${schema}".targets(id) ON DELETE CASCADE,
      current_streak INT DEFAULT 0,
      longest_streak INT DEFAULT 0,
      last_achieved_period DATE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, target_id)
    );
    CREATE INDEX IF NOT EXISTS idx_us_user ON "${schema}".user_streaks(user_id);

    -- 7. ACHIEVEMENT LOG
    CREATE TABLE IF NOT EXISTS "${schema}".achievement_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES "${schema}".users(id) ON DELETE CASCADE,
      event_type VARCHAR(30) NOT NULL,
      event_data JSONB DEFAULT '{}',
      target_id UUID REFERENCES "${schema}".targets(id) ON DELETE SET NULL,
      badge_id UUID REFERENCES "${schema}".badges(id) ON DELETE SET NULL,
      message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_al_user ON "${schema}".achievement_log(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_al_type ON "${schema}".achievement_log(event_type);

    -- 8. SEED DEFAULT BADGES
    INSERT INTO "${schema}".badges (name, description, icon, color, trigger_type, trigger_config, tier, points, is_system) VALUES
      ('Target Crusher', 'Hit 100% of any target', '🎯', '#10B981', 'target_achieved', '{"percentage":100}', 'gold', 50, true),
      ('Overachiever', 'Exceeded a target by 50%+', '🚀', '#8B5CF6', 'target_achieved', '{"percentage":150}', 'platinum', 100, true),
      ('Hot Streak', '3 periods in a row hitting target', '🔥', '#F59E0B', 'streak', '{"streak_count":3}', 'silver', 30, true),
      ('Unstoppable', '5 periods in a row hitting target', '⚡', '#EF4444', 'streak', '{"streak_count":5}', 'gold', 75, true),
      ('Consistency King', '6 consecutive periods hitting target', '👑', '#F59E0B', 'streak', '{"streak_count":6}', 'diamond', 200, true),
      ('First Deal', 'Won your first deal', '🥇', '#10B981', 'milestone', '{"metric_key":"opps_won","lifetime_count":1}', 'bronze', 10, true),
      ('Deal Machine', 'Won 50 deals lifetime', '⭐', '#F59E0B', 'milestone', '{"metric_key":"opps_won","lifetime_count":50}', 'gold', 50, true),
      ('Pipeline Builder', 'Created 100 leads lifetime', '🏗️', '#3B82F6', 'milestone', '{"metric_key":"leads_created","lifetime_count":100}', 'silver', 25, true),
      ('Conversation Starter', 'Made 500 calls lifetime', '📞', '#10B981', 'milestone', '{"metric_key":"calls_made","lifetime_count":500}', 'bronze', 15, true),
      ('Early Bird', 'Hit target before period midpoint', '🐦', '#F59E0B', 'custom', '{"rule":"achieved_before_half_period"}', 'silver', 20, true),
      ('Comeback Kid', 'Was behind pace but still hit target', '💪', '#EF4444', 'custom', '{"rule":"was_behind_then_achieved"}', 'gold', 40, true),
      ('Email Champion', 'Sent 1000 emails lifetime', '📧', '#3B82F6', 'milestone', '{"metric_key":"emails_sent","lifetime_count":1000}', 'silver', 25, true)
    ON CONFLICT DO NOTHING;

    -- Permissions
    GRANT ALL ON ALL TABLES IN SCHEMA "${schema}" TO intelli_hiper_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "${schema}" TO intelli_hiper_app;
  `
}

function buildTargetsGamificationSeedData(schema: string): string {
 return  `
    -- ============================================================
    -- SEED: TARGETS & GOALS — Industry Standard Templates
    -- ============================================================
    --
    -- Run AFTER migration 017_targets_gamification.sql
    -- Replace ${schema} with your tenant schema name.
    --
    -- Includes:
    --   • 14 targets across Sales, Lead Gen, Activities
    --   • Company-level assignments for current + next 2 months
    --   • Industry-standard target values (adjust to your team size)
    --
    -- Benchmarks based on:
    --   - Bridge Group Inside Sales Report
    --   - HubSpot Sales Benchmarks
    --   - Salesforce State of Sales Report
    --   - Gartner B2B Sales Research
    -- ============================================================

    -- ────────────────────────────────────────────────────────────
    -- 1. TARGETS (metric definitions)
    -- ────────────────────────────────────────────────────────────

    INSERT INTO "${schema}".targets
      (name, description, module, metric_key, metric_type, metric_unit, period,
      cascade_enabled, cascade_method, badge_on_achieve, streak_tracking,
      milestone_notifications, is_active, sort_order)
    VALUES

    -- ═══════════ REVENUE & DEALS ═══════════

    -- #1  Monthly Revenue Target
    -- Industry avg: $50K-$150K/rep/month for mid-market SaaS
    ('Monthly Revenue Target',
    'Total revenue from closed-won deals. Industry benchmark: $50K-$150K per rep/month for mid-market B2B.',
    'opportunities', 'revenue_won', 'sum', '$', 'monthly',
    true, 'equal', true, true, true, true, 1),

    -- #2  Quarterly Revenue Target
    -- Rolls up monthly into quarterly view for exec reporting
    ('Quarterly Revenue Target',
    'Quarterly revenue goal. Typically 3x monthly with stretch. Used for QBR reporting.',
    'opportunities', 'revenue_won', 'sum', '$', 'quarterly',
    true, 'equal', true, true, true, true, 2),

    -- #3  Deals Won per Month
    -- Industry avg: 3-8 deals/rep/month depending on deal size
    ('Monthly Deals Won',
    'Number of closed-won deals per month. Benchmark: 3-8 deals/rep for mid-market, 1-3 for enterprise.',
    'opportunities', 'opps_won', 'count', 'deals', 'monthly',
    true, 'equal', true, true, true, true, 3),

    -- #4  Pipeline Value Target
    -- Best practice: 3-4x quota coverage in pipeline
    ('Pipeline Coverage Target',
    'Open pipeline value. Best practice: maintain 3-4x quota coverage. If monthly target is $100K, pipeline should be $300-400K.',
    'opportunities', 'pipeline_value', 'sum', '$', 'monthly',
    false, 'equal', true, false, true, true, 4),

    -- #5  Average Deal Size
    -- Track to ensure reps aren't discounting heavily
    ('Average Deal Size',
    'Average revenue per closed deal. Monitor for discounting trends. Benchmark varies by segment.',
    'opportunities', 'avg_deal_size', 'sum', '$', 'monthly',
    false, 'equal', false, false, true, true, 5),

    -- ═══════════ LEAD GENERATION ═══════════

    -- #6  New Leads Created
    -- SDR benchmark: 150-300 leads/month through outbound + inbound
    ('Monthly New Leads',
    'New leads created per month. SDR benchmark: 150-300 for outbound-heavy, 50-100 for inbound-focused teams.',
    'leads', 'leads_created', 'count', 'leads', 'monthly',
    true, 'equal', true, true, true, true, 6),

    -- #7  Leads Converted
    -- Industry conversion rate: 5-15% of leads convert to opportunities
    ('Monthly Lead Conversions',
    'Leads converted to opportunities. Industry avg: 5-15% conversion rate. Track absolute count + rate.',
    'leads', 'leads_converted', 'count', 'leads', 'monthly',
    true, 'equal', true, true, true, true, 7),

    -- #8  Leads Qualified
    -- Typically 20-40% of new leads pass qualification
    ('Monthly Leads Qualified',
    'Leads advancing past initial stage. Benchmark: 20-40% of new leads should reach qualified status.',
    'leads', 'leads_reached_stage', 'count', 'leads', 'monthly',
    true, 'equal', true, true, true, true, 8),

    -- #9  Weekly New Leads (for SDR teams)
    -- Weekly cadence keeps SDRs accountable on sourcing
    ('Weekly Lead Generation',
    'Weekly lead creation target for SDR/BDR teams. Keeps sourcing consistent vs. end-of-month rushes.',
    'leads', 'leads_created', 'count', 'leads', 'weekly',
    true, 'equal', true, true, true, true, 9),

    -- ═══════════ ACTIVITY METRICS ═══════════

    -- #10 Monthly Calls on Leads
    -- Inside sales benchmark: 40-60 calls/day = 800-1200/month
    ('Monthly Outbound Calls (Leads)',
    'Calls logged against leads. Inside sales benchmark: 40-60 dials/day, 800-1200/month. Quality > quantity.',
    'leads', 'lead_calls', 'count', 'calls', 'monthly',
    true, 'equal', true, true, true, true, 10),

    -- #11 Monthly Emails on Leads
    -- Outbound cadence: 5-8 touches per lead = high email volume
    ('Monthly Emails Sent (Leads)',
    'Emails logged against leads. Outbound cadence typically includes 5-8 email touches per prospect.',
    'leads', 'lead_emails', 'count', 'emails', 'monthly',
    true, 'equal', true, false, true, true, 11),

    -- #12 Monthly Demos/Presentations
    -- Account exec benchmark: 8-15 demos/month
    ('Monthly Demos Given (Leads)',
    'Demos and presentations for leads. AE benchmark: 8-15 qualified demos/month. Key conversion driver.',
    'leads', 'lead_demos', 'count', 'demos', 'monthly',
    true, 'equal', true, true, true, true, 12),

    -- #13 Monthly Meetings on Opportunities
    -- Deal progression requires 2-4 meetings per deal cycle
    ('Monthly Opp Meetings',
    'Meetings logged against opportunities. Benchmark: 2-4 meetings per deal in pipeline per month.',
    'opportunities', 'opp_meetings', 'count', 'meetings', 'monthly',
    true, 'equal', true, false, true, true, 13),

    -- #14 Tasks Completed
    -- Operational hygiene metric
    ('Weekly Tasks Completed',
    'CRM tasks completed per week. Ensures follow-ups, admin tasks, and pipeline hygiene stay on track.',
    'tasks', 'tasks_completed', 'count', 'tasks', 'weekly',
    false, 'equal', true, true, true, true, 14)

    ON CONFLICT DO NOTHING;


    -- ────────────────────────────────────────────────────────────
    -- 2. COMPANY-LEVEL ASSIGNMENTS
    --    (Current month + next 2 months)
    --
    --    Adjust target_value to match your team size:
    --      - Values below assume ~5-8 reps
    --      - For per-rep: divide by headcount
    --      - cascade_enabled targets will auto-distribute
    --        when you click "Cascade" in the UI
    -- ────────────────────────────────────────────────────────────

    DO $$
    DECLARE
      t_id UUID;
      m_start DATE;
      m_end DATE;
      q_start DATE;
      q_end DATE;
      w_start DATE;
      w_end DATE;
    BEGIN

      -- ── Current month boundaries ──
      m_start := date_trunc('month', NOW())::date;
      m_end   := (date_trunc('month', NOW()) + interval '1 month' - interval '1 day')::date;

      -- ── Current quarter boundaries ──
      q_start := date_trunc('quarter', NOW())::date;
      q_end   := (date_trunc('quarter', NOW()) + interval '3 months' - interval '1 day')::date;

      -- ── Current week (Monday start) ──
      w_start := date_trunc('week', NOW())::date;
      w_end   := (date_trunc('week', NOW()) + interval '6 days')::date;

      -- ═══════════════════════════════════════════
      -- MONTHLY REVENUE TARGET — $500K company/month
      -- ═══════════════════════════════════════════
      SELECT id INTO t_id FROM "${schema}".targets WHERE metric_key = 'revenue_won' AND period = 'monthly' LIMIT 1;
      IF t_id IS NOT NULL THEN
        -- Current month
        INSERT INTO "${schema}".target_assignments (target_id, scope_type, target_value, period_start, period_end)
        VALUES (t_id, 'company', 500000, m_start, m_end)
        ON CONFLICT DO NOTHING;
        -- Next month
        INSERT INTO "${schema}".target_assignments (target_id, scope_type, target_value, period_start, period_end)
        VALUES (t_id, 'company', 500000, m_start + interval '1 month', m_end + interval '1 month')
        ON CONFLICT DO NOTHING;
        -- Month after
        INSERT INTO "${schema}".target_assignments (target_id, scope_type, target_value, period_start, period_end)
        VALUES (t_id, 'company', 500000, m_start + interval '2 months', m_end + interval '2 months')
        ON CONFLICT DO NOTHING;
      END IF;

      -- ═══════════════════════════════════════════
      -- QUARTERLY REVENUE — $1.5M company/quarter
      -- ═══════════════════════════════════════════
      SELECT id INTO t_id FROM "${schema}".targets WHERE metric_key = 'revenue_won' AND period = 'quarterly' LIMIT 1;
      IF t_id IS NOT NULL THEN
        INSERT INTO "${schema}".target_assignments (target_id, scope_type, target_value, period_start, period_end)
        VALUES (t_id, 'company', 1500000, q_start, q_end)
        ON CONFLICT DO NOTHING;
      END IF;

      -- ═══════════════════════════════════════════
      -- MONTHLY DEALS WON — 30 deals company/month
      -- ═══════════════════════════════════════════
      SELECT id INTO t_id FROM "${schema}".targets WHERE metric_key = 'opps_won' AND period = 'monthly' LIMIT 1;
      IF t_id IS NOT NULL THEN
        INSERT INTO "${schema}".target_assignments (target_id, scope_type, target_value, period_start, period_end)
        VALUES (t_id, 'company', 30, m_start, m_end)
        ON CONFLICT DO NOTHING;
        INSERT INTO "${schema}".target_assignments (target_id, scope_type, target_value, period_start, period_end)
        VALUES (t_id, 'company', 30, m_start + interval '1 month', m_end + interval '1 month')
        ON CONFLICT DO NOTHING;
        INSERT INTO "${schema}".target_assignments (target_id, scope_type, target_value, period_start, period_end)
        VALUES (t_id, 'company', 30, m_start + interval '2 months', m_end + interval '2 months')
        ON CONFLICT DO NOTHING;
      END IF;

      -- ═══════════════════════════════════════════
      -- PIPELINE COVERAGE — $2M open pipeline
      -- ═══════════════════════════════════════════
      SELECT id INTO t_id FROM "${schema}".targets WHERE metric_key = 'pipeline_value' LIMIT 1;
      IF t_id IS NOT NULL THEN
        INSERT INTO "${schema}".target_assignments (target_id, scope_type, target_value, period_start, period_end)
        VALUES (t_id, 'company', 2000000, m_start, m_end)
        ON CONFLICT DO NOTHING;
      END IF;

      -- ═══════════════════════════════════════════
      -- MONTHLY NEW LEADS — 200 company/month
      -- ═══════════════════════════════════════════
      SELECT id INTO t_id FROM "${schema}".targets WHERE metric_key = 'leads_created' AND period = 'monthly' LIMIT 1;
      IF t_id IS NOT NULL THEN
        INSERT INTO "${schema}".target_assignments (target_id, scope_type, target_value, period_start, period_end)
        VALUES (t_id, 'company', 200, m_start, m_end)
        ON CONFLICT DO NOTHING;
        INSERT INTO "${schema}".target_assignments (target_id, scope_type, target_value, period_start, period_end)
        VALUES (t_id, 'company', 200, m_start + interval '1 month', m_end + interval '1 month')
        ON CONFLICT DO NOTHING;
        INSERT INTO "${schema}".target_assignments (target_id, scope_type, target_value, period_start, period_end)
        VALUES (t_id, 'company', 200, m_start + interval '2 months', m_end + interval '2 months')
        ON CONFLICT DO NOTHING;
      END IF;

      -- ═══════════════════════════════════════════
      -- MONTHLY CONVERSIONS — 25 company/month
      -- ═══════════════════════════════════════════
      SELECT id INTO t_id FROM "${schema}".targets WHERE metric_key = 'leads_converted' LIMIT 1;
      IF t_id IS NOT NULL THEN
        INSERT INTO "${schema}".target_assignments (target_id, scope_type, target_value, period_start, period_end)
        VALUES (t_id, 'company', 25, m_start, m_end)
        ON CONFLICT DO NOTHING;
        INSERT INTO "${schema}".target_assignments (target_id, scope_type, target_value, period_start, period_end)
        VALUES (t_id, 'company', 25, m_start + interval '1 month', m_end + interval '1 month')
        ON CONFLICT DO NOTHING;
      END IF;

      -- ═══════════════════════════════════════════
      -- MONTHLY LEADS QUALIFIED — 60 company/month
      -- ═══════════════════════════════════════════
      SELECT id INTO t_id FROM "${schema}".targets WHERE metric_key = 'leads_reached_stage' LIMIT 1;
      IF t_id IS NOT NULL THEN
        INSERT INTO "${schema}".target_assignments (target_id, scope_type, target_value, period_start, period_end)
        VALUES (t_id, 'company', 60, m_start, m_end)
        ON CONFLICT DO NOTHING;
        INSERT INTO "${schema}".target_assignments (target_id, scope_type, target_value, period_start, period_end)
        VALUES (t_id, 'company', 60, m_start + interval '1 month', m_end + interval '1 month')
        ON CONFLICT DO NOTHING;
      END IF;

      -- ═══════════════════════════════════════════
      -- WEEKLY LEAD GENERATION — 50/week
      -- ═══════════════════════════════════════════
      SELECT id INTO t_id FROM "${schema}".targets WHERE metric_key = 'leads_created' AND period = 'weekly' LIMIT 1;
      IF t_id IS NOT NULL THEN
        -- Current week
        INSERT INTO "${schema}".target_assignments (target_id, scope_type, target_value, period_start, period_end)
        VALUES (t_id, 'company', 50, w_start, w_end)
        ON CONFLICT DO NOTHING;
        -- Next 3 weeks
        INSERT INTO "${schema}".target_assignments (target_id, scope_type, target_value, period_start, period_end)
        VALUES (t_id, 'company', 50, w_start + interval '7 days', w_end + interval '7 days')
        ON CONFLICT DO NOTHING;
        INSERT INTO "${schema}".target_assignments (target_id, scope_type, target_value, period_start, period_end)
        VALUES (t_id, 'company', 50, w_start + interval '14 days', w_end + interval '14 days')
        ON CONFLICT DO NOTHING;
        INSERT INTO "${schema}".target_assignments (target_id, scope_type, target_value, period_start, period_end)
        VALUES (t_id, 'company', 50, w_start + interval '21 days', w_end + interval '21 days')
        ON CONFLICT DO NOTHING;
      END IF;

      -- ═══════════════════════════════════════════
      -- MONTHLY CALLS ON LEADS — 4000 company/month
      -- (approx 800/rep × 5 reps)
      -- ═══════════════════════════════════════════
      SELECT id INTO t_id FROM "${schema}".targets WHERE metric_key = 'lead_calls' LIMIT 1;
      IF t_id IS NOT NULL THEN
        INSERT INTO "${schema}".target_assignments (target_id, scope_type, target_value, period_start, period_end)
        VALUES (t_id, 'company', 4000, m_start, m_end)
        ON CONFLICT DO NOTHING;
        INSERT INTO "${schema}".target_assignments (target_id, scope_type, target_value, period_start, period_end)
        VALUES (t_id, 'company', 4000, m_start + interval '1 month', m_end + interval '1 month')
        ON CONFLICT DO NOTHING;
      END IF;

      -- ═══════════════════════════════════════════
      -- MONTHLY EMAILS ON LEADS — 3000 company/month
      -- ═══════════════════════════════════════════
      SELECT id INTO t_id FROM "${schema}".targets WHERE metric_key = 'lead_emails' LIMIT 1;
      IF t_id IS NOT NULL THEN
        INSERT INTO "${schema}".target_assignments (target_id, scope_type, target_value, period_start, period_end)
        VALUES (t_id, 'company', 3000, m_start, m_end)
        ON CONFLICT DO NOTHING;
      END IF;

      -- ═══════════════════════════════════════════
      -- MONTHLY DEMOS — 50 company/month
      -- ═══════════════════════════════════════════
      SELECT id INTO t_id FROM "${schema}".targets WHERE metric_key = 'lead_demos' LIMIT 1;
      IF t_id IS NOT NULL THEN
        INSERT INTO "${schema}".target_assignments (target_id, scope_type, target_value, period_start, period_end)
        VALUES (t_id, 'company', 50, m_start, m_end)
        ON CONFLICT DO NOTHING;
        INSERT INTO "${schema}".target_assignments (target_id, scope_type, target_value, period_start, period_end)
        VALUES (t_id, 'company', 50, m_start + interval '1 month', m_end + interval '1 month')
        ON CONFLICT DO NOTHING;
      END IF;

      -- ═══════════════════════════════════════════
      -- MONTHLY OPP MEETINGS — 80 company/month
      -- ═══════════════════════════════════════════
      SELECT id INTO t_id FROM "${schema}".targets WHERE metric_key = 'opp_meetings' LIMIT 1;
      IF t_id IS NOT NULL THEN
        INSERT INTO "${schema}".target_assignments (target_id, scope_type, target_value, period_start, period_end)
        VALUES (t_id, 'company', 80, m_start, m_end)
        ON CONFLICT DO NOTHING;
      END IF;

      -- ═══════════════════════════════════════════
      -- WEEKLY TASKS COMPLETED — 100/week company
      -- ═══════════════════════════════════════════
      SELECT id INTO t_id FROM "${schema}".targets WHERE metric_key = 'tasks_completed' LIMIT 1;
      IF t_id IS NOT NULL THEN
        INSERT INTO "${schema}".target_assignments (target_id, scope_type, target_value, period_start, period_end)
        VALUES (t_id, 'company', 100, w_start, w_end)
        ON CONFLICT DO NOTHING;
        INSERT INTO "${schema}".target_assignments (target_id, scope_type, target_value, period_start, period_end)
        VALUES (t_id, 'company', 100, w_start + interval '7 days', w_end + interval '7 days')
        ON CONFLICT DO NOTHING;
        INSERT INTO "${schema}".target_assignments (target_id, scope_type, target_value, period_start, period_end)
        VALUES (t_id, 'company', 100, w_start + interval '14 days', w_end + interval '14 days')
        ON CONFLICT DO NOTHING;
        INSERT INTO "${schema}".target_assignments (target_id, scope_type, target_value, period_start, period_end)
        VALUES (t_id, 'company', 100, w_start + interval '21 days', w_end + interval '21 days')
        ON CONFLICT DO NOTHING;
      END IF;

    END $$;


    -- ────────────────────────────────────────────────────────────
    -- 3. ADDITIONAL BADGES (beyond the 12 system defaults)
    -- ────────────────────────────────────────────────────────────

    INSERT INTO "${schema}".badges
      (name, description, icon, color, trigger_type, trigger_config, tier, points, is_system)
    VALUES
      -- Revenue milestones
      ('$100K Club',
      'Closed $100K+ in a single month',
      '💰', '#10B981', 'milestone',
      '{"metric_key":"revenue_won","period_value":100000}',
      'gold', 75, true),

      ('Quarter Million',
      'Closed $250K+ in a single quarter',
      '💎', '#8B5CF6', 'milestone',
      '{"metric_key":"revenue_won","period_value":250000}',
      'platinum', 150, true),

      ('Million Dollar Rep',
      'Closed $1M+ lifetime revenue',
      '👑', '#F59E0B', 'milestone',
      '{"metric_key":"revenue_won","lifetime_value":1000000}',
      'diamond', 500, true),

      -- Activity milestones
      ('Call Warrior',
      'Made 100+ calls in a single week',
      '📞', '#3B82F6', 'milestone',
      '{"metric_key":"lead_calls","period_value":100,"period":"weekly"}',
      'silver', 20, true),

      ('Demo King',
      'Delivered 20+ demos in a month',
      '🎤', '#EC4899', 'milestone',
      '{"metric_key":"lead_demos","period_value":20}',
      'gold', 40, true),

      ('Meeting Machine',
      'Held 30+ meetings in a month',
      '🤝', '#10B981', 'milestone',
      '{"metric_key":"opp_meetings","period_value":30}',
      'silver', 25, true),

      -- Lead gen milestones
      ('Lead Magnet',
      'Created 50+ leads in a single month',
      '🧲', '#6366F1', 'milestone',
      '{"metric_key":"leads_created","period_value":50}',
      'silver', 25, true),

      ('Conversion Expert',
      'Converted 10+ leads in a single month',
      '🔄', '#10B981', 'milestone',
      '{"metric_key":"leads_converted","period_value":10}',
      'gold', 50, true),

      -- Streak badges (higher tiers)
      ('Iron Will',
      '10 consecutive periods hitting target',
      '🛡️', '#6B7280', 'streak',
      '{"streak_count":10}',
      'diamond', 300, true),

      -- Special recognition
      ('Team Player',
      'Helped 3+ colleagues hit their targets (contributed to cascaded goals)',
      '🤝', '#3B82F6', 'custom',
      '{"rule":"cascade_contributor","count":3}',
      'silver', 30, true),

      ('Fast Starter',
      'Hit 50% of monthly target in the first week',
      '⚡', '#F97316', 'custom',
      '{"rule":"half_target_first_week"}',
      'bronze', 15, true),

      ('Perfect Month',
      'Hit 100% on ALL assigned targets in a single month',
      '✨', '#F59E0B', 'custom',
      '{"rule":"all_targets_achieved_in_period"}',
      'platinum', 200, true)

    ON CONFLICT DO NOTHING;


    -- ────────────────────────────────────────────────────────────
    -- QUICK REFERENCE: Per-Rep Benchmarks
    -- ────────────────────────────────────────────────────────────
    --
    -- When you cascade company targets to individuals, here's
    -- what industry benchmarks look like per rep:
    --
    -- ┌─────────────────────────┬──────────────┬───────────────┐
    -- │ Metric                  │ Per Rep/Mo   │ Source         │
    -- ├─────────────────────────┼──────────────┼───────────────┤
    -- │ Revenue Won             │ $50-150K     │ Bridge Group   │
    -- │ Deals Won               │ 3-8          │ HubSpot        │
    -- │ New Leads Created       │ 30-60        │ SDR benchmarks │
    -- │ Leads Converted         │ 3-8          │ 10-15% rate    │
    -- │ Leads Qualified         │ 8-15         │ 30% qualify    │
    -- │ Outbound Calls          │ 600-1200     │ 40-60/day      │
    -- │ Emails Sent             │ 400-800      │ 5-8 per lead   │
    -- │ Demos/Presentations     │ 8-15         │ AE benchmark   │
    -- │ Opp Meetings            │ 12-20        │ 3-5/deal       │
    -- │ Tasks Completed         │ 15-25/week   │ CRM hygiene    │
    -- │ Pipeline Coverage       │ 3-4x quota   │ Best practice  │
    -- │ Avg Deal Size           │ $15-50K      │ Mid-market     │
    -- └─────────────────────────┴──────────────┴───────────────┘
    --
    -- To customize for your team:
    --   1. Update company target_value = per_rep × number_of_reps
    --   2. Use "Cascade" button in admin UI to auto-distribute
    --   3. Override individual targets for top/ramp reps
    -- ────────────────────────────────────────────────────────────

    -- Permissions
    GRANT ALL ON ALL TABLES IN SCHEMA "${schema}" TO intelli_hiper_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "${schema}" TO intelli_hiper_app;
  `
}

function buildReportsMigration(schema: string): string {
  return `
    CREATE TABLE IF NOT EXISTS "${schema}".report_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    parent_id UUID REFERENCES "${schema}".report_folders(id) ON DELETE CASCADE,
    created_by UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_report_folders_parent
    ON "${schema}".report_folders(parent_id);

  CREATE TABLE IF NOT EXISTS "${schema}".reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL DEFAULT 'custom',
    report_type VARCHAR(20) NOT NULL DEFAULT 'summary',
    chart_type VARCHAR(20) DEFAULT 'bar',
    data_source VARCHAR(50) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    is_system BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT true,
    created_by UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
    folder_id UUID REFERENCES "${schema}".report_folders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_reports_category ON "${schema}".reports(category);
  CREATE INDEX IF NOT EXISTS idx_reports_data_source ON "${schema}".reports(data_source);
  CREATE INDEX IF NOT EXISTS idx_reports_created_by ON "${schema}".reports(created_by);
  CREATE INDEX IF NOT EXISTS idx_reports_folder ON "${schema}".reports(folder_id);
  CREATE INDEX IF NOT EXISTS idx_reports_system ON "${schema}".reports(is_system);

  CREATE TABLE IF NOT EXISTS "${schema}".report_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES "${schema}".reports(id) ON DELETE CASCADE,
    frequency VARCHAR(20) NOT NULL DEFAULT 'weekly',
    day_of_week INT DEFAULT 1,
    day_of_month INT DEFAULT 1,
    time_of_day TIME DEFAULT '08:00:00',
    recipients TEXT[] NOT NULL DEFAULT '{}',
    format VARCHAR(10) DEFAULT 'csv',
    is_active BOOLEAN DEFAULT true,
    last_sent_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    created_by UUID REFERENCES "${schema}".users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_report_schedules_report
    ON "${schema}".report_schedules(report_id);
  CREATE INDEX IF NOT EXISTS idx_report_schedules_active
    ON "${schema}".report_schedules(is_active, next_run_at);

  -- SEED FOLDERS
  INSERT INTO "${schema}".report_folders (name, is_system)
  SELECT v.name, true FROM (VALUES
    ('Pipeline & Deals'), ('Leads'), ('Activities & Productivity'),
    ('Contacts & Accounts'), ('Revenue & Forecasting'), ('Targets & Performance')
  ) AS v(name)
  WHERE NOT EXISTS (SELECT 1 FROM "${schema}".report_folders WHERE name = v.name AND is_system = true);

  -- SEED 30 PRE-BUILT REPORTS (skip if already seeded)
  INSERT INTO "${schema}".reports (name, description, category, report_type, chart_type, data_source, config, is_system, is_public, folder_id)
  SELECT v.name, v.description, v.category, v.report_type, v.chart_type, v.data_source, v.config::jsonb, true, true,
    (SELECT id FROM "${schema}".report_folders WHERE name = v.folder_name AND is_system = true LIMIT 1)
  FROM (VALUES
    -- PIPELINE & DEALS (8)
    ('Pipeline by Stage', 'Opportunity count and value per pipeline stage', 'pipeline', 'summary', 'bar', 'opportunities',
     '{"measures":[{"field":"id","aggregate":"count","label":"Deal Count","format":"number"},{"field":"amount","aggregate":"sum","label":"Total Value","format":"currency"}],"dimensions":[{"field":"stage_name","type":"field","label":"Stage"}],"filters":[{"field":"won_at","operator":"is_null","value":null},{"field":"lost_at","operator":"is_null","value":null}],"orderBy":[{"field":"stage_sort","direction":"ASC"}]}',
     'Pipeline & Deals'),

    ('Pipeline by Month', 'Expected close revenue grouped by month and stage', 'pipeline', 'summary', 'stacked_bar', 'opportunities',
     '{"measures":[{"field":"amount","aggregate":"sum","label":"Value","format":"currency"}],"dimensions":[{"field":"close_date","type":"date","dateGranularity":"month","label":"Close Month"},{"field":"stage_name","type":"field","label":"Stage"}],"filters":[{"field":"won_at","operator":"is_null","value":null},{"field":"lost_at","operator":"is_null","value":null},{"field":"close_date","operator":"is_not_null","value":null}],"orderBy":[{"field":"close_date","direction":"ASC"}]}',
     'Pipeline & Deals'),

    ('Pipeline by Owner', 'Each rep''s pipeline value, deal count, and average deal size', 'pipeline', 'summary', 'table', 'opportunities',
     '{"measures":[{"field":"id","aggregate":"count","label":"Deals","format":"number"},{"field":"amount","aggregate":"sum","label":"Total Value","format":"currency"},{"field":"amount","aggregate":"avg","label":"Avg Deal Size","format":"currency"}],"dimensions":[{"field":"owner_name","type":"field","label":"Owner"}],"filters":[{"field":"won_at","operator":"is_null","value":null},{"field":"lost_at","operator":"is_null","value":null}],"orderBy":[{"field":"amount_sum","direction":"DESC"}]}',
     'Pipeline & Deals'),

    ('Weighted Forecast', 'Amount x probability grouped by month and forecast category', 'pipeline', 'summary', 'bar', 'opportunities',
     '{"measures":[{"field":"weighted_amount","aggregate":"sum","label":"Weighted Value","format":"currency"},{"field":"amount","aggregate":"sum","label":"Total Value","format":"currency"}],"dimensions":[{"field":"close_date","type":"date","dateGranularity":"month","label":"Month"},{"field":"forecast_category","type":"field","label":"Category"}],"filters":[{"field":"won_at","operator":"is_null","value":null},{"field":"lost_at","operator":"is_null","value":null}],"orderBy":[{"field":"close_date","direction":"ASC"}]}',
     'Pipeline & Deals'),

    ('Deals Won vs Lost', 'Won and lost deals count and value over time', 'pipeline', 'summary', 'bar', 'opportunities',
     '{"measures":[{"field":"id","aggregate":"count","label":"Count","format":"number"},{"field":"amount","aggregate":"sum","label":"Value","format":"currency"}],"dimensions":[{"field":"closed_at","type":"date","dateGranularity":"month","label":"Month"},{"field":"outcome","type":"field","label":"Outcome"}],"filters":[{"field":"outcome","operator":"in","value":["won","lost"]}],"orderBy":[{"field":"closed_at","direction":"ASC"}]}',
     'Pipeline & Deals'),

    ('Win/Loss by Reason', 'Close reasons breakdown for won and lost deals', 'pipeline', 'summary', 'pie', 'opportunities',
     '{"measures":[{"field":"id","aggregate":"count","label":"Count","format":"number"}],"dimensions":[{"field":"close_reason_name","type":"field","label":"Reason"}],"filters":[{"field":"outcome","operator":"in","value":["won","lost"]}],"orderBy":[{"field":"id_count","direction":"DESC"}]}',
     'Pipeline & Deals'),

    ('Sales Cycle Length', 'Average days to close by owner and source', 'pipeline', 'summary', 'bar', 'opportunities',
     '{"measures":[{"field":"days_to_close","aggregate":"avg","label":"Avg Days","format":"number"},{"field":"id","aggregate":"count","label":"Deals","format":"number"}],"dimensions":[{"field":"owner_name","type":"field","label":"Owner"}],"filters":[{"field":"won_at","operator":"is_not_null","value":null}],"orderBy":[{"field":"days_to_close_avg","direction":"ASC"}]}',
     'Pipeline & Deals'),

    ('Stalled Deals', 'Open deals with no activity in 14+ days', 'pipeline', 'tabular', 'table', 'opportunities',
     '{"measures":[],"dimensions":[],"fields":["name","owner_name","stage_name","amount","close_date","days_inactive","last_activity_at"],"filters":[{"field":"won_at","operator":"is_null","value":null},{"field":"lost_at","operator":"is_null","value":null},{"field":"days_inactive","operator":"gte","value":14}],"orderBy":[{"field":"days_inactive","direction":"DESC"}],"limit":50}',
     'Pipeline & Deals'),

    -- LEADS (6)
    ('Leads Created', 'New leads created over time', 'leads', 'summary', 'line', 'leads',
     '{"measures":[{"field":"id","aggregate":"count","label":"Leads Created","format":"number"}],"dimensions":[{"field":"created_at","type":"date","dateGranularity":"month","label":"Month"}],"filters":[],"orderBy":[{"field":"created_at","direction":"ASC"}]}',
     'Leads'),

    ('Leads by Source', 'Lead source distribution', 'leads', 'summary', 'pie', 'leads',
     '{"measures":[{"field":"id","aggregate":"count","label":"Count","format":"number"}],"dimensions":[{"field":"source_name","type":"field","label":"Source"}],"filters":[],"orderBy":[{"field":"id_count","direction":"DESC"}]}',
     'Leads'),

    ('Lead Funnel', 'Lead funnel by pipeline stage with conversion rates', 'leads', 'summary', 'funnel', 'leads',
     '{"measures":[{"field":"id","aggregate":"count","label":"Leads","format":"number"}],"dimensions":[{"field":"stage_name","type":"field","label":"Stage"}],"filters":[],"orderBy":[{"field":"stage_sort","direction":"ASC"}]}',
     'Leads'),

    ('Lead Conversion Rate', 'Converted vs total leads by owner and source', 'leads', 'summary', 'bar', 'leads',
     '{"measures":[{"field":"id","aggregate":"count","label":"Total Leads","format":"number"},{"field":"converted_at","aggregate":"count","label":"Converted","format":"number"}],"dimensions":[{"field":"owner_name","type":"field","label":"Owner"}],"filters":[],"orderBy":[{"field":"converted_at_count","direction":"DESC"}]}',
     'Leads'),

    ('Lead Aging', 'Leads by days in current stage', 'leads', 'summary', 'bar', 'leads',
     '{"measures":[{"field":"id","aggregate":"count","label":"Leads","format":"number"}],"dimensions":[{"field":"age_bucket","type":"field","label":"Age"}],"filters":[{"field":"converted_at","operator":"is_null","value":null},{"field":"disqualified_at","operator":"is_null","value":null}],"orderBy":[{"field":"age_bucket_sort","direction":"ASC"}]}',
     'Leads'),

    ('Lead Response Time', 'Average time to first activity per lead by owner', 'leads', 'summary', 'bar', 'leads',
     '{"measures":[{"field":"response_time_hours","aggregate":"avg","label":"Avg Response (hrs)","format":"number"},{"field":"id","aggregate":"count","label":"Leads","format":"number"}],"dimensions":[{"field":"owner_name","type":"field","label":"Owner"}],"filters":[],"orderBy":[{"field":"response_time_hours_avg","direction":"ASC"}]}',
     'Leads'),

    -- ACTIVITIES & PRODUCTIVITY (5)
    ('Activity Summary', 'Calls, emails, meetings, tasks by rep', 'activity', 'summary', 'table', 'activities',
     '{"measures":[{"field":"id","aggregate":"count","label":"Total","format":"number"}],"dimensions":[{"field":"performed_by_name","type":"field","label":"Rep"},{"field":"activity_type","type":"field","label":"Type"}],"filters":[{"field":"created_at","operator":"relative_date","value":null,"dateRelative":"this_month"}],"orderBy":[{"field":"id_count","direction":"DESC"}]}',
     'Activities & Productivity'),

    ('Activities by Type', 'Activity breakdown over time', 'activity', 'summary', 'stacked_bar', 'activities',
     '{"measures":[{"field":"id","aggregate":"count","label":"Count","format":"number"}],"dimensions":[{"field":"created_at","type":"date","dateGranularity":"week","label":"Week"},{"field":"activity_type","type":"field","label":"Type"}],"filters":[{"field":"created_at","operator":"relative_date","value":null,"dateRelative":"last_90_days"}],"orderBy":[{"field":"created_at","direction":"ASC"}]}',
     'Activities & Productivity'),

    ('Task Completion Rate', 'Completed vs overdue vs open tasks by owner', 'activity', 'summary', 'stacked_bar', 'tasks',
     '{"measures":[{"field":"id","aggregate":"count","label":"Tasks","format":"number"}],"dimensions":[{"field":"owner_name","type":"field","label":"Owner"},{"field":"task_status","type":"field","label":"Status"}],"filters":[],"orderBy":[{"field":"id_count","direction":"DESC"}]}',
     'Activities & Productivity'),

    ('Effort vs Result', 'Activities performed vs deals closed per rep', 'activity', 'summary', 'scatter', 'cross_module',
     '{"measures":[{"field":"activity_count","aggregate":"sum","label":"Activities","format":"number"},{"field":"deals_won","aggregate":"sum","label":"Deals Won","format":"number"},{"field":"revenue_won","aggregate":"sum","label":"Revenue","format":"currency"}],"dimensions":[{"field":"user_name","type":"field","label":"Rep"}],"filters":[{"field":"period","operator":"relative_date","value":null,"dateRelative":"this_quarter"}],"orderBy":[{"field":"revenue_won","direction":"DESC"}]}',
     'Activities & Productivity'),

    ('Top Performers', 'Reps ranked by revenue, activities, and conversion rate', 'activity', 'summary', 'table', 'cross_module',
     '{"measures":[{"field":"revenue_won","aggregate":"sum","label":"Revenue Won","format":"currency"},{"field":"deals_won","aggregate":"sum","label":"Deals Won","format":"number"},{"field":"activity_count","aggregate":"sum","label":"Activities","format":"number"},{"field":"conversion_rate","aggregate":"avg","label":"Conversion %","format":"percent"}],"dimensions":[{"field":"user_name","type":"field","label":"Rep"}],"filters":[{"field":"period","operator":"relative_date","value":null,"dateRelative":"this_quarter"}],"orderBy":[{"field":"revenue_won","direction":"DESC"}],"limit":20}',
     'Activities & Productivity'),

    -- CONTACTS & ACCOUNTS (4)
    ('New Contacts', 'Contacts created over time', 'contacts', 'summary', 'line', 'contacts',
     '{"measures":[{"field":"id","aggregate":"count","label":"Contacts","format":"number"}],"dimensions":[{"field":"created_at","type":"date","dateGranularity":"month","label":"Month"}],"filters":[],"orderBy":[{"field":"created_at","direction":"ASC"}]}',
     'Contacts & Accounts'),

    ('Contacts by Source', 'Contact source distribution', 'contacts', 'summary', 'pie', 'contacts',
     '{"measures":[{"field":"id","aggregate":"count","label":"Count","format":"number"}],"dimensions":[{"field":"source","type":"field","label":"Source"}],"filters":[],"orderBy":[{"field":"id_count","direction":"DESC"}]}',
     'Contacts & Accounts'),

    ('Accounts by Industry', 'Account distribution by industry and size', 'contacts', 'summary', 'bar', 'accounts',
     '{"measures":[{"field":"id","aggregate":"count","label":"Accounts","format":"number"}],"dimensions":[{"field":"industry","type":"field","label":"Industry"}],"filters":[],"orderBy":[{"field":"id_count","direction":"DESC"}],"limit":15}',
     'Contacts & Accounts'),

    ('Account Revenue', 'Top accounts by total opportunity value', 'contacts', 'summary', 'bar', 'opportunities',
     '{"measures":[{"field":"amount","aggregate":"sum","label":"Total Value","format":"currency"},{"field":"id","aggregate":"count","label":"Deals","format":"number"}],"dimensions":[{"field":"account_name","type":"field","label":"Account"}],"filters":[],"orderBy":[{"field":"amount_sum","direction":"DESC"}],"limit":20}',
     'Contacts & Accounts'),

    -- REVENUE & FORECASTING (4)
    ('Revenue by Month', 'Closed-won revenue trend over time', 'revenue', 'summary', 'line', 'opportunities',
     '{"measures":[{"field":"amount","aggregate":"sum","label":"Revenue","format":"currency"},{"field":"id","aggregate":"count","label":"Deals","format":"number"}],"dimensions":[{"field":"won_at","type":"date","dateGranularity":"month","label":"Month"}],"filters":[{"field":"won_at","operator":"is_not_null","value":null}],"orderBy":[{"field":"won_at","direction":"ASC"}]}',
     'Revenue & Forecasting'),

    ('Revenue by Owner', 'Closed revenue per rep', 'revenue', 'summary', 'bar', 'opportunities',
     '{"measures":[{"field":"amount","aggregate":"sum","label":"Revenue","format":"currency"},{"field":"id","aggregate":"count","label":"Deals Won","format":"number"}],"dimensions":[{"field":"owner_name","type":"field","label":"Owner"}],"filters":[{"field":"won_at","operator":"is_not_null","value":null}],"orderBy":[{"field":"amount_sum","direction":"DESC"}]}',
     'Revenue & Forecasting'),

    ('Revenue by Product', 'Which products generate the most revenue', 'revenue', 'summary', 'bar', 'opportunity_products',
     '{"measures":[{"field":"line_total","aggregate":"sum","label":"Revenue","format":"currency"},{"field":"quantity","aggregate":"sum","label":"Qty Sold","format":"number"}],"dimensions":[{"field":"product_name","type":"field","label":"Product"}],"filters":[{"field":"opp_won_at","operator":"is_not_null","value":null}],"orderBy":[{"field":"line_total_sum","direction":"DESC"}],"limit":20}',
     'Revenue & Forecasting'),

    ('Revenue by Source', 'Closed-won revenue by lead source', 'revenue', 'summary', 'pie', 'opportunities',
     '{"measures":[{"field":"amount","aggregate":"sum","label":"Revenue","format":"currency"}],"dimensions":[{"field":"source","type":"field","label":"Source"}],"filters":[{"field":"won_at","operator":"is_not_null","value":null}],"orderBy":[{"field":"amount_sum","direction":"DESC"}]}',
     'Revenue & Forecasting'),

    ('Account Forecast by Account', 'Accounts ranked by total pipeline value with forecast category breakdown for open deals in the quarter', 'revenue', 'summary', 'table', 'opportunities',
     '{"measures":[{"field":"amount","aggregate":"sum","label":"Total Pipeline","format":"currency"},{"field":"weighted_amount","aggregate":"sum","label":"Weighted Value","format":"currency"},{"field":"id","aggregate":"count","label":"Deals","format":"number"},{"field":"probability","aggregate":"avg","label":"Avg Probability","format":"percent"}],"dimensions":[{"field":"account_name","type":"field","label":"Account"},{"field":"forecast_category","type":"field","label":"Forecast Category"}],"filters":[{"field":"won_at","operator":"is_null","value":null},{"field":"lost_at","operator":"is_null","value":null},{"field":"close_date","operator":"relative_date","value":null,"dateRelative":"next_quarter"}],"orderBy":[{"field":"amount_sum","direction":"DESC"}]}',
     'Revenue & Forecasting'),

    ('Account Forecast by Category', 'Forecast category totals with account breakdown showing where next quarter revenue will come from', 'revenue', 'summary', 'bar', 'opportunities',
     '{"measures":[{"field":"amount","aggregate":"sum","label":"Total Value","format":"currency"},{"field":"weighted_amount","aggregate":"sum","label":"Weighted","format":"currency"},{"field":"id","aggregate":"count","label":"Deals","format":"number"}],"dimensions":[{"field":"forecast_category","type":"field","label":"Category"},{"field":"account_name","type":"field","label":"Account"}],"filters":[{"field":"won_at","operator":"is_null","value":null},{"field":"lost_at","operator":"is_null","value":null},{"field":"close_date","operator":"relative_date","value":null,"dateRelative":"next_quarter"}],"orderBy":[{"field":"amount_sum","direction":"DESC"}]}',
     'Revenue & Forecasting'),

    ('Account Pipeline Summary', 'Flat account list with total deals, pipeline value, weighted amount and dominant forecast category for next quarter', 'revenue', 'summary', 'table', 'opportunities',
     '{"measures":[{"field":"id","aggregate":"count","label":"Deals","format":"number"},{"field":"amount","aggregate":"sum","label":"Pipeline Value","format":"currency"},{"field":"weighted_amount","aggregate":"sum","label":"Weighted Value","format":"currency"},{"field":"probability","aggregate":"avg","label":"Avg Prob %","format":"percent"}],"dimensions":[{"field":"account_name","type":"field","label":"Account"}],"filters":[{"field":"won_at","operator":"is_null","value":null},{"field":"lost_at","operator":"is_null","value":null},{"field":"close_date","operator":"relative_date","value":null,"dateRelative":"next_quarter"}],"orderBy":[{"field":"amount_sum","direction":"DESC"}],"limit":50}',
     'Revenue & Forecasting'),

    -- TARGETS & PERFORMANCE (3)
    ('Target Attainment', 'Actual vs target by rep and team', 'targets', 'summary', 'bar', 'targets',
     '{"measures":[{"field":"target_value","aggregate":"sum","label":"Target","format":"currency"},{"field":"actual_value","aggregate":"sum","label":"Actual","format":"currency"},{"field":"percentage","aggregate":"avg","label":"Attainment %","format":"percent"}],"dimensions":[{"field":"assignee_name","type":"field","label":"Rep"}],"filters":[{"field":"period","operator":"relative_date","value":null,"dateRelative":"this_month"}],"orderBy":[{"field":"percentage_avg","direction":"DESC"}]}',
     'Targets & Performance'),

    ('Target Trend', 'Progress over time against targets', 'targets', 'summary', 'line', 'targets',
     '{"measures":[{"field":"target_value","aggregate":"sum","label":"Target","format":"currency"},{"field":"actual_value","aggregate":"sum","label":"Actual","format":"currency"}],"dimensions":[{"field":"period_start","type":"date","dateGranularity":"month","label":"Period"}],"filters":[],"orderBy":[{"field":"period_start","direction":"ASC"}]}',
     'Targets & Performance'),

    ('Team Scorecard', 'Multi-metric performance view per team member', 'targets', 'matrix', 'table', 'cross_module',
     '{"measures":[{"field":"revenue_won","aggregate":"sum","label":"Revenue","format":"currency"},{"field":"deals_won","aggregate":"sum","label":"Deals Won","format":"number"},{"field":"leads_created","aggregate":"sum","label":"Leads","format":"number"},{"field":"activity_count","aggregate":"sum","label":"Activities","format":"number"},{"field":"target_attainment","aggregate":"avg","label":"Target %","format":"percent"}],"dimensions":[{"field":"user_name","type":"field","label":"Team Member"}],"filters":[{"field":"period","operator":"relative_date","value":null,"dateRelative":"this_month"}],"orderBy":[{"field":"revenue_won","direction":"DESC"}]}',
     'Targets & Performance')

  ) AS v(name, description, category, report_type, chart_type, data_source, config, folder_name)
  WHERE NOT EXISTS (SELECT 1 FROM "${schema}".reports WHERE name = v.name AND is_system = true);

  -- Permissions
  GRANT ALL ON ALL TABLES IN SCHEMA "${schema}" TO intelli_hiper_app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "${schema}" TO intelli_hiper_app;
  `;
}

function buildLeadImportMigration(schema: string): string {
  return `
    CREATE TABLE IF NOT EXISTS "${schema}".import_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type VARCHAR(50) NOT NULL DEFAULT 'leads',
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      file_name VARCHAR(500) NOT NULL,
      file_path VARCHAR(1000) NOT NULL,
      file_size INTEGER,
      total_records INTEGER DEFAULT 0,
      processed_records INTEGER DEFAULT 0,
      imported_records INTEGER DEFAULT 0,
      skipped_records INTEGER DEFAULT 0,
      failed_records INTEGER DEFAULT 0,
      duplicate_records INTEGER DEFAULT 0,
      column_mapping JSONB NOT NULL DEFAULT '{}',
      settings JSONB NOT NULL DEFAULT '{}',
      failed_rows JSONB DEFAULT '[]',
      error_message TEXT,
      result_file_path VARCHAR(1000),
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      created_by UUID NOT NULL REFERENCES "${schema}".users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON "${schema}".import_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_import_jobs_created_by ON "${schema}".import_jobs(created_by);
    CREATE INDEX IF NOT EXISTS idx_import_jobs_type ON "${schema}".import_jobs(type);

    CREATE TABLE IF NOT EXISTS "${schema}".import_mapping_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'leads',
      column_mapping JSONB NOT NULL DEFAULT '{}',
      file_headers TEXT[] DEFAULT '{}',
      settings JSONB DEFAULT '{}',
      is_default BOOLEAN DEFAULT false,
      created_by UUID NOT NULL REFERENCES "${schema}".users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_import_mapping_templates_type ON "${schema}".import_mapping_templates(type);
  `;
}

function build033ProjectsEnhancements(schema: string): string {
  return `
    -- 033: Projects module enhancements
    -- is_closed / is_cancelled flags on project_statuses
    ALTER TABLE "${schema}".project_statuses
      ADD COLUMN IF NOT EXISTS is_closed    BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS is_cancelled BOOLEAN DEFAULT false;

    UPDATE "${schema}".project_statuses
      SET is_closed = true
      WHERE name = 'Completed';

    UPDATE "${schema}".project_statuses
      SET is_closed = true, is_cancelled = true
      WHERE name = 'Cancelled';

    -- approval_config on project_templates
    ALTER TABLE "${schema}".project_templates
      ADD COLUMN IF NOT EXISTS approval_config JSONB DEFAULT NULL;

    -- Add projects permissions to existing system roles (merge, do not overwrite)
    UPDATE "${schema}".roles
      SET permissions = permissions || '{"projects":{"view":true,"create":true,"edit":true,"delete":true,"export":false,"import":false}}'::jsonb
      WHERE name = 'admin' AND is_custom = false;

    UPDATE "${schema}".roles
      SET permissions = permissions || '{"projects":{"view":true,"create":true,"edit":true,"delete":false,"export":false,"import":false}}'::jsonb
      WHERE name = 'manager' AND is_custom = false;

    UPDATE "${schema}".roles
      SET permissions = permissions || '{"projects":{"view":true,"create":false,"edit":false,"delete":false,"export":false,"import":false}}'::jsonb
      WHERE name = 'user' AND is_custom = false;
  `;
}

runTenantMigrations();