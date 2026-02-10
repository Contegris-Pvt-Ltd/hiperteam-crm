-- Migration: 001_add_page_designer
-- Description: Add page_layouts and module_layout_settings tables for Page Designer

-- Page Layouts
CREATE TABLE IF NOT EXISTS "TENANT_SCHEMA".page_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    module VARCHAR(100) NOT NULL,
    page_type VARCHAR(50) NOT NULL DEFAULT 'detail',
    layout JSONB NOT NULL DEFAULT '{}',
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES "TENANT_SCHEMA".users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_page_layouts_module ON "TENANT_SCHEMA".page_layouts(module);
CREATE INDEX IF NOT EXISTS idx_page_layouts_page_type ON "TENANT_SCHEMA".page_layouts(page_type);

-- Module Layout Settings
CREATE TABLE IF NOT EXISTS "TENANT_SCHEMA".module_layout_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module VARCHAR(100) NOT NULL UNIQUE,
    use_custom_layout BOOLEAN DEFAULT false,
    detail_layout_id UUID REFERENCES "TENANT_SCHEMA".page_layouts(id) ON DELETE SET NULL,
    edit_layout_id UUID REFERENCES "TENANT_SCHEMA".page_layouts(id) ON DELETE SET NULL,
    create_layout_id UUID REFERENCES "TENANT_SCHEMA".page_layouts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_module_layout_settings_module ON "TENANT_SCHEMA".module_layout_settings(module);