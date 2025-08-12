-- =====================================================
-- Enhanced Trending Products System Migration
-- =====================================================
-- This migration enhances the trending system to support larger product sets
-- while maintaining performance and adding missing components

-- 1. Create missing manual_trending_products table
CREATE TABLE IF NOT EXISTS manual_trending_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position > 0),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Ensure unique position per active manual trending product
    UNIQUE(position, is_active) DEFERRABLE INITIALLY DEFERRED
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_manual_trending_products_active ON manual_trending_products(is_active, position);
CREATE INDEX IF NOT EXISTS idx_manual_trending_products_product ON manual_trending_products(product_id);
CREATE INDEX IF NOT EXISTS idx_trending_products_selection_type ON trending_products(selection_type, is_active);
CREATE INDEX IF NOT EXISTS idx_products_trending_flags ON products(is_trending, trending_position) WHERE is_trending = true;

-- 3. Update trending system settings to support larger limits
UPDATE trending_system_settings 
SET setting_value = '50', description = 'Number of top-selling products to include (increased for larger catalog)'
WHERE setting_key = 'top_selling_count';

UPDATE trending_system_settings 
SET setting_value = '25', description = 'Number of recently added products to include (increased for larger catalog)'
WHERE setting_key = 'recently_added_count';

UPDATE trending_system_settings 
SET setting_value = '75', description = 'Number of random in-stock products to include (increased for larger catalog)'
WHERE setting_key = 'random_stock_count';

-- Add new settings for enhanced functionality
INSERT INTO trending_system_settings (setting_key, setting_value, description) VALUES
('max_total_products', '200', 'Maximum total trending products to prevent performance issues'),
('include_manual_products', 'true', 'Include manually flagged trending products'),
('include_product_flags', 'true', 'Include products with is_trending flag set'),
('pagination_enabled', 'true', 'Enable pagination for large trending product sets')
ON CONFLICT (setting_key) DO UPDATE SET
    setting_value = EXCLUDED.setting_value,
    description = EXCLUDED.description,
    updated_at = NOW();

-- 4. Create enhanced get_trending_products function with pagination support
CREATE OR REPLACE FUNCTION get_trending_products_paginated(
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0,
    p_include_manual BOOLEAN DEFAULT true,
    p_include_flags BOOLEAN DEFAULT true
)
RETURNS TABLE (
    id UUID,
    product_id UUID,
    sku TEXT,
    name_en TEXT,
    name_ja TEXT,
    price DECIMAL(10,2),
    compare_at_price DECIMAL(10,2),
    images TEXT[],
    stock_quantity INTEGER,
    is_featured BOOLEAN,
    category_name TEXT,
    selection_type TEXT,
    algorithm_category TEXT,
    position INTEGER,
    trending_score DECIMAL(10,4),
    sales_count INTEGER,
    total_count BIGINT
) AS $$
DECLARE
    v_total_count BIGINT;
