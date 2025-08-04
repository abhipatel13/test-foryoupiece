-- Fix Double Point Allocation Issue
-- Remove the database trigger that was causing duplicate point allocation
-- The API route now handles point allocation correctly

-- Drop the trigger that was causing double point allocation
DROP TRIGGER IF EXISTS update_user_stats_on_order_completion ON orders;

-- Drop the function as well since it's no longer needed
-- The API route handles point allocation with proper duplicate prevention
DROP FUNCTION IF EXISTS update_user_stats_on_order_completion();

-- Drop the old calculate_points_earned function as well since it's no longer used
DROP FUNCTION IF EXISTS calculate_points_earned(DECIMAL, user_tier);

-- Add comment for documentation
COMMENT ON TABLE orders IS 'Orders table - point allocation now handled by API routes with proper duplicate prevention';

-- Note: The API route /api/admin/orders/complete now handles:
-- 1. Point allocation with duplicate prevention
-- 2. User stats updates
-- 3. Proper transaction logging
-- This eliminates the double allocation issue where both trigger and API were awarding points
