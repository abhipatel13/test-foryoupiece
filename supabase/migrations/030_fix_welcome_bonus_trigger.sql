-- Migration: Fix Welcome Bonus Trigger for total_points_earned
-- Updates the welcome bonus trigger to properly set total_points_earned
-- when new users sign up, ensuring they get the correct tier from the start

-- Drop existing welcome bonus trigger
DROP TRIGGER IF EXISTS award_welcome_bonus_trigger ON users;

-- Create improved welcome bonus function
CREATE OR REPLACE FUNCTION award_welcome_bonus()
RETURNS TRIGGER AS $$
DECLARE
    welcome_bonus_points INTEGER := 1000; -- 1000 points welcome bonus
    calculated_tier user_tier;
BEGIN
    -- Only award welcome bonus if this is a new user (points_balance is 0 or NULL)
    -- and they don't already have points
    IF (NEW.points_balance IS NULL OR NEW.points_balance = 0) AND 
       (NEW.total_points_earned IS NULL OR NEW.total_points_earned = 0) THEN
        
        -- Update the user's points balance AND total_points_earned with welcome bonus
        NEW.points_balance := welcome_bonus_points;
        NEW.total_points_earned := welcome_bonus_points;
        
        -- Calculate tier based on welcome bonus points
        IF welcome_bonus_points >= 50000 THEN
            calculated_tier := 'diamond';
        ELSIF welcome_bonus_points >= 35000 THEN
            calculated_tier := 'platinum';
        ELSIF welcome_bonus_points >= 15000 THEN
            calculated_tier := 'gold';
        ELSIF welcome_bonus_points >= 5000 THEN
            calculated_tier := 'silver';
        ELSE
            calculated_tier := 'bronze';
        END IF;
        
        -- Set the tier (1000 points = bronze tier)
        NEW.tier_level := calculated_tier;
        
        -- Insert a point transaction record for the welcome bonus
        INSERT INTO point_transactions (
            user_id,
            points,
            transaction_type,
            reference_type,
            description,
            created_at
        ) VALUES (
            NEW.id,
            welcome_bonus_points,
            'bonus',
            'signup',
            'Welcome bonus for new user registration',
            NOW()
        );
        
        -- Create initial rank record
        INSERT INTO user_ranks (user_id, rank, points_at_rank, achieved_at, is_current)
        VALUES (NEW.id, calculated_tier, welcome_bonus_points, NOW(), TRUE);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER award_welcome_bonus_trigger
    BEFORE INSERT ON users
    FOR EACH ROW EXECUTE FUNCTION award_welcome_bonus();

-- Also create a function to fix existing users who might have missed the total_points_earned update
CREATE OR REPLACE FUNCTION fix_existing_welcome_bonus_users()
RETURNS TABLE (
    user_id UUID,
    points_balance INTEGER,
    old_total_earned INTEGER,
    new_total_earned INTEGER,
    tier_updated BOOLEAN
) AS $$
DECLARE
    user_record RECORD;
    welcome_bonus_transaction RECORD;
    calculated_tier user_tier;
    tier_changed BOOLEAN;
BEGIN
    -- Find users who have welcome bonus transactions but total_points_earned = 0
    FOR user_record IN 
        SELECT u.id, u.points_balance, u.total_points_earned, u.tier_level
        FROM users u
        WHERE EXISTS (
            SELECT 1 FROM point_transactions pt 
            WHERE pt.user_id = u.id 
            AND pt.transaction_type = 'bonus' 
            AND pt.reference_type = 'signup'
            AND pt.points = 1000
        )
        AND (u.total_points_earned = 0 OR u.total_points_earned IS NULL)
    LOOP
        -- Get the welcome bonus transaction
        SELECT points INTO welcome_bonus_transaction
        FROM point_transactions 
        WHERE user_id = user_record.id 
        AND transaction_type = 'bonus' 
        AND reference_type = 'signup'
        LIMIT 1;
        
        -- Calculate correct tier
        IF welcome_bonus_transaction.points >= 50000 THEN
            calculated_tier := 'diamond';
        ELSIF welcome_bonus_transaction.points >= 35000 THEN
            calculated_tier := 'platinum';
        ELSIF welcome_bonus_transaction.points >= 15000 THEN
            calculated_tier := 'gold';
        ELSIF welcome_bonus_transaction.points >= 5000 THEN
            calculated_tier := 'silver';
        ELSE
            calculated_tier := 'bronze';
        END IF;
        
        tier_changed := user_record.tier_level != calculated_tier;
        
        -- Update total_points_earned and tier if needed
        UPDATE users 
        SET 
            total_points_earned = welcome_bonus_transaction.points,
            tier_level = calculated_tier,
            updated_at = NOW()
        WHERE id = user_record.id;
        
        -- Create rank record if it doesn't exist
        INSERT INTO user_ranks (user_id, rank, points_at_rank, achieved_at, is_current)
        VALUES (user_record.id, calculated_tier, welcome_bonus_transaction.points, user_record.created_at, TRUE)
        ON CONFLICT DO NOTHING;
        
        -- Return the result
        RETURN QUERY SELECT 
            user_record.id,
            user_record.points_balance,
            user_record.total_points_earned,
            welcome_bonus_transaction.points,
            tier_changed;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helpful comments
COMMENT ON FUNCTION award_welcome_bonus() IS 'Awards 1000 point welcome bonus to new users, updating both points_balance and total_points_earned, and setting correct tier';
COMMENT ON FUNCTION fix_existing_welcome_bonus_users() IS 'Fixes existing users who received welcome bonus but have total_points_earned = 0';
