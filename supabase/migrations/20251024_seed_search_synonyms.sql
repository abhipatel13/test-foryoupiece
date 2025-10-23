-- Seed initial English/Khmer search synonyms
INSERT INTO search_synonyms (base_term, lang, expansions, weight_boost)
VALUES
  ('refill','en', ARRAY['refill pack','refill pouch','recharge','refill bottle'], 0.5),
  ('refill','km', ARRAY['បំពេញ','បំពេញឡើងវិញ'], 0.5),
  ('whitening','en', ARRAY['white','brightening','tone up','brighten'], 0.3),
  ('whitening','km', ARRAY['ស','ស្បែកស'], 0.3),
  ('shampoo','en', ARRAY['hair wash','wash'], 0.2),
  ('shampoo','km', ARRAY['សាប៊ូ'], 0.2),
  ('conditioner','en', ARRAY['treatment','hair mask'], 0.2),
  ('conditioner','km', ARRAY['ក្រែមលាបសក់'], 0.2),
  ('lotion','en', ARRAY['toner','water','essence'], 0.2)
ON CONFLICT (base_term, lang)
DO UPDATE SET
  expansions = (
    SELECT ARRAY(SELECT DISTINCT e FROM unnest(search_synonyms.expansions || EXCLUDED.expansions) AS e)
  ),
  weight_boost = EXCLUDED.weight_boost,
  updated_at = NOW();
