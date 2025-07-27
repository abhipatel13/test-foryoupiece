-- Tier-Based Rewards System Migration
-- This migration creates the infrastructure for automatic tier-based rewards
-- including tier-specific coupons, reward tracking, and Diamond tier privileges

-- Create enum for tier reward types
CREATE TYPE tier_reward_type AS ENUM (
    'points_bonus',
    'free_shipping_coupon', 
    'gift_notification',
    'permanent_free_shipping',
    'exclusive_access'
);

-- Create enum for tier reward status
CREATE TYPE tier_reward_status AS ENUM (
    'pending',
    'awarded',
    'claimed',
    'expired',
    'cancelled'
);

-- Add permanent_free_shipping flag to users table for Diamond tier
ALTER TABLE users ADD COLUMN IF NOT EXISTS permanent_free_shipping BOOLEAN DEFAULT FALSE;

-- Create tier_rewards table to define what rewards are given for each tier
CREATE TABLE IF NOT EXISTS tier_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_level user_tier NOT NULL,
    reward_type tier_reward_type NOT NULL,
    reward_value INTEGER, -- Points amount, coupon discount, etc.
    reward_description TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique reward types per tier
    UNIQUE(tier_level, reward_type)
);

-- Create tier_reward_history table to track all awarded tier rewards
CREATE TABLE IF NOT EXISTS tier_reward_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    tier_level user_tier NOT NULL,
    reward_type tier_reward_type NOT NULL,
    reward_value INTEGER,
    reward_description TEXT NOT NULL,
    status tier_reward_status DEFAULT 'pending',
    
    -- Related records
    coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL,
    point_transaction_id UUID REFERENCES point_transactions(id) ON DELETE SET NULL,
    
    -- Metadata
    awarded_at TIMESTAMPTZ DEFAULT NOW(),
    claimed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create tier_specific_coupons table to track tier-based coupons
