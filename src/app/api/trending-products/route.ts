import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { sortProductsByStockPriority } from '@/lib/utils'

/**
 * Trending Products API Endpoint
 * GET /api/trending-products - Get trending products
 * POST /api/trending-products - Refresh trending products
 */

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const searchParams = url.searchParams
    const limit = parseInt(searchParams.get('limit') || '10')
    const includeStats = searchParams.get('include_stats') === 'true'

    console.log('🔥 Trending Products API called:', { limit, includeStats })

    const supabase = createServiceRoleClient()

    // Get trending products using the database function
    const { data: trendingProducts, error } = await supabase
      .rpc('get_trending_products')
      .limit(limit)

    if (error) {
      console.error('Error fetching trending products:', error)
      return NextResponse.json({ 
        error: 'Failed to fetch trending products',
        details: error.message 
      }, { status: 500 })
    }

    console.log(`✅ Found ${trendingProducts?.length || 0} trending products`)

    // Work on a local copy so we don't reassign a const
    let productsList = (trendingProducts || []) as any[]

    // Augment RPC results with points_rate to ensure UI reflects latest loyalty settings
    if (productsList.length > 0) {
      const ids = productsList.map(p => p.product_id || p.id).filter(Boolean)
      if (ids.length > 0) {
        const { data: rateRows } = await supabase
          .from('products')
          .select('id, points_rate')
          .in('id', ids)
        const rateMap = new Map((rateRows || []).map(r => [r.id, r.points_rate]))
        productsList = productsList.map(p => ({
          ...p,
          points_rate: rateMap.get(p.product_id || p.id) ?? null,
        })) as any
      }
    }

    // If no trending products found, use fallback logic
    if (!productsList || productsList.length === 0) {
      console.log('🔄 No trending products found, using fallback logic...')

      // Fallback: Get recent best-selling products
      const { data: fallbackProducts, error: fallbackError } = await supabase
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
          stock_quantity,
          stock_status,
          is_featured,
          brand,
          images,
          created_at,
          tags,
          category:categories(
            id,
            name_en,
            name_ja,
            slug
          )
        `)
        .eq('is_active', true)
        .eq('is_featured', true)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (fallbackError) {
        console.error('Error fetching fallback products:', fallbackError)
        return NextResponse.json({
          error: 'Failed to fetch products',
          details: fallbackError.message
        }, { status: 500 })
      }

      const sortedFallback = sortProductsByStockPriority(fallbackProducts || [])

      console.log(`✅ Using ${sortedFallback.length} fallback products`)

      return NextResponse.json({
        success: true,
        products: sortedFallback,
        total: sortedFallback.length,
        fallback_used: true,
        stats: includeStats ? {
          algorithm_enabled: false,
          last_refresh: null,
          total_products: sortedFallback.length
        } : undefined
      })
    }

    // Sort trending products by stock priority
    const sortedProducts = sortProductsByStockPriority(productsList)

    let stats = undefined
    if (includeStats) {
      // Get trending system stats
      const { data: systemStats } = await supabase
        .from('trending_system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['algorithm_enabled', 'last_refresh'])

      const statsMap = systemStats?.reduce((acc, stat) => {
        acc[stat.setting_key] = stat.setting_value
        return acc
      }, {} as Record<string, any>) || {}

      stats = {
        algorithm_enabled: statsMap.algorithm_enabled || false,
        last_refresh: statsMap.last_refresh || null,
        total_products: sortedProducts.length
      }
    }

    return NextResponse.json({
      success: true,
      products: sortedProducts,
      total: sortedProducts.length,
      fallback_used: false,
      stats
    })

  } catch (error) {
    console.error('Trending products API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { refresh_type = 'manual', user_id = null } = body

    console.log('🔄 Refresh trending products request:', { refresh_type, user_id })

    // Validate refresh_type
    const validRefreshTypes = ['manual', 'scheduled', 'conditional']
    if (!validRefreshTypes.includes(refresh_type)) {
      return NextResponse.json({ 
        error: 'Invalid refresh_type. Must be one of: manual, scheduled, conditional' 
      }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    // Check if algorithm is enabled
    const { data: algorithmSetting } = await supabase
      .from('trending_system_settings')
      .select('setting_value')
      .eq('setting_key', 'algorithm_enabled')
      .single()

    if (algorithmSetting?.setting_value !== true) {
      return NextResponse.json({ 
        error: 'Algorithm-based trending products is currently disabled' 
      }, { status: 400 })
    }

    // Run the refresh function with fallback logic
    const { data: refreshResult, error } = await supabase
      .rpc('refresh_trending_products_with_fallback')

    if (error) {
      console.error('Error refreshing trending products:', error)
      return NextResponse.json({ 
        error: 'Failed to refresh trending products',
        details: error.message 
      }, { status: 500 })
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
      })

    if (logError) {
      console.error('Error logging refresh:', logError)
    }

    // Get the updated trending products
    const { data: updatedProducts } = await supabase
      .rpc('get_trending_products')

    console.log(`✅ Trending products refreshed: ${refreshResult} products updated`)

    return NextResponse.json({
      success: true,
      message: 'Trending products refreshed successfully',
      products_changed: refreshResult || 0,
      updated_products: updatedProducts || []
    })

  } catch (error) {
    console.error('Refresh trending products error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
