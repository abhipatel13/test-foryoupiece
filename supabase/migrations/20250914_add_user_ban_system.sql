-- 20250914_add_user_ban_system.sql
-- Add banned flag to users and create audit log table for ban/unban actions

-- 1) Add banned column to users table (default false)
ALTER TABLE IF EXISTS users
ADD COLUMN IF NOT EXISTS banned BOOLEAN NOT NULL DEFAULT FALSE;

-- Optional: record when the user was banned/unbanned last
ALTER TABLE IF EXISTS users
ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;

-- Index to speed up queries filtering by banned status
CREATE INDEX IF NOT EXISTS idx_users_banned ON users (banned);

-- 2) Create audit table for ban/unban actions
CREATE TABLE IF NOT EXISTS user_ban_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('ban','unban')),
  reason TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_ban_audit_user_id ON user_ban_audit (user_id);
CREATE INDEX IF NOT EXISTS idx_user_ban_audit_created_at ON user_ban_audit (created_at DESC);

-- 3) Comment for documentation
COMMENT ON COLUMN users.banned IS 'If true, the user is banned from using authenticated features.';
COMMENT ON COLUMN users.banned_at IS 'Timestamp of the most recent ban action.';
COMMENT ON TABLE user_ban_audit IS 'Audit log for admin ban/unban actions.';

