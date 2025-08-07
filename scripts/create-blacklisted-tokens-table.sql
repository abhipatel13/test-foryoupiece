-- Create blacklisted_tokens table for enhanced session management
-- This table stores hashed tokens that have been invalidated

CREATE TABLE IF NOT EXISTS blacklisted_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  blacklisted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_token_hash ON blacklisted_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_user_id ON blacklisted_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_expires_at ON blacklisted_tokens(expires_at);

-- Create function to automatically clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_blacklisted_tokens()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM blacklisted_tokens 
  WHERE expires_at < NOW();
END;
$$;

-- Create a trigger to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_blacklisted_tokens_updated_at
  BEFORE UPDATE ON blacklisted_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE blacklisted_tokens ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Only service role can access blacklisted tokens
CREATE POLICY "Service role can manage blacklisted tokens"
  ON blacklisted_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users can only see their own blacklisted tokens (for transparency)
CREATE POLICY "Users can view their own blacklisted tokens"
  ON blacklisted_tokens
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON blacklisted_tokens TO service_role;
GRANT SELECT ON blacklisted_tokens TO authenticated;

-- Create a scheduled job to clean up expired tokens (if pg_cron is available)
-- This would typically be set up by a database administrator
-- SELECT cron.schedule('cleanup-blacklisted-tokens', '0 2 * * *', 'SELECT cleanup_expired_blacklisted_tokens();');

COMMENT ON TABLE blacklisted_tokens IS 'Stores hashed tokens that have been invalidated for security purposes';
COMMENT ON COLUMN blacklisted_tokens.token_hash IS 'SHA-256 hash of the invalidated token';
COMMENT ON COLUMN blacklisted_tokens.reason IS 'Reason for token invalidation (e.g., user_logout, security_breach, admin_revoke)';
COMMENT ON COLUMN blacklisted_tokens.expires_at IS 'When this blacklist entry expires and can be cleaned up';
