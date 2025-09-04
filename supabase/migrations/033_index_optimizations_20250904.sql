-- =====================================================
-- Migration 033: Targeted Index Optimizations (2025-09-04)
-- Purpose: Add missing indexes to speed up common queries and avoid N+1 pitfalls
-- Notes:
--  - Uses appropriate index types (btree, GIN, trigram) based on query patterns
--  - Partial indexes scoped to active, non-deleted products where applicable
--  - All statements are IF NOT EXISTS to be idempotent
-- =====================================================

-- Safety: ensure pg_trgm is available for trigram indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1) Products: stock_status filtering (used in recommendations and listings)
-- Most queries also constrain is_active=true and is_deleted=false
CREATE INDEX IF NOT EXISTS idx_products_stock_status_active
ON products (stock_status)
WHERE is_active = true AND is_deleted = false;

-- 2) Products: tags filtering (array contains in search API)
-- GIN index dramatically speeds up `tags @> ARRAY[...]` and PostgREST tags.cs
CREATE INDEX IF NOT EXISTS idx_products_tags_gin
ON products USING gin(tags)
WHERE is_active = true AND is_deleted = false;

-- 3) Products: trigram search on name fields (used by ILIKE %term%)
-- We already have tsvector GIN indexes, but queries use ILIKE; trigram helps substring matching
CREATE INDEX IF NOT EXISTS idx_products_name_en_trgm
ON products USING gin (name_en gin_trgm_ops)
WHERE is_active = true AND is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_products_name_ja_trgm
ON products USING gin (name_ja gin_trgm_ops)
WHERE is_active = true AND is_deleted = false;

-- 4) Orders: composite indexes already exist from migration 022
--    idx_orders_user_created_at (user_id, created_at DESC)
--    idx_orders_status_created_at (payment_status, fulfillment_status, created_at DESC)
-- No change here.

-- 5) Order items: add missing foreign key indexes for join/filter performance
CREATE INDEX IF NOT EXISTS idx_order_items_order_id
ON order_items(order_id);

-- 6) Points system: table is point_transactions (not points_ledger)
-- Common query: WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_created_at
ON point_transactions(user_id, created_at DESC);

-- Support refunds/audit lookups by order reference
CREATE INDEX IF NOT EXISTS idx_point_transactions_order_ref
ON point_transactions(reference_type, reference_id)
WHERE reference_type = 'order';

-- Analyze to update statistics after index creation
ANALYZE products;
ANALYZE order_items;
ANALYZE point_transactions;

