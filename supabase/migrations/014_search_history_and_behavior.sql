-- Enhanced Search History and User Behavior Tracking System
-- This migration adds comprehensive search history, user behavior tracking, and search analytics

-- Create user_search_history table for storing search queries
CREATE TABLE IF NOT EXISTS user_search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    search_query TEXT NOT NULL,
    search_category TEXT, -- Category filter applied during search
    results_count INTEGER DEFAULT 0,
    clicked_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    search_source TEXT DEFAULT 'header' CHECK (search_source IN ('header', 'mobile', 'category_page', 'home_page')),
    
    -- Metadata
    user_agent TEXT,
    ip_address INET,
    session_id TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_search_history_user_id ON user_search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_search_history_created_at ON user_search_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_search_history_query ON user_search_history(search_query);
CREATE INDEX IF NOT EXISTS idx_user_search_history_user_recent ON user_search_history(user_id, created_at DESC);

-- Create user_behavior_tracking table for comprehensive behavior analytics
CREATE TABLE IF NOT EXISTS user_behavior_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    
    -- Behavior type and data
    behavior_type TEXT NOT NULL CHECK (behavior_type IN (
        'search', 'product_view', 'category_view', 'cart_add', 'cart_remove', 
        'wishlist_add', 'wishlist_remove', 'purchase', 'page_view'
    )),
    
    -- Related entities
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    search_query TEXT,
    
    -- Behavior metadata
    behavior_data JSONB DEFAULT '{}', -- Flexible data storage
    duration_seconds INTEGER, -- Time spent on page/action
    referrer_url TEXT,
    page_url TEXT,
    
    -- Technical metadata
    user_agent TEXT,
    ip_address INET,
    device_type TEXT CHECK (device_type IN ('desktop', 'mobile', 'tablet')),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for behavior tracking
CREATE INDEX IF NOT EXISTS idx_user_behavior_tracking_user_id ON user_behavior_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_user_behavior_tracking_type ON user_behavior_tracking(behavior_type);
CREATE INDEX IF NOT EXISTS idx_user_behavior_tracking_created_at ON user_behavior_tracking(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_behavior_tracking_product ON user_behavior_tracking(product_id);
CREATE INDEX IF NOT EXISTS idx_user_behavior_tracking_session ON user_behavior_tracking(session_id);

-- Create search_suggestions table for popular search terms and autocomplete
CREATE TABLE IF NOT EXISTS search_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suggestion_text TEXT NOT NULL UNIQUE,
    suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('product', 'category', 'brand', 'popular')),
    
    -- Related entities
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    
    -- Popularity metrics
    search_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    conversion_count INTEGER DEFAULT 0, -- How many searches led to purchases
    
    -- Suggestion metadata
    priority_score DECIMAL(10,4) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for search suggestions
CREATE INDEX IF NOT EXISTS idx_search_suggestions_text ON search_suggestions(suggestion_text);
CREATE INDEX IF NOT EXISTS idx_search_suggestions_type ON search_suggestions(suggestion_type);
CREATE INDEX IF NOT EXISTS idx_search_suggestions_priority ON search_suggestions(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_search_suggestions_active ON search_suggestions(is_active);

-- Create search_analytics table for aggregated search metrics
CREATE TABLE IF NOT EXISTS search_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    
    -- Search volume metrics
    total_searches INTEGER DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    unique_queries INTEGER DEFAULT 0,
    
    -- Popular searches (top 10 for the day)
    top_queries JSONB DEFAULT '[]', -- Array of {query, count, conversions}
    top_categories JSONB DEFAULT '[]', -- Array of {category, count}
    
    -- Conversion metrics
    searches_with_clicks INTEGER DEFAULT 0,
    searches_with_purchases INTEGER DEFAULT 0,
    average_results_per_search DECIMAL(10,2) DEFAULT 0,
    
    -- Performance metrics
    average_search_time_ms INTEGER DEFAULT 0,
    zero_result_searches INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(date)
);

-- Create index for search analytics
CREATE INDEX IF NOT EXISTS idx_search_analytics_date ON search_analytics(date DESC);

-- Create function to update search suggestions based on search history
CREATE OR REPLACE FUNCTION update_search_suggestions()
RETURNS TRIGGER AS $$
BEGIN
    -- Update or insert search suggestion
    INSERT INTO search_suggestions (suggestion_text, suggestion_type, search_count, updated_at)
    VALUES (NEW.search_query, 'popular', 1, NOW())
    ON CONFLICT (suggestion_text) 
    DO UPDATE SET 
        search_count = search_suggestions.search_count + 1,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update search suggestions
DROP TRIGGER IF EXISTS trigger_update_search_suggestions ON user_search_history;
CREATE TRIGGER trigger_update_search_suggestions
    AFTER INSERT ON user_search_history
    FOR EACH ROW
    EXECUTE FUNCTION update_search_suggestions();

