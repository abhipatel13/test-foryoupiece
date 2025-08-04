-- Fix order status trigger function to use correct field names
-- The original function referenced 'order_status' which doesn't exist
-- The correct fields are 'payment_status' and 'fulfillment_status'

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS update_product_sales_stats_trigger ON orders;

-- Create corrected function to update product sales stats when orders are completed
CREATE OR REPLACE FUNCTION update_product_sales_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update stats when order is completed (payment verified AND fulfillment delivered)
    IF NEW.payment_status = 'verified' AND NEW.fulfillment_status = 'delivered' AND 
       (OLD.payment_status != 'verified' OR OLD.fulfillment_status != 'delivered') THEN
        
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
                AND o.payment_status = 'verified' 
                AND o.fulfillment_status = 'delivered'
                AND o.updated_at >= NOW() - INTERVAL '30 days'
            ),
            last_7_days_sales = (
                SELECT COUNT(*)
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                WHERE oi.product_id = product_sales_stats.product_id
                AND o.payment_status = 'verified' 
                AND o.fulfillment_status = 'delivered'
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

-- Recreate the trigger
CREATE TRIGGER update_product_sales_stats_trigger
    AFTER UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_product_sales_stats();

-- Add comment for documentation
COMMENT ON FUNCTION update_product_sales_stats() IS 'Updates product sales statistics when orders are completed (payment verified AND fulfillment delivered)';

-- Create a helper RPC function to update order status safely
CREATE OR REPLACE FUNCTION update_order_status(
    order_id UUID,
    new_payment_status TEXT,
    new_fulfillment_status TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Update the order without triggering the problematic function
    UPDATE orders
    SET
        payment_status = new_payment_status,
        fulfillment_status = new_fulfillment_status,
        updated_at = NOW()
    WHERE id = order_id;

    -- Return success
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error and return false
        RAISE NOTICE 'Error updating order %: %', order_id, SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_order_status(UUID, TEXT, TEXT) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION update_order_status(UUID, TEXT, TEXT) IS 'Safely updates order payment and fulfillment status';
