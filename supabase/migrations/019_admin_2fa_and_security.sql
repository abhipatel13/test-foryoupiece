-- Admin 2FA and Security Enhancement Migration
-- This migration adds two-factor authentication and IP tracking for admin users

-- Create admin_login_sessions table for tracking login sessions and IP addresses
CREATE TABLE IF NOT EXISTS admin_login_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    admin_user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE NOT NULL,
    
    -- Session information
    session_token TEXT UNIQUE NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT,
    location_data JSONB DEFAULT '{}', -- Country, city, etc.
    
    -- Security flags
    is_trusted_ip BOOLEAN DEFAULT FALSE,
    requires_2fa BOOLEAN DEFAULT TRUE,
    is_2fa_verified BOOLEAN DEFAULT FALSE,
    
    -- Session status
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ NOT NULL,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Metadata
    login_method TEXT DEFAULT 'password' CHECK (login_method IN ('password', 'oauth', 'token')),
    device_fingerprint TEXT,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create admin_2fa_tokens table for storing 2FA verification codes
CREATE TABLE IF NOT EXISTS admin_2fa_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    admin_user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE NOT NULL,
    
    -- Token information
    token_code TEXT NOT NULL, -- 6-digit code
    token_hash TEXT NOT NULL, -- Hashed version for security
    token_type TEXT DEFAULT 'email' CHECK (token_type IN ('email', 'sms', 'totp')),
    
    -- Verification status
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    attempts_count INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    
    -- Expiration
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Associated session
    session_id UUID REFERENCES admin_login_sessions(id) ON DELETE CASCADE,
    
    -- Metadata
    sent_to TEXT, -- Email or phone number where token was sent
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create admin_trusted_ips table for managing trusted IP addresses
CREATE TABLE IF NOT EXISTS admin_trusted_ips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    admin_user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE NOT NULL,
    
    -- IP information
    ip_address INET NOT NULL,
    ip_range CIDR, -- For IP ranges if needed
    description TEXT,
    
    -- Trust settings
    is_active BOOLEAN DEFAULT TRUE,
    auto_added BOOLEAN DEFAULT FALSE, -- True if added automatically after successful 2FA
    trust_level TEXT DEFAULT 'standard' CHECK (trust_level IN ('standard', 'high', 'permanent')),
    
    -- Expiration (for temporary trust)
    expires_at TIMESTAMPTZ,
    
    -- Usage tracking
    last_used_at TIMESTAMPTZ,
    usage_count INTEGER DEFAULT 0,
    
    -- Metadata
    added_by UUID REFERENCES auth.users(id), -- Who added this trusted IP
    location_data JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique IP per user
    UNIQUE(user_id, ip_address)
);

