-- 20250918_partial_cancellation.sql
-- Add cancelled_quantity to order_items for partial cancellations

-- Add column with default and constraint (idempotent-safe guards)
ALTER TABLE IF EXISTS public.order_items
  ADD COLUMN IF NOT EXISTS cancelled_quantity integer NOT NULL DEFAULT 0;

-- Ensure non-negative values
ALTER TABLE IF EXISTS public.order_items
  ADD CONSTRAINT IF NOT EXISTS order_items_cancelled_quantity_nonneg
  CHECK (cancelled_quantity >= 0);

COMMENT ON COLUMN public.order_items.cancelled_quantity IS 'Number of units cancelled for this order item (0..quantity). Used for partial cancellation refunds and stock restoration.';

