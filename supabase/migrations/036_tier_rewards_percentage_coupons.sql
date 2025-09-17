-- 036_tier_rewards_percentage_coupons.sql
-- Add percentage coupon reward type and update award function and configuration

-- 1) Add new enum value for percentage coupons (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'tier_reward_type' AND e.enumlabel = 'percentage_coupon'
  ) THEN
    ALTER TYPE tier_reward_type ADD VALUE 'percentage_coupon';
  END IF;
END $$;

-- 2) Update award_tier_rewards() to handle percentage coupons
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
            -- Skip if already awarded to this user for this tier
            IF EXISTS (
                SELECT 1 FROM tier_reward_history
                WHERE user_id = p_user_id
                AND tier_level = p_new_tier
                AND reward_type = reward_record.reward_type
                AND status IN ('awarded', 'claimed')
            ) THEN
                CONTINUE;
            END IF;

            -- Process rewards
            CASE reward_record.reward_type
                WHEN 'points_bonus' THEN
                    INSERT INTO point_transactions (
                        user_id, points, transaction_type, reference_type, description
                    ) VALUES (
                        p_user_id, reward_record.reward_value, 'bonus', 'tier_reward',
                        'Tier reward: ' || reward_record.reward_description
                    ) RETURNING id INTO points_transaction_id;

                    UPDATE users
                    SET points_balance = points_balance + reward_record.reward_value,
                        updated_at = NOW()
                    WHERE id = p_user_id;

                WHEN 'free_shipping_coupon' THEN
                    coupon_code := generate_tier_coupon_code(p_new_tier, p_user_id);
                    INSERT INTO coupons (
                        code, name, description, discount_type, discount_value,
                        per_user_usage_limit, allowed_user_ids, status, expires_at, metadata
                    ) VALUES (
                        coupon_code,
                        'Tier Reward: Free Shipping',
                        'Free shipping coupon for reaching ' || p_new_tier || ' tier',
                        'free_shipping',
                        0,
                        1,
                        jsonb_build_array(p_user_id::TEXT),
                        'active',
                        NOW() + INTERVAL '1 year',
                        jsonb_build_object('tier_reward', true, 'tier_level', p_new_tier, 'user_id', p_user_id)
                    ) RETURNING id INTO coupon_id;

                    INSERT INTO tier_specific_coupons (coupon_id, user_id, tier_level)
                    VALUES (coupon_id, p_user_id, p_new_tier);

                WHEN 'percentage_coupon' THEN
                    coupon_code := generate_tier_coupon_code(p_new_tier, p_user_id);
                    INSERT INTO coupons (
                        code, name, description, discount_type, discount_value,
                        per_user_usage_limit, allowed_user_ids, status, expires_at, metadata
                    ) VALUES (
                        coupon_code,
                        'Tier Reward: ' || reward_record.reward_value || '% Off',
                        reward_record.reward_value || '% off coupon for reaching ' || p_new_tier || ' tier',
                        'percentage',
                        reward_record.reward_value,
                        1,
                        jsonb_build_array(p_user_id::TEXT),
                        'active',
                        NOW() + INTERVAL '1 year',
                        jsonb_build_object('tier_reward', true, 'tier_level', p_new_tier, 'user_id', p_user_id)
                    ) RETURNING id INTO coupon_id;

                    INSERT INTO tier_specific_coupons (coupon_id, user_id, tier_level)
                    VALUES (coupon_id, p_user_id, p_new_tier);

                WHEN 'permanent_free_shipping' THEN
                    UPDATE users SET permanent_free_shipping = TRUE, updated_at = NOW()
                    WHERE id = p_user_id;

                WHEN 'gift_notification', 'exclusive_access' THEN
                    NULL;
                ELSE
                    RETURN QUERY SELECT reward_record.id, reward_record.reward_type, reward_record.reward_description, FALSE,
                        'Unknown reward type: ' || reward_record.reward_type::TEXT;
                    CONTINUE;
            END CASE;

            -- Record history
            INSERT INTO tier_reward_history (
                user_id, tier_level, reward_type, reward_value, reward_description, status,
                coupon_id, point_transaction_id, awarded_at
            ) VALUES (
                p_user_id, p_new_tier, reward_record.reward_type, reward_record.reward_value,
                reward_record.reward_description, 'awarded', coupon_id, points_transaction_id, NOW()
            ) RETURNING id INTO reward_history_id;

            IF coupon_id IS NOT NULL THEN
                UPDATE tier_specific_coupons
                SET reward_history_id = reward_history_id
                WHERE coupon_id = coupon_id AND user_id = p_user_id;
            END IF;

            RETURN QUERY SELECT reward_record.id, reward_record.reward_type, reward_record.reward_description, TRUE, NULL::TEXT;

            coupon_id := NULL;
            points_transaction_id := NULL;

        EXCEPTION WHEN OTHERS THEN
            RETURN QUERY SELECT reward_record.id, reward_record.reward_type, reward_record.reward_description, FALSE, SQLERRM;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3) Update tier rewards configuration
-- Disable Platinum $50 gift notification
UPDATE tier_rewards
SET is_active = FALSE, updated_at = NOW()
WHERE tier_level = 'platinum' AND reward_type = 'gift_notification';

-- Upsert Platinum 10% coupon
INSERT INTO tier_rewards (tier_level, reward_type, reward_value, reward_description, is_active)
VALUES ('platinum', 'percentage_coupon', 10, '10% off coupon (single use) for reaching Platinum tier', TRUE)
ON CONFLICT (tier_level, reward_type)
DO UPDATE SET reward_value = EXCLUDED.reward_value,
              reward_description = EXCLUDED.reward_description,
              is_active = TRUE,
              updated_at = NOW();

-- Upsert Diamond 15% coupon
INSERT INTO tier_rewards (tier_level, reward_type, reward_value, reward_description, is_active)
VALUES ('diamond', 'percentage_coupon', 15, '15% off coupon (single use) for reaching Diamond tier', TRUE)
ON CONFLICT (tier_level, reward_type)
DO UPDATE SET reward_value = EXCLUDED.reward_value,
              reward_description = EXCLUDED.reward_description,
              is_active = TRUE,
              updated_at = NOW();