-- Create admin_security_logs table for comprehensive security logging
CREATE TABLE IF NOT EXISTS admin_security_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    
    -- Event information
    event_type TEXT NOT NULL CHECK (event_type IN (
        'login_attempt', 'login_success', 'login_failure',
        '2fa_sent', '2fa_verified', '2fa_failed',
        'password_reset_request', 'password_reset_success',
        'ip_blocked', 'ip_trusted', 'session_expired',
        'unauthorized_access', 'permission_denied'
    )),
    event_description TEXT NOT NULL,
    severity TEXT DEFAULT 'info' CHECK (severity IN ('low', 'info', 'warning', 'high', 'critical')),
    
    -- Context information
    ip_address INET,
    user_agent TEXT,
    session_id UUID,
    request_path TEXT,
    request_method TEXT,
    
    -- Security context
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    threat_indicators JSONB DEFAULT '[]',
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_login_sessions_user_id ON admin_login_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_login_sessions_ip_address ON admin_login_sessions(ip_address);
CREATE INDEX IF NOT EXISTS idx_admin_login_sessions_active ON admin_login_sessions(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_login_sessions_session_token ON admin_login_sessions(session_token);

CREATE INDEX IF NOT EXISTS idx_admin_2fa_tokens_user_id ON admin_2fa_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_2fa_tokens_session_id ON admin_2fa_tokens(session_id);
CREATE INDEX IF NOT EXISTS idx_admin_2fa_tokens_expires_at ON admin_2fa_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_2fa_tokens_token_hash ON admin_2fa_tokens(token_hash);

CREATE INDEX IF NOT EXISTS idx_admin_trusted_ips_user_id ON admin_trusted_ips(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_trusted_ips_ip_address ON admin_trusted_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_admin_trusted_ips_active ON admin_trusted_ips(is_active);

CREATE INDEX IF NOT EXISTS idx_admin_security_logs_user_id ON admin_security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_security_logs_event_type ON admin_security_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_admin_security_logs_created_at ON admin_security_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_security_logs_ip_address ON admin_security_logs(ip_address);

-- Enable RLS on new tables
ALTER TABLE admin_login_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_2fa_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_trusted_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_security_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin_login_sessions
CREATE POLICY "Admins can view their own sessions" ON admin_login_sessions
    FOR SELECT USING (
        auth.uid() = user_id OR is_super_admin(auth.uid())
    );

CREATE POLICY "System can manage admin sessions" ON admin_login_sessions
    FOR ALL USING (
        auth.role() = 'service_role' OR is_super_admin(auth.uid())
    );

-- RLS Policies for admin_2fa_tokens
CREATE POLICY "Admins can view their own 2FA tokens" ON admin_2fa_tokens
    FOR SELECT USING (
        auth.uid() = user_id OR is_super_admin(auth.uid())
    );

CREATE POLICY "System can manage 2FA tokens" ON admin_2fa_tokens
    FOR ALL USING (
        auth.role() = 'service_role' OR is_super_admin(auth.uid())
    );

-- RLS Policies for admin_trusted_ips
CREATE POLICY "Admins can view their own trusted IPs" ON admin_trusted_ips
    FOR SELECT USING (
        auth.uid() = user_id OR is_super_admin(auth.uid())
    );

CREATE POLICY "System can manage trusted IPs" ON admin_trusted_ips
    FOR ALL USING (
        auth.role() = 'service_role' OR is_super_admin(auth.uid())
    );

-- RLS Policies for admin_security_logs
CREATE POLICY "Super admins can view all security logs" ON admin_security_logs
    FOR SELECT USING (is_super_admin(auth.uid()));

CREATE POLICY "Admins can view their own security logs" ON admin_security_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert security logs" ON admin_security_logs
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Helper functions for 2FA and security

-- Function to check if IP is trusted for a user
CREATE OR REPLACE FUNCTION is_trusted_ip(user_id UUID, ip_addr INET)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admin_trusted_ips 
        WHERE admin_trusted_ips.user_id = $1 
        AND admin_trusted_ips.ip_address = $2
        AND is_active = TRUE
        AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired tokens and sessions
CREATE OR REPLACE FUNCTION cleanup_expired_admin_security()
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER := 0;
BEGIN
    -- Clean up expired 2FA tokens
    DELETE FROM admin_2fa_tokens WHERE expires_at < NOW();
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    
    -- Clean up expired sessions
    UPDATE admin_login_sessions 
    SET is_active = FALSE 
    WHERE expires_at < NOW() AND is_active = TRUE;
    
    -- Clean up expired trusted IPs
    UPDATE admin_trusted_ips 
    SET is_active = FALSE 
    WHERE expires_at < NOW() AND is_active = TRUE;
    
    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log security events
CREATE OR REPLACE FUNCTION log_admin_security_event(
    p_user_id UUID,
    p_event_type TEXT,
    p_event_description TEXT,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_severity TEXT DEFAULT 'info',
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
    admin_user_id UUID;
BEGIN
    -- Get admin user ID if user is admin
    SELECT id INTO admin_user_id 
    FROM admin_users 
    WHERE user_id = p_user_id AND is_active = TRUE;
    
    -- Insert security log
    INSERT INTO admin_security_logs (
        user_id, admin_user_id, event_type, event_description,
        ip_address, user_agent, severity, metadata
    ) VALUES (
        p_user_id, admin_user_id, p_event_type, p_event_description,
        p_ip_address, p_user_agent, p_severity, p_metadata
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON TABLE admin_login_sessions IS 'Tracks admin login sessions with IP-based security';
COMMENT ON TABLE admin_2fa_tokens IS 'Stores two-factor authentication tokens for admin users';
COMMENT ON TABLE admin_trusted_ips IS 'Manages trusted IP addresses for admin users';
COMMENT ON TABLE admin_security_logs IS 'Comprehensive security event logging for admin access';

COMMENT ON FUNCTION is_trusted_ip IS 'Checks if an IP address is trusted for a specific user';
COMMENT ON FUNCTION cleanup_expired_admin_security IS 'Cleans up expired security tokens and sessions';
COMMENT ON FUNCTION log_admin_security_event IS 'Logs security events for admin users';