CREATE TABLE IF NOT EXISTS tier_specific_coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID REFERENCES coupons(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    tier_level user_tier NOT NULL,
    reward_history_id UUID REFERENCES tier_reward_history(id) ON DELETE SET NULL,
    
    -- Coupon details
    is_unique_to_user BOOLEAN DEFAULT TRUE,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one tier-specific coupon per user per tier (for unique coupons)
    UNIQUE(user_id, tier_level, coupon_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tier_rewards_tier_level ON tier_rewards(tier_level);
CREATE INDEX IF NOT EXISTS idx_tier_rewards_active ON tier_rewards(is_active);

CREATE INDEX IF NOT EXISTS idx_tier_reward_history_user_id ON tier_reward_history(user_id);
CREATE INDEX IF NOT EXISTS idx_tier_reward_history_tier_level ON tier_reward_history(tier_level);
CREATE INDEX IF NOT EXISTS idx_tier_reward_history_status ON tier_reward_history(status);
CREATE INDEX IF NOT EXISTS idx_tier_reward_history_awarded_at ON tier_reward_history(awarded_at);

CREATE INDEX IF NOT EXISTS idx_tier_specific_coupons_user_id ON tier_specific_coupons(user_id);
CREATE INDEX IF NOT EXISTS idx_tier_specific_coupons_coupon_id ON tier_specific_coupons(coupon_id);
CREATE INDEX IF NOT EXISTS idx_tier_specific_coupons_tier_level ON tier_specific_coupons(tier_level);

-- Insert default tier rewards configuration
INSERT INTO tier_rewards (tier_level, reward_type, reward_value, reward_description) VALUES
    ('silver', 'free_shipping_coupon', 0, 'Free shipping coupon for reaching Silver tier'),
    ('gold', 'points_bonus', 10000, '10,000 bonus points for reaching Gold tier'),
    ('gold', 'free_shipping_coupon', 0, 'Free shipping coupon for reaching Gold tier'),
    ('platinum', 'points_bonus', 20000, '20,000 bonus points for reaching Platinum tier'),
    ('platinum', 'gift_notification', 50, '$50 gift notification for reaching Platinum tier'),
    ('diamond', 'permanent_free_shipping', 0, 'Permanent free shipping privilege for Diamond tier'),
    ('diamond', 'gift_notification', 100, '$100 end-of-year bundle pack for Diamond tier'),
    ('diamond', 'exclusive_access', 0, 'Access to exclusive deals for Diamond tier')
ON CONFLICT (tier_level, reward_type) DO NOTHING;

-- Create function to generate unique coupon code for tier rewards
CREATE OR REPLACE FUNCTION generate_tier_coupon_code(
    p_tier_level user_tier,
    p_user_id UUID
)
RETURNS TEXT AS $$
DECLARE
    tier_prefix TEXT;
    user_suffix TEXT;
    timestamp_suffix TEXT;
    coupon_code TEXT;
    code_exists BOOLEAN;
BEGIN
    -- Get tier prefix
    CASE p_tier_level
        WHEN 'silver' THEN tier_prefix := 'SILVER';
        WHEN 'gold' THEN tier_prefix := 'GOLD';
        WHEN 'platinum' THEN tier_prefix := 'PLAT';
        WHEN 'diamond' THEN tier_prefix := 'DIAM';
        ELSE tier_prefix := 'TIER';
    END CASE;
    
    -- Get user suffix (last 6 chars of user ID)
    user_suffix := UPPER(RIGHT(REPLACE(p_user_id::TEXT, '-', ''), 6));
    
    -- Get timestamp suffix
    timestamp_suffix := TO_CHAR(NOW(), 'MMDD');
    
    -- Generate coupon code
    coupon_code := tier_prefix || 'FREE' || user_suffix || timestamp_suffix;
    
    -- Check if code exists and modify if needed
    SELECT EXISTS(SELECT 1 FROM coupons WHERE code = coupon_code) INTO code_exists;
    
    IF code_exists THEN
        -- Add random suffix if code exists
        coupon_code := coupon_code || LPAD(FLOOR(RANDOM() * 100)::TEXT, 2, '0');
    END IF;
    
    RETURN coupon_code;
END;
$$ LANGUAGE plpgsql;

-- Create function to award tier-based rewards
CREATE OR REPLACE FUNCTION award_tier_rewards(
    p_user_id UUID,
    p_new_tier user_tier,
    p_old_tier user_tier DEFAULT 'bronze'
)
RETURNS TABLE (
    reward_id UUID,
    reward_type tier_reward_type,
    reward_description TEXT,
    success BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    reward_record RECORD;
    coupon_code TEXT;
    coupon_id UUID;
    points_transaction_id UUID;
    reward_history_id UUID;
BEGIN
    -- Only award rewards if tier actually increased
    IF p_new_tier <= p_old_tier THEN
        RETURN;
    END IF;

    -- Get all rewards for the new tier
    FOR reward_record IN
        SELECT * FROM tier_rewards
        WHERE tier_level = p_new_tier AND is_active = TRUE
    LOOP
        BEGIN
            -- Check if user already received this reward for this tier
            IF EXISTS (
                SELECT 1 FROM tier_reward_history
                WHERE user_id = p_user_id
                AND tier_level = p_new_tier
                AND reward_type = reward_record.reward_type
                AND status IN ('awarded', 'claimed')
            ) THEN
                -- Skip if already awarded
                CONTINUE;
            END IF;

            -- Process different reward types
            CASE reward_record.reward_type
                WHEN 'points_bonus' THEN
                    -- Award bonus points
                    INSERT INTO point_transactions (
                        user_id, points, transaction_type, reference_type,
                        description
                    ) VALUES (
                        p_user_id, reward_record.reward_value, 'bonus', 'tier_reward',
                        'Tier reward: ' || reward_record.reward_description
                    ) RETURNING id INTO points_transaction_id;

                    -- Update user points balance
                    UPDATE users
                    SET points_balance = points_balance + reward_record.reward_value,
                        updated_at = NOW()
                    WHERE id = p_user_id;

                WHEN 'free_shipping_coupon' THEN
                    -- Generate unique coupon code
                    coupon_code := generate_tier_coupon_code(p_new_tier, p_user_id);

                    -- Create free shipping coupon
                    INSERT INTO coupons (
                        code, name, description, discount_type, discount_value,
                        per_user_usage_limit, allowed_user_ids, status,
                        expires_at, metadata
                    ) VALUES (
                        coupon_code,
                        'Tier Reward: Free Shipping',
                        'Free shipping coupon for reaching ' || p_new_tier || ' tier',
                        'free_shipping',
                        0,
                        1, -- Single use
                        jsonb_build_array(p_user_id::TEXT),
                        'active',
                        NOW() + INTERVAL '1 year',
                        jsonb_build_object(
                            'tier_reward', true,
                            'tier_level', p_new_tier,
                            'user_id', p_user_id
                        )
                    ) RETURNING id INTO coupon_id;

                    -- Track tier-specific coupon
                    INSERT INTO tier_specific_coupons (
                        coupon_id, user_id, tier_level
                    ) VALUES (
                        coupon_id, p_user_id, p_new_tier
                    );

                WHEN 'permanent_free_shipping' THEN
                    -- Enable permanent free shipping for Diamond tier
                    UPDATE users
                    SET permanent_free_shipping = TRUE,
                        updated_at = NOW()
                    WHERE id = p_user_id;

                WHEN 'gift_notification', 'exclusive_access' THEN
                    -- These are handled as notifications/flags, no immediate action needed
                    NULL;

                ELSE
                    -- Unknown reward type
                    RETURN QUERY SELECT
                        reward_record.id,
                        reward_record.reward_type,
                        reward_record.reward_description,
                        FALSE,
                        'Unknown reward type: ' || reward_record.reward_type::TEXT;
                    CONTINUE;
            END CASE;

            -- Record the reward in history
            INSERT INTO tier_reward_history (
                user_id, tier_level, reward_type, reward_value,
                reward_description, status, coupon_id, point_transaction_id,
                awarded_at
            ) VALUES (
                p_user_id, p_new_tier, reward_record.reward_type, reward_record.reward_value,
                reward_record.reward_description, 'awarded', coupon_id, points_transaction_id,
                NOW()
            ) RETURNING id INTO reward_history_id;

            -- Update tier_specific_coupons with reward_history_id if applicable
            IF coupon_id IS NOT NULL THEN
                UPDATE tier_specific_coupons
                SET reward_history_id = reward_history_id
                WHERE coupon_id = coupon_id AND user_id = p_user_id;
            END IF;

            -- Return success
            RETURN QUERY SELECT
                reward_record.id,
                reward_record.reward_type,
                reward_record.reward_description,
                TRUE,
                NULL::TEXT;

            -- Reset variables for next iteration
            coupon_id := NULL;
            points_transaction_id := NULL;

        EXCEPTION WHEN OTHERS THEN
            -- Return error for this reward
            RETURN QUERY SELECT
                reward_record.id,
                reward_record.reward_type,
                reward_record.reward_description,
                FALSE,
                SQLERRM;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced update_user_rank function to trigger tier rewards
CREATE OR REPLACE FUNCTION update_user_rank(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_total_earned INTEGER;
    new_tier user_tier;
    current_tier user_tier;
    reward_results RECORD;
BEGIN
    -- Get user's total points earned and current tier
    SELECT total_points_earned, tier_level
    INTO user_total_earned, current_tier
    FROM users
    WHERE id = p_user_id;

    -- Check if user exists
    IF user_total_earned IS NULL THEN
        RAISE EXCEPTION 'User not found: %', p_user_id;
    END IF;

    -- Calculate new tier based on total_points_earned
    IF user_total_earned >= 50000 THEN
        new_tier := 'diamond';
    ELSIF user_total_earned >= 35000 THEN
        new_tier := 'platinum';
    ELSIF user_total_earned >= 15000 THEN
        new_tier := 'gold';
    ELSIF user_total_earned >= 5000 THEN
        new_tier := 'silver';
    ELSE
        new_tier := 'bronze';
    END IF;

    -- Update tier if it has changed
    IF current_tier != new_tier THEN
        UPDATE users
        SET tier_level = new_tier, updated_at = NOW()
        WHERE id = p_user_id;

        -- Mark current rank as not current
        UPDATE user_ranks
        SET is_current = FALSE
        WHERE user_id = p_user_id AND is_current = TRUE;

        -- Create new rank record
        INSERT INTO user_ranks (user_id, rank, points_at_rank, achieved_at, is_current)
        VALUES (p_user_id, new_tier, user_total_earned, NOW(), TRUE);

        -- Award tier-based rewards
        FOR reward_results IN
            SELECT * FROM award_tier_rewards(p_user_id, new_tier, current_tier)
        LOOP
            IF reward_results.success THEN
                RAISE NOTICE 'Awarded tier reward: % for user % (tier: %)',
                    reward_results.reward_description, p_user_id, new_tier;
            ELSE
                RAISE WARNING 'Failed to award tier reward: % - Error: %',
                    reward_results.reward_description, reward_results.error_message;
            END IF;
        END LOOP;

        RAISE NOTICE 'Updated user % tier from % to % (total points: %) and awarded rewards',
            p_user_id, current_tier, new_tier, user_total_earned;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user's tier rewards history
CREATE OR REPLACE FUNCTION get_user_tier_rewards(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    tier_level user_tier,
    reward_type tier_reward_type,
    reward_description TEXT,
    status tier_reward_status,
    coupon_code TEXT,
    awarded_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        trh.id,
        trh.tier_level,
        trh.reward_type,
        trh.reward_description,
        trh.status,
        c.code as coupon_code,
        trh.awarded_at,
        trh.expires_at
    FROM tier_reward_history trh
    LEFT JOIN coupons c ON trh.coupon_id = c.id
    WHERE trh.user_id = p_user_id
    ORDER BY trh.awarded_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RLS policies
ALTER TABLE tier_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_reward_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_specific_coupons ENABLE ROW LEVEL SECURITY;

-- RLS policies for tier_rewards (admin read-only)
CREATE POLICY "Admin can view tier rewards" ON tier_rewards
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM admin_users au
        JOIN users u ON au.user_id = u.id
        WHERE u.id = auth.uid() AND au.is_active = TRUE
    ));

-- RLS policies for tier_reward_history
CREATE POLICY "Users can view their own tier reward history" ON tier_reward_history
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Admin can view all tier reward history" ON tier_reward_history
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM admin_users au
        JOIN users u ON au.user_id = u.id
        WHERE u.id = auth.uid() AND au.is_active = TRUE
    ));

-- RLS policies for tier_specific_coupons
CREATE POLICY "Users can view their own tier coupons" ON tier_specific_coupons
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Admin can view all tier coupons" ON tier_specific_coupons
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM admin_users au
        JOIN users u ON au.user_id = u.id
        WHERE u.id = auth.uid() AND au.is_active = TRUE
    ));

-- Grant necessary permissions
GRANT SELECT ON tier_rewards TO authenticated;
GRANT SELECT ON tier_reward_history TO authenticated;
GRANT SELECT ON tier_specific_coupons TO authenticated;

GRANT EXECUTE ON FUNCTION generate_tier_coupon_code(user_tier, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION award_tier_rewards(UUID, user_tier, user_tier) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_rank(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_tier_rewards(UUID) TO authenticated;

-- Add helpful comments
COMMENT ON TABLE tier_rewards IS 'Defines what rewards are automatically given when users reach each tier';
COMMENT ON TABLE tier_reward_history IS 'Tracks all tier-based rewards awarded to users with full audit trail';
COMMENT ON TABLE tier_specific_coupons IS 'Links tier-based coupons to users and tracks their generation';
COMMENT ON FUNCTION award_tier_rewards(UUID, user_tier, user_tier) IS 'Awards all applicable rewards when user reaches a new tier';
COMMENT ON FUNCTION update_user_rank(UUID) IS 'Enhanced function that updates user tier and automatically awards tier rewards';
COMMENT ON FUNCTION get_user_tier_rewards(UUID) IS 'Retrieves complete tier reward history for a user';
