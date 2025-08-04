-- Cleanup Duplicate Point Transactions
-- Remove duplicate transactions caused by both API route and database trigger running simultaneously
-- Keep the API-generated transactions (with "#" in description) and remove trigger-generated ones

-- First, let's identify and delete the trigger-generated duplicate transactions
-- These are characterized by:
-- 1. transaction_type = 'earned'
-- 2. reference_type = 'order' 
-- 3. Description format: "Points earned from order FYP-..." (without #)
-- 4. Smaller point amounts (trigger used wrong calculation)

DELETE FROM point_transactions 
WHERE id IN (
    -- Find the smaller transaction for each order that has duplicates
    SELECT DISTINCT ON (reference_id) id
    FROM point_transactions pt1
    WHERE transaction_type = 'earned' 
        AND reference_type = 'order'
        AND points > 0
        AND description LIKE 'Points earned from order FYP-%'
        AND description NOT LIKE 'Points earned from order #FYP-%'
        AND EXISTS (
            -- Only delete if there's a corresponding API-generated transaction
            SELECT 1 FROM point_transactions pt2 
            WHERE pt2.reference_id = pt1.reference_id
                AND pt2.transaction_type = 'earned'
                AND pt2.reference_type = 'order'
                AND pt2.description LIKE 'Points earned from order #FYP-%'
                AND pt2.id != pt1.id
        )
    ORDER BY reference_id, points ASC -- Keep the larger transaction (API-generated)
);

-- Now recalculate user totals based on the cleaned transactions
-- Update users.total_points_earned to match the sum of their earned transactions
UPDATE users 
SET total_points_earned = (
    SELECT COALESCE(SUM(points), 0)
    FROM point_transactions 
    WHERE user_id = users.id 
        AND transaction_type = 'earned'
        AND points > 0
);

-- Update users.points_balance to match the net sum of all transactions
UPDATE users 
SET points_balance = (
    SELECT COALESCE(SUM(points), 0)
    FROM point_transactions 
    WHERE user_id = users.id
);

-- Add a comment for documentation
COMMENT ON TABLE point_transactions IS 'Point transactions table - cleaned up duplicate transactions from double allocation issue (API + trigger)';

-- Log the cleanup results
DO $$
DECLARE
    deleted_count INTEGER;
    user_count INTEGER;
BEGIN
    -- Get count of users that were updated
    SELECT COUNT(*) INTO user_count FROM users WHERE total_points_earned > 0;
    
    RAISE NOTICE 'Cleanup completed successfully:';
    RAISE NOTICE '- Removed duplicate trigger-generated transactions';
    RAISE NOTICE '- Updated totals for % users', user_count;
    RAISE NOTICE '- Point allocation now handled exclusively by API routes';
END $$;
