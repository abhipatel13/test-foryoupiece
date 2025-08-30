import { NextRequest, NextResponse } from 'next/server'
import { createAnonymousClient } from '@/lib/supabase/server'
import { RecommendationEngine } from '@/lib/recommendation-engine'
import { sortProductsByStockPriority } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '6')
    const userId = searchParams.get('user_id')
    const includeDiscounts = searchParams.get('include_discounts') === 'true'
    const excludePurchased = searchParams.get('exclude_purchased') !== 'false' // Default true
    const context = (searchParams.get('context') as 'cart' | 'general') || 'general'
    const diversify = searchParams.get('diversify') === 'true'

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
      cartItemsCount: cartItems.length,
      excludeIdsCount: excludeIds.length
    })

    // SECURITY FIX: Use anonymous client instead of service role to ensure RLS applies
    const supabase = createAnonymousClient()

    // Fetch all active products with category information
    const { data: products, error: productsError } = await supabase
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
      .order('created_at', { ascending: false })

    if (productsError) {
      console.error('❌ Error fetching products:', productsError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch products',
        data: []
      }, { status: 500 })
    }

    // Transform products to match the expected interface
    const transformedProducts = products?.map(product => ({
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
        id: product.category.id,
        name_en: product.category.name_en,
        name_ja: product.category.name_ja,
        slug: product.category.slug
      } : null
    })) || []

    console.log(`📦 Fetched ${transformedProducts.length} products for recommendations`)

    // Get personalized recommendations
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
      // Preserve the original recommendation order as secondary sort
      // (recommendations are already sorted by relevance/algorithm)
      return 0
    })

    // Log recommendation context for debugging
    if (userId) {
      try {
        const { UserBehaviorService } = await import('@/lib/services/user-behavior-service')
        const behaviorService = new UserBehaviorService()
        const context = await behaviorService.getRecommendationContext(userId)

        console.log('📊 Recommendation Context:', {
          hasHistory: context.hasHistory,
          totalPurchases: context.totalPurchases,
          favoriteCategories: context.favoriteCategories,
          favoriteBrands: context.favoriteBrands,
          averageOrderValue: context.averageOrderValue,
          lastPurchaseDate: context.lastPurchaseDate
        })
      } catch (contextError) {
        console.warn('⚠️ Could not fetch recommendation context:', contextError)
      }
    }

    return NextResponse.json({
      success: true,
      data: sortedRecommendations,
      meta: {
        total: sortedRecommendations.length,
        limit,
        hasUserHistory: !!userId,
        algorithm: userId ? 'personalized' : 'random'
      }
    })

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
