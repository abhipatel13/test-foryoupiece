-- Add videos array column to products for YouTube URLs
-- Safe to run multiple times due to IF NOT EXISTS
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS videos TEXT[] DEFAULT '{}'::text[];

-- Optional: simple check constraint to limit array length (can be adjusted later)
-- ALTER TABLE products ADD CONSTRAINT products_videos_maxlen CHECK (array_length(videos, 1) IS NULL OR array_length(videos, 1) <= 20);

