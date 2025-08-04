-- Create functions for admin product operations that bypass RLS
-- These functions will be used by the BoxHero sync service

-- Function to create a product with admin privileges
CREATE OR REPLACE FUNCTION admin_create_product(
  product_data jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Insert the product with elevated privileges
  INSERT INTO products (
    id, sku, name_en, name_ja, description_en, description_ja,
    price, stock_quantity, low_stock_threshold, category_id,
    images, is_featured, is_active, tags, created_at, updated_at
  )
  VALUES (
    (product_data->>'id')::uuid,
    product_data->>'sku',
    product_data->>'name_en',
    product_data->>'name_ja',
    product_data->>'description_en',
    product_data->>'description_ja',
    (product_data->>'price')::decimal,
    (product_data->>'stock_quantity')::integer,
    (product_data->>'low_stock_threshold')::integer,
    (product_data->>'category_id')::uuid,
    (product_data->>'images')::jsonb,
    (product_data->>'is_featured')::boolean,
    (product_data->>'is_active')::boolean,
    (product_data->>'tags')::jsonb,
    (product_data->>'created_at')::timestamptz,
    (product_data->>'updated_at')::timestamptz
  )
  RETURNING to_jsonb(products.*) INTO result;
  
  RETURN result;
END;
$$;

-- Function to update a product with admin privileges
CREATE OR REPLACE FUNCTION admin_update_product(
  product_id uuid,
  product_data jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Update the product with elevated privileges
  UPDATE products SET
    sku = COALESCE(product_data->>'sku', sku),
    name_en = COALESCE(product_data->>'name_en', name_en),
    name_ja = COALESCE(product_data->>'name_ja', name_ja),
    description_en = COALESCE(product_data->>'description_en', description_en),
    description_ja = COALESCE(product_data->>'description_ja', description_ja),
    price = COALESCE((product_data->>'price')::decimal, price),
    stock_quantity = COALESCE((product_data->>'stock_quantity')::integer, stock_quantity),
    low_stock_threshold = COALESCE((product_data->>'low_stock_threshold')::integer, low_stock_threshold),
    category_id = COALESCE((product_data->>'category_id')::uuid, category_id),
    images = COALESCE((product_data->>'images')::jsonb, images),
    is_featured = COALESCE((product_data->>'is_featured')::boolean, is_featured),
    is_active = COALESCE((product_data->>'is_active')::boolean, is_active),
    tags = COALESCE((product_data->>'tags')::jsonb, tags),
    updated_at = COALESCE((product_data->>'updated_at')::timestamptz, updated_at)
  WHERE id = product_id
  RETURNING to_jsonb(products.*) INTO result;
  
  RETURN result;
END;
$$;

-- Grant execute permissions to the service role
GRANT EXECUTE ON FUNCTION admin_create_product(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION admin_update_product(uuid, jsonb) TO service_role;
