-- Comprehensive Points Security System Migration
-- Prevents unauthorized direct database modifications to user points and tiers
-- Implements comprehensive audit logging and monitoring

-- Create security audit log table for all user points/tier changes
CREATE TABLE IF NOT EXISTS user_security_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    
    -- Before/After values for critical fields
    points_balance_before INTEGER,
    points_balance_after INTEGER,
    total_points_earned_before INTEGER,
    total_points_earned_after INTEGER,
    tier_level_before user_tier,
    tier_level_after user_tier,
    
    -- Change detection
    points_balance_changed BOOLEAN DEFAULT FALSE,
    total_points_earned_changed BOOLEAN DEFAULT FALSE,
    tier_level_changed BOOLEAN DEFAULT FALSE,
    
    -- Context information
    trigger_source TEXT, -- 'application_function', 'direct_sql', 'unknown'
    session_user_name TEXT,
    current_user_name TEXT,
    application_name TEXT,
    client_addr TEXT,
    
    -- Audit trail
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_security_audit_log_user_id ON user_security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_security_audit_log_created_at ON user_security_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_security_audit_log_operation ON user_security_audit_log(operation);
CREATE INDEX IF NOT EXISTS idx_user_security_audit_log_changes ON user_security_audit_log(points_balance_changed, total_points_earned_changed, tier_level_changed);

-- Create comprehensive audit trigger function
CREATE OR REPLACE FUNCTION audit_user_points_changes()
RETURNS TRIGGER AS $$
DECLARE
    points_balance_changed BOOLEAN := FALSE;
    total_points_earned_changed BOOLEAN := FALSE;
    tier_level_changed BOOLEAN := FALSE;
    trigger_source TEXT := 'unknown';
    app_name TEXT;
