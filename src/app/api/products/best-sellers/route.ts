import { NextRequest, NextResponse } from 'next/server'
import { createAnonymousClient } from '@/lib/supabase/server'

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

    // SECURITY FIX: Use anonymous client instead of service role to ensure RLS applies
    const supabase = createAnonymousClient();

    // Helper to build query with flexible category columns (supports legacy schema)
    const buildQuery = (useLegacyCategoryName = false) => {
      const categorySelect = useLegacyCategoryName
        ? `categories!inner(id, name, slug)`
        : `categories!inner(id, name_en, name_ja, slug)`

      return supabase
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
          points_rate,
          images,
          brand,
          stock_quantity,
          is_featured,
          is_best_seller,
          best_seller_position,
          created_at,
          updated_at,
          category_id,
          ${categorySelect}
        `, { count: 'exact' })
        .eq('is_active', true)
        .eq('is_best_seller', true)
        .not('best_seller_position', 'is', null)
        .order('best_seller_position', { ascending: true })
    }

    // First, get counts for in-stock and out-of-stock best sellers
    const countBase = supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('is_best_seller', true)
      .not('best_seller_position', 'is', null)

    const [{ count: inCount, error: inErr }, { count: outCount, error: outErr }] = await Promise.all([
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('is_best_seller', true)
        .not('best_seller_position', 'is', null)
        .gt('stock_quantity', 0),
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('is_best_seller', true)
        .not('best_seller_position', 'is', null)
        .lte('stock_quantity', 0)
    ])

    if (inErr || outErr) {
      console.error('❌ Best Sellers count error:', inErr || outErr)
      return NextResponse.json({ success: false, error: 'Failed to count best sellers' }, { status: 500 })
    }

    const totalIn = inCount || 0
    const totalOut = outCount || 0
    const total = totalIn + totalOut

    // Fetch the appropriate slice(s) maintaining best_seller_position within each stock group
    const fetchGroup = async (inStock: boolean, start: number, end: number, legacy = false) => {
      const q = buildQuery(legacy)
        [inStock ? 'gt' : 'lte']('stock_quantity', 0)
        .range(start, end)
      const { data, error } = await q
      return { data, error }
    }

    let products: any[] = []
    let error: any = null

    if (offset < totalIn) {
      const end = Math.min(totalIn - 1, offset + limit - 1)
      let res = await fetchGroup(true, offset, end, false)

      // Legacy fallback if needed
      if (res.error && (res.error.message?.includes('name_en') || res.error.message?.includes('name_ja') || res.error.message?.includes('does not exist'))) {
        console.warn('⚠️ Best Sellers API: Falling back to legacy categories.name for in-stock slice')
        res = await fetchGroup(true, offset, end, true)
      }

      if (res.error) {
        console.error('❌ Error fetching in-stock best sellers:', res.error)
        return NextResponse.json({ success: false, error: res.error.message }, { status: 500 })
      }

      products = res.data || []

      if (products.length < limit && totalOut > 0) {
        const need = limit - products.length
        let res2 = await fetchGroup(false, 0, need - 1, false)
        if (res2.error && (res2.error.message?.includes('name_en') || res2.error.message?.includes('name_ja') || res2.error.message?.includes('does not exist'))) {
          console.warn('⚠️ Best Sellers API: Falling back to legacy categories.name for out-of-stock tail')
          res2 = await fetchGroup(false, 0, need - 1, true)
        }
        if (res2.error) {
          console.error('❌ Error fetching out-of-stock tail:', res2.error)
          return NextResponse.json({ success: false, error: res2.error.message }, { status: 500 })
        }
        products = products.concat(res2.data || [])
      }
    } else {
      const outStart = offset - totalIn
      const outEnd = outStart + limit - 1
      let res = await fetchGroup(false, outStart, outEnd, false)
      if (res.error && (res.error.message?.includes('name_en') || res.error.message?.includes('name_ja') || res.error.message?.includes('does not exist'))) {
        console.warn('⚠️ Best Sellers API: Falling back to legacy categories.name for out-of-stock slice')
        res = await fetchGroup(false, outStart, outEnd, true)
      }
      if (res.error) {
        console.error('❌ Error fetching out-of-stock best sellers:', res.error)
        return NextResponse.json({ success: false, error: res.error.message }, { status: 500 })
      }
      products = res.data || []
    }

    console.log(`✅ Best Sellers API: Returned ${products.length} items (total: ${total}, in: ${totalIn}, out: ${totalOut})`)

    // Transform the data to match the expected format
    const transformedProducts = products.map((product: any) => {
      const hasLegacyName = product?.categories && 'name' in product.categories && !('name_en' in product.categories)
      const category = product.categories ? {
        id: product.categories.id,
        name_en: hasLegacyName ? product.categories.name : product.categories.name_en,
        name_ja: hasLegacyName ? product.categories.name : product.categories.name_ja,
        slug: product.categories.slug
      } : null

      return {
        id: product.id,
        sku: product.sku,
        name_en: product.name_en,
        name_ja: product.name_ja,
        description_en: product.description_en,
        description_ja: product.description_ja,
        price: product.price,
        compare_at_price: product.compare_at_price,
        points_rate: product.points_rate,
        images: product.images || [],
        brand: product.brand,
        stock_quantity: product.stock_quantity,
        is_featured: product.is_featured,
        is_best_seller: product.is_best_seller,
        best_seller_position: product.best_seller_position,
        created_at: product.created_at,
        updated_at: product.updated_at,
        category,
        stock_status: product.stock_quantity > 0 ? 'in_stock' : 'out_of_stock'
      }
    })

    return NextResponse.json({
      success: true,
      data: transformedProducts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + transformedProducts.length < total,
        hasPrev: page > 1
      }
    })

  } catch (error) {
    console.error('❌ Unexpected error in Best Sellers API:', error);
    return NextResponse.json({
      success: false,
      error: 'An unexpected error occurred while fetching best sellers'
    }, { status: 500 });
  }
}
