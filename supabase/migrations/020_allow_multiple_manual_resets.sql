-- Migration: Allow Multiple Manual Points Resets
-- This migration creates a new function for manual resets that doesn't have yearly restrictions
-- while preserving the annual reset function with its yearly restriction

-- Function to perform manual points reset (allows multiple resets per year)
CREATE OR REPLACE FUNCTION perform_manual_points_reset(
    admin_user_id_param UUID
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

    -- Calculate totals before reset
    SELECT COUNT(*), COALESCE(SUM(points_balance), 0)
    INTO users_count, points_total
    FROM users
    WHERE points_balance > 0;

    -- Create reset history record (no yearly restriction for manual resets)
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
        'manual',
        admin_user_id_param,
        jsonb_build_object(
            'reset_timestamp', NOW(),
            'reset_by', admin_user_id_param::text,
            'reset_description', 'Manual points reset by admin - allows multiple resets per year',
            'multiple_resets_allowed', true
        )
    ) RETURNING id INTO reset_record_id;

    -- Reset all user points to 0
    UPDATE users 
    SET 
        points_balance = 0,
        total_points_earned = 0,
        tier_level = 'bronze',
        updated_at = NOW()
    WHERE points_balance > 0 OR total_points_earned > 0 OR tier_level != 'bronze';

    -- Clear all point transactions (complete reset)
    DELETE FROM point_transactions;

    -- Clear all tier reward history
    DELETE FROM tier_reward_history;

    -- Reset all user ranks to bronze
    UPDATE user_ranks 
    SET is_current = FALSE, reset_at = NOW()
    WHERE is_current = TRUE;

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

-- Add comment for the new function
COMMENT ON FUNCTION perform_manual_points_reset(UUID) IS 'Performs manual points reset without yearly restrictions - allows multiple resets per year';
