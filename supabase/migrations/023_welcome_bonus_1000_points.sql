-- Migration: Add Welcome Bonus System (1000 Points)
-- Creates a trigger to automatically award 1000 points to new users upon signup
-- This replaces any existing 100 point welcome bonus with 1000 points

-- Function to award welcome bonus points to new users
CREATE OR REPLACE FUNCTION award_welcome_bonus()
RETURNS TRIGGER AS $$
DECLARE
    welcome_bonus_points INTEGER := 1000; -- 1000 points welcome bonus
BEGIN
    -- Only award welcome bonus if this is a new user (points_balance is 0 or NULL)
    -- and they don't already have points
    IF (NEW.points_balance IS NULL OR NEW.points_balance = 0) THEN
        -- Update the user's points balance with welcome bonus
        NEW.points_balance := welcome_bonus_points;
        
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
        
        -- Log the welcome bonus award
        RAISE NOTICE 'Welcome bonus awarded: % points to user %', welcome_bonus_points, NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to award welcome bonus on user creation
DROP TRIGGER IF EXISTS trigger_award_welcome_bonus ON users;
CREATE TRIGGER trigger_award_welcome_bonus
    BEFORE INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION award_welcome_bonus();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION award_welcome_bonus() TO authenticated;
GRANT EXECUTE ON FUNCTION award_welcome_bonus() TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION award_welcome_bonus() IS 'Automatically awards 1000 points welcome bonus to new users upon registration. Creates a point transaction record and ensures users start with 1000 points instead of 0.';

-- Note: This migration ensures that:
-- 1. New users receive 1000 points instead of 100 points
-- 2. The welcome bonus is properly tracked in point_transactions
-- 3. Users remain in bronze tier (1000 points < 5000 silver threshold)
-- 4. The bonus is only awarded once per user during initial registration
