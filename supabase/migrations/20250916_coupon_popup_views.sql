-- 20250916_coupon_popup_views.sql
-- Track which users have seen targeted coupon popups (server-side persistence)

BEGIN;

CREATE TABLE IF NOT EXISTS coupon_popup_views (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, coupon_id)
);

CREATE INDEX IF NOT EXISTS idx_coupon_popup_views_user ON coupon_popup_views(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_popup_views_coupon ON coupon_popup_views(coupon_id);

-- Helpful view for debugging (optional)
-- CREATE VIEW v_coupon_popup_views AS
--   SELECT cpv.user_id, cpv.coupon_id, cpv.seen_at, c.code, c.name, c.status, c.expires_at
--   FROM coupon_popup_views cpv
--   JOIN coupons c ON c.id = cpv.coupon_id;

COMMIT;

