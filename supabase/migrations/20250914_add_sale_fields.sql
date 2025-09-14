-- Add sale scheduling fields to products
-- 20250914_add_sale_fields.sql

-- Add optional sale start/end timestamps to products for admin-driven sales
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sale_starts_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS sale_ends_at   TIMESTAMPTZ NULL;

-- Index for querying active sales by end time
CREATE INDEX IF NOT EXISTS idx_products_sale_ends_at ON products (sale_ends_at);

COMMENT ON COLUMN products.sale_starts_at IS 'Optional sale start timestamp (admin configured)';
COMMENT ON COLUMN products.sale_ends_at   IS 'Optional sale end timestamp (admin configured)';

