import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { method } = req;

  try {
    // Basic admin authentication check (you can enhance this)
    const { authorization } = req.headers;
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    switch (method) {
      case 'GET':
        return await getAdminTrendingProducts(req, res);
      case 'POST':
        return await addManualTrendingProduct(req, res);
      case 'PUT':
        return await updateTrendingProduct(req, res);
      case 'DELETE':
        return await removeTrendingProduct(req, res);
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({ error: `Method ${method} Not Allowed` });
    }
  } catch (error) {
    console.error('Admin trending products API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

async function getAdminTrendingProducts(req, res) {
  try {
    // Get all trending products with detailed information
    const { data: trendingProducts, error } = await supabase
      .rpc('get_trending_products');

    if (error) {
      console.error('Error fetching admin trending products:', error);
      return res.status(500).json({ error: 'Failed to fetch trending products' });
    }

    // Get system settings
    const { data: settings } = await supabase
      .from('trending_system_settings')
      .select('setting_key, setting_value, description, updated_at');

    // Get refresh history
    const { data: refreshHistory } = await supabase
      .from('trending_refresh_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    // Get product sales stats for analysis
    const { data: salesStats } = await supabase
      .from('product_sales_stats')
      .select(`
        product_id,
        total_sales_count,
        last_30_days_sales,
        last_7_days_sales,
        trending_score,
        products!inner(name_en, sku, is_active)
      `)
      .order('trending_score', { ascending: false })
      .limit(20);

    return res.status(200).json({
      success: true,
      trending_products: trendingProducts || [],
      settings: settings || [],
      refresh_history: refreshHistory || [],
      top_products_by_score: salesStats || []
    });

  } catch (error) {
    console.error('Error in getAdminTrendingProducts:', error);
    return res.status(500).json({ error: 'Failed to get admin trending products' });
  }
}

async function addManualTrendingProduct(req, res) {
  try {
    const { product_id, position, user_id } = req.body;

    if (!product_id || !position) {
      return res.status(400).json({ 
        error: 'product_id and position are required' 
      });
    }

    // Check if product exists and is active
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name_en, is_active, stock_quantity')
      .eq('id', product_id)
      .single();

    if (productError || !product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (!product.is_active) {
      return res.status(400).json({ error: 'Cannot add inactive product to trending' });
    }

    // Check if product is already in trending
    const { data: existingTrending } = await supabase
      .from('trending_products')
      .select('id')
      .eq('product_id', product_id)
      .eq('is_active', true);

    if (existingTrending && existingTrending.length > 0) {
      return res.status(400).json({ error: 'Product is already in trending products' });
    }

    // Insert the manual trending product
    const { data: newTrending, error: insertError } = await supabase
      .from('trending_products')
      .insert({
        product_id,
        selection_type: 'manual',
        position: parseInt(position),
        created_by: user_id
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error adding manual trending product:', insertError);
      return res.status(500).json({ error: 'Failed to add trending product' });
    }

    return res.status(201).json({
      success: true,
      message: 'Product added to trending successfully',
      trending_product: newTrending
    });

  } catch (error) {
    console.error('Error in addManualTrendingProduct:', error);
    return res.status(500).json({ error: 'Failed to add manual trending product' });
  }
}

async function updateTrendingProduct(req, res) {
  try {
    const { trending_id, position, is_active } = req.body;

    if (!trending_id) {
      return res.status(400).json({ error: 'trending_id is required' });
    }

    const updateData = {};
    if (position !== undefined) updateData.position = parseInt(position);
    if (is_active !== undefined) updateData.is_active = is_active;
    updateData.updated_at = new Date().toISOString();

    const { data: updatedTrending, error } = await supabase
      .from('trending_products')
      .update(updateData)
      .eq('id', trending_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating trending product:', error);
      return res.status(500).json({ error: 'Failed to update trending product' });
    }

    return res.status(200).json({
      success: true,
      message: 'Trending product updated successfully',
      trending_product: updatedTrending
    });

  } catch (error) {
    console.error('Error in updateTrendingProduct:', error);
    return res.status(500).json({ error: 'Failed to update trending product' });
  }
}

async function removeTrendingProduct(req, res) {
  try {
    const { trending_id } = req.query;

    if (!trending_id) {
      return res.status(400).json({ error: 'trending_id is required' });
    }

    const { error } = await supabase
      .from('trending_products')
      .delete()
      .eq('id', trending_id);

    if (error) {
      console.error('Error removing trending product:', error);
      return res.status(500).json({ error: 'Failed to remove trending product' });
    }

    return res.status(200).json({
      success: true,
      message: 'Trending product removed successfully'
    });

  } catch (error) {
    console.error('Error in removeTrendingProduct:', error);
    return res.status(500).json({ error: 'Failed to remove trending product' });
  }
}
