-- Migration: Fix Points System Data Integrity Issues
-- This migration addresses critical bugs in the points system:
-- 1. Updates update_user_points function to handle total_points_earned correctly
-- 2. Fixes annual reset function to reset total_points_earned
-- 3. Provides data reconciliation for existing users

-- First, update the update_user_points function to handle total_points_earned correctly
CREATE OR REPLACE FUNCTION update_user_points(
    p_user_id UUID,
    p_points INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    current_balance INTEGER;
    current_total_earned INTEGER;
    new_balance INTEGER;
    new_total_earned INTEGER;
BEGIN
    -- Get current points balance and total earned
    SELECT points_balance, total_points_earned 
    INTO current_balance, current_total_earned
    FROM users
    WHERE id = p_user_id;
    
    -- Check if user exists
    IF current_balance IS NULL THEN
        RAISE EXCEPTION 'User not found with ID: %', p_user_id;
    END IF;
    
    -- Calculate new balance
    new_balance := current_balance + p_points;
    
    -- Prevent negative balance (safety check)
    IF new_balance < 0 THEN
        RAISE EXCEPTION 'Operation would result in negative balance. Current: %, Change: %, Result: %', 
            current_balance, p_points, new_balance;
    END IF;
    
    -- Update total_points_earned only for positive points (earned points)
    -- For negative points (redemptions), total_points_earned stays the same
    IF p_points > 0 THEN
        new_total_earned := current_total_earned + p_points;
    ELSE
        new_total_earned := current_total_earned; -- Don't reduce total earned for redemptions
    END IF;
    
    -- Update user's points balance and total points earned
    UPDATE users 
    SET points_balance = new_balance,
        total_points_earned = new_total_earned,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    -- Verify the update was successful
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Failed to update user points balance for user: %', p_user_id;
    END IF;
    
    -- Log the operation for debugging
    RAISE NOTICE 'Updated user % points: balance % -> % (change: %), total_earned % -> %', 
        p_user_id, current_balance, new_balance, p_points, current_total_earned, new_total_earned;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the annual reset function to also reset total_points_earned
CREATE OR REPLACE FUNCTION perform_annual_points_reset(
    admin_user_id_param UUID DEFAULT NULL,
    reset_type_param VARCHAR(20) DEFAULT 'annual'
)
RETURNS TABLE (
    users_affected INTEGER,
    total_points_reset BIGINT,
    reset_id UUID
) AS $$
DECLARE
    reset_record_id UUID;
    users_count INTEGER := 0;
    points_total BIGINT := 0;
    current_year INTEGER;
BEGIN
    current_year := EXTRACT(YEAR FROM NOW());

    -- Check if reset already performed this year
    IF EXISTS (
        SELECT 1 FROM points_reset_history
        WHERE reset_year = current_year AND reset_type = reset_type_param
    ) THEN
        RAISE EXCEPTION 'Points reset already performed for year %', current_year;
    END IF;

    -- Calculate totals before reset (include both balance and total earned)
    SELECT COUNT(*), COALESCE(SUM(points_balance + total_points_earned), 0)
    INTO users_count, points_total
    FROM users
    WHERE points_balance > 0 OR total_points_earned > 0;

    -- Create reset history record
    INSERT INTO points_reset_history (
        reset_year,
        reset_date,
        total_users_affected,
        total_points_reset,
        reset_type,
        admin_user_id,
        metadata
    ) VALUES (
        current_year,
        NOW(),
        users_count,
        points_total,
        reset_type_param,
        admin_user_id_param,
        jsonb_build_object(
            'reset_timestamp', NOW(),
            'reset_by', COALESCE(admin_user_id_param::text, 'system'),
            'includes_total_earned_reset', true
        )
    ) RETURNING id INTO reset_record_id;

    -- Mark all current user ranks as not current and set reset date
    UPDATE user_ranks
    SET is_current = FALSE, reset_at = NOW()
    WHERE is_current = TRUE;

    -- Reset all user points to 0, total points earned to 0, and tier to bronze
    UPDATE users
    SET
        points_balance = 0,
        total_points_earned = 0,
        tier_level = 'bronze',
        updated_at = NOW()
    WHERE points_balance > 0 OR total_points_earned > 0;

    -- Create new bronze rank records for all users
    INSERT INTO user_ranks (user_id, rank, points_at_rank, achieved_at, is_current)
    SELECT
        id,
        'bronze'::user_tier,
        0,
        NOW(),
        TRUE
    FROM users;

    -- Return results
    RETURN QUERY SELECT users_count, points_total, reset_record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reconcile user points data (fix existing inconsistencies)
CREATE OR REPLACE FUNCTION reconcile_user_points_data(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
    user_id UUID,
    old_total_earned INTEGER,
    new_total_earned INTEGER,
    points_difference INTEGER,
    reconciled BOOLEAN
) AS $$
DECLARE
    user_record RECORD;
    calculated_total INTEGER;
    current_year INTEGER;
    start_of_year TIMESTAMPTZ;
BEGIN
    current_year := EXTRACT(YEAR FROM NOW());
    start_of_year := DATE_TRUNC('year', NOW());
    
    -- If specific user provided, reconcile only that user
    IF p_user_id IS NOT NULL THEN
        -- Calculate actual total earned from current year transactions
        SELECT COALESCE(SUM(points), 0)
        INTO calculated_total
        FROM point_transactions
        WHERE user_id = p_user_id 
        AND points > 0 
        AND created_at >= start_of_year;
        
        -- Get current stored total
        SELECT id, total_points_earned
        INTO user_record
        FROM users
        WHERE id = p_user_id;
        
        IF user_record.id IS NOT NULL THEN
            -- Update if there's a discrepancy
            IF ABS(calculated_total - user_record.total_points_earned) > 0 THEN
                UPDATE users
                SET total_points_earned = calculated_total,
                    updated_at = NOW()
                WHERE id = p_user_id;
                
                RETURN QUERY SELECT 
                    p_user_id,
                    user_record.total_points_earned,
                    calculated_total,
                    calculated_total - user_record.total_points_earned,
                    TRUE;
            ELSE
                RETURN QUERY SELECT 
                    p_user_id,
                    user_record.total_points_earned,
                    calculated_total,
                    0,
                    FALSE;
            END IF;
        END IF;
    ELSE
        -- Reconcile all users
        FOR user_record IN 
            SELECT id, total_points_earned
            FROM users
            WHERE total_points_earned > 0 OR id IN (
                SELECT DISTINCT user_id 
                FROM point_transactions 
                WHERE points > 0 AND created_at >= start_of_year
            )
        LOOP
            -- Calculate actual total earned from current year transactions
            SELECT COALESCE(SUM(points), 0)
            INTO calculated_total
            FROM point_transactions
            WHERE user_id = user_record.id 
            AND points > 0 
            AND created_at >= start_of_year;
            
            -- Update if there's a discrepancy
            IF ABS(calculated_total - user_record.total_points_earned) > 0 THEN
                UPDATE users
                SET total_points_earned = calculated_total,
                    updated_at = NOW()
                WHERE id = user_record.id;
                
                RETURN QUERY SELECT 
                    user_record.id,
                    user_record.total_points_earned,
                    calculated_total,
                    calculated_total - user_record.total_points_earned,
                    TRUE;
            END IF;
        END LOOP;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION reconcile_user_points_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reconcile_user_points_data(UUID) TO service_role;

-- Add helpful comments
COMMENT ON FUNCTION update_user_points(UUID, INTEGER) IS 'Safely updates user points balance and total_points_earned. For positive points (earned), updates both fields. For negative points (redeemed), only updates balance.';
COMMENT ON FUNCTION perform_annual_points_reset(UUID, VARCHAR) IS 'Performs annual points reset including total_points_earned reset to implement yearly points system.';
COMMENT ON FUNCTION reconcile_user_points_data(UUID) IS 'Reconciles user total_points_earned with actual current year transactions. Can be run for specific user or all users.';