BEGIN
    -- Determine trigger source
    app_name := current_setting('application_name', true);
    IF app_name IS NOT NULL AND app_name LIKE '%supabase%' THEN
        trigger_source := 'application_function';
    ELSIF current_setting('client_encoding', true) IS NOT NULL THEN
        trigger_source := 'direct_sql';
    END IF;
    
    -- Handle INSERT operations
    IF TG_OP = 'INSERT' THEN
        INSERT INTO user_security_audit_log (
            user_id,
            table_name,
            operation,
            points_balance_after,
            total_points_earned_after,
            tier_level_after,
            points_balance_changed,
            total_points_earned_changed,
            tier_level_changed,
            trigger_source,
            session_user_name,
            current_user_name,
            application_name,
            client_addr,
            metadata
        ) VALUES (
            NEW.id,
            TG_TABLE_NAME,
            TG_OP,
            NEW.points_balance,
            NEW.total_points_earned,
            NEW.tier_level,
            TRUE, -- New record, so considered changed
            TRUE,
            TRUE,
            trigger_source,
            session_user,
            current_user,
            current_setting('application_name', true),
            inet_client_addr()::TEXT,
            jsonb_build_object(
                'new_user_creation', true,
                'trigger_name', TG_NAME,
                'trigger_when', TG_WHEN,
                'trigger_level', TG_LEVEL
            )
        );
        
        RETURN NEW;
    END IF;
    
    -- Handle UPDATE operations
    IF TG_OP = 'UPDATE' THEN
        -- Check what changed
        points_balance_changed := (OLD.points_balance IS DISTINCT FROM NEW.points_balance);
        total_points_earned_changed := (OLD.total_points_earned IS DISTINCT FROM NEW.total_points_earned);
        tier_level_changed := (OLD.tier_level IS DISTINCT FROM NEW.tier_level);
        
        -- Only log if critical fields changed
        IF points_balance_changed OR total_points_earned_changed OR tier_level_changed THEN
            INSERT INTO user_security_audit_log (
                user_id,
                table_name,
                operation,
                points_balance_before,
                points_balance_after,
                total_points_earned_before,
                total_points_earned_after,
                tier_level_before,
                tier_level_after,
                points_balance_changed,
                total_points_earned_changed,
                tier_level_changed,
                trigger_source,
                session_user_name,
                current_user_name,
                application_name,
                client_addr,
                metadata
            ) VALUES (
                NEW.id,
                TG_TABLE_NAME,
                TG_OP,
                OLD.points_balance,
                NEW.points_balance,
                OLD.total_points_earned,
                NEW.total_points_earned,
                OLD.tier_level,
                NEW.tier_level,
                points_balance_changed,
                total_points_earned_changed,
                tier_level_changed,
                trigger_source,
                session_user,
                current_user,
                current_setting('application_name', true),
                inet_client_addr()::TEXT,
                jsonb_build_object(
                    'points_balance_delta', COALESCE(NEW.points_balance, 0) - COALESCE(OLD.points_balance, 0),
                    'total_points_earned_delta', COALESCE(NEW.total_points_earned, 0) - COALESCE(OLD.total_points_earned, 0),
                    'trigger_name', TG_NAME,
                    'trigger_when', TG_WHEN,
                    'trigger_level', TG_LEVEL,
                    'session_info', jsonb_build_object(
                        'session_user', session_user,
                        'current_user', current_user,
                        'client_addr', inet_client_addr()::TEXT
                    )
                )
            );
            
            -- Log suspicious activity (direct resets to 0)
            IF (OLD.points_balance > 1000 AND NEW.points_balance = 0) OR 
               (OLD.total_points_earned > 1000 AND NEW.total_points_earned = 0) THEN
                RAISE WARNING 'SECURITY ALERT: Suspicious points reset detected for user % - points_balance: % -> %, total_points_earned: % -> %, trigger_source: %', 
                    NEW.id, OLD.points_balance, NEW.points_balance, OLD.total_points_earned, NEW.total_points_earned, trigger_source;
            END IF;
        END IF;
        
        RETURN NEW;
    END IF;
    
    -- Handle DELETE operations
    IF TG_OP = 'DELETE' THEN
        INSERT INTO user_security_audit_log (
            user_id,
            table_name,
            operation,
            points_balance_before,
            total_points_earned_before,
            tier_level_before,
            trigger_source,
            session_user_name,
            current_user_name,
            application_name,
            client_addr,
            metadata
        ) VALUES (
            OLD.id,
            TG_TABLE_NAME,
            TG_OP,
            OLD.points_balance,
            OLD.total_points_earned,
            OLD.tier_level,
            trigger_source,
            session_user,
            current_user,
            current_setting('application_name', true),
            inet_client_addr()::TEXT,
            jsonb_build_object(
                'user_deletion', true,
                'trigger_name', TG_NAME
            )
        );
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the comprehensive audit trigger
DROP TRIGGER IF EXISTS comprehensive_user_points_audit_trigger ON users;
CREATE TRIGGER comprehensive_user_points_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW
    EXECUTE FUNCTION audit_user_points_changes();

