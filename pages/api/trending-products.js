import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { method } = req;

  try {
    switch (method) {
      case 'GET':
        return await getTrendingProducts(req, res);
      case 'POST':
        return await refreshTrendingProducts(req, res);
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: `Method ${method} Not Allowed` });
    }
  } catch (error) {
    console.error('Trending products API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

async function getTrendingProducts(req, res) {
  try {
    const { limit = 10, include_stats = false } = req.query;

    // Get trending products using the database function
    const { data: trendingProducts, error } = await supabase
      .rpc('get_trending_products')
      .limit(parseInt(limit));

    if (error) {
      console.error('Error fetching trending products:', error);
      return res.status(500).json({ error: 'Failed to fetch trending products' });
    }

    // If include_stats is requested, also get system settings and refresh log
    let systemStats = null;
    if (include_stats === 'true') {
      const { data: settings } = await supabase
        .from('trending_system_settings')
        .select('setting_key, setting_value, description');

      const { data: lastRefresh } = await supabase
        .from('trending_refresh_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      systemStats = {
        settings: settings || [],
        lastRefresh: lastRefresh?.[0] || null
      };
    }

    return res.status(200).json({
      success: true,
      products: trendingProducts || [],
      count: trendingProducts?.length || 0,
      stats: systemStats
    });

  } catch (error) {
    console.error('Error in getTrendingProducts:', error);
    return res.status(500).json({ error: 'Failed to get trending products' });
  }
}

async function refreshTrendingProducts(req, res) {
  try {
    const { refresh_type = 'manual', user_id = null } = req.body;

    // Validate refresh_type
    const validRefreshTypes = ['manual', 'scheduled', 'conditional'];
    if (!validRefreshTypes.includes(refresh_type)) {
      return res.status(400).json({ 
        error: 'Invalid refresh_type. Must be one of: manual, scheduled, conditional' 
      });
    }

    // Check if algorithm is enabled
    const { data: algorithmSetting } = await supabase
      .from('trending_system_settings')
      .select('setting_value')
      .eq('setting_key', 'algorithm_enabled')
      .single();

    if (algorithmSetting?.setting_value !== true) {
      return res.status(400).json({ 
        error: 'Algorithm-based trending products is currently disabled' 
      });
    }

    // Run the refresh function with fallback logic
    const { data: refreshResult, error } = await supabase
      .rpc('refresh_trending_products_with_fallback');

    if (error) {
      console.error('Error refreshing trending products:', error);
      return res.status(500).json({ error: 'Failed to refresh trending products' });
    }

    // Log the refresh
    const { error: logError } = await supabase
      .from('trending_refresh_log')
      .insert({
        refresh_type,
        products_changed: refreshResult || 0,
        total_products: refreshResult || 0,
        refresh_reason: `${refresh_type} refresh triggered`,
        created_by: user_id
      });

    if (logError) {
      console.error('Error logging refresh:', logError);
    }

    // Get the updated trending products
    const { data: updatedProducts } = await supabase
      .rpc('get_trending_products');

    return res.status(200).json({
      success: true,
      message: 'Trending products refreshed successfully',
      products_changed: refreshResult || 0,
      products: updatedProducts || []
    });

  } catch (error) {
    console.error('Error in refreshTrendingProducts:', error);
    return res.status(500).json({ error: 'Failed to refresh trending products' });
  }
}
