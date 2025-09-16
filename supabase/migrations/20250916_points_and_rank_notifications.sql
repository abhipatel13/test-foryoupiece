-- Add notifications for Admin Points Added and Rank Up events
-- This migration adds two trigger functions and triggers that integrate with the existing notifications system
-- It does NOT modify existing order notification logic

-- 1) Points Added Notification (admin manual adjustments)
--    Fires AFTER INSERT on admin_point_adjustments when points_changed > 0
CREATE OR REPLACE FUNCTION notify_admin_points_added()
RETURNS TRIGGER AS $$
BEGIN
    -- Only notify for positive adjustments (points added)
    IF NEW.points_changed > 0 THEN
        INSERT INTO notifications (user_id, title, message, type, related_order_id)
        VALUES (
            NEW.user_id,
            'Points Added',
            'You''ve received ' || NEW.points_changed || ' bonus points! Reason: ' ||
              COALESCE(NULLIF(TRIM(NEW.reason), ''), 'Admin adjustment'),
            'success',
            NULL
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create or replace trigger on admin_point_adjustments
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'notify_admin_points_added_trigger'
    ) THEN
        DROP TRIGGER notify_admin_points_added_trigger ON admin_point_adjustments;
    END IF;
END $$;

CREATE TRIGGER notify_admin_points_added_trigger
    AFTER INSERT ON admin_point_adjustments
    FOR EACH ROW
    EXECUTE FUNCTION notify_admin_points_added();


-- 2) Rank Up Notification
--    Fires AFTER UPDATE on users when tier_level increases (bronze→silver→gold→platinum→diamond)
CREATE OR REPLACE FUNCTION notify_rank_up()
RETURNS TRIGGER AS $$
DECLARE
    old_rank_int INTEGER;
    new_rank_int INTEGER;
    benefits TEXT;
BEGIN
    -- Map tiers to comparable integers
    old_rank_int := CASE OLD.tier_level
        WHEN 'bronze' THEN 1
        WHEN 'silver' THEN 2
        WHEN 'gold' THEN 3
        WHEN 'platinum' THEN 4
        WHEN 'diamond' THEN 5
        ELSE 0 END;

    new_rank_int := CASE NEW.tier_level
        WHEN 'bronze' THEN 1
        WHEN 'silver' THEN 2
        WHEN 'gold' THEN 3
        WHEN 'platinum' THEN 4
        WHEN 'diamond' THEN 5
        ELSE 0 END;

    -- Only notify on genuine upgrades
    IF new_rank_int > old_rank_int THEN
        -- Friendly benefits copy per tier (kept concise)
        benefits := CASE NEW.tier_level
            WHEN 'silver' THEN 'Enjoy enhanced rewards and exclusive offers.'
            WHEN 'gold' THEN 'You unlocked free shipping on all orders!'
            WHEN 'platinum' THEN 'Enjoy premium perks and exclusive offers.'
            WHEN 'diamond' THEN 'Enjoy permanent free shipping and premium perks.'
            ELSE 'Enjoy new benefits and exclusive rewards.' END;

        INSERT INTO notifications (user_id, title, message, type, related_order_id)
        VALUES (
            NEW.id,
            'Congratulations! Rank Upgraded',
            'Congratulations! You''ve reached ' || INITCAP(NEW.tier_level::text) || ' tier. ' || benefits,
            'success',
            NULL
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create or replace trigger on users for rank upgrades
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'notify_rank_up_trigger'
    ) THEN
        DROP TRIGGER notify_rank_up_trigger ON users;
    END IF;
END $$;

CREATE TRIGGER notify_rank_up_trigger
    AFTER UPDATE ON users
    FOR EACH ROW
    WHEN (OLD.tier_level IS DISTINCT FROM NEW.tier_level)
    EXECUTE FUNCTION notify_rank_up();

-- Helpful comments
COMMENT ON FUNCTION notify_admin_points_added() IS 'Inserts a success notification when an admin adds points via admin_point_adjustments.';
COMMENT ON FUNCTION notify_rank_up() IS 'Inserts a success notification when a user''s tier_level increases.';

