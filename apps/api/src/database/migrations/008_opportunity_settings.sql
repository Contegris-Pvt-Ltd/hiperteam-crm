-- ============================================================
-- Migration: 008_opportunity_settings
-- Description: Admin-configurable settings tables for opportunities
--   - opportunity_types (replaces hardcoded enum)
--   - opportunity_forecast_categories (replaces hardcoded enum)
--   - Add competitor column to opportunities table (if missing)
-- ============================================================

SET search_path TO "TENANT_SCHEMA";

-- ============================================================
-- 1. OPPORTUNITY TYPES
-- ============================================================
CREATE TABLE IF NOT EXISTS "TENANT_SCHEMA".opportunity_types (
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

-- Seed default types
INSERT INTO "TENANT_SCHEMA".opportunity_types (name, slug, color, sort_order, is_system) VALUES
  ('New Business', 'new_business', '#3B82F6', 1, true),
  ('Renewal',      'renewal',      '#10B981', 2, true),
  ('Upsell',       'upsell',       '#F59E0B', 3, true),
  ('Cross Sell',   'cross_sell',   '#8B5CF6', 4, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. OPPORTUNITY FORECAST CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS "TENANT_SCHEMA".opportunity_forecast_categories (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(100) NOT NULL,
  slug              VARCHAR(100) NOT NULL,
  description       TEXT,
  color             VARCHAR(20) DEFAULT '#6B7280',
  probability_min   INT DEFAULT 0,         -- Auto-assign when probability >= this
  probability_max   INT DEFAULT 100,       -- Auto-assign when probability <= this
  sort_order        INT DEFAULT 0,
  is_system         BOOLEAN DEFAULT false,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default forecast categories
INSERT INTO "TENANT_SCHEMA".opportunity_forecast_categories (name, slug, color, probability_min, probability_max, sort_order, is_system) VALUES
  ('Pipeline',   'pipeline',   '#6B7280', 0,  25,  1, true),
  ('Best Case',  'best_case',  '#F59E0B', 26, 50,  2, true),
  ('Commit',     'commit',     '#3B82F6', 51, 80,  3, true),
  ('Closed',     'closed',     '#10B981', 81, 100, 4, true),
  ('Omitted',    'omitted',    '#EF4444', 0,  0,   5, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. ADD COMPETITOR COLUMN TO OPPORTUNITIES (if missing)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'TENANT_SCHEMA'
      AND table_name = 'opportunities'
      AND column_name = 'competitor'
  ) THEN
    ALTER TABLE "TENANT_SCHEMA".opportunities ADD COLUMN competitor VARCHAR(255);
  END IF;
END $$;

-- ============================================================
-- 4. RECORD MIGRATION
-- ============================================================
INSERT INTO "TENANT_SCHEMA".schema_migrations (migration_name)
VALUES ('008_opportunity_settings')
ON CONFLICT DO NOTHING;