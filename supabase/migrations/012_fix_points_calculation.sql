-- Fix points calculation system to use correct 10 points per $1 formula
-- Issue: Database trigger was using 1% (0.01) instead of 10 points per dollar
-- Requirement: 1% cashback rate = 10 points per $1, where 1000 points = $1 USD

-- Update the points calculation function to use correct formula
CREATE OR REPLACE FUNCTION calculate_points_earned(
    order_total DECIMAL,
    user_tier user_tier DEFAULT 'bronze'
)
RETURNS INTEGER AS $$
DECLARE
    base_points_per_dollar INTEGER := 10; -- 10 points per $1 (1% cashback rate)
    tier_multiplier DECIMAL;
BEGIN
    -- Set tier multiplier (currently not used, but kept for future enhancement)
    CASE user_tier
        WHEN 'bronze' THEN tier_multiplier := 1.0;
        WHEN 'silver' THEN tier_multiplier := 1.2;
        WHEN 'gold' THEN tier_multiplier := 1.5;
        WHEN 'platinum' THEN tier_multiplier := 2.0;
        ELSE tier_multiplier := 1.0;
    END CASE;
    
    -- Calculate points: $1 = 10 points (1% cashback, 1000 points = $1 USD)
    -- For now, using base rate without tier multiplier to match current system
    RETURN FLOOR(order_total * base_points_per_dollar);
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON FUNCTION calculate_points_earned(DECIMAL, user_tier) IS 'Calculates points earned from order total using 10 points per $1 formula (1% cashback, 1000 points = $1 USD)';

-- Test the function with sample values
DO $$
DECLARE
    test_result INTEGER;
BEGIN
    -- Test: $27.50 should give 275 points
    SELECT calculate_points_earned(27.50) INTO test_result;
    RAISE NOTICE 'Test: $27.50 -> % points (expected: 275)', test_result;
    
    -- Test: $50.00 should give 500 points  
    SELECT calculate_points_earned(50.00) INTO test_result;
    RAISE NOTICE 'Test: $50.00 -> % points (expected: 500)', test_result;
    
    -- Test: $1.00 should give 10 points
    SELECT calculate_points_earned(1.00) INTO test_result;
    RAISE NOTICE 'Test: $1.00 -> % points (expected: 10)', test_result;
END $$;
