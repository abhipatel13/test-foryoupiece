-- Telegram Order Notifications System
-- This migration adds Telegram integration for order management

-- Add Telegram-related columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS telegram_message_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS telegram_status TEXT DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS processed_by TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE;

-- Create telegram_notifications table for tracking all Telegram messages
CREATE TABLE IF NOT EXISTS telegram_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  thread_id TEXT,
  message_type TEXT NOT NULL CHECK (message_type IN ('notification', 'confirmation')),
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'updated', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_telegram_status ON orders(telegram_status);
CREATE INDEX IF NOT EXISTS idx_orders_telegram_message_id ON orders(telegram_message_id);
CREATE INDEX IF NOT EXISTS idx_telegram_notifications_order_id ON telegram_notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_telegram_notifications_message_id ON telegram_notifications(message_id);
CREATE INDEX IF NOT EXISTS idx_telegram_notifications_type ON telegram_notifications(message_type);

-- Function to update telegram_notifications updated_at timestamp
CREATE OR REPLACE FUNCTION update_telegram_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER telegram_notifications_updated_at
  BEFORE UPDATE ON telegram_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_telegram_notifications_updated_at();

-- Function to handle order status changes and trigger notifications
CREATE OR REPLACE FUNCTION notify_order_telegram()
RETURNS TRIGGER AS $$
BEGIN
  -- Trigger Telegram notification for new orders
  IF TG_OP = 'INSERT' AND NEW.payment_status = 'pending' THEN
    -- This will be handled by the application layer via webhook
    PERFORM pg_notify('new_order', NEW.id::text);
  END IF;
  
  -- Log status changes for existing orders
  IF TG_OP = 'UPDATE' AND (OLD.payment_status != NEW.payment_status OR OLD.fulfillment_status != NEW.fulfillment_status) THEN
    PERFORM pg_notify('order_status_changed', json_build_object(
      'order_id', NEW.id,
      'old_payment_status', OLD.payment_status,
      'new_payment_status', NEW.payment_status,
      'old_fulfillment_status', OLD.fulfillment_status,
      'new_fulfillment_status', NEW.fulfillment_status
    )::text);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for order notifications
DROP TRIGGER IF EXISTS order_telegram_notification ON orders;
CREATE TRIGGER order_telegram_notification
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_order_telegram();

-- RPC function to update order status with Telegram tracking
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
      WHEN new_payment_status = 'verified' AND new_fulfillment_status = 'shipped' THEN 'completed'
      WHEN new_payment_status = 'cancelled' OR new_fulfillment_status = 'cancelled' THEN 'cancelled'
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

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION update_order_status_with_telegram TO authenticated;
GRANT EXECUTE ON FUNCTION update_order_status_with_telegram TO service_role;

-- Comments for documentation
COMMENT ON TABLE telegram_notifications IS 'Tracks all Telegram messages sent for order management';
COMMENT ON COLUMN orders.telegram_message_id IS 'ID of the Telegram message for this order';
COMMENT ON COLUMN orders.telegram_status IS 'Status of Telegram processing: pending, processing, completed, cancelled';
COMMENT ON COLUMN orders.processed_by IS 'User who processed the order via Telegram';
COMMENT ON COLUMN orders.processed_at IS 'Timestamp when order was processed via Telegram';
COMMENT ON FUNCTION update_order_status_with_telegram IS 'Updates order status with Telegram tracking information';
