-- Advanced Coupon Targeting Enhancements
-- Adds eligibility checks to validate_coupon_usage for tier and metadata.targeting rules

-- Update validate_coupon_usage to enforce tier_restrictions and metadata.targeting
CREATE OR REPLACE FUNCTION validate_coupon_usage(
    p_coupon_code TEXT,
    p_user_id UUID,
    p_order_total DECIMAL
)
RETURNS TABLE (
    is_valid BOOLEAN,
    error_message TEXT,
    coupon_id UUID,
    discount_amount DECIMAL
) AS $$
DECLARE
    v_coupon RECORD;
    v_user RECORD;
    v_user_usage_count INTEGER;
    v_calculated_discount DECIMAL;
    v_targeting JSONB;
    v_recent_signup_days INTEGER;
    v_recent_purchase_days INTEGER;
    v_top_n INTEGER;
    v_min_total_spent DECIMAL;
    v_last_purchase TIMESTAMPTZ;
    v_rank_position BIGINT;
BEGIN
    -- Get coupon details
    SELECT * INTO v_coupon
    FROM coupons
    WHERE code = p_coupon_code;

    -- Check if coupon exists
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Invalid coupon code', NULL::UUID, 0::DECIMAL;
        RETURN;
    END IF;

    -- Check if coupon is active
    IF v_coupon.status != 'active' THEN
        RETURN QUERY SELECT FALSE, 'This coupon is not active', NULL::UUID, 0::DECIMAL;
        RETURN;
    END IF;

    -- Check if coupon has started
    IF v_coupon.starts_at > NOW() THEN
        RETURN QUERY SELECT FALSE, 'This coupon is not yet valid', NULL::UUID, 0::DECIMAL;
        RETURN;
    END IF;

    -- Check if coupon has expired
    IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < NOW() THEN
        RETURN QUERY SELECT FALSE, 'This coupon has expired', NULL::UUID, 0::DECIMAL;
        RETURN;
    END IF;

    -- Check total usage limit
    IF v_coupon.total_usage_limit IS NOT NULL AND v_coupon.current_usage_count >= v_coupon.total_usage_limit THEN
        RETURN QUERY SELECT FALSE, 'This coupon has reached its usage limit', NULL::UUID, 0::DECIMAL;
        RETURN;
    END IF;

    -- Fetch user info needed for targeting checks
    SELECT id, tier_level, created_at, total_spent INTO v_user
    FROM users
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'User not found', NULL::UUID, 0::DECIMAL;
        RETURN;
    END IF;

    -- Tier-specific restriction (when enabled)
    IF COALESCE(v_coupon.is_tier_specific, FALSE) = TRUE AND v_coupon.tier_restrictions IS NOT NULL THEN
        -- Expecting tier_restrictions as JSON array of tier strings
        IF NOT (v_coupon.tier_restrictions ? v_user.tier_level) THEN
            RETURN QUERY SELECT FALSE, 'You are not eligible to use this coupon', NULL::UUID, 0::DECIMAL;
            RETURN;
        END IF;
    END IF;

    -- Targeting via metadata.targeting JSONB
    v_targeting := NULLIF(v_coupon.metadata, '{}'::jsonb)->'targeting';

    IF v_targeting IS NOT NULL THEN
        -- Recently signed up: users registered within last N days
        v_recent_signup_days := NULLIF((v_targeting->>'recently_signed_up_days')::INT, 0);
        IF v_recent_signup_days IS NOT NULL THEN
            IF v_user.created_at < (NOW() - (v_recent_signup_days || ' days')::interval) THEN
                RETURN QUERY SELECT FALSE, 'This coupon is only for recently signed up users', NULL::UUID, 0::DECIMAL;
                RETURN;
            END IF;
        END IF;

        -- Recently purchased: made a purchase within last N days
        v_recent_purchase_days := NULLIF((v_targeting->>'recently_purchased_days')::INT, 0);
        IF v_recent_purchase_days IS NOT NULL THEN
            SELECT MAX(created_at) INTO v_last_purchase
            FROM orders
            WHERE user_id = p_user_id AND payment_status = 'verified'
              AND created_at >= (NOW() - (v_recent_purchase_days || ' days')::interval);

            IF v_last_purchase IS NULL THEN
                RETURN QUERY SELECT FALSE, 'This coupon requires a recent purchase', NULL::UUID, 0::DECIMAL;
                RETURN;
            END IF;
        END IF;

        -- Most purchased users: threshold or top N by total_spent
        v_min_total_spent := NULLIF((v_targeting->>'most_purchased_min_total_spent')::DECIMAL, 0);
        v_top_n := NULLIF((v_targeting->>'most_purchased_top_n')::INT, 0);

        IF v_min_total_spent IS NOT NULL THEN
            IF COALESCE(v_user.total_spent, 0) < v_min_total_spent THEN
                RETURN QUERY SELECT FALSE, 'This coupon is for top purchasers only', NULL::UUID, 0::DECIMAL;
                RETURN;
            END IF;
        ELSIF v_top_n IS NOT NULL THEN
            -- Compute 1-based rank position by total_spent DESC (ties resolved by id)
            SELECT 1 + COUNT(*) INTO v_rank_position
            FROM users u2
            WHERE COALESCE(u2.total_spent, 0) > COALESCE(v_user.total_spent, 0)
               OR (COALESCE(u2.total_spent, 0) = COALESCE(v_user.total_spent, 0) AND u2.id < v_user.id);

            IF v_rank_position > v_top_n THEN
                RETURN QUERY SELECT FALSE, 'This coupon is limited to top purchasers', NULL::UUID, 0::DECIMAL;
                RETURN;
            END IF;
        END IF;
    END IF;

    -- Check user allowlist if present (explicit whitelist takes precedence)
    IF v_coupon.allowed_user_ids IS NOT NULL THEN
        IF NOT (v_coupon.allowed_user_ids ? p_user_id::TEXT) THEN
            RETURN QUERY SELECT FALSE, 'You are not eligible to use this coupon', NULL::UUID, 0::DECIMAL;
            RETURN;
        END IF;
    END IF;

    -- Check per-user usage limit
    IF v_coupon.per_user_usage_limit IS NOT NULL THEN
        SELECT COUNT(*) INTO v_user_usage_count
        FROM coupon_usage cu
        WHERE cu.coupon_id = v_coupon.id AND cu.user_id = p_user_id;

        IF v_user_usage_count >= v_coupon.per_user_usage_limit THEN
            RETURN QUERY SELECT FALSE, 'You have reached the usage limit for this coupon', NULL::UUID, 0::DECIMAL;
            RETURN;
        END IF;
    END IF;

    -- Check minimum order amount
    IF v_coupon.minimum_order_amount IS NOT NULL AND p_order_total < v_coupon.minimum_order_amount THEN
        RETURN QUERY SELECT FALSE,
            'Minimum order amount of $' || v_coupon.minimum_order_amount || ' required',
            NULL::UUID, 0::DECIMAL;
        RETURN;
    END IF;

    -- Calculate discount amount
    IF v_coupon.discount_type = 'percentage' THEN
        v_calculated_discount := ROUND(p_order_total * (v_coupon.discount_value / 100), 2);
    ELSE
        v_calculated_discount := LEAST(v_coupon.discount_value, p_order_total);
    END IF;

    RETURN QUERY SELECT TRUE, ''::TEXT, v_coupon.id::UUID, v_calculated_discount;
END;
$$ LANGUAGE plpgsql;