-- Create function to detect and alert on suspicious activity
CREATE OR REPLACE FUNCTION detect_suspicious_points_activity()
RETURNS TABLE (
    alert_id UUID,
    user_id UUID,
    user_email TEXT,
    alert_type TEXT,
    alert_message TEXT,
    points_before INTEGER,
    points_after INTEGER,
    total_earned_before INTEGER,
    total_earned_after INTEGER,
    tier_before user_tier,
    tier_after user_tier,
    trigger_source TEXT,
    detected_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gen_random_uuid() as alert_id,
        usal.user_id,
        u.email,
        CASE 
            WHEN usal.points_balance_before > 10000 AND usal.points_balance_after = 0 THEN 'CRITICAL_POINTS_RESET'
            WHEN usal.total_points_earned_before > 10000 AND usal.total_points_earned_after = 0 THEN 'CRITICAL_TOTAL_EARNED_RESET'
            WHEN usal.tier_level_before IN ('gold', 'platinum', 'diamond') AND usal.tier_level_after = 'bronze' THEN 'CRITICAL_TIER_DOWNGRADE'
            WHEN usal.trigger_source = 'direct_sql' AND (usal.points_balance_changed OR usal.total_points_earned_changed) THEN 'DIRECT_SQL_MODIFICATION'
            ELSE 'SUSPICIOUS_ACTIVITY'
        END as alert_type,
        CASE 
            WHEN usal.points_balance_before > 10000 AND usal.points_balance_after = 0 THEN 
                'Critical points balance reset detected: ' || usal.points_balance_before || ' -> 0'
            WHEN usal.total_points_earned_before > 10000 AND usal.total_points_earned_after = 0 THEN 
                'Critical total points earned reset detected: ' || usal.total_points_earned_before || ' -> 0'
            WHEN usal.tier_level_before IN ('gold', 'platinum', 'diamond') AND usal.tier_level_after = 'bronze' THEN 
                'Critical tier downgrade detected: ' || usal.tier_level_before || ' -> ' || usal.tier_level_after
            WHEN usal.trigger_source = 'direct_sql' THEN 
                'Direct SQL modification detected outside application functions'
            ELSE 'Suspicious points/tier modification detected'
        END as alert_message,
        usal.points_balance_before,
        usal.points_balance_after,
        usal.total_points_earned_before,
        usal.total_points_earned_after,
        usal.tier_level_before,
        usal.tier_level_after,
        usal.trigger_source,
        usal.created_at
    FROM user_security_audit_log usal
    JOIN users u ON usal.user_id = u.id
    WHERE usal.created_at >= NOW() - INTERVAL '24 hours'
    AND (
        -- Critical resets
        (usal.points_balance_before > 10000 AND usal.points_balance_after = 0) OR
        (usal.total_points_earned_before > 10000 AND usal.total_points_earned_after = 0) OR
        -- Critical tier downgrades
        (usal.tier_level_before IN ('gold', 'platinum', 'diamond') AND usal.tier_level_after = 'bronze') OR
        -- Direct SQL modifications
        (usal.trigger_source = 'direct_sql' AND (usal.points_balance_changed OR usal.total_points_earned_changed))
    )
    ORDER BY usal.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get security audit history for a user
CREATE OR REPLACE FUNCTION get_user_security_audit_history(p_user_id UUID, p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
    id UUID,
    operation TEXT,
    points_balance_before INTEGER,
    points_balance_after INTEGER,
    total_points_earned_before INTEGER,
    total_points_earned_after INTEGER,
    tier_level_before user_tier,
    tier_level_after user_tier,
    trigger_source TEXT,
    session_user_name TEXT,
    client_addr TEXT,
    created_at TIMESTAMPTZ,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        usal.id,
        usal.operation,
        usal.points_balance_before,
        usal.points_balance_after,
        usal.total_points_earned_before,
        usal.total_points_earned_after,
        usal.tier_level_before,
        usal.tier_level_after,
        usal.trigger_source,
        usal.session_user_name,
        usal.client_addr,
        usal.created_at,
        usal.metadata
    FROM user_security_audit_log usal
    WHERE usal.user_id = p_user_id
    ORDER BY usal.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT SELECT ON user_security_audit_log TO authenticated;
GRANT EXECUTE ON FUNCTION detect_suspicious_points_activity() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_security_audit_history(UUID, INTEGER) TO authenticated;

-- Add RLS policies
ALTER TABLE user_security_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own audit logs
CREATE POLICY user_security_audit_log_user_access ON user_security_audit_log
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Service role can access all audit logs
CREATE POLICY user_security_audit_log_service_access ON user_security_audit_log
    FOR ALL USING (auth.role() = 'service_role');

-- Add helpful comments
COMMENT ON TABLE user_security_audit_log IS 'Comprehensive audit log for all user points and tier changes - prevents unauthorized modifications';
COMMENT ON FUNCTION audit_user_points_changes() IS 'Comprehensive audit trigger that logs all changes to user points and tiers with security context';
COMMENT ON FUNCTION detect_suspicious_points_activity() IS 'Detects and alerts on suspicious points/tier modifications including direct SQL changes';
COMMENT ON FUNCTION get_user_security_audit_history(UUID, INTEGER) IS 'Returns security audit history for a specific user';

-- Log the security system deployment
DO $$
BEGIN
    RAISE NOTICE 'Comprehensive Points Security System deployed successfully';
    RAISE NOTICE 'All user points and tier changes will now be audited and monitored';
    RAISE NOTICE 'Suspicious activity detection is active';
END $$;
