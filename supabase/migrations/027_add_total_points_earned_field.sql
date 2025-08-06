-- Migration: Add missing total_points_earned field to users table
-- This field is critical for the ranking system but was missing from the database schema
-- It tracks the total lifetime points earned by users for tier calculation

-- Add the total_points_earned field to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_points_earned INTEGER DEFAULT 0 CHECK (total_points_earned >= 0);

-- Add index for performance on tier calculations
CREATE INDEX IF NOT EXISTS idx_users_total_points_earned ON users(total_points_earned);

-- Add comment for documentation
COMMENT ON COLUMN users.total_points_earned IS 'Total lifetime points earned by user (used for tier calculation, resets annually)';

-- Populate existing users' total_points_earned based on their earned point transactions
-- This ensures existing users have correct tier calculations
UPDATE users 
SET total_points_earned = (
    SELECT COALESCE(SUM(points), 0)
    FROM point_transactions 
    WHERE user_id = users.id 
        AND transaction_type = 'earned'
        AND points > 0
        AND created_at >= DATE_TRUNC('year', NOW()) -- Only count current year points
)
WHERE total_points_earned = 0 OR total_points_earned IS NULL;

-- Update user tiers based on their total_points_earned
-- This ensures all users have correct tiers after adding the field
DO $$
DECLARE
    user_record RECORD;
    correct_tier user_tier;
BEGIN
    FOR user_record IN 
        SELECT id, total_points_earned, tier_level 
        FROM users 
        WHERE total_points_earned > 0 OR tier_level != 'bronze'
    LOOP
        -- Calculate correct tier based on total_points_earned
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
        
        -- Update tier if it doesn't match
        IF user_record.tier_level != correct_tier THEN
            UPDATE users 
            SET tier_level = correct_tier, updated_at = NOW()
            WHERE id = user_record.id;
            
            -- Mark current rank as not current
            UPDATE user_ranks 
            SET is_current = FALSE 
            WHERE user_id = user_record.id AND is_current = TRUE;
            
            -- Create new rank record
            INSERT INTO user_ranks (user_id, rank, points_at_rank, achieved_at, is_current)
            VALUES (user_record.id, correct_tier, user_record.total_points_earned, NOW(), TRUE)
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;
END $$;

-- Ensure all users have a current rank record
INSERT INTO user_ranks (user_id, rank, points_at_rank, achieved_at, is_current)
SELECT 
    u.id,
    u.tier_level,
    u.total_points_earned,
    u.created_at,
    TRUE
FROM users u
LEFT JOIN user_ranks ur ON u.id = ur.user_id AND ur.is_current = TRUE
WHERE ur.user_id IS NULL
ON CONFLICT DO NOTHING;
