-- Admin Points Management System Migration
-- This migration adds comprehensive admin points management functionality

-- Add admin_adjustment transaction type if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
        CREATE TYPE transaction_type AS ENUM ('earned', 'redeemed', 'expired', 'bonus', 'refund', 'admin_adjustment');
    ELSE
        -- Add admin_adjustment to existing enum if not present
        BEGIN
            ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'admin_adjustment';
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END;
    END IF;
END $$;

-- Create admin_point_adjustments table for tracking manual point changes
CREATE TABLE IF NOT EXISTS admin_point_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    points_before INTEGER NOT NULL CHECK (points_before >= 0),
    points_after INTEGER NOT NULL CHECK (points_after >= 0),
    points_changed INTEGER NOT NULL, -- Can be positive or negative
    reason TEXT NOT NULL,
    transaction_id UUID REFERENCES point_transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_point_adjustments_user_id ON admin_point_adjustments(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_point_adjustments_admin_user_id ON admin_point_adjustments(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_point_adjustments_created_at ON admin_point_adjustments(created_at DESC);

-- Create points_reset_history table for tracking annual resets
CREATE TABLE IF NOT EXISTS points_reset_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reset_year INTEGER NOT NULL,
    reset_date TIMESTAMPTZ NOT NULL,
    total_users_affected INTEGER NOT NULL DEFAULT 0,
    total_points_reset BIGINT NOT NULL DEFAULT 0,
    reset_type VARCHAR(20) NOT NULL DEFAULT 'annual' CHECK (reset_type IN ('annual', 'manual')),
    admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- For manual resets
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for reset history
CREATE INDEX IF NOT EXISTS idx_points_reset_history_reset_year ON points_reset_history(reset_year DESC);
CREATE INDEX IF NOT EXISTS idx_points_reset_history_reset_date ON points_reset_history(reset_date DESC);

-- Function to calculate next reset date (January 1st of next year)
CREATE OR REPLACE FUNCTION get_next_points_reset_date()
RETURNS TIMESTAMPTZ AS $$
BEGIN
    RETURN DATE_TRUNC('year', NOW() + INTERVAL '1 year');
END;
$$ LANGUAGE plpgsql;

-- Function to get time until next reset
CREATE OR REPLACE FUNCTION get_time_until_reset()
RETURNS INTERVAL AS $$
BEGIN
    RETURN get_next_points_reset_date() - NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to perform annual points reset
CREATE OR REPLACE FUNCTION perform_annual_points_reset(
    admin_user_id_param UUID DEFAULT NULL,
    reset_type_param VARCHAR(20) DEFAULT 'annual'
)
RETURNS TABLE (
    users_affected INTEGER,
    total_points_reset BIGINT,
    reset_id UUID
) AS $$
DECLARE
    reset_record_id UUID;
    users_count INTEGER := 0;
    points_total BIGINT := 0;
    current_year INTEGER;
BEGIN
    current_year := EXTRACT(YEAR FROM NOW());

    -- Check if reset already performed this year
    IF EXISTS (
        SELECT 1 FROM points_reset_history
        WHERE reset_year = current_year AND reset_type = reset_type_param
    ) THEN
        RAISE EXCEPTION 'Points reset already performed for year %', current_year;
    END IF;

    -- Calculate totals before reset
    SELECT COUNT(*), COALESCE(SUM(points_balance), 0)
    INTO users_count, points_total
    FROM users
    WHERE points_balance > 0;

    -- Create reset history record
    INSERT INTO points_reset_history (
        reset_year,
        reset_date,
        total_users_affected,
        total_points_reset,
        reset_type,
        admin_user_id,
        metadata
    ) VALUES (
        current_year,
        NOW(),
        users_count,
        points_total,
        reset_type_param,
        admin_user_id_param,
        jsonb_build_object(
            'reset_timestamp', NOW(),
            'reset_by', COALESCE(admin_user_id_param::text, 'system')
        )
    ) RETURNING id INTO reset_record_id;

    -- Mark all current user ranks as not current and set reset date
    UPDATE user_ranks
    SET is_current = FALSE, reset_at = NOW()
    WHERE is_current = TRUE;

    -- Reset all user points to 0 and tier to bronze
    UPDATE users
    SET
        points_balance = 0,
        tier_level = 'bronze',
        updated_at = NOW()
    WHERE points_balance > 0;

    -- Create new bronze rank records for all users
    INSERT INTO user_ranks (user_id, rank, points_at_rank, achieved_at, is_current)
    SELECT
        id,
        'bronze'::user_tier,
        0,
        NOW(),
        TRUE
    FROM users;

    -- Return results
    RETURN QUERY SELECT users_count, points_total, reset_record_id;
END;
$$ LANGUAGE plpgsql;

-- Function to safely adjust user points (used by admin interface)
CREATE OR REPLACE FUNCTION admin_adjust_user_points(
    target_user_id UUID,
    admin_user_id UUID,
    points_adjustment INTEGER,
    reason_text TEXT
)
RETURNS TABLE (
    success BOOLEAN,
    points_before INTEGER,
    points_after INTEGER,
    new_tier user_tier,
    transaction_id UUID,
    adjustment_id UUID
) AS $$
DECLARE
    current_points INTEGER;
    new_points INTEGER;
    new_user_tier user_tier;
    trans_id UUID;
    adj_id UUID;
    trans_type transaction_type;
BEGIN
    -- Get current points
    SELECT points_balance INTO current_points
    FROM users 
    WHERE id = target_user_id;
    
    IF current_points IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, 0, 'bronze'::user_tier, NULL::UUID, NULL::UUID;
        RETURN;
    END IF;
    
    -- Calculate new points (ensure not negative)
    new_points := GREATEST(0, current_points + points_adjustment);
    
    -- Determine transaction type
    trans_type := CASE 
        WHEN points_adjustment > 0 THEN 'bonus'::transaction_type
        ELSE 'admin_adjustment'::transaction_type
    END;
    
    -- Create point transaction
    INSERT INTO point_transactions (
        user_id,
        points,
        transaction_type,
        reference_type,
        description
    ) VALUES (
        target_user_id,
        points_adjustment,
        trans_type,
        'admin_adjustment'::reference_type,
        reason_text
    ) RETURNING id INTO trans_id;
    
    -- Update user points and calculate new tier
    UPDATE users 
    SET 
        points_balance = new_points,
        tier_level = CASE 
            WHEN new_points >= 50000 THEN 'diamond'::user_tier
            WHEN new_points >= 35000 THEN 'platinum'::user_tier
            WHEN new_points >= 15000 THEN 'gold'::user_tier
            WHEN new_points >= 5000 THEN 'silver'::user_tier
            ELSE 'bronze'::user_tier
        END,
        updated_at = NOW()
    WHERE id = target_user_id
    RETURNING tier_level INTO new_user_tier;
    
    -- Create admin adjustment record
    INSERT INTO admin_point_adjustments (
        user_id,
        admin_user_id,
        points_before,
        points_after,
        points_changed,
        reason,
        transaction_id
    ) VALUES (
        target_user_id,
        admin_user_id,
        current_points,
        new_points,
        points_adjustment,
        reason_text,
        trans_id
    ) RETURNING id INTO adj_id;
    
    -- Update user rank if tier changed
    IF new_user_tier != (
        SELECT tier_level FROM users WHERE id = target_user_id
    ) THEN
        -- Mark current rank as not current
        UPDATE user_ranks 
        SET is_current = FALSE 
        WHERE user_id = target_user_id AND is_current = TRUE;
        
        -- Create new rank record
        INSERT INTO user_ranks (user_id, rank, points_at_rank, achieved_at, is_current)
        VALUES (target_user_id, new_user_tier, new_points, NOW(), TRUE);
    END IF;
    
    RETURN QUERY SELECT TRUE, current_points, new_points, new_user_tier, trans_id, adj_id;
END;
$$ LANGUAGE plpgsql;

-- Create RLS policies for admin tables
ALTER TABLE admin_point_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_reset_history ENABLE ROW LEVEL SECURITY;

-- Admin users can view all adjustment records
CREATE POLICY "Admin users can view all point adjustments" ON admin_point_adjustments
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- Admin users can view all reset history
CREATE POLICY "Admin users can view reset history" ON points_reset_history
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- Grant necessary permissions
GRANT SELECT ON admin_point_adjustments TO authenticated;
GRANT SELECT ON points_reset_history TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_points_reset_date() TO authenticated;
GRANT EXECUTE ON FUNCTION get_time_until_reset() TO authenticated;
GRANT EXECUTE ON FUNCTION perform_annual_points_reset(UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_adjust_user_points(UUID, UUID, INTEGER, TEXT) TO authenticated;

-- Add helpful comments
COMMENT ON TABLE admin_point_adjustments IS 'Tracks all manual point adjustments made by administrators';
COMMENT ON TABLE points_reset_history IS 'Records of annual points resets and manual resets';
COMMENT ON FUNCTION get_next_points_reset_date() IS 'Returns the next January 1st reset date';
COMMENT ON FUNCTION get_time_until_reset() IS 'Returns interval until next points reset';
COMMENT ON FUNCTION perform_annual_points_reset(UUID, VARCHAR) IS 'Performs annual points reset for all users';
COMMENT ON FUNCTION admin_adjust_user_points(UUID, UUID, INTEGER, TEXT) IS 'Safely adjusts user points with full audit trail';
