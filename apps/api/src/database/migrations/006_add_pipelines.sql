-- Migration: 006_add_pipelines
-- Description: Shared pipeline system for leads & opportunities.
--   Creates pipelines, pipeline_stages, pipeline_stage_fields.
--   Migrates existing lead_stages → pipeline_stages under a
--   "Default Pipeline" with module = 'leads'.
--   Adds pipeline_id to leads table, re-points stage_id FK.

SET search_path TO "TENANT_SCHEMA";

-- ============================================================
-- 1. PIPELINES TABLE (shared across modules)
-- ============================================================
CREATE TABLE IF NOT EXISTS "TENANT_SCHEMA".pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_by UUID REFERENCES "TENANT_SCHEMA".users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipelines_active
  ON "TENANT_SCHEMA".pipelines(is_active);
CREATE INDEX IF NOT EXISTS idx_pipelines_default
  ON "TENANT_SCHEMA".pipelines(is_default) WHERE is_default = true;

-- ============================================================
-- 2. PIPELINE STAGES TABLE (per pipeline, per module)
-- ============================================================
CREATE TABLE IF NOT EXISTS "TENANT_SCHEMA".pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES "TENANT_SCHEMA".pipelines(id) ON DELETE CASCADE,
  module VARCHAR(50) NOT NULL,                -- 'leads' | 'opportunities'
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  color VARCHAR(20) DEFAULT '#3B82F6',
  description TEXT,
  probability INT DEFAULT 0,                  -- 0-100, mainly for opportunities
  sort_order INT NOT NULL DEFAULT 0,
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  is_won BOOLEAN DEFAULT false,
  is_lost BOOLEAN DEFAULT false,
  required_fields JSONB DEFAULT '[]',         -- field keys that must be filled
  visible_fields JSONB DEFAULT '[]',          -- field keys shown at this stage
  auto_actions JSONB DEFAULT '[]',            -- automation triggers
  exit_criteria JSONB DEFAULT '[]',           -- checklist items before leaving stage
  lock_previous_fields BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pipeline_id, module, slug)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline
  ON "TENANT_SCHEMA".pipeline_stages(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_module
  ON "TENANT_SCHEMA".pipeline_stages(pipeline_id, module);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_sort
  ON "TENANT_SCHEMA".pipeline_stages(pipeline_id, module, sort_order);

-- ============================================================
-- 3. PIPELINE STAGE FIELDS (replaces lead_stage_fields)
-- ============================================================
CREATE TABLE IF NOT EXISTS "TENANT_SCHEMA".pipeline_stage_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES "TENANT_SCHEMA".pipeline_stages(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_pipeline_stage_fields_stage
  ON "TENANT_SCHEMA".pipeline_stage_fields(stage_id);

-- ============================================================
-- 4. SEED: Create "Default Pipeline"
-- ============================================================
INSERT INTO "TENANT_SCHEMA".pipelines (name, description, is_default, is_active, sort_order)
SELECT 'Default Pipeline', 'Default sales pipeline for leads and opportunities', true, true, 0
WHERE NOT EXISTS (
  SELECT 1 FROM "TENANT_SCHEMA".pipelines WHERE is_default = true
);

-- ============================================================
-- 5. MIGRATE: lead_stages → pipeline_stages (preserve UUIDs)
-- ============================================================
INSERT INTO "TENANT_SCHEMA".pipeline_stages
  (id, pipeline_id, module, name, slug, color, description,
   probability, sort_order, is_system, is_active, is_won, is_lost,
   required_fields, visible_fields, auto_actions, exit_criteria,
   lock_previous_fields, created_at, updated_at)
SELECT
  ls.id,                                          -- preserve UUID
  p.id,                                           -- default pipeline
  'leads',                                        -- module
  ls.name, ls.slug, ls.color, ls.description,
  CASE WHEN ls.is_won THEN 100
       WHEN ls.is_lost THEN 0
       ELSE (ls.sort_order * 15)                  -- rough probability from sort order
  END,
  ls.sort_order, ls.is_system, ls.is_active, ls.is_won, ls.is_lost,
  ls.required_fields, ls.visible_fields, ls.auto_actions, '[]'::jsonb,
  ls.lock_previous_fields, ls.created_at, ls.updated_at
FROM "TENANT_SCHEMA".lead_stages ls
CROSS JOIN (SELECT id FROM "TENANT_SCHEMA".pipelines WHERE is_default = true LIMIT 1) p
WHERE NOT EXISTS (
  SELECT 1 FROM "TENANT_SCHEMA".pipeline_stages ps
  WHERE ps.id = ls.id
);

-- ============================================================
-- 6. MIGRATE: lead_stage_fields → pipeline_stage_fields
-- ============================================================
INSERT INTO "TENANT_SCHEMA".pipeline_stage_fields
  (id, stage_id, field_key, field_label, field_type, field_options,
   is_required, is_visible, sort_order, created_at)
SELECT
  lsf.id, lsf.stage_id, lsf.field_key, lsf.field_label,
  lsf.field_type, lsf.field_options, lsf.is_required,
  lsf.is_visible, lsf.sort_order, lsf.created_at
FROM "TENANT_SCHEMA".lead_stage_fields lsf
WHERE EXISTS (
  SELECT 1 FROM "TENANT_SCHEMA".pipeline_stages ps WHERE ps.id = lsf.stage_id
)
AND NOT EXISTS (
  SELECT 1 FROM "TENANT_SCHEMA".pipeline_stage_fields psf WHERE psf.id = lsf.id
);

-- ============================================================
-- 7. ADD pipeline_id to leads table
-- ============================================================
ALTER TABLE "TENANT_SCHEMA".leads
  ADD COLUMN IF NOT EXISTS pipeline_id UUID;

-- Set all existing leads to the default pipeline
UPDATE "TENANT_SCHEMA".leads
SET pipeline_id = (SELECT id FROM "TENANT_SCHEMA".pipelines WHERE is_default = true LIMIT 1)
WHERE pipeline_id IS NULL;

-- Add FK (only if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_leads_pipeline'
    AND table_schema = 'TENANT_SCHEMA'
  ) THEN
    ALTER TABLE "TENANT_SCHEMA".leads
      ADD CONSTRAINT fk_leads_pipeline
      FOREIGN KEY (pipeline_id) REFERENCES "TENANT_SCHEMA".pipelines(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_pipeline ON "TENANT_SCHEMA".leads(pipeline_id);

-- ============================================================
-- 8. RE-POINT leads.stage_id FK from lead_stages → pipeline_stages
-- ============================================================
-- Drop old FK constraint (name may vary, so find and drop dynamically)
DO $$
DECLARE
  fk_name TEXT;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
  WHERE tc.table_schema = 'TENANT_SCHEMA'
    AND tc.table_name = 'leads'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'lead_stages'
    AND ccu.column_name = 'id';

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "TENANT_SCHEMA".leads DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

-- Add new FK to pipeline_stages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_leads_pipeline_stage'
    AND table_schema = 'TENANT_SCHEMA'
  ) THEN
    ALTER TABLE "TENANT_SCHEMA".leads
      ADD CONSTRAINT fk_leads_pipeline_stage
      FOREIGN KEY (stage_id) REFERENCES "TENANT_SCHEMA".pipeline_stages(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 9. SEED: Default Opportunity stages (for future use)
--    These will be ready when the opportunities module is built.
-- ============================================================
INSERT INTO "TENANT_SCHEMA".pipeline_stages
  (pipeline_id, module, name, slug, color, probability, sort_order, is_system, required_fields, exit_criteria)
SELECT
  p.id, 'opportunities', v.name, v.slug, v.color, v.probability, v.sort_order, false,
  v.required_fields::jsonb, v.exit_criteria::jsonb
FROM (SELECT id FROM "TENANT_SCHEMA".pipelines WHERE is_default = true LIMIT 1) p,
(VALUES
  ('Qualification',    'qualification',    '#3B82F6', 10, 1,  '[]', '[]'),
  ('Needs Analysis',   'needs_analysis',   '#F59E0B', 20, 2,  '[]', '["Identify key stakeholders","Document pain points"]'),
  ('Proposal',         'proposal',         '#8B5CF6', 40, 3,  '["amount"]', '["Proposal sent to decision maker"]'),
  ('Negotiation',      'negotiation',      '#EC4899', 60, 4,  '["amount","closeDate"]', '["Terms discussed","Pricing agreed"]'),
  ('Review',           'review',           '#F97316', 80, 5,  '["amount","closeDate"]', '["Legal review complete","Contract drafted"]'),
  ('Closed Won',       'closed_won',       '#059669', 100, 90, '["amount","closeDate"]', '[]'),
  ('Closed Lost',      'closed_lost',      '#EF4444', 0,  91, '[]', '[]')
) AS v(name, slug, color, probability, sort_order, required_fields, exit_criteria)
WHERE NOT EXISTS (
  SELECT 1 FROM "TENANT_SCHEMA".pipeline_stages ps
  WHERE ps.pipeline_id = p.id AND ps.module = 'opportunities'
);

-- Mark terminal opportunity stages
UPDATE "TENANT_SCHEMA".pipeline_stages
SET is_won = true
WHERE module = 'opportunities' AND slug = 'closed_won'
AND pipeline_id = (SELECT id FROM "TENANT_SCHEMA".pipelines WHERE is_default = true LIMIT 1);

UPDATE "TENANT_SCHEMA".pipeline_stages
SET is_lost = true
WHERE module = 'opportunities' AND slug = 'closed_lost'
AND pipeline_id = (SELECT id FROM "TENANT_SCHEMA".pipelines WHERE is_default = true LIMIT 1);