BEGIN
    -- Get total count for pagination
    WITH all_trending AS (
        -- Algorithm-selected products
        SELECT tp.product_id, tp.position, tp.selection_type, tp.algorithm_category
        FROM trending_products tp
        JOIN products p ON tp.product_id = p.id
        WHERE tp.is_active = true AND p.is_active = true
        
        UNION
        
        -- Manual trending products (if enabled)
        SELECT mtp.product_id, mtp.position + 1000 as position, 'manual'::TEXT as selection_type, 'manual'::TEXT as algorithm_category
        FROM manual_trending_products mtp
        JOIN products p ON mtp.product_id = p.id
        WHERE p_include_manual = true AND mtp.is_active = true AND p.is_active = true
        
        UNION
        
        -- Products with is_trending flag (if enabled)
        SELECT p.id as product_id, COALESCE(p.trending_position, 2000) as position, 'flagged'::TEXT as selection_type, 'flagged'::TEXT as algorithm_category
        FROM products p
        WHERE p_include_flags = true AND p.is_trending = true AND p.is_active = true
        AND p.id NOT IN (
            SELECT tp2.product_id FROM trending_products tp2 WHERE tp2.is_active = true
            UNION
            SELECT mtp2.product_id FROM manual_trending_products mtp2 WHERE mtp2.is_active = true AND p_include_manual = true
        )
    )
    SELECT COUNT(*) INTO v_total_count FROM all_trending;

    -- Return paginated results
    RETURN QUERY
    WITH all_trending AS (
        -- Algorithm-selected products
        SELECT 
            tp.id,
            tp.product_id,
            p.sku,
            p.name_en,
            p.name_ja,
            p.price,
            p.compare_at_price,
            p.images,
            p.stock_quantity,
            p.is_featured,
            c.name_en as category_name,
            tp.selection_type,
            tp.algorithm_category,
            tp.position,
            COALESCE(pss.trending_score, 0) as trending_score,
            COALESCE(pss.total_sales_count, 0) as sales_count,
            v_total_count
        FROM trending_products tp
        JOIN products p ON tp.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN product_sales_stats pss ON p.id = pss.product_id
        WHERE tp.is_active = true AND p.is_active = true
        
        UNION ALL
        
        -- Manual trending products (if enabled)
        SELECT 
            mtp.id,
            mtp.product_id,
            p.sku,
            p.name_en,
            p.name_ja,
            p.price,
            p.compare_at_price,
            p.images,
            p.stock_quantity,
            p.is_featured,
            c.name_en as category_name,
            'manual'::TEXT as selection_type,
            'manual'::TEXT as algorithm_category,
            mtp.position + 1000 as position,
            COALESCE(pss.trending_score, 0) as trending_score,
            COALESCE(pss.total_sales_count, 0) as sales_count,
            v_total_count
        FROM manual_trending_products mtp
        JOIN products p ON mtp.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN product_sales_stats pss ON p.id = pss.product_id
        WHERE p_include_manual = true AND mtp.is_active = true AND p.is_active = true
        
        UNION ALL
        
        -- Products with is_trending flag (if enabled)
        SELECT 
            gen_random_uuid() as id,
            p.id as product_id,
            p.sku,
            p.name_en,
            p.name_ja,
            p.price,
            p.compare_at_price,
            p.images,
            p.stock_quantity,
            p.is_featured,
            c.name_en as category_name,
            'flagged'::TEXT as selection_type,
            'flagged'::TEXT as algorithm_category,
            COALESCE(p.trending_position, 2000) as position,
            COALESCE(pss.trending_score, 0) as trending_score,
            COALESCE(pss.total_sales_count, 0) as sales_count,
            v_total_count
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN product_sales_stats pss ON p.id = pss.product_id
        WHERE p_include_flags = true AND p.is_trending = true AND p.is_active = true
        AND p.id NOT IN (
            SELECT tp2.product_id FROM trending_products tp2 WHERE tp2.is_active = true
            UNION
            SELECT mtp2.product_id FROM manual_trending_products mtp2 WHERE mtp2.is_active = true AND p_include_manual = true
        )
    )
    SELECT * FROM all_trending
    ORDER BY position ASC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- 5. Create the missing refresh_trending_products_with_fallback function
CREATE OR REPLACE FUNCTION refresh_trending_products_with_fallback()
RETURNS INTEGER AS $$
DECLARE
    v_result INTEGER;
    v_settings RECORD;
BEGIN
    -- Get current settings
    SELECT 
        COALESCE((SELECT setting_value::INTEGER FROM trending_system_settings WHERE setting_key = 'top_selling_count'), 4) as top_selling_count,
        COALESCE((SELECT setting_value::INTEGER FROM trending_system_settings WHERE setting_key = 'recently_added_count'), 2) as recently_added_count,
        COALESCE((SELECT setting_value::INTEGER FROM trending_system_settings WHERE setting_key = 'random_stock_count'), 4) as random_stock_count,
        COALESCE((SELECT setting_value::INTEGER FROM trending_system_settings WHERE setting_key = 'max_total_products'), 200) as max_total_products
    INTO v_settings;
    
    -- Try to refresh with current settings
    BEGIN
        SELECT refresh_trending_products('manual', NULL) INTO v_result;
        RETURN v_result;
    EXCEPTION WHEN OTHERS THEN
        -- Fallback: Use smaller numbers if the refresh fails
        PERFORM refresh_trending_products_fallback(10, 5, 15);
        RETURN 30; -- Return fallback count
    END;
END;
$$ LANGUAGE plpgsql;

