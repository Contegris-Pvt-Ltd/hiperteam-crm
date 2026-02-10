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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default roles
INSERT INTO roles (name, description, permissions, is_system) VALUES
  ('admin', 'Full access to everything', '{"*": {"*": "all"}}', true),
  ('manager', 'Manage team and data', '{"contacts": {"*": "team"}, "leads": {"*": "team"}, "users": {"view": "team"}}', true),
  ('user', 'Standard user access', '{"contacts": {"*": "own"}, "leads": {"*": "own"}}', true)
ON CONFLICT DO NOTHING;

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
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);

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