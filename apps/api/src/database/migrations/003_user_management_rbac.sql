-- ============================================================
-- Migration: 003_user_management_rbac
-- Description: User Management, Org Structure & Enterprise RBAC
-- Date: 2026-02-11
--
-- Adds: departments, teams, user_teams, territories, 
--       user_territories, user_invitations
-- Alters: users (add org fields), roles (add RBAC fields)
--
-- Permission Model (3 levels):
--   1. Module-level:  roles.permissions  → { module: { action: bool } }
--   2. Record-level:  roles.record_access → { module: "own"|"team"|"department"|"all" }
--   3. Field-level:   roles.field_permissions → { module: { field: "hidden"|"read_only"|"editable" } }
-- ============================================================

-- ============================================================
-- 1. DEPARTMENTS TABLE (hierarchical)
-- ============================================================
CREATE TABLE IF NOT EXISTS "TENANT_SCHEMA".departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(30) UNIQUE,
  description TEXT,
  parent_department_id UUID REFERENCES "TENANT_SCHEMA".departments(id) ON DELETE SET NULL,
  head_id UUID, -- FK added after users ALTER
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_departments_parent
  ON "TENANT_SCHEMA".departments(parent_department_id);
CREATE INDEX IF NOT EXISTS idx_departments_head
  ON "TENANT_SCHEMA".departments(head_id);
CREATE INDEX IF NOT EXISTS idx_departments_active
  ON "TENANT_SCHEMA".departments(is_active);

-- ============================================================
-- 2. TEAMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS "TENANT_SCHEMA".teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  department_id UUID REFERENCES "TENANT_SCHEMA".departments(id) ON DELETE SET NULL,
  team_lead_id UUID, -- FK added after users ALTER
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_department
  ON "TENANT_SCHEMA".teams(department_id);
CREATE INDEX IF NOT EXISTS idx_teams_lead
  ON "TENANT_SCHEMA".teams(team_lead_id);
CREATE INDEX IF NOT EXISTS idx_teams_active
  ON "TENANT_SCHEMA".teams(is_active);

-- ============================================================
-- 3. TERRITORIES TABLE (hierarchical)
-- ============================================================
CREATE TABLE IF NOT EXISTS "TENANT_SCHEMA".territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(30),
  description TEXT,
  type VARCHAR(50) DEFAULT 'geographic',  -- geographic, industry, account_size, product_line, custom
  parent_territory_id UUID REFERENCES "TENANT_SCHEMA".territories(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',  -- boundaries, criteria, etc.
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_territories_parent
  ON "TENANT_SCHEMA".territories(parent_territory_id);
CREATE INDEX IF NOT EXISTS idx_territories_type
  ON "TENANT_SCHEMA".territories(type);
CREATE INDEX IF NOT EXISTS idx_territories_active
  ON "TENANT_SCHEMA".territories(is_active);

-- ============================================================
-- 4. ALTER USERS TABLE — add org structure fields
-- ============================================================
ALTER TABLE "TENANT_SCHEMA".users
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES "TENANT_SCHEMA".departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES "TENANT_SCHEMA".users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS job_title VARCHAR(150),
  ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES "TENANT_SCHEMA".users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_department
  ON "TENANT_SCHEMA".users(department_id);
CREATE INDEX IF NOT EXISTS idx_users_manager
  ON "TENANT_SCHEMA".users(manager_id);
CREATE INDEX IF NOT EXISTS idx_users_status
  ON "TENANT_SCHEMA".users(status);

-- Now add FKs for departments and teams head/lead columns
ALTER TABLE "TENANT_SCHEMA".departments
  DROP CONSTRAINT IF EXISTS fk_departments_head,
  ADD CONSTRAINT fk_departments_head
    FOREIGN KEY (head_id) REFERENCES "TENANT_SCHEMA".users(id) ON DELETE SET NULL;

ALTER TABLE "TENANT_SCHEMA".teams
  DROP CONSTRAINT IF EXISTS fk_teams_lead,
  ADD CONSTRAINT fk_teams_lead
    FOREIGN KEY (team_lead_id) REFERENCES "TENANT_SCHEMA".users(id) ON DELETE SET NULL;

-- ============================================================
-- 5. USER_TEAMS (Many-to-Many)
-- ============================================================
CREATE TABLE IF NOT EXISTS "TENANT_SCHEMA".user_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "TENANT_SCHEMA".users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES "TENANT_SCHEMA".teams(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member',  -- member, lead, observer
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_user_teams_user
  ON "TENANT_SCHEMA".user_teams(user_id);
CREATE INDEX IF NOT EXISTS idx_user_teams_team
  ON "TENANT_SCHEMA".user_teams(team_id);

-- ============================================================
-- 6. USER_TERRITORIES (Many-to-Many)
-- ============================================================
CREATE TABLE IF NOT EXISTS "TENANT_SCHEMA".user_territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "TENANT_SCHEMA".users(id) ON DELETE CASCADE,
  territory_id UUID NOT NULL REFERENCES "TENANT_SCHEMA".territories(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member',  -- owner, member
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, territory_id)
);

CREATE INDEX IF NOT EXISTS idx_user_territories_user
  ON "TENANT_SCHEMA".user_territories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_territories_territory
  ON "TENANT_SCHEMA".user_territories(territory_id);

-- ============================================================
-- 7. ALTER ROLES TABLE — add enterprise RBAC fields
-- ============================================================
ALTER TABLE "TENANT_SCHEMA".roles
  ADD COLUMN IF NOT EXISTS level INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS record_access JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS field_permissions JSONB DEFAULT '{}';

-- ============================================================
-- 8. USER INVITATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS "TENANT_SCHEMA".user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role_id UUID REFERENCES "TENANT_SCHEMA".roles(id) ON DELETE SET NULL,
  department_id UUID REFERENCES "TENANT_SCHEMA".departments(id) ON DELETE SET NULL,
  team_ids UUID[] DEFAULT '{}',
  job_title VARCHAR(150),
  invited_by UUID NOT NULL REFERENCES "TENANT_SCHEMA".users(id),
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'pending',  -- pending, accepted, expired, cancelled
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_invitations_email
  ON "TENANT_SCHEMA".user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_token
  ON "TENANT_SCHEMA".user_invitations(token);
CREATE INDEX IF NOT EXISTS idx_user_invitations_status
  ON "TENANT_SCHEMA".user_invitations(status);

-- ============================================================
-- 9. UPDATE DEFAULT ROLES with full RBAC permission structure
-- ============================================================

-- Admin: full access to everything, all records, all fields editable
UPDATE "TENANT_SCHEMA".roles SET
  level = 100,
  is_custom = false,
  permissions = '{
    "contacts": { "view": true, "create": true, "edit": true, "delete": true, "export": true, "import": true },
    "accounts": { "view": true, "create": true, "edit": true, "delete": true, "export": true, "import": true },
    "leads":    { "view": true, "create": true, "edit": true, "delete": true, "export": true, "import": true },
    "deals":    { "view": true, "create": true, "edit": true, "delete": true, "export": true, "import": true },
    "tasks":    { "view": true, "create": true, "edit": true, "delete": true, "export": true, "import": true },
    "reports":  { "view": true, "create": true, "edit": true, "delete": true, "export": true, "import": true },
    "users":    { "view": true, "create": true, "edit": true, "delete": true, "invite": true },
    "roles":    { "view": true, "create": true, "edit": true, "delete": true },
    "settings": { "view": true, "edit": true },
    "admin":    { "view": true, "edit": true }
  }',
  record_access = '{
    "contacts": "all",
    "accounts": "all",
    "leads":    "all",
    "deals":    "all",
    "tasks":    "all",
    "reports":  "all"
  }',
  field_permissions = '{}'