-- 6. Create fallback refresh function with smaller limits
CREATE OR REPLACE FUNCTION refresh_trending_products_fallback(
    p_top_selling INTEGER DEFAULT 10,
    p_recently_added INTEGER DEFAULT 5,
    p_random_stock INTEGER DEFAULT 15
)
RETURNS INTEGER AS $$
DECLARE
    v_total_changed INTEGER := 0;
BEGIN
    -- Calculate trending scores first
    PERFORM calculate_trending_scores();
    
    -- Clear existing algorithm-selected trending products
    DELETE FROM trending_products WHERE selection_type = 'algorithm';
    
    -- Insert top-selling products
    WITH top_selling AS (
        SELECT p.id, ROW_NUMBER() OVER (ORDER BY pss.trending_score DESC, pss.last_30_days_sales DESC) as rn
        FROM products p
        JOIN product_sales_stats pss ON p.id = pss.product_id
        WHERE p.is_active = true AND p.stock_quantity > 0
        ORDER BY pss.trending_score DESC, pss.last_30_days_sales DESC
        LIMIT p_top_selling
    )
    INSERT INTO trending_products (product_id, selection_type, algorithm_category, position)
    SELECT id, 'algorithm', 'top_selling', rn FROM top_selling;
    
    GET DIAGNOSTICS v_total_changed = ROW_COUNT;
    
    -- Insert recently added products
    WITH recently_added AS (
        SELECT p.id, (p_top_selling + ROW_NUMBER() OVER (ORDER BY p.created_at DESC)) as position
        FROM products p
        WHERE p.is_active = true AND p.stock_quantity > 0
        AND p.created_at >= NOW() - INTERVAL '30 days'
        AND p.id NOT IN (SELECT product_id FROM trending_products WHERE selection_type = 'algorithm')
        ORDER BY p.created_at DESC
        LIMIT p_recently_added
    )
    INSERT INTO trending_products (product_id, selection_type, algorithm_category, position)
    SELECT id, 'algorithm', 'recently_added', position FROM recently_added;
    
    -- Insert random in-stock products
    WITH random_stock AS (
        SELECT p.id, (p_top_selling + p_recently_added + ROW_NUMBER() OVER (ORDER BY RANDOM())) as position
        FROM products p
        WHERE p.is_active = true AND p.stock_quantity > 0
        AND p.id NOT IN (SELECT product_id FROM trending_products WHERE selection_type = 'algorithm')
        ORDER BY RANDOM()
        LIMIT p_random_stock
    )
    INSERT INTO trending_products (product_id, selection_type, algorithm_category, position)
    SELECT id, 'algorithm', 'random_stock', position FROM random_stock;
    
    RETURN v_total_changed + p_recently_added + p_random_stock;
END;
$$ LANGUAGE plpgsql;

-- 7. Update the original get_trending_products function to use the new enhanced version
CREATE OR REPLACE FUNCTION get_trending_products()
RETURNS TABLE (
    id UUID,
    product_id UUID,
    sku TEXT,
    name_en TEXT,
    name_ja TEXT,
    price DECIMAL(10,2),
    compare_at_price DECIMAL(10,2),
    images TEXT[],
    stock_quantity INTEGER,
    is_featured BOOLEAN,
    category_name TEXT,
    selection_type TEXT,
    algorithm_category TEXT,
    position INTEGER,
    trending_score DECIMAL(10,4),
    sales_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gtp.id,
        gtp.product_id,
        gtp.sku,
        gtp.name_en,
        gtp.name_ja,
        gtp.price,
        gtp.compare_at_price,
        gtp.images,
        gtp.stock_quantity,
        gtp.is_featured,
        gtp.category_name,
        gtp.selection_type,
        gtp.algorithm_category,
        gtp.position,
        gtp.trending_score,
        gtp.sales_count
    FROM get_trending_products_paginated(200, 0, true, true) gtp;
END;
$$ LANGUAGE plpgsql;

-- 8. Grant necessary permissions
GRANT SELECT ON manual_trending_products TO authenticated;
GRANT ALL ON manual_trending_products TO service_role;

-- 9. Add RLS policies for manual_trending_products
ALTER TABLE manual_trending_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to active manual trending products" ON manual_trending_products
    FOR SELECT USING (is_active = true);

CREATE POLICY "Allow service role full access to manual trending products" ON manual_trending_products
    FOR ALL USING (auth.role() = 'service_role');

-- 10. Run initial refresh with new settings
SELECT refresh_trending_products_with_fallback();
