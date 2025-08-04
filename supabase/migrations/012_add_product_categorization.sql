-- Migration: Add product categorization fields for trending and best seller
-- This migration adds fields to mark products as trending or best seller

-- Add new columns to products table
ALTER TABLE products 
ADD COLUMN is_trending BOOLEAN DEFAULT FALSE,
ADD COLUMN is_best_seller BOOLEAN DEFAULT FALSE,
ADD COLUMN trending_position INTEGER,
ADD COLUMN best_seller_position INTEGER;

-- Add indexes for performance
CREATE INDEX idx_products_is_trending ON products(is_trending) WHERE is_trending = TRUE;
CREATE INDEX idx_products_is_best_seller ON products(is_best_seller) WHERE is_best_seller = TRUE;
CREATE INDEX idx_products_trending_position ON products(trending_position) WHERE trending_position IS NOT NULL;
CREATE INDEX idx_products_best_seller_position ON products(best_seller_position) WHERE best_seller_position IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN products.is_trending IS 'Flag to mark product as trending';
COMMENT ON COLUMN products.is_best_seller IS 'Flag to mark product as best seller';
COMMENT ON COLUMN products.trending_position IS 'Position in trending products list (lower number = higher priority)';
COMMENT ON COLUMN products.best_seller_position IS 'Position in best seller products list (lower number = higher priority)';
