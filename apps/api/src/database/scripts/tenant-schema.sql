-- ============================================================
-- TENANT SCHEMA CREATION SCRIPT
-- Run this for each new tenant, replacing TENANT_SCHEMA with actual schema name
-- ============================================================

-- Create schema
CREATE SCHEMA IF NOT EXISTS TENANT_SCHEMA;
SET search_path TO TENANT_SCHEMA;

-- ============================================================
-- ROLES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '{}',
  is_system BOOLEAN DEFAULT false,
  level INT DEFAULT 0,
  is_custom BOOLEAN DEFAULT false,
  record_access JSONB DEFAULT '{}',
  field_permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default roles
 INSERT INTO roles (name, description, permissions, is_system, level, is_custom, record_access, field_permissions) VALUES
   ('admin', 'Full access to everything', 
    '{"contacts":{"view":true,"create":true,"edit":true,"delete":true,"export":true,"import":true},"accounts":{"view":true,"create":true,"edit":true,"delete":true,"export":true,"import":true},"leads":{"view":true,"create":true,"edit":true,"delete":true,"export":true,"import":true},"deals":{"view":true,"create":true,"edit":true,"delete":true,"export":true,"import":true},"tasks":{"view":true,"create":true,"edit":true,"delete":true,"export":true,"import":true},"reports":{"view":true,"create":true,"edit":true,"delete":true,"export":true,"import":true},"users":{"view":true,"create":true,"edit":true,"delete":true,"invite":true},"roles":{"view":true,"create":true,"edit":true,"delete":true},"settings":{"view":true,"edit":true},"admin":{"view":true,"edit":true}}',
    true, 100, false,
    '{"contacts":"all","accounts":"all","leads":"all","deals":"all","tasks":"all","reports":"all"}',
    '{}'),
   ('manager', 'Manage team and data',
    '{"contacts":{"view":true,"create":true,"edit":true,"delete":true,"export":true,"import":false},"accounts":{"view":true,"create":true,"edit":true,"delete":true,"export":true,"import":false},"leads":{"view":true,"create":true,"edit":true,"delete":true,"export":true,"import":false},"deals":{"view":true,"create":true,"edit":true,"delete":true,"export":true,"import":false},"tasks":{"view":true,"create":true,"edit":true,"delete":true,"export":false,"import":false},"reports":{"view":true,"create":true,"edit":false,"delete":false,"export":true,"import":false},"users":{"view":true,"create":false,"edit":false,"delete":false,"invite":false},"roles":{"view":true,"create":false,"edit":false,"delete":false},"settings":{"view":true,"edit":false},"admin":{"view":false,"edit":false}}',
    true, 50, false,
    '{"contacts":"team","accounts":"team","leads":"team","deals":"team","tasks":"team","reports":"team"}',
    '{}'),
   ('user', 'Standard user access',
    '{"contacts":{"view":true,"create":true,"edit":true,"delete":false,"export":false,"import":false},"accounts":{"view":true,"create":true,"edit":true,"delete":false,"export":false,"import":false},"leads":{"view":true,"create":true,"edit":true,"delete":false,"export":false,"import":false},"deals":{"view":true,"create":true,"edit":true,"delete":false,"export":false,"import":false},"tasks":{"view":true,"create":true,"edit":true,"delete":true,"export":false,"import":false},"reports":{"view":true,"create":false,"edit":false,"delete":false,"export":false,"import":false},"users":{"view":false,"create":false,"edit":false,"delete":false,"invite":false},"roles":{"view":false,"create":false,"edit":false,"delete":false},"settings":{"view":false,"edit":false},"admin":{"view":false,"edit":false}}',
    true, 10, false,
    '{"contacts":"own","accounts":"own","leads":"own","deals":"own","tasks":"own","reports":"own"}',
    '{}')
 ON CONFLICT DO NOTHING;

