-- Migration: 0001_add_custom_tabs_groups
-- Description: Add custom tabs and groups tables for form layout management
-- Date: 2026-02-09

-- Custom Tabs Table
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

-- Custom Field Groups Table
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

-- Add new columns to custom_field_definitions
ALTER TABLE custom_field_definitions 
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES custom_field_groups(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS tab_id UUID REFERENCES custom_tabs(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS section VARCHAR(50) DEFAULT 'custom',
ADD COLUMN IF NOT EXISTS column_span INT DEFAULT 1;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_custom_tabs_module ON custom_tabs(module);
CREATE INDEX IF NOT EXISTS idx_custom_field_groups_module ON custom_field_groups(module);
CREATE INDEX IF NOT EXISTS idx_custom_field_groups_tab ON custom_field_groups(tab_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_group ON custom_field_definitions(group_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_tab ON custom_field_definitions(tab_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_section ON custom_field_definitions(section);