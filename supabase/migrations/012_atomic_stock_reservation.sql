-- Migration: Atomic Stock Reservation System
-- This migration creates functions to prevent race conditions in inventory management
-- by implementing atomic stock validation and reservation during order creation

-- Function to atomically validate and reserve stock for multiple products
CREATE OR REPLACE FUNCTION reserve_stock_for_order(
    order_items jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    item jsonb;
    product_record RECORD;
    reservation_results jsonb[] := '{}';
    total_reserved integer := 0;
    failed_reservations jsonb[] := '{}';
    success_count integer := 0;
    failure_count integer := 0;
BEGIN
    -- Process each item in the order
    FOR item IN SELECT * FROM jsonb_array_elements(order_items)
    LOOP
        -- Get current product stock with row-level locking to prevent race conditions
        SELECT id, name_en, stock_quantity, track_inventory, allow_backorder
        INTO product_record
        FROM products 
        WHERE id = (item->>'product_id')::uuid
        FOR UPDATE; -- This locks the row until transaction commits
        
        -- Check if product exists
        IF NOT FOUND THEN
            failed_reservations := failed_reservations || jsonb_build_object(
                'product_id', item->>'product_id',
                'error', 'Product not found',
                'requested_quantity', item->>'quantity'
            );
            failure_count := failure_count + 1;
            CONTINUE;
        END IF;
        
        -- Skip stock validation if inventory tracking is disabled
        IF NOT product_record.track_inventory THEN
            reservation_results := reservation_results || jsonb_build_object(
                'product_id', item->>'product_id',
                'product_name', product_record.name_en,
                'requested_quantity', item->>'quantity',
                'reserved_quantity', item->>'quantity',
                'new_stock', product_record.stock_quantity,
                'status', 'reserved_no_tracking'
            );
            success_count := success_count + 1;
            CONTINUE;
        END IF;
        
        -- Check stock availability
        DECLARE
            requested_qty integer := (item->>'quantity')::integer;
            current_stock integer := product_record.stock_quantity;
            new_stock integer;
        BEGIN
            -- Calculate new stock level
            new_stock := current_stock - requested_qty;
            
            -- Check if we have enough stock or if backorders are allowed
            IF new_stock < 0 AND NOT product_record.allow_backorder THEN
                failed_reservations := failed_reservations || jsonb_build_object(
                    'product_id', item->>'product_id',
                    'product_name', product_record.name_en,
                    'error', 'Insufficient stock',
                    'requested_quantity', requested_qty,
                    'available_stock', current_stock,
                    'shortfall', requested_qty - current_stock
                );
                failure_count := failure_count + 1;
                CONTINUE;
            END IF;
            
            -- Reserve the stock by updating the quantity
            UPDATE products 
            SET 
                stock_quantity = GREATEST(0, new_stock),
                updated_at = NOW()
            WHERE id = product_record.id;
            
            -- Record successful reservation
            reservation_results := reservation_results || jsonb_build_object(
                'product_id', item->>'product_id',
                'product_name', product_record.name_en,
                'requested_quantity', requested_qty,
                'reserved_quantity', requested_qty,
                'previous_stock', current_stock,
                'new_stock', GREATEST(0, new_stock),
                'status', CASE 
                    WHEN new_stock < 0 THEN 'reserved_backorder'
                    ELSE 'reserved'
                END
            );
            
            success_count := success_count + 1;
            total_reserved := total_reserved + requested_qty;
        END;
    END LOOP;
    
    -- If any reservations failed, rollback the entire transaction
    IF failure_count > 0 THEN
        -- Return failure result with details
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Stock reservation failed for one or more items',
            'total_items', success_count + failure_count,
            'successful_reservations', success_count,
            'failed_reservations', failure_count,
            'failures', failed_reservations,
            'timestamp', NOW()
        );
    END IF;
    
    -- All reservations successful
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Stock reserved successfully for all items',
        'total_items', success_count,
        'total_quantity_reserved', total_reserved,
        'reservations', reservation_results,
        'timestamp', NOW()
    );
END;
$$;

-- Function to rollback stock reservations (for order cancellation or failure)
CREATE OR REPLACE FUNCTION rollback_stock_reservation(
    order_items jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    item jsonb;
    product_record RECORD;
    rollback_results jsonb[] := '{}';
    success_count integer := 0;
    failure_count integer := 0;
BEGIN
    -- Process each item to rollback
    FOR item IN SELECT * FROM jsonb_array_elements(order_items)
    LOOP
        -- Get current product with locking
        SELECT id, name_en, stock_quantity, track_inventory
        INTO product_record
        FROM products 
        WHERE id = (item->>'product_id')::uuid
        FOR UPDATE;
        
        -- Check if product exists
        IF NOT FOUND THEN
            failure_count := failure_count + 1;
            CONTINUE;
        END IF;
        
        -- Skip if inventory tracking is disabled
        IF NOT product_record.track_inventory THEN
            success_count := success_count + 1;
            CONTINUE;
        END IF;
        
        -- Restore the stock
        DECLARE
            quantity_to_restore integer := (item->>'quantity')::integer;
            current_stock integer := product_record.stock_quantity;
            new_stock integer := current_stock + quantity_to_restore;
        BEGIN
            UPDATE products 
            SET 
                stock_quantity = new_stock,
                updated_at = NOW()
            WHERE id = product_record.id;
            
            rollback_results := rollback_results || jsonb_build_object(
                'product_id', item->>'product_id',
                'product_name', product_record.name_en,
                'restored_quantity', quantity_to_restore,
                'previous_stock', current_stock,
                'new_stock', new_stock,
                'status', 'restored'
            );
            
            success_count := success_count + 1;
        END;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Stock rollback completed',
        'total_items', success_count + failure_count,
        'successful_rollbacks', success_count,
        'failed_rollbacks', failure_count,
        'rollbacks', rollback_results,
        'timestamp', NOW()
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION reserve_stock_for_order(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION reserve_stock_for_order(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION rollback_stock_reservation(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION rollback_stock_reservation(jsonb) TO service_role;

-- Add comments for documentation
COMMENT ON FUNCTION reserve_stock_for_order(jsonb) IS 'Atomically validates and reserves stock for multiple products during order creation. Uses row-level locking to prevent race conditions.';
COMMENT ON FUNCTION rollback_stock_reservation(jsonb) IS 'Rollback stock reservations for order cancellation or failure scenarios.';