-- Create function to clean old search history (keep only last 5 per user)
CREATE OR REPLACE FUNCTION cleanup_user_search_history()
RETURNS TRIGGER AS $$
BEGIN
    -- Keep only the 5 most recent searches per user
    DELETE FROM user_search_history 
    WHERE user_id = NEW.user_id 
    AND id NOT IN (
        SELECT id FROM user_search_history 
        WHERE user_id = NEW.user_id 
        ORDER BY created_at DESC 
        LIMIT 5
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically cleanup old search history
DROP TRIGGER IF EXISTS trigger_cleanup_search_history ON user_search_history;
CREATE TRIGGER trigger_cleanup_search_history
    AFTER INSERT ON user_search_history
    FOR EACH ROW
    EXECUTE FUNCTION cleanup_user_search_history();

-- Create RLS policies for search history (users can only see their own data)
ALTER TABLE user_search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_behavior_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_analytics ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_search_history
CREATE POLICY "Users can view their own search history" ON user_search_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own search history" ON user_search_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own search history" ON user_search_history
    FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for user_behavior_tracking
CREATE POLICY "Users can view their own behavior data" ON user_behavior_tracking
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own behavior data" ON user_behavior_tracking
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS policies for search_suggestions (read-only for users)
CREATE POLICY "Anyone can view active search suggestions" ON search_suggestions
    FOR SELECT USING (is_active = true);

-- RLS policies for search_analytics (read-only for authenticated users)
CREATE POLICY "Authenticated users can view search analytics" ON search_analytics
    FOR SELECT USING (auth.role() = 'authenticated');

-- Insert initial search suggestions based on existing products
INSERT INTO search_suggestions (suggestion_text, suggestion_type, product_id, priority_score)
SELECT DISTINCT 
    name_en as suggestion_text,
    'product' as suggestion_type,
    id as product_id,
    CASE 
        WHEN is_featured THEN 10.0
        WHEN stock_quantity > 10 THEN 5.0
        ELSE 1.0
    END as priority_score
FROM products 
WHERE is_active = true 
AND name_en IS NOT NULL 
AND LENGTH(name_en) > 2
ON CONFLICT (suggestion_text) DO NOTHING;

-- Insert category-based suggestions
INSERT INTO search_suggestions (suggestion_text, suggestion_type, category_id, priority_score)
SELECT DISTINCT 
    name_en as suggestion_text,
    'category' as suggestion_type,
    id as category_id,
    8.0 as priority_score
FROM categories 
WHERE name_en IS NOT NULL
ON CONFLICT (suggestion_text) DO NOTHING;

-- Insert brand-based suggestions
INSERT INTO search_suggestions (suggestion_text, suggestion_type, priority_score)
SELECT DISTINCT 
    brand as suggestion_text,
    'brand' as suggestion_type,
    6.0 as priority_score
FROM products 
WHERE brand IS NOT NULL 
AND LENGTH(brand) > 1
AND is_active = true
ON CONFLICT (suggestion_text) DO NOTHING;

-- Create function to get user's recent search history
CREATE OR REPLACE FUNCTION get_user_search_history(p_user_id UUID, p_limit INTEGER DEFAULT 5)
RETURNS TABLE (
    id UUID,
    search_query TEXT,
    search_category TEXT,
    results_count INTEGER,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ush.id,
        ush.search_query,
        ush.search_category,
        ush.results_count,
        ush.created_at
    FROM user_search_history ush
    WHERE ush.user_id = p_user_id
    ORDER BY ush.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get search suggestions
CREATE OR REPLACE FUNCTION get_search_suggestions(p_query TEXT DEFAULT '', p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    suggestion_text TEXT,
    suggestion_type TEXT,
    priority_score DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ss.suggestion_text,
        ss.suggestion_type,
        ss.priority_score
    FROM search_suggestions ss
    WHERE ss.is_active = true
    AND (p_query = '' OR ss.suggestion_text ILIKE '%' || p_query || '%')
    ORDER BY ss.priority_score DESC, ss.search_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON user_search_history TO authenticated;
GRANT ALL ON user_behavior_tracking TO authenticated;
GRANT SELECT ON search_suggestions TO authenticated;
GRANT SELECT ON search_analytics TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_user_search_history(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_search_suggestions(TEXT, INTEGER) TO authenticated;

COMMENT ON TABLE user_search_history IS 'Stores user search queries with metadata for personalization and analytics';
COMMENT ON TABLE user_behavior_tracking IS 'Comprehensive user behavior tracking for recommendation engine';
COMMENT ON TABLE search_suggestions IS 'Search autocomplete suggestions based on products, categories, and popular searches';
COMMENT ON TABLE search_analytics IS 'Aggregated search metrics and analytics data';
