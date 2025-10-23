CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS tags_text TEXT;

-- Maintain tags_text via trigger (GENERATED was rejected due to immutability)
CREATE OR REPLACE FUNCTION products_set_tags_text()
RETURNS TRIGGER AS $$
BEGIN
  NEW.tags_text := array_to_string(COALESCE(NEW.tags, '{}'), ' ');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_set_tags_text ON products;
CREATE TRIGGER trg_products_set_tags_text
BEFORE INSERT OR UPDATE OF tags ON products
FOR EACH ROW EXECUTE FUNCTION products_set_tags_text();

-- Backfill existing rows
UPDATE products SET tags_text = array_to_string(COALESCE(tags, '{}'), ' ')
WHERE tags_text IS NULL OR tags_text = '';

CREATE INDEX IF NOT EXISTS idx_products_brand_trgm
ON products USING gin (brand gin_trgm_ops)
WHERE is_active = true AND (is_deleted IS NULL OR is_deleted = false);

CREATE INDEX IF NOT EXISTS idx_products_description_en_trgm
ON products USING gin (description_en gin_trgm_ops)
WHERE is_active = true AND (is_deleted IS NULL OR is_deleted = false);

CREATE INDEX IF NOT EXISTS idx_products_sku_trgm
ON products USING gin (sku gin_trgm_ops)
WHERE is_active = true AND (is_deleted IS NULL OR is_deleted = false);

CREATE INDEX IF NOT EXISTS idx_products_tags_text_trgm
ON products USING gin (tags_text gin_trgm_ops)
WHERE is_active = true AND (is_deleted IS NULL OR is_deleted = false);

CREATE TABLE IF NOT EXISTS search_synonyms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_term TEXT NOT NULL,
  lang TEXT NOT NULL CHECK (lang IN ('en','km')),
  expansions TEXT[] NOT NULL DEFAULT '{}',
  weight_boost DECIMAL(10,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(base_term, lang)
);

CREATE OR REPLACE FUNCTION search_products_en_km(
  p_query TEXT,
  p_limit INTEGER DEFAULT 100,
  p_category_slug TEXT DEFAULT NULL
) RETURNS TABLE (
  product_id UUID,
  score numeric
) AS $$
DECLARE
  sanitized TEXT;
  tokens TEXT[];
  tok_count INT;
