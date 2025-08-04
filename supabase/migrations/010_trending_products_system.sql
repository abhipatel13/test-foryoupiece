-- =====================================================
-- Trending Products System Migration
-- =====================================================

-- Create trending_products table to store algorithm-selected and manually-selected trending products
CREATE TABLE trending_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    selection_type TEXT NOT NULL CHECK (selection_type IN ('algorithm', 'manual')),
    algorithm_category TEXT CHECK (algorithm_category IN ('top_selling', 'recently_added', 'random_stock')),
    position INTEGER NOT NULL CHECK (position > 0),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id), -- Admin who manually added (null for algorithm)
    
    -- Ensure unique position per active trending product
    UNIQUE(position, is_active) DEFERRABLE INITIALLY DEFERRED
);

-- Create trending_refresh_log table to track algorithm refresh history
CREATE TABLE trending_refresh_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    refresh_type TEXT NOT NULL CHECK (refresh_type IN ('scheduled', 'manual', 'conditional')),
    products_changed INTEGER DEFAULT 0,
    top_selling_changed INTEGER DEFAULT 0,
    recently_added_changed INTEGER DEFAULT 0,
    random_stock_changed INTEGER DEFAULT 0,
    total_products INTEGER DEFAULT 10,
    refresh_reason TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) -- Admin who triggered manual refresh (null for scheduled)
);

-- Create product_sales_stats table to track sales data for trending algorithm
CREATE TABLE product_sales_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE UNIQUE,
    total_sales_count INTEGER DEFAULT 0,
    total_sales_amount DECIMAL(12,2) DEFAULT 0,
    last_30_days_sales INTEGER DEFAULT 0,
    last_7_days_sales INTEGER DEFAULT 0,
    last_sale_date TIMESTAMPTZ,
    view_count INTEGER DEFAULT 0,
    last_view_date TIMESTAMPTZ,
    trending_score DECIMAL(10,4) DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create trending_system_settings table for admin configuration
CREATE TABLE trending_system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Insert default settings
INSERT INTO trending_system_settings (setting_key, setting_value, description) VALUES
('algorithm_enabled', 'true', 'Enable/disable automatic algorithm selection'),
('refresh_frequency_hours', '48', 'How often to refresh trending products (in hours)'),
('top_selling_count', '4', 'Number of top-selling products to include'),
('recently_added_count', '2', 'Number of recently added products to include'),
('random_stock_count', '4', 'Number of random in-stock products to include'),
('last_refresh_date', 'null', 'Timestamp of last algorithm refresh'),
('min_sales_for_trending', '1', 'Minimum sales count to be considered for top-selling'),
('days_for_recent_products', '30', 'Products added within this many days are considered recent');

-- Create indexes for performance
CREATE INDEX idx_trending_products_active ON trending_products(is_active, position) WHERE is_active = true;
CREATE INDEX idx_trending_products_product_id ON trending_products(product_id);
CREATE INDEX idx_trending_products_selection_type ON trending_products(selection_type);
CREATE INDEX idx_trending_refresh_log_created_at ON trending_refresh_log(created_at DESC);
CREATE INDEX idx_product_sales_stats_product_id ON product_sales_stats(product_id);
CREATE INDEX idx_product_sales_stats_trending_score ON product_sales_stats(trending_score DESC);
CREATE INDEX idx_product_sales_stats_last_30_days ON product_sales_stats(last_30_days_sales DESC);

