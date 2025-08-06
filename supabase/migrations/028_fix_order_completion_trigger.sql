-- Migration: Fix Order Completion Trigger for Proper Rank Progression
-- Updates the order completion trigger to properly handle total_points_earned
-- and automatically update user ranks when points are earned

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS update_user_stats_on_order_completion ON orders;

-- Create improved function to update user stats when order is completed
CREATE OR REPLACE FUNCTION update_user_stats_on_order_completion()
RETURNS TRIGGER AS $$
DECLARE
    points_to_add INTEGER;
    new_tier user_tier;
    current_tier user_tier;
    user_total_earned INTEGER;
BEGIN
    -- Only process when payment status changes to 'verified'
    IF OLD.payment_status != 'verified' AND NEW.payment_status = 'verified' THEN
        -- Calculate points earned (10 points per $1 USD)
        points_to_add := FLOOR(NEW.total_amount * 10);
        
        -- Get current user tier and total earned
        SELECT tier_level, total_points_earned 
        INTO current_tier, user_total_earned
        FROM users WHERE id = NEW.user_id;
        
        -- Update user stats including total_points_earned
        UPDATE users SET
            total_spent = total_spent + NEW.total_amount,
            total_orders = total_orders + 1,
            points_balance = points_balance + points_to_add,
            total_points_earned = total_points_earned + points_to_add,
            updated_at = NOW()
        WHERE id = NEW.user_id;
        
        -- Calculate new tier based on updated total_points_earned
        IF (user_total_earned + points_to_add) >= 50000 THEN
            new_tier := 'diamond';
        ELSIF (user_total_earned + points_to_add) >= 35000 THEN
            new_tier := 'platinum';
        ELSIF (user_total_earned + points_to_add) >= 15000 THEN
            new_tier := 'gold';
        ELSIF (user_total_earned + points_to_add) >= 5000 THEN
            new_tier := 'silver';
        ELSE
            new_tier := 'bronze';
        END IF;
        
        -- Update tier if it has changed
        IF current_tier != new_tier THEN
            UPDATE users SET tier_level = new_tier WHERE id = NEW.user_id;
            
            -- Mark current rank as not current
            UPDATE user_ranks 
            SET is_current = FALSE 
            WHERE user_id = NEW.user_id AND is_current = TRUE;
            
            -- Create new rank record
            INSERT INTO user_ranks (user_id, rank, points_at_rank, achieved_at, is_current)
            VALUES (NEW.user_id, new_tier, user_total_earned + points_to_add, NOW(), TRUE);
        END IF;
        
        -- Record points transaction
        INSERT INTO point_transactions (
            user_id, points, transaction_type, reference_type, 
            reference_id, description
        ) VALUES (
            NEW.user_id, points_to_add, 'earned', 'order', 
            NEW.id, 'Points earned from order ' || NEW.order_number
        );
        
        -- Update order with points earned
        NEW.points_earned = points_to_add;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the updated trigger
CREATE TRIGGER update_user_stats_on_order_completion
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_user_stats_on_order_completion();

-- Add helpful comment
COMMENT ON FUNCTION update_user_stats_on_order_completion() IS 'Updates user stats, points balance, total_points_earned, and tier when order payment is verified. Automatically handles rank progression.';
