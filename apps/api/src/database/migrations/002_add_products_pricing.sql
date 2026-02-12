-- Migration: 002_add_products_pricing
-- Description: Add products, product_categories, price_books, price_book_entries, 
--              product_bundles, bundle_items, and opportunity_line_items tables

-- CRITICAL: Set search_path so all FK references resolve within tenant schema
SET search_path TO "TENANT_SCHEMA";

-- ============================================================
-- PRODUCT CATEGORIES TABLE (hierarchical)
-- ============================================================
CREATE TABLE IF NOT EXISTS "TENANT_SCHEMA".product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES "TENANT_SCHEMA".product_categories(id) ON DELETE SET NULL,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(slug)
);

CREATE INDEX IF NOT EXISTS idx_product_categories_parent
  ON "TENANT_SCHEMA".product_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_slug
  ON "TENANT_SCHEMA".product_categories(slug);

-- ============================================================
-- PRODUCTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS "TENANT_SCHEMA".products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100),
  short_description VARCHAR(500),
  description TEXT,
  type VARCHAR(50) NOT NULL DEFAULT 'product',
  category_id UUID REFERENCES "TENANT_SCHEMA".product_categories(id) ON DELETE SET NULL,
  unit VARCHAR(50) DEFAULT 'each',
  base_price DECIMAL(15,2) DEFAULT 0,
  cost DECIMAL(15,2),
  currency VARCHAR(3) DEFAULT 'USD',
  tax_category VARCHAR(100),
  status VARCHAR(50) DEFAULT 'active',
  image_url TEXT,
  external_url TEXT,
  custom_fields JSONB DEFAULT '{}',
  owner_id UUID REFERENCES "TENANT_SCHEMA".users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES "TENANT_SCHEMA".users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_code
  ON "TENANT_SCHEMA".products(code) WHERE code IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_type
  ON "TENANT_SCHEMA".products(type);
CREATE INDEX IF NOT EXISTS idx_products_status
  ON "TENANT_SCHEMA".products(status);
CREATE INDEX IF NOT EXISTS idx_products_category
  ON "TENANT_SCHEMA".products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_deleted
  ON "TENANT_SCHEMA".products(deleted_at);

-- ============================================================
-- PRICE BOOKS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS "TENANT_SCHEMA".price_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_standard BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  created_by UUID REFERENCES "TENANT_SCHEMA".users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_books_active
  ON "TENANT_SCHEMA".price_books(is_active);

-- Insert default Standard price book
INSERT INTO "TENANT_SCHEMA".price_books (name, description, is_standard, is_active)
VALUES ('Standard', 'Default pricing for all products', true, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- PRICE BOOK ENTRIES TABLE (product pricing per book)
-- ============================================================
CREATE TABLE IF NOT EXISTS "TENANT_SCHEMA".price_book_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_book_id UUID NOT NULL REFERENCES "TENANT_SCHEMA".price_books(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES "TENANT_SCHEMA".products(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_price_book_entries_book
  ON "TENANT_SCHEMA".price_book_entries(price_book_id);
CREATE INDEX IF NOT EXISTS idx_price_book_entries_product
  ON "TENANT_SCHEMA".price_book_entries(product_id);

-- ============================================================
-- PRODUCT BUNDLES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS "TENANT_SCHEMA".product_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES "TENANT_SCHEMA".products(id) ON DELETE CASCADE,
  bundle_type VARCHAR(20) DEFAULT 'fixed',
  min_items INT DEFAULT 0,
  max_items INT,
  discount_type VARCHAR(20) DEFAULT 'percentage',
  discount_value DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_bundles_product
  ON "TENANT_SCHEMA".product_bundles(product_id);

-- ============================================================
-- BUNDLE ITEMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS "TENANT_SCHEMA".bundle_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id UUID NOT NULL REFERENCES "TENANT_SCHEMA".product_bundles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES "TENANT_SCHEMA".products(id) ON DELETE CASCADE,
  quantity INT DEFAULT 1,
  is_optional BOOLEAN DEFAULT false,
  override_price DECIMAL(15,2),
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bundle_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_bundle_items_bundle
  ON "TENANT_SCHEMA".bundle_items(bundle_id);

-- ============================================================
-- OPPORTUNITY LINE ITEMS TABLE (for future Opportunities module)
-- ============================================================
CREATE TABLE IF NOT EXISTS "TENANT_SCHEMA".opportunity_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL,
  product_id UUID REFERENCES "TENANT_SCHEMA".products(id) ON DELETE SET NULL,
  price_book_entry_id UUID REFERENCES "TENANT_SCHEMA".price_book_entries(id) ON DELETE SET NULL,
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

CREATE INDEX IF NOT EXISTS idx_line_items_opportunity
  ON "TENANT_SCHEMA".opportunity_line_items(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_line_items_product
  ON "TENANT_SCHEMA".opportunity_line_items(product_id);

-- Grant privileges
GRANT ALL ON ALL TABLES IN SCHEMA "TENANT_SCHEMA" TO intelli_hiper_app;