-- ============================================================
-- DEPARTMENTS TABLE (created BEFORE users — no head_id FK yet)
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(30) UNIQUE,
  description TEXT,
  parent_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  head_id UUID,  -- FK added after users table exists
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_departments_parent ON departments(parent_department_id);
CREATE INDEX IF NOT EXISTS idx_departments_head ON departments(head_id);

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(50),
  role_id UUID REFERENCES roles(id),
  status VARCHAR(20) DEFAULT 'active',
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  job_title VARCHAR(150),
  avatar_url VARCHAR(500),
  timezone VARCHAR(50) DEFAULT 'UTC',
  employee_id VARCHAR(50),
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_users_manager ON users(manager_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Now add the deferred FK: departments.head_id → users.id
ALTER TABLE departments
  DROP CONSTRAINT IF EXISTS fk_departments_head,
  ADD CONSTRAINT fk_departments_head
    FOREIGN KEY (head_id) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================
-- TEAMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  team_lead_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_department ON teams(department_id);
CREATE INDEX IF NOT EXISTS idx_teams_lead ON teams(team_lead_id);
CREATE INDEX IF NOT EXISTS idx_teams_active ON teams(is_active);

-- ============================================================
-- TERRITORIES TABLE (hierarchical)
-- ============================================================
CREATE TABLE IF NOT EXISTS territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(30),
  description TEXT,
  type VARCHAR(50) DEFAULT 'geographic',
  parent_territory_id UUID REFERENCES territories(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_territories_parent ON territories(parent_territory_id);
CREATE INDEX IF NOT EXISTS idx_territories_type ON territories(type);

-- ============================================================
-- USER_TEAMS (Many-to-Many)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_user_teams_user ON user_teams(user_id);
CREATE INDEX IF NOT EXISTS idx_user_teams_team ON user_teams(team_id);

-- ============================================================
-- USER_TERRITORIES (Many-to-Many)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  territory_id UUID NOT NULL REFERENCES territories(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member',
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, territory_id)
);

CREATE INDEX IF NOT EXISTS idx_user_territories_user ON user_territories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_territories_territory ON user_territories(territory_id);

-- ============================================================
-- USER INVITATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  team_ids UUID[] DEFAULT '{}',
  job_title VARCHAR(150),
  invited_by UUID NOT NULL REFERENCES users(id),
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(token);
CREATE INDEX IF NOT EXISTS idx_user_invitations_status ON user_invitations(status);

-- Seed default department
INSERT INTO departments (name, code, description, is_active)
VALUES ('General', 'GEN', 'Default department', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- CONTACTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  mobile VARCHAR(50),
  company VARCHAR(200),
  job_title VARCHAR(200),
  website VARCHAR(500),
  
  -- Legacy address fields
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100),
  
  -- Multi-value fields (JSONB arrays)
  emails JSONB DEFAULT '[]',
  phones JSONB DEFAULT '[]',
  addresses JSONB DEFAULT '[]',
  
  -- Social profiles
  social_profiles JSONB DEFAULT '{}',
  
  -- Communication preferences
  do_not_contact BOOLEAN DEFAULT false,
  do_not_email BOOLEAN DEFAULT false,
  do_not_call BOOLEAN DEFAULT false,
  
  -- Metadata
  source VARCHAR(100),
  lead_source_details JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'active',
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  avatar_url VARCHAR(500),
  profile_completion INTEGER DEFAULT 0,
  
  -- Custom fields
  custom_fields JSONB DEFAULT '{}',
  
  -- Relationships
  owner_id UUID REFERENCES users(id),
  created_by UUID REFERENCES users(id),
  account_id UUID,
  
  -- Activity tracking
  last_activity_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_owner ON contacts(owner_id);
CREATE INDEX IF NOT EXISTS idx_contacts_account ON contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_contacts_deleted ON contacts(deleted_at);

-- ============================================================
-- ACCOUNTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  account_type VARCHAR(50) DEFAULT 'prospect',
  industry VARCHAR(100),
  website VARCHAR(500),
  
  -- Contact info
  phone VARCHAR(50),
  email VARCHAR(255),
  
  -- Multi-value fields
  emails JSONB DEFAULT '[]',
  phones JSONB DEFAULT '[]',
  addresses JSONB DEFAULT '[]',
  
  -- Address (legacy)
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100),
  
  -- Business info
  employee_count VARCHAR(50),
  annual_revenue VARCHAR(50),
  description TEXT,
  
  -- Social profiles
  social_profiles JSONB DEFAULT '{}',
  
  -- Metadata
  tags TEXT[] DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'active',
  logo_url VARCHAR(500),
  
  -- Custom fields
  custom_fields JSONB DEFAULT '{}',
  
  -- Relationships
  owner_id UUID REFERENCES users(id),
  parent_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_accounts_name ON accounts(name);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_accounts_industry ON accounts(industry);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
CREATE INDEX IF NOT EXISTS idx_accounts_owner ON accounts(owner_id);
CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_deleted ON accounts(deleted_at);

-- Add foreign key from contacts to accounts
ALTER TABLE contacts 
ADD CONSTRAINT fk_contacts_account 
FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL;

-- ============================================================
-- CONTACT-ACCOUNT RELATIONSHIP (Many-to-Many)
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role VARCHAR(100),
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contact_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_accounts_contact ON contact_accounts(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_accounts_account ON contact_accounts(account_id);

-- ============================================================
-- DOCUMENTS TABLE (Polymorphic)
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255),
  mime_type VARCHAR(100),
  size_bytes BIGINT,
  storage_path VARCHAR(500),
  storage_url VARCHAR(500),
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);

