-- Create table for bot-based Telegram authentication codes
-- This is for future implementation of bot-based auth as an alternative to OAuth

CREATE TABLE IF NOT EXISTS telegram_auth_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  user_data JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Indexes for performance
  CONSTRAINT telegram_auth_codes_expires_at_check CHECK (expires_at > created_at)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_telegram_auth_codes_code ON telegram_auth_codes(code);
CREATE INDEX IF NOT EXISTS idx_telegram_auth_codes_status ON telegram_auth_codes(status);
CREATE INDEX IF NOT EXISTS idx_telegram_auth_codes_expires_at ON telegram_auth_codes(expires_at);

-- Enable RLS
ALTER TABLE telegram_auth_codes ENABLE ROW LEVEL SECURITY;

-- RLS policies (only allow service role access for security)
CREATE POLICY "Service role can manage telegram auth codes" ON telegram_auth_codes
  FOR ALL USING (auth.role() = 'service_role');

-- Auto-cleanup expired codes (runs every hour)
CREATE OR REPLACE FUNCTION cleanup_expired_telegram_auth_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM telegram_auth_codes 
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a scheduled job to cleanup expired codes (if pg_cron is available)
-- SELECT cron.schedule('cleanup-telegram-auth-codes', '0 * * * *', 'SELECT cleanup_expired_telegram_auth_codes();');
