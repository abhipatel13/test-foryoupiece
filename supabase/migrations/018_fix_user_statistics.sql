-- Fix User Statistics and Data Correlation Issues
-- This migration ensures all user statistics are accurately calculated and synchronized

-- Function to recalculate and fix all user statistics
CREATE OR REPLACE FUNCTION fix_user_statistics()
RETURNS TABLE (
    user_id UUID,
    old_total_orders INTEGER,
    new_total_orders INTEGER,
    old_total_spent DECIMAL,
    new_total_spent DECIMAL,
    old_total_points_earned INTEGER,
    new_total_points_earned INTEGER,
    old_tier user_tier,
    new_tier user_tier,
    statistics_fixed BOOLEAN
) AS $$
DECLARE
    user_record RECORD;
    calculated_orders INTEGER;
    calculated_spent DECIMAL;
    calculated_points INTEGER;
    calculated_tier user_tier;
BEGIN
    -- Loop through all users to recalculate their statistics
    FOR user_record IN 
        SELECT u.id, u.total_orders, u.total_spent, u.total_points_earned, u.tier_level
        FROM users u
    LOOP
        -- Calculate actual total orders from orders table
        SELECT COUNT(*), COALESCE(SUM(total_amount), 0)
        INTO calculated_orders, calculated_spent
        FROM orders 
        WHERE user_id = user_record.id 
        AND payment_status = 'verified';
        
        -- Calculate actual total points earned from point_transactions
        SELECT COALESCE(SUM(points), 0)
        INTO calculated_points
        FROM point_transactions 
        WHERE user_id = user_record.id 
        AND transaction_type = 'earned';
        
        -- Calculate correct tier based on total_points_earned
        IF calculated_points >= 50000 THEN
            calculated_tier := 'diamond';
        ELSIF calculated_points >= 35000 THEN
            calculated_tier := 'platinum';
        ELSIF calculated_points >= 15000 THEN
            calculated_tier := 'gold';
        ELSIF calculated_points >= 5000 THEN
            calculated_tier := 'silver';
        ELSE
            calculated_tier := 'bronze';
        END IF;
        
        -- Update user statistics if they differ from calculated values
        IF user_record.total_orders != calculated_orders OR 
           user_record.total_spent != calculated_spent OR 
           user_record.total_points_earned != calculated_points OR 
           user_record.tier_level != calculated_tier THEN
            
            -- Update the user record
            UPDATE users 
            SET 
                total_orders = calculated_orders,
                total_spent = calculated_spent,
                total_points_earned = calculated_points,
                tier_level = calculated_tier,
                updated_at = NOW()
            WHERE id = user_record.id;
            
            -- Update user rank if tier changed
            IF user_record.tier_level != calculated_tier THEN
                -- Mark current rank as not current
                UPDATE user_ranks 
                SET is_current = FALSE 
                WHERE user_id = user_record.id AND is_current = TRUE;
                
                -- Create new rank record
                INSERT INTO user_ranks (user_id, rank, points_at_rank, achieved_at, is_current)
                VALUES (user_record.id, calculated_tier, calculated_points, NOW(), TRUE)
                ON CONFLICT DO NOTHING;
            END IF;
            
            -- Return the changes made
            RETURN QUERY SELECT 
                user_record.id,
                user_record.total_orders,
                calculated_orders,
                user_record.total_spent,
                calculated_spent,
                user_record.total_points_earned,
                calculated_points,
                user_record.tier_level,
                calculated_tier,
                TRUE;
        END IF;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate user statistics consistency
