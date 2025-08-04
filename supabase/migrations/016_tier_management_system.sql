-- Tier Management System Migration
-- Creates comprehensive tier management and audit logging system

-- Create tier_reset_logs table for audit trail
CREATE TABLE IF NOT EXISTS tier_reset_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL NOT NULL,
    old_tier user_tier NOT NULL,
    new_tier user_tier NOT NULL,
    reason TEXT NOT NULL,
    points_balance_at_reset INTEGER NOT NULL DEFAULT 0,
    total_points_earned_at_reset INTEGER NOT NULL DEFAULT 0,
    reset_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_tier_reset_logs_user_id ON tier_reset_logs(user_id);
CREATE INDEX idx_tier_reset_logs_admin_user_id ON tier_reset_logs(admin_user_id);
CREATE INDEX idx_tier_reset_logs_reset_at ON tier_reset_logs(reset_at);

-- Create tier_coupon_usage_tracking table for detailed coupon analytics
CREATE TABLE IF NOT EXISTS tier_coupon_usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID REFERENCES coupons(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    user_tier_at_usage user_tier NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    order_total DECIMAL(10,2) NOT NULL DEFAULT 0,
    used_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for tier coupon usage tracking
CREATE INDEX idx_tier_coupon_usage_coupon_id ON tier_coupon_usage_tracking(coupon_id);
CREATE INDEX idx_tier_coupon_usage_user_id ON tier_coupon_usage_tracking(user_id);
CREATE INDEX idx_tier_coupon_usage_tier ON tier_coupon_usage_tracking(user_tier_at_usage);
CREATE INDEX idx_tier_coupon_usage_used_at ON tier_coupon_usage_tracking(used_at);

-- Add tier-specific fields to coupons table if not exists
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS tier_restrictions JSONB DEFAULT NULL;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS is_tier_specific BOOLEAN DEFAULT FALSE;

-- Create function to reset user tier while preserving points
CREATE OR REPLACE FUNCTION reset_user_tier(
    p_user_id UUID,
    p_new_tier user_tier,
    p_admin_user_id UUID,
    p_reason TEXT
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    old_tier user_tier,
    new_tier user_tier
) AS $$
DECLARE
    v_old_tier user_tier;
    v_points_balance INTEGER;
    v_total_points_earned INTEGER;
BEGIN
    -- Get current user data
    SELECT tier_level, points_balance, total_points_earned
    INTO v_old_tier, v_points_balance, v_total_points_earned
    FROM users
    WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'User not found', NULL::user_tier, NULL::user_tier;
        RETURN;
    END IF;
    
    -- Update user tier (preserving points balance)
    UPDATE users
    SET 
        tier_level = p_new_tier,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    -- Update current rank record
    UPDATE user_ranks
    SET is_current = FALSE
    WHERE user_id = p_user_id AND is_current = TRUE;
    
    -- Create new rank record
    INSERT INTO user_ranks (
        user_id,
        rank,
        points_at_rank,
        achieved_at,
        is_current
    ) VALUES (
        p_user_id,
        p_new_tier,
        v_total_points_earned,
        NOW(),
        TRUE
    );
    
    -- Log the tier reset
    INSERT INTO tier_reset_logs (
        user_id,
        admin_user_id,
        old_tier,
        new_tier,
        reason,
        points_balance_at_reset,
        total_points_earned_at_reset,
        reset_at
    ) VALUES (
        p_user_id,
        p_admin_user_id,
        v_old_tier,
        p_new_tier,
        p_reason,
        v_points_balance,
        v_total_points_earned,
        NOW()
    );
    
    RETURN QUERY SELECT TRUE, 'Tier reset successfully', v_old_tier, p_new_tier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get tier analytics
CREATE OR REPLACE FUNCTION get_tier_analytics(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    tier_level user_tier,
    user_count BIGINT,
    total_points_earned BIGINT,
    total_spent DECIMAL,
    avg_points_per_user DECIMAL,
    avg_spent_per_user DECIMAL,
    tier_upgrades_count BIGINT,
    tier_resets_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.tier_level,
        COUNT(u.id) as user_count,
        COALESCE(SUM(u.total_points_earned), 0) as total_points_earned,
        COALESCE(SUM(u.total_spent), 0) as total_spent,
        COALESCE(AVG(u.total_points_earned), 0) as avg_points_per_user,
        COALESCE(AVG(u.total_spent), 0) as avg_spent_per_user,
        COALESCE(tier_upgrades.upgrade_count, 0) as tier_upgrades_count,
        COALESCE(tier_resets.reset_count, 0) as tier_resets_count
    FROM users u
    LEFT JOIN (
        SELECT 
            new_tier,
            COUNT(*) as upgrade_count
        FROM tier_reward_history trh
        WHERE (p_start_date IS NULL OR trh.awarded_at >= p_start_date)
          AND (p_end_date IS NULL OR trh.awarded_at <= p_end_date)
        GROUP BY new_tier
    ) tier_upgrades ON tier_upgrades.new_tier = u.tier_level
    LEFT JOIN (
        SELECT 
            new_tier,
            COUNT(*) as reset_count
        FROM tier_reset_logs trl
        WHERE (p_start_date IS NULL OR trl.reset_at >= p_start_date)
          AND (p_end_date IS NULL OR trl.reset_at <= p_end_date)
        GROUP BY new_tier
    ) tier_resets ON tier_resets.new_tier = u.tier_level
    GROUP BY u.tier_level, tier_upgrades.upgrade_count, tier_resets.reset_count
    ORDER BY 
        CASE u.tier_level
            WHEN 'bronze' THEN 1
            WHEN 'silver' THEN 2
            WHEN 'gold' THEN 3
            WHEN 'platinum' THEN 4
            WHEN 'diamond' THEN 5
            ELSE 6
        END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get tier-specific coupon analytics
CREATE OR REPLACE FUNCTION get_tier_coupon_analytics(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    tier_level user_tier,
    coupon_code TEXT,
    coupon_name TEXT,
    usage_count BIGINT,
    total_discount_amount DECIMAL,
    avg_discount_amount DECIMAL,
    total_order_value DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tctu.user_tier_at_usage,
        c.code,
        c.name,
        COUNT(tctu.id) as usage_count,
        COALESCE(SUM(tctu.discount_amount), 0) as total_discount_amount,
        COALESCE(AVG(tctu.discount_amount), 0) as avg_discount_amount,
        COALESCE(SUM(tctu.order_total), 0) as total_order_value
    FROM tier_coupon_usage_tracking tctu
    JOIN coupons c ON c.id = tctu.coupon_id
    WHERE (p_start_date IS NULL OR tctu.used_at >= p_start_date)
      AND (p_end_date IS NULL OR tctu.used_at <= p_end_date)
    GROUP BY tctu.user_tier_at_usage, c.code, c.name
    ORDER BY tctu.user_tier_at_usage, usage_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to track tier-specific coupon usage
CREATE OR REPLACE FUNCTION track_tier_coupon_usage()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert into tier coupon usage tracking when a coupon is used
    INSERT INTO tier_coupon_usage_tracking (
        coupon_id,
        user_id,
        user_tier_at_usage,
        order_id,
        discount_amount,
        order_total,
        used_at
    )
    SELECT 
        NEW.coupon_id,
        NEW.user_id,
        u.tier_level,
        NEW.order_id,
        NEW.discount_amount,
        NEW.order_total_before_discount,
        NEW.used_at
    FROM users u
    WHERE u.id = NEW.user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on coupon_usage table
DROP TRIGGER IF EXISTS trigger_track_tier_coupon_usage ON coupon_usage;
CREATE TRIGGER trigger_track_tier_coupon_usage
    AFTER INSERT ON coupon_usage
    FOR EACH ROW
    EXECUTE FUNCTION track_tier_coupon_usage();

-- Grant necessary permissions
GRANT SELECT ON tier_reset_logs TO authenticated;
GRANT SELECT ON tier_coupon_usage_tracking TO authenticated;

GRANT EXECUTE ON FUNCTION reset_user_tier(UUID, user_tier, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tier_analytics(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tier_coupon_analytics(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- Add RLS policies
ALTER TABLE tier_reset_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_coupon_usage_tracking ENABLE ROW LEVEL SECURITY;

-- Admin users can see all tier reset logs
CREATE POLICY "Admin users can view tier reset logs" ON tier_reset_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admin_users au
            WHERE au.user_id = auth.uid()
            AND au.is_active = true
        )
    );

-- Admin users can see all tier coupon usage tracking
CREATE POLICY "Admin users can view tier coupon usage tracking" ON tier_coupon_usage_tracking
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admin_users au
            WHERE au.user_id = auth.uid()
            AND au.is_active = true
        )
    );
