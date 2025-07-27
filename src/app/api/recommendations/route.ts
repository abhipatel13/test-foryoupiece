import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { RecommendationEngine } from '@/lib/recommendation-engine'
import { sortProductsByStockPriority } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '6')
    const userId = searchParams.get('user_id')
    const includeDiscounts = searchParams.get('include_discounts') === 'true'
    const excludePurchased = searchParams.get('exclude_purchased') !== 'false' // Default true

    console.log('🎯 Personalized Recommendations API called:', {
      limit,
      userId,
      includeDiscounts,
      excludePurchased
    })

    // Use service role client to fetch products (bypasses RLS)
    const supabase = createServiceRoleClient()

    // Fetch all active products with category information
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select(`
        id,
        name_en,
        price,
        compare_at_price,
        stock_quantity,
        is_featured,
        brand,
        images,
        created_at,
        tags,
        category:categories(
          id,
          name_en,
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
      name_en: product.name_en,
      price: product.price,
      compare_at_price: product.compare_at_price,
      stock_quantity: product.stock_quantity,
      is_featured: product.is_featured,
      category: product.category?.name_en,
      brand: product.brand,
      images: product.images || [],
      created_at: product.created_at,
      tags: product.tags || []
    })) || []

    console.log(`📦 Fetched ${transformedProducts.length} products for recommendations`)

    // Get personalized recommendations
    const recommendations = await RecommendationEngine.getEnhancedPersonalizedRecommendations(
      transformedProducts,
      {
        userId,
        limit,
        includeDiscounts,
        excludePurchased
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
