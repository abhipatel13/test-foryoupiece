import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache as cache } from 'next/cache'
import { createAnonymousClient } from '@/lib/supabase/server'
import { RecommendationEngine } from '@/lib/recommendation-engine'
import { sortProductsByStockPriority } from '@/lib/utils'

// Route-level caching for public (non-personalized) requests
export const revalidate = 300

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Core params
    const limit = Math.max(1, Math.min(parseInt(searchParams.get('limit') || '6', 10), 50))
    const userId = searchParams.get('user_id') || undefined
    const includeDiscounts = searchParams.get('include_discounts') === 'true'
    const excludePurchased = searchParams.get('exclude_purchased') !== 'false' // Default true
    const context = (searchParams.get('context') as 'cart' | 'general') || 'general'
    const diversify = searchParams.get('diversify') === 'true'

    // Optional DB-level filters (do not change existing behavior unless explicitly provided)
    const inStockOnly = searchParams.get('in_stock_only') === 'true'
    const discountOnly = searchParams.get('discount_only') === 'true' // stronger filter than include_discounts
    const stockStatus = searchParams.get('stock_status') || undefined // in_stock|low_stock|out_of_stock|preorder
    const brand = searchParams.get('brand') || undefined // comma-separated supported
    const categoryId = searchParams.get('category_id') || undefined
    const categorySlug = searchParams.get('category_slug') || undefined

    // Cursor-based pagination (keyset by created_at)
    const cursor = searchParams.get('cursor') || undefined
    const decodeCursor = (c?: string) => {
      if (!c) return null
      try {
        const [ts, id] = Buffer.from(c, 'base64').toString('utf8').split('|')
        return { created_at: ts, id }
      } catch { return null }
    }
    const encodeCursor = (ts: string, id: string) => Buffer.from(`${ts}|${id}`).toString('base64')
    const cursorObj = decodeCursor(cursor)

    // Optional cart context: accept comma-separated IDs or JSON array
    let cartItems: string[] = []
    const rawCart = searchParams.get('cart_items')
    if (rawCart) {
      try {
        cartItems = Array.isArray(rawCart as any)
          ? (rawCart as any)
          : JSON.parse(rawCart)
      } catch {
        cartItems = rawCart.split(',').map(s => s.trim()).filter(Boolean)
      }
    }

    // Optional explicit exclusion IDs
    let excludeIds: string[] = []
    const rawExclude = searchParams.get('exclude_ids')
    if (rawExclude) {
      try {
        excludeIds = Array.isArray(rawExclude as any)
          ? (rawExclude as any)
          : JSON.parse(rawExclude)
      } catch {
        excludeIds = rawExclude.split(',').map(s => s.trim()).filter(Boolean)
      }
    }

    console.log('🎯 Personalized Recommendations API called:', {
      limit,
      userId,
      includeDiscounts,
      excludePurchased,
      context,
      diversify,
      inStockOnly,
      discountOnly,
      stockStatus,
      brand,
      categoryId,
      categorySlug,
      cartItemsCount: cartItems.length,
      excludeIdsCount: excludeIds.length,
      cursorPresent: !!cursor
    })

    // SECURITY: Use anonymous client so RLS applies
    const supabase = createAnonymousClient()

    // Build products base query with narrow projection
    // Note: we fetch a candidate pool larger than the final limit to allow personalization to rank items
    const candidatePool = Math.min(Math.max(limit * 4, 40), 200)

    // Resolve category by slug if provided
    let resolvedCategoryId: string | undefined = categoryId
    if (!resolvedCategoryId && categorySlug) {
      const { data: cat } = await supabase
        .from('categories')
        .select('id, slug')
        .eq('slug', categorySlug)
        .single()
      resolvedCategoryId = cat?.id
    }

    let queryBuilder = () => {
      let q = supabase
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
          stock_quantity,
          stock_status,
          is_featured,
          brand,
          images,
          created_at,
          tags,
          points_rate,
          category:categories(
            id,
            name_en,
            name_ja,
            slug
          )
        `)
        .eq('is_active', true)
        .eq('is_deleted', false)

      // DB-level filters
      if (inStockOnly) {
        q = q.gt('stock_quantity', 0)
      } else if (stockStatus) {
        q = q.eq('stock_status', stockStatus)
      }
      if (discountOnly) {
        // broader promo filter (discount or enhanced points)
        q = q.or('compare_at_price.gt.0,points_rate.gt.1.0')
      }
      if (resolvedCategoryId) {
        q = q.eq('category_id', resolvedCategoryId)
      }
      if (brand) {
        const brands = brand.split(',').map(b => b.trim()).filter(Boolean)
        if (brands.length === 1) q = q.eq('brand', brands[0])
        else if (brands.length > 1) q = q.in('brand', brands)
      }
      if (excludeIds.length > 0) {
        const excludeSet = Array.from(new Set([...(excludeIds || []), ...(cartItems || [])]))
        q = q.not('id', 'in', `(${excludeSet.map(id => `'${id}'`).join(',')})`)
      }

      // Keyset pagination (created_at DESC)
      q = q.order('created_at', { ascending: false })
      if (cursorObj?.created_at) {
        q = q.lt('created_at', cursorObj.created_at)
      }

      // Finally limit candidate pool
      return q.limit(candidatePool)
    }

    // Cache non-personalized queries aggressively with tags
    const cacheKey = [
      'recommendations-candidates',
      resolvedCategoryId || 'all',
      brand || 'any',
      stockStatus || (inStockOnly ? 'in_stock' : 'any'),
      discountOnly ? 'promo' : 'any',
      candidatePool,
      cursorObj?.created_at || 'start'
    ]

    const tags = ['products']

    const fetchCandidates = async () => {
      const { data, error } = await queryBuilder()
      if (error) throw error
      return data || []
    }

    const products = (!userId && cartItems.length === 0)
      ? await cache(fetchCandidates, cacheKey, { tags })()
      : await fetchCandidates()


    // Transform products to match the expected interface
    const transformedProducts = (products || []).map(product => ({
      id: product.id,
      sku: product.sku,
      name_en: product.name_en,
      name_ja: product.name_ja,
      description_en: product.description_en,
      description_ja: product.description_ja,
      price: product.price,
      compare_at_price: product.compare_at_price,
      stock_quantity: product.stock_quantity,
      stock_status: product.stock_status,
      is_featured: product.is_featured,
      brand: product.brand,
      images: product.images || [],
      created_at: product.created_at,
      tags: product.tags || [],
      points_rate: product.points_rate,
      category: product.category ? {
        id: (product as any).category.id,
        name_en: (product as any).category.name_en,
        name_ja: (product as any).category.name_ja,
        slug: (product as any).category.slug
      } : null
    }))

    console.log(`📦 Fetched ${transformedProducts.length} candidate products`)

    // Get personalized recommendations from candidate set
    const recommendations = await RecommendationEngine.getEnhancedPersonalizedRecommendations(
      transformedProducts,
      {
        userId,
        limit,
        includeDiscounts,
        excludePurchased,
        cartItems,
        context,
        excludeIds,
        diversify
      }
    )

    console.log(`✅ Generated ${recommendations.length} personalized recommendations`)

    // Apply global stock-priority sorting while preserving recommendation algorithm order
    const sortedRecommendations = sortProductsByStockPriority(recommendations, (a, b) => {
      return 0 // preserve algorithm order
    })

    // Compute next cursor based on the last candidate (for subsequent pages)
    let next_cursor: string | null = null
    if (products && products.length > 0) {
      const last = products[products.length - 1]
      if (last?.created_at && last?.id) {
        next_cursor = encodeCursor(last.created_at as any, last.id as any)
      }
    }

    // Log recommendation context for debugging
    if (userId) {
      try {
        const { UserBehaviorService } = await import('@/lib/services/user-behavior-service')
        const behaviorService = new UserBehaviorService()
        const ctx = await behaviorService.getRecommendationContext(userId)

        console.log('📊 Recommendation Context:', {
          hasHistory: ctx.hasHistory,
          totalPurchases: ctx.totalPurchases,
          favoriteCategories: ctx.favoriteCategories,
          favoriteBrands: ctx.favoriteBrands,
          averageOrderValue: ctx.averageOrderValue,
          lastPurchaseDate: ctx.lastPurchaseDate
        })
      } catch (contextError) {
        console.warn('⚠️ Could not fetch recommendation context:', contextError)
      }
    }

    const response = NextResponse.json({
      success: true,
      data: sortedRecommendations,
      meta: {
        total: sortedRecommendations.length,
        limit,
        hasUserHistory: !!userId,
        algorithm: userId ? 'personalized' : 'random',
        next_cursor,
        filtersApplied: {
          inStockOnly,
          discountOnly,
          stockStatus: stockStatus || null,
          brand: brand || null,
          categoryId: resolvedCategoryId || null
        }
      }
    })

    // Caching strategy: cache only when not personalized
    if (!userId && cartItems.length === 0) {
      response.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate')
    } else {
      response.headers.set('Cache-Control', 'no-store')
    }

    return response

  } catch (error) {
    console.error('❌ Error in recommendations API:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      data: []
    }, { status: 500 })
  }
}

// POST endpoint for updating user behavior (future enhancement)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, action, productId, metadata } = body

    if (!userId || !action) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: userId, action'
      }, { status: 400 })
    }

    // TODO: Implement user behavior tracking
    // This could track:
    // - Product views
    // - Search queries
    // - Cart additions
    // - Wishlist additions
    // - Time spent on product pages

    console.log('📝 User behavior tracking (not implemented yet):', {
      userId,
      action,
      productId,
      metadata
    })

    return NextResponse.json({
      success: true,
      message: 'Behavior tracking endpoint ready for implementation'
    })

  } catch (error) {
    console.error('❌ Error in behavior tracking API:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