CREATE OR REPLACE FUNCTION validate_user_statistics()
RETURNS TABLE (
    user_id UUID,
    user_email TEXT,
    total_orders_mismatch BOOLEAN,
    total_spent_mismatch BOOLEAN,
    total_points_earned_mismatch BOOLEAN,
    tier_mismatch BOOLEAN,
    calculated_orders INTEGER,
    stored_orders INTEGER,
    calculated_spent DECIMAL,
    stored_spent DECIMAL,
    calculated_points INTEGER,
    stored_points INTEGER,
    calculated_tier user_tier,
    stored_tier user_tier
) AS $$
BEGIN
    RETURN QUERY
    WITH user_calculations AS (
        SELECT 
            u.id,
            u.email,
            u.total_orders as stored_orders,
            u.total_spent as stored_spent,
            u.total_points_earned as stored_points,
            u.tier_level as stored_tier,
            COALESCE((
                SELECT COUNT(*) 
                FROM orders o 
                WHERE o.user_id = u.id AND o.payment_status = 'verified'
            ), 0) as calculated_orders,
            COALESCE((
                SELECT SUM(o.total_amount) 
                FROM orders o 
                WHERE o.user_id = u.id AND o.payment_status = 'verified'
            ), 0) as calculated_spent,
            COALESCE((
                SELECT SUM(pt.points) 
                FROM point_transactions pt 
                WHERE pt.user_id = u.id AND pt.transaction_type = 'earned'
            ), 0) as calculated_points,
            CASE 
                WHEN COALESCE((
                    SELECT SUM(pt.points) 
                    FROM point_transactions pt 
                    WHERE pt.user_id = u.id AND pt.transaction_type = 'earned'
                ), 0) >= 50000 THEN 'diamond'::user_tier
                WHEN COALESCE((
                    SELECT SUM(pt.points) 
                    FROM point_transactions pt 
                    WHERE pt.user_id = u.id AND pt.transaction_type = 'earned'
                ), 0) >= 35000 THEN 'platinum'::user_tier
                WHEN COALESCE((
                    SELECT SUM(pt.points) 
                    FROM point_transactions pt 
                    WHERE pt.user_id = u.id AND pt.transaction_type = 'earned'
                ), 0) >= 15000 THEN 'gold'::user_tier
                WHEN COALESCE((
                    SELECT SUM(pt.points) 
                    FROM point_transactions pt 
                    WHERE pt.user_id = u.id AND pt.transaction_type = 'earned'
                ), 0) >= 5000 THEN 'silver'::user_tier
                ELSE 'bronze'::user_tier
            END as calculated_tier
        FROM users u
    )
    SELECT 
        uc.id,
        uc.email,
        uc.stored_orders != uc.calculated_orders as total_orders_mismatch,
        uc.stored_spent != uc.calculated_spent as total_spent_mismatch,
        uc.stored_points != uc.calculated_points as total_points_earned_mismatch,
        uc.stored_tier != uc.calculated_tier as tier_mismatch,
        uc.calculated_orders,
        uc.stored_orders,
        uc.calculated_spent,
        uc.stored_spent,
        uc.calculated_points,
        uc.stored_points,
        uc.calculated_tier,
        uc.stored_tier
    FROM user_calculations uc
    WHERE 
        uc.stored_orders != uc.calculated_orders OR
        uc.stored_spent != uc.calculated_spent OR
        uc.stored_points != uc.calculated_points OR
        uc.stored_tier != uc.calculated_tier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create admin API endpoint function to get comprehensive user statistics
CREATE OR REPLACE FUNCTION get_user_comprehensive_stats(p_user_id UUID)
RETURNS TABLE (
    user_id UUID,
    user_email TEXT,
    user_name TEXT,
    total_orders INTEGER,
    total_spent DECIMAL,
    total_points_earned INTEGER,
    points_balance INTEGER,
    tier_level user_tier,
    account_created TIMESTAMPTZ,
    last_order_date TIMESTAMPTZ,
    last_point_transaction TIMESTAMPTZ,
    order_history_count INTEGER,
    point_transaction_count INTEGER,
    rank_changes_count INTEGER,
    coupon_usage_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.email,
        CONCAT(u.first_name, ' ', u.last_name) as user_name,
        u.total_orders,
        u.total_spent,
        u.total_points_earned,
        u.points_balance,
        u.tier_level,
        u.created_at,
        (SELECT MAX(o.created_at) FROM orders o WHERE o.user_id = u.id),
        (SELECT MAX(pt.created_at) FROM point_transactions pt WHERE pt.user_id = u.id),
        (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id)::INTEGER,
        (SELECT COUNT(*) FROM point_transactions pt WHERE pt.user_id = u.id)::INTEGER,
        (SELECT COUNT(*) FROM user_ranks ur WHERE ur.user_id = u.id)::INTEGER,
        (SELECT COUNT(*) FROM coupon_usage cu WHERE cu.user_id = u.id)::INTEGER
    FROM users u
    WHERE u.id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION fix_user_statistics() TO authenticated;
GRANT EXECUTE ON FUNCTION validate_user_statistics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_comprehensive_stats(UUID) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION fix_user_statistics() IS 'Recalculates and fixes all user statistics based on actual transaction data';
COMMENT ON FUNCTION validate_user_statistics() IS 'Validates user statistics consistency and identifies mismatches';
COMMENT ON FUNCTION get_user_comprehensive_stats(UUID) IS 'Returns comprehensive user statistics for admin dashboard';
