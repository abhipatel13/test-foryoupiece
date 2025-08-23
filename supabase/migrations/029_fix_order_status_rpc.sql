-- Fix the update_order_status_with_telegram RPC function
-- The issue is that it's trying to set payment_status to 'cancelled' which is not a valid enum value
-- payment_status can only be: 'pending', 'verified', 'failed', 'refunded'
-- fulfillment_status can be: 'pending', 'processing', 'shipped', 'delivered', 'cancelled', 'on_hold'

-- Drop and recreate the function with proper enum handling
DROP FUNCTION IF EXISTS update_order_status_with_telegram(UUID, payment_status, fulfillment_status, TEXT);

-- Create the corrected RPC function
CREATE OR REPLACE FUNCTION update_order_status_with_telegram(
  order_id UUID,
  new_payment_status payment_status,
  new_fulfillment_status fulfillment_status,
  processed_by_user TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  order_exists BOOLEAN;
BEGIN
  -- Check if order exists
  SELECT EXISTS(SELECT 1 FROM orders WHERE id = order_id) INTO order_exists;
  
  IF NOT order_exists THEN
    RAISE EXCEPTION 'Order with ID % not found', order_id;
  END IF;
  
  -- Update order with Telegram tracking
  UPDATE orders 
  SET 
    payment_status = new_payment_status,
    fulfillment_status = new_fulfillment_status,
    processed_by = COALESCE(processed_by_user, processed_by),
    processed_at = CASE 
      WHEN processed_by_user IS NOT NULL THEN NOW()
      ELSE processed_at
    END,
    telegram_status = CASE 
      -- Order is completed when payment is verified AND fulfillment is delivered
      WHEN new_payment_status = 'verified' AND new_fulfillment_status = 'delivered' THEN 'completed'
      -- Order is cancelled when fulfillment is cancelled (payment status doesn't have 'cancelled')
      WHEN new_fulfillment_status = 'cancelled' THEN 'cancelled'
      -- Order is shipped when payment is verified AND fulfillment is shipped
      WHEN new_payment_status = 'verified' AND new_fulfillment_status = 'shipped' THEN 'shipped'
      -- Default to processing for other states
      ELSE 'processing'
    END,
    updated_at = NOW()
  WHERE id = order_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to update order status: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_order_status_with_telegram(UUID, payment_status, fulfillment_status, TEXT) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION update_order_status_with_telegram(UUID, payment_status, fulfillment_status, TEXT) IS 'Updates order payment and fulfillment status with proper enum validation and Telegram tracking';