BEGIN
  sanitized := COALESCE(regexp_replace(lower(p_query), '[,();''"\\]', '', 'g'), '');
  sanitized := regexp_replace(sanitized, '[\x00-\x1F\x7F]', '', 'g');
  sanitized := btrim(sanitized);
  IF length(sanitized) < 2 THEN
    RETURN;
  END IF;

  -- Base tokens only (keep expansion inside EXISTS checks)
  tokens := ARRAY(
    SELECT t FROM regexp_split_to_table(sanitized, '\s+') AS t
    WHERE length(t) > 1
    LIMIT 10
  );

  tok_count := COALESCE(array_length(tokens, 1), 0);
  IF tok_count = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH bt AS (
    SELECT unnest(tokens) AS t
  ),
  filtered AS (
    SELECT p.id,
           SUM(
             CASE WHEN EXISTS (
               SELECT 1
               FROM (
                 SELECT lower(bt.t) AS term
                 UNION ALL
                 SELECT unnest(s.expansions)
                 FROM search_synonyms s
                 WHERE s.base_term = bt.t AND s.lang IN ('en','km')
               ) AS terms(term)
               WHERE 
                 lower(p.name_en) LIKE '%'||terms.term||'%' OR
                 lower(COALESCE(p.brand, '')) LIKE '%'||terms.term||'%' OR
                 lower(COALESCE(p.description_en, '')) LIKE '%'||terms.term||'%' OR
                 lower(COALESCE(p.sku, '')) LIKE '%'||terms.term||'%' OR
                 lower(COALESCE(p.tags_text, '')) LIKE '%'||terms.term||'%' OR
                 similarity(COALESCE(p.name_en, ''), terms.term) > 0.38 OR
                 similarity(COALESCE(p.brand, ''), terms.term) > 0.38 OR
                 similarity(COALESCE(p.sku, ''), terms.term) > 0.38 OR
                 similarity(COALESCE(p.tags_text, ''), terms.term) > 0.38
             ) THEN 1 ELSE 0 END
           ) AS matched_tokens,
           -- Score using base tokens; trigram contributes as numeric
           SUM(
             (CASE WHEN lower(p.name_en) = bt.t THEN 8
                   WHEN lower(p.name_en) LIKE bt.t||'%' THEN 6
                   WHEN lower(p.name_en) LIKE '%'||bt.t||'%' THEN 4 ELSE 0 END) +
             (CASE WHEN lower(COALESCE(p.brand, '')) = bt.t THEN 6
                   WHEN lower(COALESCE(p.brand, '')) LIKE bt.t||'%' THEN 4
                   WHEN lower(COALESCE(p.brand, '')) LIKE '%'||bt.t||'%' THEN 3 ELSE 0 END) +
             (CASE WHEN lower(COALESCE(p.sku, '')) = bt.t THEN 5
                   WHEN lower(COALESCE(p.sku, '')) LIKE '%'||bt.t||'%' THEN 3 ELSE 0 END) +
             (CASE WHEN lower(COALESCE(p.tags_text, '')) LIKE '%'||bt.t||'%' THEN 2 ELSE 0 END) +
             (CASE WHEN lower(COALESCE(p.description_en, '')) LIKE '%'||bt.t||'%' THEN 2 ELSE 0 END) +
             ((GREATEST(similarity(COALESCE(p.name_en, ''), bt.t), similarity(COALESCE(p.brand, ''), bt.t), similarity(COALESCE(p.sku, ''), bt.t), similarity(COALESCE(p.tags_text, ''), bt.t)) * 2.0)::numeric)
           ) AS base_score
    FROM products p
    CROSS JOIN bt
    WHERE p.is_active = true
      AND (p.is_deleted IS NULL OR p.is_deleted = false)
      AND (
        p_category_slug IS NULL OR EXISTS (
          SELECT 1 FROM categories c WHERE c.id = p.category_id AND c.slug = p_category_slug
        )
      )
    GROUP BY p.id
    HAVING SUM(
             CASE WHEN EXISTS (
               SELECT 1
               FROM (
                 SELECT lower(bt.t) AS term
                 UNION ALL
                 SELECT unnest(s.expansions)
                 FROM search_synonyms s
                 WHERE s.base_term = bt.t AND s.lang IN ('en','km')
               ) AS terms(term)
               WHERE 
                 lower(p.name_en) LIKE '%'||terms.term||'%' OR
                 lower(COALESCE(p.brand, '')) LIKE '%'||terms.term||'%' OR
                 lower(COALESCE(p.description_en, '')) LIKE '%'||terms.term||'%' OR
                 lower(COALESCE(p.sku, '')) LIKE '%'||terms.term||'%' OR
                 lower(COALESCE(p.tags_text, '')) LIKE '%'||terms.term||'%' OR
                 similarity(COALESCE(p.name_en, ''), terms.term) > 0.38 OR
                 similarity(COALESCE(p.brand, ''), terms.term) > 0.38 OR
                 similarity(COALESCE(p.sku, ''), terms.term) > 0.38 OR
                 similarity(COALESCE(p.tags_text, ''), terms.term) > 0.38
             ) THEN 1 ELSE 0 END
           ) >= tok_count
  ),
  scored AS (
    SELECT f.id AS product_id,
           f.base_score + (CASE WHEN p2.stock_quantity > 0 THEN 1 ELSE 0 END) AS score
    FROM filtered f
    JOIN products p2 ON p2.id = f.id
  )
  SELECT s.product_id, (s.score)::numeric AS score
  FROM scored s
  ORDER BY s.score DESC, s.product_id
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

ANALYZE products;
