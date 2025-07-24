-- Create sync_logs table to track BoxHero sync operations
-- This table is needed for the manual sync functionality to work

CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sync_type TEXT NOT NULL DEFAULT 'boxhero_categories',
    status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
    categories_synced INTEGER DEFAULT 0,
    total_items_processed INTEGER DEFAULT 0,
    error_message TEXT,
    sync_duration_ms INTEGER,
    triggered_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON sync_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs(status);

-- Enable RLS for security
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read sync logs
CREATE POLICY "Allow authenticated read access to sync logs" ON sync_logs
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow service role to manage sync logs
CREATE POLICY "Allow service role to manage sync logs" ON sync_logs
    FOR ALL USING (auth.role() = 'service_role');
