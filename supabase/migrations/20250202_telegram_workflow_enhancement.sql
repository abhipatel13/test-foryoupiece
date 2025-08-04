-- Telegram Workflow Enhancement
-- This migration enhances the Telegram notification workflow to support sequential processing

-- Add workflow state tracking to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS telegram_workflow_state TEXT DEFAULT 'pending' 
  CHECK (telegram_workflow_state IN ('pending', 'notification_sent', 'arrived_confirmed', 'delivery_notified', 'completed', 'cancelled'));

-- Add arrival confirmation tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS arrival_confirmed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS arrival_confirmed_by TEXT;

-- Add delivery notification tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_notification_sent_at TIMESTAMP WITH TIME ZONE;

-- Create index for workflow state
CREATE INDEX IF NOT EXISTS idx_orders_telegram_workflow_state ON orders(telegram_workflow_state);

-- Update existing orders to have proper workflow state
UPDATE orders 
SET telegram_workflow_state = CASE 
  WHEN telegram_status = 'pending' AND telegram_message_id IS NOT NULL THEN 'notification_sent'
  WHEN telegram_status = 'confirmed' THEN 'completed'
  WHEN telegram_status = 'cancelled' THEN 'cancelled'
  ELSE 'pending'
END
WHERE telegram_workflow_state = 'pending';

-- Function to update workflow state when telegram_status changes
CREATE OR REPLACE FUNCTION update_telegram_workflow_state()
RETURNS TRIGGER AS $$
BEGIN
  -- Update workflow state based on telegram_status changes
  IF OLD.telegram_status IS DISTINCT FROM NEW.telegram_status THEN
    CASE NEW.telegram_status
      WHEN 'pending' THEN
        IF NEW.telegram_message_id IS NOT NULL THEN
          NEW.telegram_workflow_state = 'notification_sent';
        ELSE
          NEW.telegram_workflow_state = 'pending';
        END IF;
      WHEN 'confirmed' THEN
        NEW.telegram_workflow_state = 'completed';
        -- Set arrival confirmation timestamp if not already set
        IF NEW.arrival_confirmed_at IS NULL THEN
          NEW.arrival_confirmed_at = NOW();
        END IF;
      WHEN 'cancelled' THEN
        NEW.telegram_workflow_state = 'cancelled';
      ELSE
        -- Keep existing workflow state for other statuses
        NULL;
    END CASE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for workflow state updates
DROP TRIGGER IF EXISTS update_telegram_workflow_state_trigger ON orders;
CREATE TRIGGER update_telegram_workflow_state_trigger
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_telegram_workflow_state();

-- Function to handle arrival confirmation workflow
CREATE OR REPLACE FUNCTION confirm_order_arrival(
  p_order_id UUID,
  p_confirmed_by TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  order_record RECORD;
BEGIN
  -- Get order details
  SELECT * INTO order_record FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;
  
  -- Check if order is in correct state for arrival confirmation
  IF order_record.telegram_workflow_state != 'notification_sent' THEN
    RAISE EXCEPTION 'Order % is not in correct state for arrival confirmation. Current state: %', 
      order_record.order_number, order_record.telegram_workflow_state;
  END IF;
  
  -- Update order with arrival confirmation
  UPDATE orders 
  SET 
    telegram_workflow_state = 'arrived_confirmed',
    arrival_confirmed_at = NOW(),
    arrival_confirmed_by = p_confirmed_by,
    telegram_status = 'confirmed',
    payment_status = 'verified',
    fulfillment_status = 'shipped',
    processed_by = p_confirmed_by,
    processed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_order_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to confirm arrival for order %: %', p_order_id, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Function to mark delivery notification as sent
CREATE OR REPLACE FUNCTION mark_delivery_notification_sent(
  p_order_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE orders 
  SET 
    telegram_workflow_state = 'delivery_notified',
    delivery_notification_sent_at = NOW(),
    updated_at = NOW()
  WHERE id = p_order_id 
    AND telegram_workflow_state = 'arrived_confirmed';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or not in correct state for delivery notification';
  END IF;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to mark delivery notification sent for order %: %', p_order_id, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON COLUMN orders.telegram_workflow_state IS 'Tracks the sequential workflow state: pending -> notification_sent -> arrived_confirmed -> delivery_notified -> completed';
COMMENT ON COLUMN orders.arrival_confirmed_at IS 'Timestamp when arrival was confirmed via /arrived command';
COMMENT ON COLUMN orders.arrival_confirmed_by IS 'User who confirmed the arrival via /arrived command';
COMMENT ON COLUMN orders.delivery_notification_sent_at IS 'Timestamp when delivery notification was sent to second group';
COMMENT ON FUNCTION confirm_order_arrival IS 'Handles the arrival confirmation workflow step';
COMMENT ON FUNCTION mark_delivery_notification_sent IS 'Marks when delivery notification has been sent to second group';
