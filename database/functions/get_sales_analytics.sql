-- Create function to get comprehensive sales analytics
CREATE OR REPLACE FUNCTION get_sales_analytics(
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  min_sales_threshold integer DEFAULT 1
)
RETURNS TABLE (
  product_id uuid,
  sku text,
  name_en text,
  name_ja text,
  total_units_sold bigint,
  total_revenue numeric,
  order_count bigint,
  last_sale_date timestamp with time zone,
  first_sale_date timestamp with time zone,
  is_best_seller boolean,
  best_seller_position integer,
  images text[],
  price numeric,
  category_id uuid,
  category_name_en text,
  category_slug text
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH order_stats AS (
    SELECT 
      oi.product_id,
      SUM(oi.quantity) as units_sold,
      SUM(oi.price * oi.quantity) as revenue,
      COUNT(DISTINCT o.id) as order_count,
      MAX(o.created_at) as last_sale,
      MIN(o.created_at) as first_sale
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.created_at >= start_date 
      AND o.created_at <= end_date
      AND o.status IN ('completed', 'processing', 'shipped', 'delivered')
    GROUP BY oi.product_id
    HAVING SUM(oi.quantity) >= min_sales_threshold
  ),
  product_details AS (
    SELECT 
      p.id,
      p.sku,
      p.name_en,
      p.name_ja,
      p.is_best_seller,
      p.best_seller_position,
      p.images,
      p.price,
      p.category_id,
      c.name_en as category_name_en,
      c.slug as category_slug
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.is_active = true
  )
  SELECT 
    pd.id as product_id,
    pd.sku,
    pd.name_en,
    pd.name_ja,
    COALESCE(os.units_sold, 0) as total_units_sold,
    COALESCE(os.revenue, 0) as total_revenue,
    COALESCE(os.order_count, 0) as order_count,
    os.last_sale as last_sale_date,
    os.first_sale as first_sale_date,
    COALESCE(pd.is_best_seller, false) as is_best_seller,
    pd.best_seller_position,
    pd.images,
    pd.price,
    pd.category_id,
    pd.category_name_en,
    pd.category_slug
  FROM order_stats os
  JOIN product_details pd ON os.product_id = pd.id
  ORDER BY os.revenue DESC, os.units_sold DESC, os.order_count DESC;
END;
$$;
