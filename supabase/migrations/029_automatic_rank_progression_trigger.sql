-- Migration: Automatic Rank Progression Trigger
-- Creates a trigger that automatically updates user ranks whenever total_points_earned changes
-- This ensures rank progression happens immediately when users cross tier thresholds

-- Function to automatically update user rank when total_points_earned changes
CREATE OR REPLACE FUNCTION auto_update_user_rank()
RETURNS TRIGGER AS $$
DECLARE
    new_tier user_tier;
    old_tier user_tier;
BEGIN
    -- Only process if total_points_earned actually changed
    IF OLD.total_points_earned IS DISTINCT FROM NEW.total_points_earned THEN
        -- Calculate new tier based on total_points_earned
        IF NEW.total_points_earned >= 50000 THEN
            new_tier := 'diamond';
        ELSIF NEW.total_points_earned >= 35000 THEN
            new_tier := 'platinum';
        ELSIF NEW.total_points_earned >= 15000 THEN
            new_tier := 'gold';
        ELSIF NEW.total_points_earned >= 5000 THEN
            new_tier := 'silver';
        ELSE
            new_tier := 'bronze';
        END IF;
        
        -- Get the old tier
        old_tier := OLD.tier_level;
        
        -- Update tier if it has changed
        IF old_tier != new_tier THEN
            -- Update the tier_level in the same transaction
            NEW.tier_level := new_tier;
            
            -- Mark current rank as not current
            UPDATE user_ranks 
            SET is_current = FALSE 
            WHERE user_id = NEW.id AND is_current = TRUE;
            
            -- Create new rank record
            INSERT INTO user_ranks (user_id, rank, points_at_rank, achieved_at, is_current)
            VALUES (NEW.id, new_tier, NEW.total_points_earned, NOW(), TRUE);
            
            -- Log the tier change for debugging
            RAISE NOTICE 'User % tier updated from % to % (points: %)', 
                NEW.id, old_tier, new_tier, NEW.total_points_earned;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic rank updates
DROP TRIGGER IF EXISTS auto_update_user_rank_trigger ON users;
CREATE TRIGGER auto_update_user_rank_trigger
    BEFORE UPDATE ON users
    FOR EACH ROW 
    WHEN (OLD.total_points_earned IS DISTINCT FROM NEW.total_points_earned)
    EXECUTE FUNCTION auto_update_user_rank();

-- Also create a function to manually recalculate all user ranks
-- This can be called if there are any inconsistencies
CREATE OR REPLACE FUNCTION recalculate_all_user_ranks()
RETURNS TABLE (
    user_id UUID,
    old_tier user_tier,
    new_tier user_tier,
    total_points INTEGER,
    updated BOOLEAN
) AS $$
DECLARE
    user_record RECORD;
    calculated_tier user_tier;
    rank_updated BOOLEAN;
BEGIN
    FOR user_record IN 
        SELECT id, tier_level, total_points_earned 
        FROM users 
        ORDER BY total_points_earned DESC
    LOOP
        -- Calculate correct tier
        IF user_record.total_points_earned >= 50000 THEN
            calculated_tier := 'diamond';
        ELSIF user_record.total_points_earned >= 35000 THEN
            calculated_tier := 'platinum';
        ELSIF user_record.total_points_earned >= 15000 THEN
            calculated_tier := 'gold';
        ELSIF user_record.total_points_earned >= 5000 THEN
            calculated_tier := 'silver';
        ELSE
            calculated_tier := 'bronze';
        END IF;
        
        rank_updated := FALSE;
        
        -- Update if tier doesn't match
        IF user_record.tier_level != calculated_tier THEN
            -- Update user tier
            UPDATE users 
            SET tier_level = calculated_tier, updated_at = NOW()
            WHERE id = user_record.id;
            
            -- Mark current rank as not current
            UPDATE user_ranks 
            SET is_current = FALSE 
            WHERE user_id = user_record.id AND is_current = TRUE;
            
            -- Create new rank record
            INSERT INTO user_ranks (user_id, rank, points_at_rank, achieved_at, is_current)
            VALUES (user_record.id, calculated_tier, user_record.total_points_earned, NOW(), TRUE)
            ON CONFLICT DO NOTHING;
            
            rank_updated := TRUE;
        END IF;
        
        -- Return the result
        RETURN QUERY SELECT 
            user_record.id,
            user_record.tier_level,
            calculated_tier,
            user_record.total_points_earned,
            rank_updated;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helpful comments
COMMENT ON FUNCTION auto_update_user_rank() IS 'Automatically updates user tier and rank records when total_points_earned changes';
COMMENT ON FUNCTION recalculate_all_user_ranks() IS 'Manually recalculates and fixes all user ranks based on their total_points_earned';
COMMENT ON TRIGGER auto_update_user_rank_trigger ON users IS 'Automatically triggers rank updates when total_points_earned changes';
