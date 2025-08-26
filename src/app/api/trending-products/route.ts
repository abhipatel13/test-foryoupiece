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
    const offset = parseInt(searchParams.get('offset') || '0')
    const includeStats = searchParams.get('include_stats') === 'true'
    const includeManual = searchParams.get('include_manual') !== 'false' // Default true
    const includeFlags = searchParams.get('include_flags') !== 'false' // Default true

    console.log('🔥 Trending Products API called:', { limit, offset, includeStats, includeManual, includeFlags })

    const supabase = createServiceRoleClient()

    // Build genuine trending set ONLY (flags/manual + algorithm). No supplemental filler.
    // 1) Flagged trending: products.is_trending = true (covers BoxHero tag and manual toggle)
    let flaggedProducts: any[] = []
    if (includeFlags) {
      const { data: flaggedRows, error: flaggedError } = await supabase
        .from('products')
        .select(`
          id,
          sku,
          name_en,
          name_ja,
          price,
          compare_at_price,
          images,
          stock_quantity,
          is_featured,
          points_rate,
          categories!inner(name_en)
        `)
        .eq('is_active', true)
        .eq('is_trending', true)

      if (flaggedError) {
        console.error('Error fetching flagged trending products:', flaggedError)
        return NextResponse.json({
          error: 'Failed to fetch flagged trending products',
          details: flaggedError.message
        }, { status: 500 })
      }

      flaggedProducts = (flaggedRows || []).map((p: any) => ({
        id: `flag-${p.id}`,
        product_id: p.id,
        sku: p.sku,
        name_en: p.name_en,
        name_ja: p.name_ja,
        price: p.price,
        compare_at_price: p.compare_at_price,
        images: p.images,
        stock_quantity: p.stock_quantity,
        is_featured: p.is_featured,
        category_name: p.categories?.name_en || 'Uncategorized',
        selection_type: 'flag',
        algorithm_category: 'trending_flag',
        product_position: null,
        trending_score: null,
        sales_count: null,
        points_rate: p.points_rate ?? null,
      }))
    }

    // 2) Algorithm trending via RPC (if available)
    let algorithmProducts: any[] = []
    const algoResult = await supabase.rpc('get_trending_products')
    if (!algoResult.error && Array.isArray(algoResult.data)) {
      algorithmProducts = algoResult.data as any[]
    } else if (algoResult.error && algoResult.error.code !== 'PGRST202') {
      console.warn('Trending algorithm RPC error (continuing with flags only):', algoResult.error)
    }

    // Merge and de-duplicate by product_id/sku, prefer flagged over algorithm when conflicts
    const mergedMap = new Map<string, any>()
    const put = (item: any) => {
      const key = String(item.product_id || item.id || item.sku)
      if (!mergedMap.has(key)) mergedMap.set(key, item)
      else {
        const existing = mergedMap.get(key)
        // Prefer flagged entry metadata
        if (item.selection_type === 'flag' && existing.selection_type !== 'flag') {
          mergedMap.set(key, item)
        }
      }
    }

    algorithmProducts.forEach(put)
    flaggedProducts.forEach(put)

    let productsList = Array.from(mergedMap.values())

    // Total BEFORE pagination/limit
    const totalCount = productsList.length

    // New ordering: Stock-first, then deterministic random within each stock group
    // Seed rotates every 72 hours to refresh order predictably
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000
    const rotationBucket = Math.floor(Date.now() / threeDaysMs)

    // Simple deterministic hash to float in [0,1)
    const hashToFloat = (str: string, seed: number) => {
      let h = 2166136261 ^ seed
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i)
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)
      }
      // Convert to positive 32-bit and normalize
      const u = (h >>> 0) / 4294967296
      return u
    }

    const seededRandomSort = (a: any, b: any) => {
      const keyA = String(a.product_id || a.id || a.sku || '')
      const keyB = String(b.product_id || b.id || b.sku || '')
      const ra = hashToFloat(keyA, rotationBucket)
      const rb = hashToFloat(keyB, rotationBucket)
      return ra - rb
    }

    // Apply stock-first and seeded random within groups
    productsList = sortProductsByStockPriority(productsList, seededRandomSort)

    // Apply limit/offset if provided (API contract), but UI uses client-side pagination with a high limit
    const sliced = productsList.slice(offset, offset + Math.min(limit, productsList.length - offset))

    // Augment with latest points_rate (ensure consistency)
    if (sliced.length > 0) {
      const ids = sliced.map(p => p.product_id || p.id).filter(Boolean)
      if (ids.length > 0) {
        const { data: rateRows } = await supabase
          .from('products')
          .select('id, points_rate')
          .in('id', ids)
        const rateMap = new Map((rateRows || []).map(r => [r.id, r.points_rate]))
        for (let i = 0; i < sliced.length; i++) {
          sliced[i] = { ...sliced[i], points_rate: rateMap.get(sliced[i].product_id || sliced[i].id) ?? sliced[i].points_rate ?? null }
        }
      }
    }

    // If after merging we still have zero, return empty without fallback filler
    if (!productsList || productsList.length === 0) {
      console.log('⚠️ No genuine trending products found (flags + algorithm). Returning empty set without supplemental filler.')
      const stats = includeStats ? { algorithm_enabled: false, last_refresh: null, total_products: 0 } : undefined
      return NextResponse.json({
        success: true,
        products: [],
        total: 0,
        total_available: 0,
        offset,
        limit,
        has_more: false,
        fallback_used: false,
        stats
      })
    }

    // Stats
    let stats = undefined
    if (includeStats) {
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
        total_products: totalCount
      }
    }

    return NextResponse.json({
      success: true,
      products: sliced,
      total: sliced.length,
      total_available: totalCount,
      offset,
      limit,
      has_more: totalCount > (offset + sliced.length),
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
