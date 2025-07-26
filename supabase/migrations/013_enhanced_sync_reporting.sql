-- Enhanced BoxHero Sync Reporting System
-- This migration adds comprehensive sync reporting, activity logs, and cache invalidation tracking

-- Create enhanced sync reports table
CREATE TABLE IF NOT EXISTS sync_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_id UUID REFERENCES sync_logs(id) ON DELETE CASCADE,
    sync_type TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('started', 'in_progress', 'completed', 'failed', 'cancelled')),
    
    -- Timing information
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    
    -- Before/After metrics
    before_stats JSONB DEFAULT '{}', -- {products: 0, categories: 0, total_stock: 0}
    after_stats JSONB DEFAULT '{}',  -- {products: 0, categories: 0, total_stock: 0}
    
    -- Detailed sync metrics
    products_added INTEGER DEFAULT 0,
    products_updated INTEGER DEFAULT 0,
    products_removed INTEGER DEFAULT 0,
    categories_added INTEGER DEFAULT 0,
    categories_updated INTEGER DEFAULT 0,
    categories_removed INTEGER DEFAULT 0,
    inventory_adjustments INTEGER DEFAULT 0,
    
    -- Error and warning tracking
    errors_count INTEGER DEFAULT 0,
    warnings_count INTEGER DEFAULT 0,
    errors_details JSONB DEFAULT '[]', -- Array of error objects
    warnings_details JSONB DEFAULT '[]', -- Array of warning objects
    
    -- Performance metrics
    api_calls_made INTEGER DEFAULT 0,
    data_transferred_kb INTEGER DEFAULT 0,
    cache_invalidations INTEGER DEFAULT 0,
    
    -- Metadata
    triggered_by TEXT,
    sync_options JSONB DEFAULT '{}', -- Sync configuration used
    boxhero_api_version TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create activity logs table for admin actions
CREATE TABLE IF NOT EXISTS admin_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL, -- 'sync_triggered', 'product_updated', 'category_modified', etc.
    action_description TEXT NOT NULL,
    
    -- Context information
    resource_type TEXT, -- 'product', 'category', 'sync', 'order', etc.
    resource_id UUID,
    resource_name TEXT,
    
    -- Before/After data for changes
    before_data JSONB,
    after_data JSONB,
    
    -- Request context
    ip_address INET,
    user_agent TEXT,
    session_id TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create cache invalidation logs
CREATE TABLE IF NOT EXISTS cache_invalidation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key TEXT NOT NULL,
    cache_type TEXT NOT NULL, -- 'products', 'categories', 'dashboard_stats', etc.
    invalidation_reason TEXT NOT NULL,
    triggered_by TEXT, -- 'sync', 'admin_action', 'scheduled', etc.
    
    -- Performance tracking
    invalidation_time_ms INTEGER,
    affected_records INTEGER,
    
    -- Context
    sync_report_id UUID REFERENCES sync_reports(id) ON DELETE SET NULL,
    admin_activity_id UUID REFERENCES admin_activity_logs(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create sync performance history for trending analysis
CREATE TABLE IF NOT EXISTS sync_performance_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_report_id UUID REFERENCES sync_reports(id) ON DELETE CASCADE,
    
    -- Performance metrics over time
    total_duration_ms INTEGER NOT NULL,
    api_response_time_avg_ms INTEGER,
    database_write_time_ms INTEGER,
    cache_invalidation_time_ms INTEGER,
    
    -- Data volume metrics
    records_processed INTEGER DEFAULT 0,
    data_size_kb INTEGER DEFAULT 0,
    
    -- Success rates
    success_rate DECIMAL(5,2), -- Percentage
    error_rate DECIMAL(5,2),   -- Percentage
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sync_reports_sync_id ON sync_reports(sync_id);
CREATE INDEX IF NOT EXISTS idx_sync_reports_status ON sync_reports(status);
CREATE INDEX IF NOT EXISTS idx_sync_reports_started_at ON sync_reports(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_reports_sync_type ON sync_reports(sync_type);

CREATE INDEX IF NOT EXISTS idx_activity_logs_admin_user ON admin_activity_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_type ON admin_activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON admin_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_resource ON admin_activity_logs(resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_cache_invalidation_type ON cache_invalidation_logs(cache_type);
CREATE INDEX IF NOT EXISTS idx_cache_invalidation_created_at ON cache_invalidation_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_performance_created_at ON sync_performance_history(created_at DESC);

-- Enable RLS
ALTER TABLE sync_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_invalidation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_performance_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sync_reports
CREATE POLICY "Allow service role full access to sync reports" ON sync_reports
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow authenticated users to read sync reports" ON sync_reports
    FOR SELECT USING (auth.role() = 'authenticated');

-- RLS Policies for admin_activity_logs
CREATE POLICY "Allow service role full access to activity logs" ON admin_activity_logs
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow authenticated users to read activity logs" ON admin_activity_logs
    FOR SELECT USING (auth.role() = 'authenticated');

-- RLS Policies for cache_invalidation_logs
CREATE POLICY "Allow service role full access to cache logs" ON cache_invalidation_logs
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow authenticated users to read cache logs" ON cache_invalidation_logs
    FOR SELECT USING (auth.role() = 'authenticated');

-- RLS Policies for sync_performance_history
CREATE POLICY "Allow service role full access to performance history" ON sync_performance_history
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow authenticated users to read performance history" ON sync_performance_history
    FOR SELECT USING (auth.role() = 'authenticated');

-- Create function to automatically update sync report timestamps
CREATE OR REPLACE FUNCTION update_sync_report_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    
    -- Auto-calculate duration when status changes to completed or failed
    IF NEW.status IN ('completed', 'failed') AND OLD.status NOT IN ('completed', 'failed') THEN
        NEW.completed_at = NOW();
        NEW.duration_ms = EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) * 1000;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for sync reports
CREATE TRIGGER trigger_update_sync_report_timestamp
    BEFORE UPDATE ON sync_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_sync_report_timestamp();

-- Create function to log admin activities automatically
CREATE OR REPLACE FUNCTION log_admin_activity(
    p_admin_user_id UUID,
    p_action_type TEXT,
    p_action_description TEXT,
    p_resource_type TEXT DEFAULT NULL,
    p_resource_id UUID DEFAULT NULL,
    p_resource_name TEXT DEFAULT NULL,
    p_before_data JSONB DEFAULT NULL,
    p_after_data JSONB DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    activity_id UUID;
BEGIN
    INSERT INTO admin_activity_logs (
        admin_user_id,
        action_type,
        action_description,
        resource_type,
        resource_id,
        resource_name,
        before_data,
        after_data,
        metadata
    ) VALUES (
        p_admin_user_id,
        p_action_type,
        p_action_description,
        p_resource_type,
        p_resource_id,
        p_resource_name,
        p_before_data,
        p_after_data,
        p_metadata
    ) RETURNING id INTO activity_id;
    
    RETURN activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to log cache invalidations
CREATE OR REPLACE FUNCTION log_cache_invalidation(
    p_cache_key TEXT,
    p_cache_type TEXT,
    p_invalidation_reason TEXT,
    p_triggered_by TEXT DEFAULT 'unknown',
    p_sync_report_id UUID DEFAULT NULL,
    p_admin_activity_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO cache_invalidation_logs (
        cache_key,
        cache_type,
        invalidation_reason,
        triggered_by,
        sync_report_id,
        admin_activity_id
    ) VALUES (
        p_cache_key,
        p_cache_type,
        p_invalidation_reason,
        p_triggered_by,
        p_sync_report_id,
        p_admin_activity_id
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
