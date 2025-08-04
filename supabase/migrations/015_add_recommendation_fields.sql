-- =====================================================
-- Add Recommendation Engine Required Fields Migration
-- =====================================================

-- Add missing product fields required by recommendation engine
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS points_rate DECIMAL(4,2) DEFAULT 1.00 CHECK (points_rate >= 0 AND points_rate <= 10.00),
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0 CHECK (view_count >= 0),
ADD COLUMN IF NOT EXISTS purchase_count INTEGER DEFAULT 0 CHECK (purchase_count >= 0),
ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 4.0 CHECK (rating >= 0 AND rating <= 5.0);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_products_view_count ON products(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_products_purchase_count ON products(purchase_count DESC);
CREATE INDEX IF NOT EXISTS idx_products_rating ON products(rating DESC);
CREATE INDEX IF NOT EXISTS idx_products_points_rate ON products(points_rate DESC);

-- Create indexes for recommendation queries
CREATE INDEX IF NOT EXISTS idx_user_behavior_tracking_user_product ON user_behavior_tracking(user_id, product_id, behavior_type);
CREATE INDEX IF NOT EXISTS idx_user_behavior_tracking_recent ON user_behavior_tracking(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_search_history_recent ON user_search_history(user_id, created_at DESC);

-- Create function to increment product view count
CREATE OR REPLACE FUNCTION increment_product_view_count(product_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE products 
  SET view_count = view_count + 1,
      updated_at = NOW()
  WHERE id = product_uuid;
END;
$$ LANGUAGE plpgsql;

-- Create function to update product purchase count when orders are completed
CREATE OR REPLACE FUNCTION update_product_purchase_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update when payment status changes to 'verified' (completed)
    IF OLD.payment_status != 'verified' AND NEW.payment_status = 'verified' THEN
        -- Update purchase count for all products in this order
        UPDATE products 
        SET purchase_count = purchase_count + oi.quantity,
            updated_at = NOW()
        FROM order_items oi
        WHERE oi.order_id = NEW.id 
        AND products.id = oi.product_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update purchase counts
DROP TRIGGER IF EXISTS trigger_update_product_purchase_count ON orders;
CREATE TRIGGER trigger_update_product_purchase_count
    AFTER UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_product_purchase_count();

-- Initialize purchase_count for existing products based on historical order data
UPDATE products 
SET purchase_count = COALESCE(historical_counts.total_quantity, 0)
FROM (
    SELECT 
        oi.product_id,
        SUM(oi.quantity) as total_quantity
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.payment_status = 'verified'
    GROUP BY oi.product_id
) as historical_counts
WHERE products.id = historical_counts.product_id;

-- Add comments for documentation
COMMENT ON COLUMN products.points_rate IS 'Points rate percentage for loyalty program (e.g., 1.00 = 1%, 2.00 = 2%)';
COMMENT ON COLUMN products.view_count IS 'Total number of times this product has been viewed';
COMMENT ON COLUMN products.purchase_count IS 'Total number of times this product has been purchased (sum of quantities)';
COMMENT ON COLUMN products.rating IS 'Average product rating (0-5 scale)';

-- Log the migration
INSERT INTO boxhero_sync_logs (
    sync_type, 
    status, 
    message, 
    details
) VALUES (
    'schema_migration',
    'completed',
    'Added recommendation engine required fields to products table',
    '{\"fields_added\": [\"points_rate\", \"view_count\", \"purchase_count\", \"rating\"], \"indexes_created\": 7, \"functions_created\": 2}'::jsonb
);
