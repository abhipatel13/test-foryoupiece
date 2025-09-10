-- Add media_order column to products for mixed media ordering (images + videos)
-- Safe to run multiple times
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS media_order TEXT[] DEFAULT '{}'::text[];

-- Optional: backfill existing products with empty array (no-op if default covers)
UPDATE products SET media_order = COALESCE(media_order, '{}'::text[]);