-- Create function to update product sales stats when orders are completed
CREATE OR REPLACE FUNCTION update_product_sales_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update stats when order status changes to 'completed'
    IF NEW.order_status = 'completed' AND (OLD.order_status IS NULL OR OLD.order_status != 'completed') THEN
        -- Update sales stats for all products in this order
        INSERT INTO product_sales_stats (product_id, total_sales_count, total_sales_amount, last_sale_date, updated_at)
        SELECT 
            oi.product_id,
            1,
            oi.total,
            NEW.updated_at,
            NEW.updated_at
        FROM order_items oi
        WHERE oi.order_id = NEW.id
        ON CONFLICT (product_id) DO UPDATE SET
            total_sales_count = product_sales_stats.total_sales_count + 1,
            total_sales_amount = product_sales_stats.total_sales_amount + EXCLUDED.total_sales_amount,
            last_sale_date = EXCLUDED.last_sale_date,
            updated_at = EXCLUDED.updated_at;
            
        -- Update last 30 days and 7 days sales counts
        UPDATE product_sales_stats 
        SET 
            last_30_days_sales = (
                SELECT COUNT(*)
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                WHERE oi.product_id = product_sales_stats.product_id
                AND o.order_status = 'completed'
                AND o.updated_at >= NOW() - INTERVAL '30 days'
            ),
            last_7_days_sales = (
                SELECT COUNT(*)
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                WHERE oi.product_id = product_sales_stats.product_id
                AND o.order_status = 'completed'
                AND o.updated_at >= NOW() - INTERVAL '7 days'
            )
        WHERE product_id IN (
            SELECT oi.product_id
            FROM order_items oi
            WHERE oi.order_id = NEW.id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update sales stats
CREATE TRIGGER trigger_update_product_sales_stats
    AFTER UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_product_sales_stats();

-- Create function to calculate trending scores
CREATE OR REPLACE FUNCTION calculate_trending_scores()
RETURNS void AS $$
BEGIN
    UPDATE product_sales_stats
    SET 
        trending_score = (
            -- Base score from recent sales (weighted heavily)
            (COALESCE(last_7_days_sales, 0) * 10) +
            (COALESCE(last_30_days_sales, 0) * 3) +
            
            -- Total sales contribution (lower weight)
            (COALESCE(total_sales_count, 0) * 0.5) +
            
            -- Recency boost for recently added products
            CASE 
                WHEN p.created_at >= NOW() - INTERVAL '7 days' THEN 15
                WHEN p.created_at >= NOW() - INTERVAL '30 days' THEN 8
                ELSE 0
            END +
            
            -- Stock scarcity boost
            CASE 
                WHEN p.stock_quantity <= 5 AND p.stock_quantity > 0 THEN 5
                WHEN p.stock_quantity <= 10 AND p.stock_quantity > 0 THEN 2
                ELSE 0
            END +
            
            -- Featured product boost
            CASE WHEN p.is_featured THEN 8 ELSE 0 END +
            
            -- Active product requirement
            CASE WHEN p.is_active THEN 0 ELSE -1000 END
        ),
        updated_at = NOW()
    FROM products p
    WHERE product_sales_stats.product_id = p.id;
END;
$$ LANGUAGE plpgsql;

-- Create function to refresh trending products using algorithm
CREATE OR REPLACE FUNCTION refresh_trending_products(
    p_refresh_type TEXT DEFAULT 'manual',
    p_created_by UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_start_time TIMESTAMPTZ := NOW();
    v_execution_time INTEGER;
    v_products_changed INTEGER := 0;
    v_top_selling_changed INTEGER := 0;
    v_recently_added_changed INTEGER := 0;
    v_random_stock_changed INTEGER := 0;
    v_settings RECORD;
    v_result JSON;
BEGIN
    -- Get system settings
    SELECT
        (SELECT setting_value::INTEGER FROM trending_system_settings WHERE setting_key = 'top_selling_count') as top_selling_count,
        (SELECT setting_value::INTEGER FROM trending_system_settings WHERE setting_key = 'recently_added_count') as recently_added_count,
        (SELECT setting_value::INTEGER FROM trending_system_settings WHERE setting_key = 'random_stock_count') as random_stock_count,
        (SELECT setting_value::INTEGER FROM trending_system_settings WHERE setting_key = 'min_sales_for_trending') as min_sales_for_trending,
        (SELECT setting_value::INTEGER FROM trending_system_settings WHERE setting_key = 'days_for_recent_products') as days_for_recent_products
    INTO v_settings;

    -- First, calculate trending scores
    PERFORM calculate_trending_scores();

    -- Clear existing algorithm-selected trending products
    DELETE FROM trending_products WHERE selection_type = 'algorithm';

    -- 1. Insert top-selling products (4 items)
    WITH top_selling AS (
        SELECT p.id, ROW_NUMBER() OVER (ORDER BY pss.trending_score DESC, pss.last_30_days_sales DESC) as rn
        FROM products p
        JOIN product_sales_stats pss ON p.id = pss.product_id
        WHERE p.is_active = true
        AND p.stock_quantity > 0
        AND pss.total_sales_count >= v_settings.min_sales_for_trending
        ORDER BY pss.trending_score DESC, pss.last_30_days_sales DESC
        LIMIT v_settings.top_selling_count
    )
    INSERT INTO trending_products (product_id, selection_type, algorithm_category, position)
    SELECT id, 'algorithm', 'top_selling', rn
    FROM top_selling;

    GET DIAGNOSTICS v_top_selling_changed = ROW_COUNT;

    -- 2. Insert recently added products (2 items)
    WITH recently_added AS (
        SELECT p.id, (v_settings.top_selling_count + ROW_NUMBER() OVER (ORDER BY p.created_at DESC)) as position
        FROM products p
        WHERE p.is_active = true
        AND p.stock_quantity > 0
        AND p.created_at >= NOW() - (v_settings.days_for_recent_products || ' days')::INTERVAL
        AND p.id NOT IN (SELECT product_id FROM trending_products WHERE selection_type = 'algorithm')
        ORDER BY p.created_at DESC
        LIMIT v_settings.recently_added_count
    )
    INSERT INTO trending_products (product_id, selection_type, algorithm_category, position)
    SELECT id, 'algorithm', 'recently_added', position
    FROM recently_added;

    GET DIAGNOSTICS v_recently_added_changed = ROW_COUNT;

    -- 3. Insert random in-stock products (4 items)
    WITH random_stock AS (
        SELECT p.id, (v_settings.top_selling_count + v_settings.recently_added_count + ROW_NUMBER() OVER (ORDER BY RANDOM())) as position
        FROM products p
        WHERE p.is_active = true
        AND p.stock_quantity > 0
        AND p.id NOT IN (SELECT product_id FROM trending_products WHERE selection_type = 'algorithm')
        ORDER BY RANDOM()
        LIMIT v_settings.random_stock_count
    )
    INSERT INTO trending_products (product_id, selection_type, algorithm_category, position)
    SELECT id, 'algorithm', 'random_stock', position
    FROM random_stock;

    GET DIAGNOSTICS v_random_stock_changed = ROW_COUNT;

    -- Calculate total changes
    v_products_changed := v_top_selling_changed + v_recently_added_changed + v_random_stock_changed;

    -- Update last refresh date
    UPDATE trending_system_settings
    SET setting_value = to_jsonb(NOW()::TEXT), updated_at = NOW()
    WHERE setting_key = 'last_refresh_date';

    -- Calculate execution time
    v_execution_time := EXTRACT(EPOCH FROM (NOW() - v_start_time)) * 1000;

    -- Log the refresh
    INSERT INTO trending_refresh_log (
        refresh_type, products_changed, top_selling_changed,
        recently_added_changed, random_stock_changed,
        total_products, execution_time_ms, created_by
    ) VALUES (
        p_refresh_type, v_products_changed, v_top_selling_changed,
        v_recently_added_changed, v_random_stock_changed,
        v_products_changed, v_execution_time, p_created_by
    );

    -- Return result
    v_result := json_build_object(
        'success', true,
        'products_changed', v_products_changed,
        'top_selling_changed', v_top_selling_changed,
        'recently_added_changed', v_recently_added_changed,
        'random_stock_changed', v_random_stock_changed,
        'execution_time_ms', v_execution_time
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Create function to get trending products with details
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
        COALESCE(pss.total_sales_count, 0) as sales_count
    FROM trending_products tp
    JOIN products p ON tp.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN product_sales_stats pss ON p.id = pss.product_id
    WHERE tp.is_active = true
    AND p.is_active = true
    ORDER BY tp.position ASC;
END;
$$ LANGUAGE plpgsql;

-- Initialize product sales stats for existing products
INSERT INTO product_sales_stats (product_id, updated_at)
SELECT id, NOW()
FROM products
WHERE is_active = true
ON CONFLICT (product_id) DO NOTHING;

-- Run initial trending score calculation
SELECT calculate_trending_scores();

-- Run initial trending products refresh
SELECT refresh_trending_products('initial', NULL);
