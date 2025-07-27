-- Enhanced Tier Reset System Migration
-- Creates enhanced tier reset function that can adjust points to tier minimums

-- Create enhanced function to reset user tier with point adjustment
CREATE OR REPLACE FUNCTION reset_user_tier_with_points(
    p_user_id UUID,
    p_new_tier user_tier,
    p_new_total_points INTEGER,
    p_new_points_balance INTEGER,
    p_admin_user_id UUID,
    p_reason TEXT,
    p_is_forced BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    old_tier user_tier,
    new_tier user_tier,
    old_total_points INTEGER,
    new_total_points INTEGER,
    old_points_balance INTEGER,
    new_points_balance INTEGER
) AS $$
DECLARE
    v_old_tier user_tier;
    v_old_points_balance INTEGER;
    v_old_total_points_earned INTEGER;
BEGIN
    -- Get current user data
    SELECT tier_level, points_balance, total_points_earned
    INTO v_old_tier, v_old_points_balance, v_old_total_points_earned
    FROM users
    WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'User not found', NULL::user_tier, NULL::user_tier, 0, 0, 0, 0;
        RETURN;
    END IF;
    
    -- Update user tier and points
    UPDATE users
    SET 
        tier_level = p_new_tier,
        total_points_earned = p_new_total_points,
        points_balance = p_new_points_balance,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    -- Update current rank record
    UPDATE user_ranks
    SET is_current = FALSE
    WHERE user_id = p_user_id AND is_current = TRUE;
    
    -- Create new rank record
    INSERT INTO user_ranks (
        user_id,
        rank,
        points_at_rank,
        achieved_at,
        is_current
    ) VALUES (
        p_user_id,
        p_new_tier,
        p_new_total_points,
        NOW(),
        TRUE
    );
    
    -- Log the tier reset with enhanced details
    INSERT INTO tier_reset_logs (
        user_id,
        admin_user_id,
        old_tier,
        new_tier,
        reason,
        points_balance_at_reset,
        total_points_earned_at_reset,
        reset_at,
        metadata
    ) VALUES (
        p_user_id,
        p_admin_user_id,
        v_old_tier,
        p_new_tier,
        p_reason,
        v_old_points_balance,
        v_old_total_points_earned,
        NOW(),
        jsonb_build_object(
            'is_forced_reset', p_is_forced,
            'new_total_points', p_new_total_points,
            'new_points_balance', p_new_points_balance,
            'points_adjusted', p_new_total_points != v_old_total_points_earned
        )
    );
    
    -- Create point transaction record if points were adjusted
    IF p_new_total_points != v_old_total_points_earned OR p_new_points_balance != v_old_points_balance THEN
        INSERT INTO point_transactions (
            user_id,
            points,
            transaction_type,
            reference_type,
            description,
            created_at
        ) VALUES (
            p_user_id,
            p_new_points_balance - v_old_points_balance,
            CASE 
                WHEN p_new_points_balance > v_old_points_balance THEN 'earned'::transaction_type
                ELSE 'admin_adjustment'::transaction_type
            END,
            'admin_adjustment',
            CASE 
                WHEN p_is_forced THEN 'Forced tier reset: ' || p_reason
                ELSE 'Tier reset: ' || p_reason
            END,
            NOW()
        );
    END IF;
    
    RETURN QUERY SELECT 
        TRUE, 
        'Tier reset successfully with point adjustment', 
        v_old_tier, 
        p_new_tier,
        v_old_total_points_earned,
        p_new_total_points,
        v_old_points_balance,
        p_new_points_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION reset_user_tier_with_points(UUID, user_tier, INTEGER, INTEGER, UUID, TEXT, BOOLEAN) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION reset_user_tier_with_points IS 'Enhanced tier reset function that can adjust user points to tier minimum thresholds for forced resets';