-- ============================================================
-- ACTIVITIES TABLE (Polymorphic Timeline)
-- ============================================================
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  activity_type VARCHAR(50) NOT NULL,
  subject VARCHAR(255),
  description TEXT,
  metadata JSONB DEFAULT '{}',
  performed_by UUID REFERENCES users(id),
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_entity ON activities(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_activities_performed_at ON activities(performed_at);

-- ============================================================
-- AUDIT LOGS TABLE (Change Tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  changes JSONB DEFAULT '{}',
  old_values JSONB DEFAULT '{}',
  new_values JSONB DEFAULT '{}',
  performed_by UUID REFERENCES users(id),
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address VARCHAR(50),
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_at ON audit_logs(performed_at);

-- ============================================================
-- NOTES TABLE (Polymorphic)
-- ============================================================
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_entity ON notes(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(is_pinned);

-- ============================================================
-- CUSTOM TABS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS custom_tabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  module VARCHAR(50) NOT NULL,
  icon VARCHAR(50) DEFAULT 'folder',
  description VARCHAR(255),
  display_order INT DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_tabs_module ON custom_tabs(module);

-- ============================================================
-- CUSTOM FIELD GROUPS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS custom_field_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  module VARCHAR(50) NOT NULL,
  tab_id UUID REFERENCES custom_tabs(id) ON DELETE SET NULL,
  section VARCHAR(50),
  icon VARCHAR(50),
  description VARCHAR(255),
  display_order INT DEFAULT 0,
  collapsed_by_default BOOLEAN DEFAULT false,
  columns INT DEFAULT 2,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_field_groups_module ON custom_field_groups(module);
CREATE INDEX IF NOT EXISTS idx_custom_field_groups_tab ON custom_field_groups(tab_id);

-- ============================================================
-- CUSTOM FIELD DEFINITIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module VARCHAR(50) NOT NULL,
  field_key VARCHAR(100) NOT NULL,
  field_label VARCHAR(200) NOT NULL,
  field_type VARCHAR(50) NOT NULL,
  field_options JSONB DEFAULT '[]',
  is_required BOOLEAN DEFAULT false,
  default_value TEXT,
  validation_rules JSONB DEFAULT '{}',
  display_order INT DEFAULT 0,
  placeholder VARCHAR(255),
  help_text VARCHAR(500),
  include_in_completion BOOLEAN DEFAULT false,
  completion_weight INT DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  depends_on_field_id UUID REFERENCES custom_field_definitions(id) ON DELETE SET NULL,
  conditional_options JSONB DEFAULT '{}',
  group_id UUID REFERENCES custom_field_groups(id) ON DELETE SET NULL,
  tab_id UUID REFERENCES custom_tabs(id) ON DELETE SET NULL,
  section VARCHAR(50) DEFAULT 'custom',
  column_span INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(module, field_key)
);

CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_module ON custom_field_definitions(module);
CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_depends_on ON custom_field_definitions(depends_on_field_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_group ON custom_field_definitions(group_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_tab ON custom_field_definitions(tab_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_section ON custom_field_definitions(section);

-- ============================================================
-- PROFILE COMPLETION CONFIG TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS profile_completion_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module VARCHAR(50) NOT NULL UNIQUE,
  field_weights JSONB DEFAULT '{}',
  is_enabled BOOLEAN DEFAULT true,
  min_percentage INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_completion_module ON profile_completion_config(module);

-- ============================================================
-- SCHEMA MIGRATIONS TRACKING TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  migration_name VARCHAR(255) NOT NULL UNIQUE,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mark initial schema as complete
INSERT INTO schema_migrations (migration_name) VALUES ('0000_initial_schema') ON CONFLICT DO NOTHING;

-- ============================================================
-- PAGE LAYOUTS TABLE (Page Designer)
-- ============================================================
CREATE TABLE IF NOT EXISTS page_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module VARCHAR(50) NOT NULL,
  layout_type VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  config JSONB NOT NULL,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_page_layouts_module_type ON page_layouts(module, layout_type);

-- ============================================================
-- MODULE LAYOUT SETTINGS TABLE (Page Designer)
-- ============================================================
CREATE TABLE IF NOT EXISTS module_layout_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module VARCHAR(50) NOT NULL,
  layout_type VARCHAR(20) NOT NULL,
  use_custom_layout BOOLEAN DEFAULT false,
  layout_id UUID REFERENCES page_layouts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(module, layout_type)
);

CREATE INDEX IF NOT EXISTS idx_module_layout_settings_module ON module_layout_settings(module);