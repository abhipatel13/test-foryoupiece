-- Migration: Telegram Stock Management System
-- Creates tables and functions for processing Telegram stock update messages

-- Create telegram_stock_updates table to log all processed messages
CREATE TABLE telegram_stock_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_message_id BIGINT NOT NULL UNIQUE,
    telegram_user_id BIGINT NOT NULL,
    telegram_username TEXT,
    telegram_user_first_name TEXT,
    message_text TEXT NOT NULL,
    processing_status TEXT NOT NULL CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'ignored')),
    products_found INTEGER DEFAULT 0,
    products_updated INTEGER DEFAULT 0,
    products_failed INTEGER DEFAULT 0,
    unmatched_products JSONB DEFAULT '[]',
    updated_products JSONB DEFAULT '[]',
    error_details TEXT,
    processing_time_ms INTEGER,
    response_sent BOOLEAN DEFAULT FALSE,
    response_message_id BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_telegram_stock_updates_message_id ON telegram_stock_updates(telegram_message_id);
CREATE INDEX idx_telegram_stock_updates_created_at ON telegram_stock_updates(created_at);
CREATE INDEX idx_telegram_stock_updates_status ON telegram_stock_updates(processing_status);
CREATE INDEX idx_telegram_stock_updates_user_id ON telegram_stock_updates(telegram_user_id);

-- Create telegram_stock_product_matches table for tracking product matching accuracy
CREATE TABLE telegram_stock_product_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_update_id UUID REFERENCES telegram_stock_updates(id) ON DELETE CASCADE,
    raw_product_text TEXT NOT NULL,
    extracted_name TEXT NOT NULL,
    extracted_quantity INTEGER NOT NULL,
    matched_product_id UUID REFERENCES products(id),
    matched_product_name TEXT,
    match_confidence DECIMAL(5,4), -- 0.0000 to 1.0000
    match_method TEXT CHECK (match_method IN ('exact', 'fuzzy', 'manual', 'failed')),
    old_stock_quantity INTEGER,
    new_stock_quantity INTEGER,
    stock_updated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for product matches
CREATE INDEX idx_telegram_stock_product_matches_update_id ON telegram_stock_product_matches(stock_update_id);
CREATE INDEX idx_telegram_stock_product_matches_product_id ON telegram_stock_product_matches(matched_product_id);

-- Enhanced stock update function with comprehensive logging
CREATE OR REPLACE FUNCTION update_product_stock_with_logging(
    product_id uuid,
    quantity_change integer,
    reason text DEFAULT 'Stock adjustment',
    reference_id uuid DEFAULT NULL,
    reference_type text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    old_quantity integer;
    new_quantity integer;
    product_name text;
    result jsonb;
BEGIN
    -- Get current product info
    SELECT stock_quantity, name_en INTO old_quantity, product_name
    FROM products 
    WHERE id = product_id;
    
    -- Check if product exists
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Product not found',
            'product_id', product_id
        );
    END IF;
    
    -- Calculate new quantity (allow negative for backorders)
    new_quantity := old_quantity + quantity_change;
    
    -- Update the product stock quantity
    UPDATE products 
    SET 
        stock_quantity = new_quantity,
        updated_at = NOW()
    WHERE id = product_id;
    
    -- Log the inventory movement
    INSERT INTO inventory_movements (
        product_id,
        movement_type,
        quantity,
        reason,
        reference_type,
        reference_id,
        created_at
    ) VALUES (
        product_id,
        CASE 
            WHEN quantity_change > 0 THEN 'in'
            WHEN quantity_change < 0 THEN 'out'
            ELSE 'adjustment'
        END,
        ABS(quantity_change),
        reason,
        reference_type,
        reference_id,
        NOW()
    );
    
    -- Return success result with details
    RETURN jsonb_build_object(
        'success', true,
        'product_id', product_id,
        'product_name', product_name,
        'old_quantity', old_quantity,
        'new_quantity', new_quantity,
        'quantity_change', quantity_change,
        'timestamp', NOW()
    );
    
