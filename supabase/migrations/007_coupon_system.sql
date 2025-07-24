-- ForYouPiece Coupon System Migration
-- Creates comprehensive coupon management system with usage tracking

-- Create custom types for coupon system
CREATE TYPE coupon_discount_type AS ENUM ('percentage', 'fixed_amount');
CREATE TYPE coupon_status AS ENUM ('active', 'inactive', 'expired');

-- Coupons table - stores all coupon configurations
CREATE TABLE coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL, -- Display name for admin
    description TEXT, -- Internal description for admin
    discount_type coupon_discount_type NOT NULL,
    discount_value DECIMAL(10,2) NOT NULL CHECK (discount_value > 0),
    
    -- Usage limits
    total_usage_limit INTEGER CHECK (total_usage_limit > 0), -- NULL = unlimited
    per_user_usage_limit INTEGER CHECK (per_user_usage_limit > 0), -- NULL = unlimited per user
    current_usage_count INTEGER DEFAULT 0 CHECK (current_usage_count >= 0),
    
    -- User restrictions (JSON array of user IDs, NULL = all users can use)
    allowed_user_ids JSONB DEFAULT NULL,
    
    -- Order requirements
    minimum_order_amount DECIMAL(10,2) CHECK (minimum_order_amount >= 0), -- NULL = no minimum
    
    -- Time restrictions
    starts_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    -- Status and metadata
    status coupon_status DEFAULT 'active',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}', -- For future extensibility
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_expiration CHECK (expires_at IS NULL OR expires_at > starts_at),
    CONSTRAINT valid_discount_percentage CHECK (
        discount_type != 'percentage' OR (discount_value > 0 AND discount_value <= 100)
    )
);

-- Coupon usage tracking table - tracks individual coupon uses
CREATE TABLE coupon_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID REFERENCES coupons(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
    
    -- Usage details
    discount_amount DECIMAL(10,2) NOT NULL CHECK (discount_amount >= 0),
    order_total_before_discount DECIMAL(10,2) NOT NULL CHECK (order_total_before_discount >= 0),
    
    -- Timestamps
    used_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one coupon per order
    UNIQUE(order_id)
);

-- Add coupon tracking to orders table
ALTER TABLE orders ADD COLUMN coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN coupon_code TEXT;
ALTER TABLE orders ADD COLUMN coupon_discount_amount DECIMAL(12,2) DEFAULT 0 CHECK (coupon_discount_amount >= 0);

-- Create indexes for performance
CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_status ON coupons(status);
CREATE INDEX idx_coupons_expires_at ON coupons(expires_at);
CREATE INDEX idx_coupon_usage_coupon_id ON coupon_usage(coupon_id);
CREATE INDEX idx_coupon_usage_user_id ON coupon_usage(user_id);
CREATE INDEX idx_coupon_usage_order_id ON coupon_usage(order_id);
CREATE INDEX idx_orders_coupon_id ON orders(coupon_id);

-- Create function to update coupon usage count
CREATE OR REPLACE FUNCTION update_coupon_usage_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Increment usage count
        UPDATE coupons 
        SET current_usage_count = current_usage_count + 1,
            updated_at = NOW()
        WHERE id = NEW.coupon_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement usage count (for refunds/cancellations)
        UPDATE coupons 
        SET current_usage_count = GREATEST(current_usage_count - 1, 0),
            updated_at = NOW()
        WHERE id = OLD.coupon_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update usage counts
CREATE TRIGGER trigger_update_coupon_usage_count
    AFTER INSERT OR DELETE ON coupon_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_coupon_usage_count();

-- Create function to validate coupon usage
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
        FROM coupon_usage
        WHERE coupon_id = v_coupon.id AND user_id = p_user_id;
        
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
    
    -- Return valid result
    RETURN QUERY SELECT TRUE, ''::TEXT, v_coupon.id, v_calculated_discount;
END;
$$ LANGUAGE plpgsql;

-- Create function to apply coupon to order
CREATE OR REPLACE FUNCTION apply_coupon_to_order(
    p_coupon_code TEXT,
    p_user_id UUID,
    p_order_id UUID,
    p_order_total DECIMAL
)
RETURNS TABLE (
    success BOOLEAN,
    error_message TEXT,
    discount_amount DECIMAL
) AS $$
DECLARE
    v_validation RECORD;
BEGIN
    -- Validate coupon first
    SELECT * INTO v_validation
    FROM validate_coupon_usage(p_coupon_code, p_user_id, p_order_total)
    LIMIT 1;
    
    IF NOT v_validation.is_valid THEN
        RETURN QUERY SELECT FALSE, v_validation.error_message, 0::DECIMAL;
        RETURN;
    END IF;
    
    -- Record coupon usage
    INSERT INTO coupon_usage (coupon_id, user_id, order_id, discount_amount, order_total_before_discount)
    VALUES (v_validation.coupon_id, p_user_id, p_order_id, v_validation.discount_amount, p_order_total);
    
    -- Update order with coupon information
    UPDATE orders
    SET coupon_id = v_validation.coupon_id,
        coupon_code = p_coupon_code,
        coupon_discount_amount = v_validation.discount_amount,
        discount_amount = COALESCE(discount_amount, 0) + v_validation.discount_amount,
        total_amount = total_amount - v_validation.discount_amount,
        updated_at = NOW()
    WHERE id = p_order_id;
    
    RETURN QUERY SELECT TRUE, ''::TEXT, v_validation.discount_amount;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS on new tables
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for coupons table
-- Admin can do everything
CREATE POLICY "Admin full access to coupons" ON coupons
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE user_id = auth.uid() 
            AND role IN ('super_admin', 'admin')
        )
    );

-- Users can only read active coupons (for validation)
CREATE POLICY "Users can read active coupons" ON coupons
    FOR SELECT USING (status = 'active');

-- RLS Policies for coupon_usage table
-- Admin can read all usage records
CREATE POLICY "Admin can read all coupon usage" ON coupon_usage
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE user_id = auth.uid() 
            AND role IN ('super_admin', 'admin')
        )
    );

-- Users can only see their own usage records
CREATE POLICY "Users can read own coupon usage" ON coupon_usage
    FOR SELECT USING (user_id = auth.uid());

-- System can insert usage records (via service role)
CREATE POLICY "System can insert coupon usage" ON coupon_usage
    FOR INSERT WITH CHECK (true);

-- Add updated_at trigger for coupons
CREATE TRIGGER update_coupons_updated_at
    BEFORE UPDATE ON coupons
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
