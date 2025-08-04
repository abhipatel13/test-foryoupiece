-- Migration: Add update_product_stock function for stock management
-- This function is used by the order creation API to update product stock quantities

-- Function to update product stock quantity
CREATE OR REPLACE FUNCTION update_product_stock(
  product_id uuid,
  quantity_change integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the product stock quantity
  UPDATE products 
  SET 
    stock_quantity = GREATEST(0, stock_quantity + quantity_change),
    updated_at = NOW()
  WHERE id = product_id;
  
  -- Check if the product exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product with ID % not found', product_id;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_product_stock(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION update_product_stock(uuid, integer) TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION update_product_stock(uuid, integer) IS 'Updates product stock quantity by adding the quantity_change (can be negative for reductions)';
