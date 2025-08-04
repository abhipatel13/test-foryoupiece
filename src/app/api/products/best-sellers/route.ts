import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * Best Sellers API Endpoint
 * GET /api/products/best-sellers
 * 
 * Query Parameters:
 * - limit: number of products to return (default: 6 for homepage, max: 100)
 * - page: page number for pagination (default: 1)
 * - top_tier_only: boolean to return only top 10 ranked products (default: false)
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🏆 Best Sellers API called - TIMESTAMP:', new Date().toISOString());

    const url = new URL(request.url);
    const searchParams = url.searchParams;
    
    // Parse query parameters
    const limit = Math.min(
      searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 6,
      100 // Maximum limit to prevent abuse
    );
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1;
    const offset = (page - 1) * limit;
    const topTierOnly = searchParams.get('top_tier_only') === 'true';

    console.log('🏆 Best Sellers Query params:', { limit, page, offset, topTierOnly });

    // Use Supabase service role client (bypasses RLS)
    const supabase = createServiceRoleClient();

    // Build the query for best seller products
    let query = supabase
      .from('products')
      .select(`
        id,
        sku,
        name_en,
        name_ja,
        description_en,
        description_ja,
        price,
        compare_at_price,
        images,
        brand,
        stock_quantity,
        is_featured,
        is_best_seller,
        best_seller_position,
        created_at,
        updated_at,
        category_id,
        categories!inner(
          id,
          name_en,
          name_ja,
          slug
        )
      `, { count: 'exact' })
      .eq('is_active', true)
      .eq('is_best_seller', true)
      .not('best_seller_position', 'is', null);

    // Apply top tier filter if requested (positions 1-10)
    if (topTierOnly) {
      query = query.gte('best_seller_position', 1).lte('best_seller_position', 10);
    }

    // Order by best seller position (lowest numbers first = highest ranking)
    query = query.order('best_seller_position', { ascending: true });

    // Apply pagination
    const { data: products, error, count } = await query
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('❌ Error fetching best sellers:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    console.log(`✅ Best Sellers API: Found ${products?.length || 0} products (total: ${count})`);

    // Transform the data to match the expected format
    const transformedProducts = products?.map(product => ({
      id: product.id,
      sku: product.sku,
      name_en: product.name_en,
      name_ja: product.name_ja,
      description_en: product.description_en,
      description_ja: product.description_ja,
      price: product.price,
      compare_at_price: product.compare_at_price,
      images: product.images || [],
      brand: product.brand,
      stock_quantity: product.stock_quantity,
      is_featured: product.is_featured,
      is_best_seller: product.is_best_seller,
      best_seller_position: product.best_seller_position,
      created_at: product.created_at,
      updated_at: product.updated_at,
      category: product.categories ? {
        id: product.categories.id,
        name_en: product.categories.name_en,
        name_ja: product.categories.name_ja,
        slug: product.categories.slug
      } : null,
      // Add stock status for display
      stock_status: product.stock_quantity > 0 ? 'in_stock' : 'out_of_stock'
    })) || [];

    return NextResponse.json({
      success: true,
      data: transformedProducts,
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
        hasNext: offset + limit < (count || 0),
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('❌ Unexpected error in Best Sellers API:', error);
    return NextResponse.json({
      success: false,
      error: 'An unexpected error occurred while fetching best sellers'
    }, { status: 500 });
  }
}
