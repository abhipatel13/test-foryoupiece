-- Create categories table for storing BoxHero categories locally
-- This replaces real-time API calls with locally stored data

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    emoji TEXT DEFAULT '📦',
    item_count INTEGER DEFAULT 0,
    description TEXT,
    source TEXT DEFAULT 'boxhero',
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);

-- Create sync_logs table to track BoxHero sync operations
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

-- Create index for sync logs
CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON sync_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs(status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_categories_updated_at 
    BEFORE UPDATE ON categories 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default categories (fallback data)
INSERT INTO categories (name, slug, emoji, item_count, description, source, sort_order) VALUES
    ('Hair', 'hair', '💇', 0, 'Hair care products including shampoos, treatments, and styling products', 'default', 1),
    ('Bath & Body', 'bath-body', '🛁', 0, 'Bath and body care products including soaps, lotions, and cleansers', 'default', 2),
    ('Skincare', 'skincare', '✨', 0, 'Skincare products including creams, serums, and treatments', 'default', 3),
    ('Makeup', 'makeup', '💄', 0, 'Cosmetics and makeup products', 'default', 4),
    ('Health & Personal Care', 'health-personal-care', '🏥', 0, 'Health supplements and personal care items', 'default', 5),
    ('Food & Beverage', 'food-beverage', '🍽️', 0, 'Food and beverage products', 'default', 6),
    ('Home', 'home', '🏠', 0, 'Home and household products', 'default', 7)
ON CONFLICT (slug) DO NOTHING;

-- RLS Policies for categories table
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active categories
CREATE POLICY "Allow public read access to active categories" ON categories
    FOR SELECT USING (is_active = true);

-- Allow authenticated users to read all categories
CREATE POLICY "Allow authenticated read access to categories" ON categories
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow service role full access for sync operations
CREATE POLICY "Allow service role full access to categories" ON categories
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for sync_logs table
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read sync logs
CREATE POLICY "Allow authenticated read access to sync logs" ON sync_logs
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow service role full access for sync operations
CREATE POLICY "Allow service role full access to sync logs" ON sync_logs
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Grant necessary permissions
GRANT SELECT ON categories TO anon;
GRANT SELECT ON categories TO authenticated;
GRANT ALL ON categories TO service_role;

GRANT SELECT ON sync_logs TO authenticated;
GRANT ALL ON sync_logs TO service_role;
