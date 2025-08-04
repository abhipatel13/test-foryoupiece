-- Create email_logs table for tracking email notifications
-- This table stores logs of all email attempts for monitoring and debugging

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  email_type VARCHAR(100) NOT NULL, -- 'admin_login_alert', 'password_reset', etc.
  status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  error_message TEXT,
  metadata JSONB, -- Store additional data like IP address, attempt count, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_email_logs_updated_at 
    BEFORE UPDATE ON email_logs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add RLS (Row Level Security) policies
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can insert/update/delete email logs
CREATE POLICY "Service role can manage email logs" ON email_logs
    FOR ALL USING (auth.role() = 'service_role');

-- Policy: Authenticated users can read their own email logs (if needed)
CREATE POLICY "Users can read own email logs" ON email_logs
    FOR SELECT USING (auth.email() = recipient);

-- Grant permissions
GRANT ALL ON email_logs TO service_role;
GRANT SELECT ON email_logs TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE email_logs IS 'Stores logs of all email notifications sent by the system';
COMMENT ON COLUMN email_logs.recipient IS 'Email address of the recipient';
COMMENT ON COLUMN email_logs.subject IS 'Subject line of the email';
COMMENT ON COLUMN email_logs.email_type IS 'Type of email (admin_login_alert, password_reset, etc.)';
COMMENT ON COLUMN email_logs.status IS 'Status of the email (sent, failed, pending)';
COMMENT ON COLUMN email_logs.error_message IS 'Error message if email failed to send';
COMMENT ON COLUMN email_logs.metadata IS 'Additional data related to the email (JSON format)';
