-- Fix ambiguous column reference in validate_coupon_usage function
-- This migration fixes the "column reference 'coupon_id' is ambiguous" error

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
    v_user_usage_count INTEGER;
    v_calculated_discount DECIMAL;
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
    
    -- Check user restrictions
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
    
    -- Return valid result with explicit casting to avoid ambiguity
    RETURN QUERY SELECT TRUE, ''::TEXT, v_coupon.id::UUID, v_calculated_discount;
END;
$$ LANGUAGE plpgsql;
