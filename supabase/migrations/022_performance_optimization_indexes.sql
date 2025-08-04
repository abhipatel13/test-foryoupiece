-- =====================================================
-- Performance Optimization Indexes Migration
-- Addresses selective loading delays in production
-- =====================================================

-- Critical indexes for products table performance

-- 1. Index for recently added products query (most critical)
-- Supports: WHERE is_active = true ORDER BY boxhero_last_sync_at DESC NULLS LAST, created_at DESC
CREATE INDEX IF NOT EXISTS idx_products_recently_added 
ON products(is_active, boxhero_last_sync_at DESC, created_at DESC) 
WHERE is_active = true;

-- 2. Index for default product sorting
-- Supports: WHERE is_active = true ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_products_active_created_at 
ON products(is_active, created_at DESC) 
WHERE is_active = true;

-- 3. Index for deals filtering (products with discounts)
-- Supports: WHERE is_active = true AND compare_at_price > price
CREATE INDEX IF NOT EXISTS idx_products_deals 
ON products(is_active, compare_at_price, price) 
WHERE is_active = true AND compare_at_price IS NOT NULL AND compare_at_price > price;

-- 4. Index for BoxHero sync operations
-- Supports queries filtering by boxhero_last_sync_at
CREATE INDEX IF NOT EXISTS idx_products_boxhero_sync 
ON products(boxhero_last_sync_at DESC) 
WHERE boxhero_last_sync_at IS NOT NULL;

-- 5. Composite index for featured products
-- Supports: WHERE is_active = true AND is_featured = true
CREATE INDEX IF NOT EXISTS idx_products_active_featured 
ON products(is_active, is_featured, created_at DESC) 
WHERE is_active = true AND is_featured = true;

-- 6. Index for stock-based queries
-- Supports stock quantity filtering and sorting
CREATE INDEX IF NOT EXISTS idx_products_stock_quantity 
ON products(is_active, stock_quantity DESC) 
WHERE is_active = true;

-- 7. Index for category-based queries
-- Supports: WHERE is_active = true AND category_id = ?
CREATE INDEX IF NOT EXISTS idx_products_category_active 
ON products(category_id, is_active, created_at DESC) 
WHERE is_active = true;

-- 8. Index for search queries
-- Supports ILIKE searches on name and description fields
CREATE INDEX IF NOT EXISTS idx_products_search_name_en 
ON products USING gin(to_tsvector('english', name_en)) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_products_search_name_ja 
ON products USING gin(to_tsvector('simple', name_ja)) 
WHERE is_active = true;

-- Performance indexes for user-related queries

-- 9. Index for user orders (account page performance)
CREATE INDEX IF NOT EXISTS idx_orders_user_created_at 
ON orders(user_id, created_at DESC);

-- 10. Index for user points and tier calculations
CREATE INDEX IF NOT EXISTS idx_users_points_tier 
ON users(points_balance DESC, tier_level);

-- 11. Index for order status queries
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at 
ON orders(payment_status, fulfillment_status, created_at DESC);

-- Add comments for documentation
COMMENT ON INDEX idx_products_recently_added IS 'Critical index for recently added products sorting performance';
COMMENT ON INDEX idx_products_active_created_at IS 'Index for default product listing performance';
COMMENT ON INDEX idx_products_deals IS 'Index for deals and discounts filtering performance';
COMMENT ON INDEX idx_orders_user_created_at IS 'Index for user account page order history performance';

-- Analyze tables to update statistics after index creation
ANALYZE products;
ANALYZE orders;
ANALYZE users;
