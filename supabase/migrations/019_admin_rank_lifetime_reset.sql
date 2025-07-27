-- Admin Rank and Lifetime Points Reset System
-- This migration adds functionality for admins to reset user ranks and lifetime points
-- while preserving usable points balances

-- Function to perform admin rank and lifetime points reset (preserves usable points balance)
CREATE OR REPLACE FUNCTION perform_admin_rank_lifetime_reset(
    admin_user_id_param UUID
)
RETURNS TABLE (
    users_affected INTEGER,
    total_lifetime_points_reset BIGINT,
    reset_id UUID
) AS $$
DECLARE
    reset_record_id UUID;
    users_count INTEGER := 0;
    lifetime_points_total BIGINT := 0;
    current_year INTEGER;
BEGIN
    current_year := EXTRACT(YEAR FROM NOW());
    
    -- Calculate totals before reset
    SELECT COUNT(*), COALESCE(SUM(total_points_earned), 0)
    INTO users_count, lifetime_points_total
    FROM users 
    WHERE total_points_earned > 0;
    
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
        lifetime_points_total,
        'admin_rank_reset',
        admin_user_id_param,
        jsonb_build_object(
            'reset_timestamp', NOW(),
            'reset_by', admin_user_id_param::text,
            'reset_description', 'Admin rank and lifetime points reset - preserves usable points balance',
            'lifetime_points_reset', lifetime_points_total,
            'points_balance_preserved', true
        )
    ) RETURNING id INTO reset_record_id;
    
    -- Mark all current user ranks as not current and set reset date
    UPDATE user_ranks 
    SET is_current = FALSE, reset_at = NOW()
    WHERE is_current = TRUE;
    
    -- Reset all user ranks to bronze and lifetime points to 0 (preserve points_balance)
    UPDATE users 
    SET 
        tier_level = 'bronze',
        total_points_earned = 0,
        updated_at = NOW()
    WHERE total_points_earned > 0 OR tier_level != 'bronze';
    
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
    RETURN QUERY SELECT users_count, lifetime_points_total, reset_record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION perform_admin_rank_lifetime_reset(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION perform_admin_rank_lifetime_reset(UUID) TO service_role;

-- Add helpful comment
COMMENT ON FUNCTION perform_admin_rank_lifetime_reset(UUID) IS 'Resets all user ranks to bronze and lifetime points to 0, preserving usable points balance';

-- Log the migration
INSERT INTO boxhero_sync_logs (
    sync_type, 
    status, 
    message, 
    details
) VALUES (
    'schema_migration',
    'completed',
    'Added admin rank and lifetime points reset functionality',
    '{\"function_added\": \"perform_admin_rank_lifetime_reset\", \"preserves_usable_points\": true, \"resets_ranks\": true, \"resets_lifetime_tracking\": true}'::jsonb
);
