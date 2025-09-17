-- 034_preserve_points_in_resets.sql
-- Purpose: Ensure all reset operations preserve spendable points (users.points_balance)
-- and only reset rank tracking (users.total_points_earned and users.tier_level + user_ranks).

-- 1) Annual reset should NOT zero points_balance. It should only reset rank tracking.
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
    lifetime_points_total BIGINT := 0;
    current_year INTEGER;
BEGIN
    current_year := EXTRACT(YEAR FROM NOW());

    -- Prevent duplicate annual resets per year
    IF EXISTS (
        SELECT 1 FROM points_reset_history
        WHERE reset_year = current_year AND reset_type = reset_type_param
    ) THEN
        RAISE EXCEPTION 'Points reset already performed for year %', current_year;
    END IF;

    -- Totals BEFORE reset (sum lifetime points only, do not include spendable balances)
    SELECT COUNT(*), COALESCE(SUM(total_points_earned), 0)
    INTO users_count, lifetime_points_total
    FROM users
    WHERE total_points_earned > 0 OR tier_level != 'bronze';

    -- Record reset
    INSERT INTO points_reset_history (
        reset_year, reset_date, total_users_affected, total_points_reset,
        reset_type, admin_user_id, metadata
    ) VALUES (
        current_year, NOW(), users_count, lifetime_points_total,
        reset_type_param, admin_user_id_param,
        jsonb_build_object(
            'reset_timestamp', NOW(),
            'reset_by', COALESCE(admin_user_id_param::text, 'system'),
            'note', 'Annual rank tracking reset; spendable points preserved'
        )
    ) RETURNING id INTO reset_record_id;

    -- Close current rank records
    UPDATE user_ranks SET is_current = FALSE, reset_at = NOW() WHERE is_current = TRUE;

    -- Reset rank tracking ONLY; preserve spendable points
    UPDATE users
    SET total_points_earned = 0,
        tier_level = 'bronze',
        updated_at = NOW()
    WHERE total_points_earned > 0 OR tier_level != 'bronze';

    -- Start new bronze rank records
    INSERT INTO user_ranks (user_id, rank, points_at_rank, achieved_at, is_current)
    SELECT id, 'bronze'::user_tier, 0, NOW(), TRUE FROM users;

    RETURN QUERY SELECT users_count, lifetime_points_total, reset_record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2) Manual reset should also preserve points_balance and reset only rank tracking.
CREATE OR REPLACE FUNCTION perform_manual_points_reset(
    admin_user_id_param UUID
)
RETURNS TABLE (
    users_affected INTEGER,
    total_points_reset BIGINT,
    reset_id UUID
) AS $$
DECLARE
    reset_record_id UUID;
    users_count INTEGER := 0;
    lifetime_points_total BIGINT := 0;
    current_year INTEGER;
BEGIN
    current_year := EXTRACT(YEAR FROM NOW());

    -- Totals BEFORE reset (lifetime points only)
    SELECT COUNT(*), COALESCE(SUM(total_points_earned), 0)
    INTO users_count, lifetime_points_total
    FROM users
    WHERE total_points_earned > 0 OR tier_level != 'bronze';

    -- Record reset (manual)
    INSERT INTO points_reset_history (
        reset_year, reset_date, total_users_affected, total_points_reset,
        reset_type, admin_user_id, metadata
    ) VALUES (
        current_year, NOW(), users_count, lifetime_points_total,
        'manual', admin_user_id_param,
        jsonb_build_object(
            'reset_timestamp', NOW(),
            'reset_by', admin_user_id_param::text,
            'note', 'Manual rank tracking reset; spendable points preserved'
        )
    ) RETURNING id INTO reset_record_id;

    -- Close current rank records
    UPDATE user_ranks SET is_current = FALSE, reset_at = NOW() WHERE is_current = TRUE;

    -- Reset rank tracking ONLY; preserve spendable points
    UPDATE users
    SET total_points_earned = 0,
        tier_level = 'bronze',
        updated_at = NOW()
    WHERE total_points_earned > 0 OR tier_level != 'bronze';

    -- Start new bronze rank records
    INSERT INTO user_ranks (user_id, rank, points_at_rank, achieved_at, is_current)
    SELECT id, 'bronze'::user_tier, 0, NOW(), TRUE FROM users;

    RETURN QUERY SELECT users_count, lifetime_points_total, reset_record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3) Permissions (align with previous grants)
GRANT EXECUTE ON FUNCTION perform_annual_points_reset(UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION perform_manual_points_reset(UUID) TO authenticated;

-- Notes:
-- - No scheduled/automatic invocation is included here. Resets must be triggered by admins.
-- - points_balance is intentionally untouched in both functions.

