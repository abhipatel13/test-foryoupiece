-- Fix Tier Calculation System
-- This migration fixes the inconsistency between tier calculation methods
-- and ensures all UI components show the correct user tier based on total_points_earned

-- Create the missing update_user_rank function
CREATE OR REPLACE FUNCTION update_user_rank(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_total_earned INTEGER;
    new_tier user_tier;
    current_tier user_tier;
BEGIN
    -- Get user's total points earned and current tier
    SELECT total_points_earned, tier_level 
    INTO user_total_earned, current_tier
    FROM users 
    WHERE id = p_user_id;
    
    -- Check if user exists
    IF user_total_earned IS NULL THEN
        RAISE EXCEPTION 'User not found: %', p_user_id;
    END IF;
    
    -- Calculate new tier based on total_points_earned (not points_balance)
    IF user_total_earned >= 50000 THEN
        new_tier := 'diamond';
    ELSIF user_total_earned >= 35000 THEN
        new_tier := 'platinum';
    ELSIF user_total_earned >= 15000 THEN
        new_tier := 'gold';
    ELSIF user_total_earned >= 5000 THEN
        new_tier := 'silver';
    ELSE
        new_tier := 'bronze';
    END IF;
    
    -- Update tier if it has changed
    IF current_tier != new_tier THEN
        UPDATE users 
        SET tier_level = new_tier, updated_at = NOW()
        WHERE id = p_user_id;
        
        -- Mark current rank as not current
        UPDATE user_ranks 
        SET is_current = FALSE 
        WHERE user_id = p_user_id AND is_current = TRUE;
        
        -- Create new rank record
        INSERT INTO user_ranks (user_id, rank, points_at_rank, achieved_at, is_current)
        VALUES (p_user_id, new_tier, user_total_earned, NOW(), TRUE);
        
        RAISE NOTICE 'Updated user % tier from % to % (total points: %)', p_user_id, current_tier, new_tier, user_total_earned;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_user_rank(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_rank(UUID) TO service_role;

-- Update the admin_adjust_user_points function to use total_points_earned for tier calculation
CREATE OR REPLACE FUNCTION admin_adjust_user_points(
    target_user_id UUID,
    admin_user_id UUID,
    points_adjustment INTEGER,
    reason_text TEXT
)
RETURNS TABLE (
    success BOOLEAN,
    points_before INTEGER,
    points_after INTEGER,
    new_tier user_tier,
    transaction_id UUID,
    adjustment_id UUID
) AS $$
DECLARE
    current_points INTEGER;
    current_total_earned INTEGER;
    new_points INTEGER;
    new_total_earned INTEGER;
    new_user_tier user_tier;
    trans_id UUID;
    adj_id UUID;
    trans_type transaction_type;
BEGIN
    -- Get current points and total earned
    SELECT points_balance, total_points_earned 
    INTO current_points, current_total_earned
    FROM users 
    WHERE id = target_user_id;
    
    IF current_points IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, 0, 'bronze'::user_tier, NULL::UUID, NULL::UUID;
        RETURN;
    END IF;
    
    -- Calculate new values
    new_points := current_points + points_adjustment;
    
    -- Prevent negative balance
    IF new_points < 0 THEN
        new_points := 0;
        points_adjustment := -current_points;
    END IF;
    
    -- Update total_points_earned only for positive adjustments (earned points)
    IF points_adjustment > 0 THEN
        new_total_earned := current_total_earned + points_adjustment;
        trans_type := 'earned';
    ELSE
        new_total_earned := current_total_earned; -- Don't reduce total earned for redemptions
        trans_type := 'redeemed';
    END IF;
    
    -- Create transaction record
    INSERT INTO point_transactions (
        user_id, points, transaction_type, reference_type, description
    ) VALUES (
        target_user_id, points_adjustment, trans_type, 'admin_adjustment', reason_text
    ) RETURNING id INTO trans_id;
    
    -- Update user points and total earned
    UPDATE users 
    SET 
        points_balance = new_points,
        total_points_earned = new_total_earned,
        updated_at = NOW()
    WHERE id = target_user_id;
    
    -- Calculate new tier based on total_points_earned
    IF new_total_earned >= 50000 THEN
        new_user_tier := 'diamond';
    ELSIF new_total_earned >= 35000 THEN
        new_user_tier := 'platinum';
    ELSIF new_total_earned >= 15000 THEN
        new_user_tier := 'gold';
    ELSIF new_total_earned >= 5000 THEN
        new_user_tier := 'silver';
    ELSE
        new_user_tier := 'bronze';
    END IF;
    
    -- Update tier
    UPDATE users 
    SET tier_level = new_user_tier
    WHERE id = target_user_id;
    
    -- Create admin adjustment record
    INSERT INTO admin_point_adjustments (
        user_id,
        admin_user_id,
        points_before,
        points_after,
        points_changed,
        reason,
        transaction_id
    ) VALUES (
        target_user_id,
        admin_user_id,
        current_points,
        new_points,
        points_adjustment,
        reason_text,
        trans_id
    ) RETURNING id INTO adj_id;
    
    -- Update user rank if tier changed
    PERFORM update_user_rank(target_user_id);
    
    RETURN QUERY SELECT TRUE, current_points, new_points, new_user_tier, trans_id, adj_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix existing users' tiers based on their total_points_earned
DO $$
DECLARE
    user_record RECORD;
    correct_tier user_tier;
BEGIN
    FOR user_record IN 
        SELECT id, total_points_earned, tier_level 
        FROM users 
        WHERE total_points_earned > 0
    LOOP
        -- Calculate correct tier
        IF user_record.total_points_earned >= 50000 THEN
            correct_tier := 'diamond';
        ELSIF user_record.total_points_earned >= 35000 THEN
            correct_tier := 'platinum';
        ELSIF user_record.total_points_earned >= 15000 THEN
            correct_tier := 'gold';
        ELSIF user_record.total_points_earned >= 5000 THEN
            correct_tier := 'silver';
        ELSE
            correct_tier := 'bronze';
        END IF;
        
        -- Update if different
        IF user_record.tier_level != correct_tier THEN
            UPDATE users 
            SET tier_level = correct_tier, updated_at = NOW()
            WHERE id = user_record.id;
            
            RAISE NOTICE 'Fixed tier for user %: % -> % (total points: %)', 
                user_record.id, user_record.tier_level, correct_tier, user_record.total_points_earned;
        END IF;
    END LOOP;
END $$;
