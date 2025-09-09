-- Manual Products Support and BoxHero Isolation
-- Adds flags to mark manual products and guard them from BoxHero sync updates

-- 1) Add columns
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS allow_manual_stock_update BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN products.is_manual IS 'True when the product was created manually in admin and must be isolated from BoxHero sync updates';
COMMENT ON COLUMN products.allow_manual_stock_update IS 'One-shot flag to allow stock updates on manual products from trusted admin flows. Triggers will reset it to FALSE.';

-- 2) Create a trigger to block unintended stock updates to manual products
CREATE OR REPLACE FUNCTION prevent_boxhero_updates_on_manual_products()
RETURNS TRIGGER AS $$
BEGIN
  -- Only apply to stock changes on manual products
  IF (OLD.is_manual = TRUE) AND (NEW.stock_quantity IS DISTINCT FROM OLD.stock_quantity) THEN
    -- Allow only when explicitly permitted by admin flow
    IF NOT (NEW.allow_manual_stock_update IS TRUE) THEN
      -- Revert the stock change
      NEW.stock_quantity := OLD.stock_quantity;
    END IF;
  END IF;

  -- Always clear the one-shot flag so it never persists
  NEW.allow_manual_stock_update := FALSE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_block_boxhero_on_manual_products ON products;
CREATE TRIGGER trg_block_boxhero_on_manual_products
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION prevent_boxhero_updates_on_manual_products();

-- 3) Helpful partial index for filtering manual products (optional but useful)
CREATE INDEX IF NOT EXISTS idx_products_is_manual ON products(is_manual);