WHERE name = 'admin' AND is_system = true;

-- Manager: team-level access, can manage team data
UPDATE "TENANT_SCHEMA".roles SET
  level = 50,
  is_custom = false,
  permissions = '{
    "contacts": { "view": true, "create": true, "edit": true, "delete": true, "export": true, "import": false },
    "accounts": { "view": true, "create": true, "edit": true, "delete": true, "export": true, "import": false },
    "leads":    { "view": true, "create": true, "edit": true, "delete": true, "export": true, "import": false },
    "deals":    { "view": true, "create": true, "edit": true, "delete": true, "export": true, "import": false },
    "tasks":    { "view": true, "create": true, "edit": true, "delete": true, "export": false, "import": false },
    "reports":  { "view": true, "create": true, "edit": false, "delete": false, "export": true, "import": false },
    "users":    { "view": true, "create": false, "edit": false, "delete": false, "invite": false },
    "roles":    { "view": true, "create": false, "edit": false, "delete": false },
    "settings": { "view": true, "edit": false },
    "admin":    { "view": false, "edit": false }
  }',
  record_access = '{
    "contacts": "team",
    "accounts": "team",
    "leads":    "team",
    "deals":    "team",
    "tasks":    "team",
    "reports":  "team"
  }',
  field_permissions = '{}'
WHERE name = 'manager' AND is_system = true;

-- User: own-record access, basic CRM ops
UPDATE "TENANT_SCHEMA".roles SET
  level = 10,
  is_custom = false,
  permissions = '{
    "contacts": { "view": true, "create": true, "edit": true, "delete": false, "export": false, "import": false },
    "accounts": { "view": true, "create": true, "edit": true, "delete": false, "export": false, "import": false },
    "leads":    { "view": true, "create": true, "edit": true, "delete": false, "export": false, "import": false },
    "deals":    { "view": true, "create": true, "edit": true, "delete": false, "export": false, "import": false },
    "tasks":    { "view": true, "create": true, "edit": true, "delete": true, "export": false, "import": false },
    "reports":  { "view": true, "create": false, "edit": false, "delete": false, "export": false, "import": false },
    "users":    { "view": false, "create": false, "edit": false, "delete": false, "invite": false },
    "roles":    { "view": false, "create": false, "edit": false, "delete": false },
    "settings": { "view": false, "edit": false },
    "admin":    { "view": false, "edit": false }
  }',
  record_access = '{
    "contacts": "own",
    "accounts": "own",
    "leads":    "own",
    "deals":    "own",
    "tasks":    "own",
    "reports":  "own"
  }',
  field_permissions = '{}'
WHERE name = 'user' AND is_system = true;

-- ============================================================
-- 10. SEED: Default Department (for existing users)
-- ============================================================
INSERT INTO "TENANT_SCHEMA".departments (name, code, description, is_active)
VALUES ('General', 'GEN', 'Default department', true)
ON CONFLICT DO NOTHING;