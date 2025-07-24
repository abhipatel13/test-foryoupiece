-- Add 'on_hold' status to fulfillment_status enum
-- This allows orders to be placed but held for manual payment verification

-- Add the new status to the enum
ALTER TYPE fulfillment_status ADD VALUE 'on_hold';

-- Update the default value for new orders to be 'on_hold' instead of 'pending'
-- This ensures all new QR code orders start in 'on_hold' status
ALTER TABLE orders ALTER COLUMN fulfillment_status SET DEFAULT 'on_hold';

-- Create index for faster queries on fulfillment_status
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON orders(fulfillment_status);

-- Create index for faster queries on payment_status
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

-- Create composite index for admin order filtering
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(fulfillment_status, payment_status, created_at DESC);
