import { NextRequest, NextResponse } from 'next/server'
import { createAnonymousClient } from '@/lib/supabase/server'
import { sortProductsByStockPriority } from '@/lib/utils'

/**
 * Optimized Homepage Data API
 * Combines multiple queries into a single endpoint to reduce database round trips
 * and improve performance for homepage sections
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const searchParams = url.searchParams
    
    // Parse query parameters
    const dealsLimit = parseInt(searchParams.get('deals_limit') || '5')
    const recentlyAddedLimit = parseInt(searchParams.get('recently_added_limit') || '5')
    const includeTrending = searchParams.get('include_trending') === 'true'
    
    console.log('🏠 Homepage Data API called:', { dealsLimit, recentlyAddedLimit, includeTrending })

    // SECURITY FIX: Use anonymous client instead of service role to ensure RLS applies
    const supabase = createAnonymousClient()

    // Execute all queries in parallel for better performance
    const [dealsResult, recentlyAddedResult, trendingResult] = await Promise.all([
      // 1. Get promotional products (discount OR enhanced points) with DB filtering
      supabase
        .from('products')
        .select(`
          id, sku, name_en, name_ja, description_en, price, compare_at_price,
          stock_quantity, stock_status, is_featured, brand, images, created_at, tags,
          points_rate,
          category:categories(id, name_en, name_ja, slug)
        `)
        .eq('is_active', true)
        .eq('is_deleted', false) // SECURITY FIX: Exclude soft-deleted products
        // OR: (compare_at_price > 0) OR (points_rate > 1.0) — precise discount check done client-side
        .or('compare_at_price.gt.0,points_rate.gt.1.0')
        .order('compare_at_price', { ascending: false, nullsLast: true }) // Highest discounts first when present
        .limit(dealsLimit * 2), // Get extra to account for stock filtering

      // 2. Get recently added products
      supabase
        .from('products')
        .select(`
          id, sku, name_en, name_ja, description_en, price, compare_at_price,
          stock_quantity, stock_status, is_featured, brand, images, created_at, tags,
          boxhero_last_sync_at,
          points_rate,
          category:categories(id, name_en, name_ja, slug)
        `)
        .eq('is_active', true)
        .eq('is_deleted', false) // SECURITY FIX: Exclude soft-deleted products
        .order('boxhero_last_sync_at', { ascending: false, nullsLast: true })
        .order('created_at', { ascending: false })
        .limit(recentlyAddedLimit),

      // 3. Get trending products (optional)
      includeTrending ? supabase.rpc('get_trending_products').limit(10) : Promise.resolve({ data: null, error: null })
    ])

    // Handle errors
    if (dealsResult.error) {
      console.error('❌ Error fetching deals:', dealsResult.error)
      throw new Error('Failed to fetch deals products')
    }

    if (recentlyAddedResult.error) {
      console.error('❌ Error fetching recently added:', recentlyAddedResult.error)
      throw new Error('Failed to fetch recently added products')
    }

    if (trendingResult.error) {
      console.error('❌ Error fetching trending:', trendingResult.error)
      // Don't throw for trending - it's optional
    }

    // Process deals products
    let dealsProducts = dealsResult.data || []
    
    // Filter promotions: include products with (discount) OR (enhanced points)
    dealsProducts = dealsProducts
      .filter(product => {
        const hasDiscount = product.compare_at_price && product.compare_at_price > product.price
        const hasEnhancedPoints = (product.points_rate ?? 1) > 1.0
        const hasValidPrice = typeof product.price === 'number' && product.price > 0
        const hasImage = Array.isArray(product.images) && product.images.length > 0
        const inStock = product.stock_quantity > 0
        return (hasDiscount || hasEnhancedPoints) && hasValidPrice && hasImage && inStock
      })
      .map(product => ({
        ...product,
        discountPercentage: product.compare_at_price && product.compare_at_price > product.price
          ? Math.round(((product.compare_at_price - product.price) / product.compare_at_price) * 100)
          : 0
      }))
      .sort((a, b) => {
        // Primary by discount percentage desc, secondary by points_rate desc
        if (b.discountPercentage !== a.discountPercentage) return b.discountPercentage - a.discountPercentage
        const aPoints = (a.points_rate ?? 1)
        const bPoints = (b.points_rate ?? 1)
        return bPoints - aPoints
      })
      .slice(0, dealsLimit) // Limit to requested amount

    // Apply stock priority sorting while preserving promotion order
    const sortedDealsProducts = sortProductsByStockPriority(dealsProducts, (a, b) => {
      if (b.discountPercentage !== a.discountPercentage) return b.discountPercentage - a.discountPercentage
      const aPoints = (a.points_rate ?? 1)
      const bPoints = (b.points_rate ?? 1)
      return bPoints - aPoints
    })

    // Process recently added products
    let recentlyAddedProducts = recentlyAddedResult.data || []
    
    // Apply stock priority sorting while preserving recently added order
    const sortedRecentlyAddedProducts = sortProductsByStockPriority(recentlyAddedProducts, (a, b) => {
      // Preserve recently added order as secondary sort
      const aSync = a.boxhero_last_sync_at ? new Date(a.boxhero_last_sync_at).getTime() : 0
      const bSync = b.boxhero_last_sync_at ? new Date(b.boxhero_last_sync_at).getTime() : 0
      if (bSync !== aSync) return bSync - aSync
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    // Process trending products (if requested)
    let trendingProducts = null
    if (includeTrending && trendingResult.data) {
      trendingProducts = trendingResult.data.slice(0, 10)
    }

    const response = {
      success: true,
      data: {
        deals: sortedDealsProducts,
        recently_added: sortedRecentlyAddedProducts,
        trending: trendingProducts,
        metadata: {
          deals_count: sortedDealsProducts.length,
          recently_added_count: sortedRecentlyAddedProducts.length,
          trending_count: trendingProducts?.length || 0,
          generated_at: new Date().toISOString()
        }
      }
    }

    console.log(`✅ Homepage data generated successfully:`, {
      deals: response.data.deals.length,
      recently_added: response.data.recently_added.length,
      trending: response.data.trending?.length || 0
    })

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Homepage Data API Error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch homepage data',
      data: {
        deals: [],
        recently_added: [],
        trending: null,
        metadata: {
          deals_count: 0,
          recently_added_count: 0,
          trending_count: 0,
          generated_at: new Date().toISOString()
        }
      }
    }, { status: 500 })
  }
}
