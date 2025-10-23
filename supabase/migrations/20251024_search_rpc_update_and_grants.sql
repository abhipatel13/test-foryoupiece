-- Final RPC definition and grants to keep repository in sync with live DB
-- Grants: anon/authenticated can read synonyms used by the RPC
GRANT SELECT ON TABLE search_synonyms TO anon, authenticated;

-- RPC: English + Khmer multi-term AND search with synonym expansion and server-side ranking
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
  -- Sanitize for control and quote characters (ASCII + common Unicode quotes)
  sanitized := COALESCE(regexp_replace(lower(p_query), '[,();''"\\]', '', 'g'), '');
  sanitized := regexp_replace(sanitized, '[\x00-\x1F\x7F]', '', 'g');
  sanitized := regexp_replace(sanitized, '[“”‘’]', '', 'g');
  sanitized := btrim(sanitized);
  IF length(sanitized) < 1 THEN
    RETURN;
  END IF;

  -- Tokenization: allow single non-ASCII (Khmer) tokens; drop single ASCII noise
  tokens := ARRAY(
    SELECT t FROM regexp_split_to_table(sanitized, '\s+') AS t
    WHERE NOT (char_length(t) = 1 AND t ~ '^[A-Za-z0-9]$')
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
           -- Weighted scoring; include trigram similarity cast to numeric
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