EXCEPTION WHEN OTHERS THEN
    -- Return error result
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'product_id', product_id,
        'old_quantity', old_quantity,
        'quantity_change', quantity_change
    );
END;
$$;

-- Function to bulk update stock quantities for multiple products
CREATE OR REPLACE FUNCTION bulk_update_product_stock(
    updates jsonb,
    reason text DEFAULT 'Telegram stock update',
    reference_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    update_item jsonb;
    result jsonb;
    results jsonb[] := '{}';
    success_count integer := 0;
    error_count integer := 0;
BEGIN
    -- Process each update in the array
    FOR update_item IN SELECT * FROM jsonb_array_elements(updates)
    LOOP
        -- Call individual stock update function
        SELECT update_product_stock_with_logging(
            (update_item->>'product_id')::uuid,
            (update_item->>'quantity_change')::integer,
            reason,
            reference_id,
            'telegram_stock_update'
        ) INTO result;
        
        -- Add result to results array
        results := results || result;
        
        -- Count successes and errors
        IF (result->>'success')::boolean THEN
            success_count := success_count + 1;
        ELSE
            error_count := error_count + 1;
        END IF;
    END LOOP;
    
    -- Return summary
    RETURN jsonb_build_object(
        'success', error_count = 0,
        'total_updates', success_count + error_count,
        'successful_updates', success_count,
        'failed_updates', error_count,
        'results', results,
        'timestamp', NOW()
    );
END;
$$;

-- Function to find products by name with fuzzy matching support
CREATE OR REPLACE FUNCTION find_products_by_name(
    search_name text,
    exact_match_only boolean DEFAULT false
) RETURNS TABLE (
    id uuid,
    name_en text,
    name_ja text,
    sku text,
    stock_quantity integer,
    match_score decimal
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- First try exact match (case-insensitive)
    RETURN QUERY
    SELECT 
        p.id,
        p.name_en,
        p.name_ja,
        p.sku,
        p.stock_quantity,
        1.0::decimal as match_score
    FROM products p
    WHERE 
        LOWER(p.name_en) = LOWER(search_name)
        OR LOWER(p.name_ja) = LOWER(search_name)
        OR LOWER(p.sku) = LOWER(search_name)
    ORDER BY p.name_en;
    
    -- If no exact matches and fuzzy matching is allowed
    IF NOT exact_match_only AND NOT EXISTS (
        SELECT 1 FROM products p
        WHERE 
            LOWER(p.name_en) = LOWER(search_name)
            OR LOWER(p.name_ja) = LOWER(search_name)
            OR LOWER(p.sku) = LOWER(search_name)
    ) THEN
        -- Return fuzzy matches using similarity
        RETURN QUERY
        SELECT 
            p.id,
            p.name_en,
            p.name_ja,
            p.sku,
            p.stock_quantity,
            GREATEST(
                similarity(LOWER(p.name_en), LOWER(search_name)),
                similarity(LOWER(p.name_ja), LOWER(search_name)),
                similarity(LOWER(p.sku), LOWER(search_name))
            )::decimal as match_score
        FROM products p
        WHERE 
            GREATEST(
                similarity(LOWER(p.name_en), LOWER(search_name)),
                similarity(LOWER(p.name_ja), LOWER(search_name)),
                similarity(LOWER(p.sku), LOWER(search_name))
            ) > 0.3
        ORDER BY match_score DESC, p.name_en
        LIMIT 5;
    END IF;
END;
$$;

-- Enable pg_trgm extension for fuzzy text matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_telegram_stock_updates_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_telegram_stock_updates_timestamp
    BEFORE UPDATE ON telegram_stock_updates
    FOR EACH ROW EXECUTE FUNCTION update_telegram_stock_updates_timestamp();
