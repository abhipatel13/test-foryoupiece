-- Fix admin reset to properly preserve usable points balance
-- Issue: Admin reset was setting points_balance = 0 instead of preserving usable points
-- Solution: Remove tier bonus transactions and recalculate balance from remaining transactions

-- Function to recalculate user points balance from transactions
CREATE OR REPLACE FUNCTION recalculate_user_points_balance(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    calculated_balance INTEGER;
BEGIN
    -- Calculate balance from all point transactions
    SELECT COALESCE(SUM(points), 0)
    INTO calculated_balance
    FROM point_transactions
    WHERE user_id = p_user_id;
    
    -- Update user's points_balance to match calculated balance
    UPDATE users 
    SET points_balance = calculated_balance,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    RETURN calculated_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fixed admin reset function that properly preserves usable points
CREATE OR REPLACE FUNCTION perform_admin_rank_lifetime_reset(admin_user_id_param UUID)
RETURNS TABLE(users_affected INTEGER, total_lifetime_points_reset BIGINT, reset_id UUID) AS $$
DECLARE
    reset_record_id UUID;
    users_count INTEGER := 0;
    lifetime_points_total BIGINT := 0;
    current_year INTEGER;
    user_record RECORD;
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
    
    -- Remove tier reward bonus transactions (since ranks are being reset)
    DELETE FROM point_transactions 
    WHERE transaction_type = 'bonus' 
    AND reference_type = 'tier_reward';
    
    -- Remove tier reward history (since ranks are being reset)
    DELETE FROM tier_reward_history;
    
    -- Reset all user ranks to bronze and lifetime points to 0
    -- Recalculate points_balance from remaining transactions
    FOR user_record IN 
        SELECT id FROM users 
        WHERE total_points_earned > 0 OR tier_level != 'bronze'
    LOOP
        -- Reset tier and lifetime points
        UPDATE users 
        SET 
            tier_level = 'bronze',
            total_points_earned = 0,
            updated_at = NOW()
        WHERE id = user_record.id;
        
        -- Recalculate points balance from remaining transactions
        PERFORM recalculate_user_points_balance(user_record.id);
    END LOOP;
    
    -- Create new bronze rank records for all users
    INSERT INTO user_ranks (user_id, rank, points_at_rank, achieved_at, is_current)
    SELECT 
        id,
        'bronze'::user_tier,
        0,
        NOW(),
        TRUE
    FROM users
    ON CONFLICT (user_id, rank) WHERE is_current = TRUE
    DO UPDATE SET 
        points_at_rank = 0,
        achieved_at = NOW(),
        is_current = TRUE;
    
    -- Return results
    RETURN QUERY SELECT users_count, lifetime_points_total, reset_record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
