import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { UserBehaviorService } from '@/lib/services/user-behavior-service'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'Service unavailable'
      }, { status: 500 })
    }

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 })
    }

    const body = await request.json()
    const {
      behaviorType,
      productId,
      categoryId,
      searchQuery,
      sessionId,
      metadata = {}
    } = body

    // Validate required fields
    if (!behaviorType) {
      return NextResponse.json({
        success: false,
        error: 'Missing required field: behaviorType'
      }, { status: 400 })
    }

    // Validate behavior type
    const validBehaviorTypes = [
      'search', 'product_view', 'category_view', 'cart_add', 'cart_remove',
      'wishlist_add', 'wishlist_remove', 'purchase', 'page_view'
    ]

    if (!validBehaviorTypes.includes(behaviorType)) {
      return NextResponse.json({
        success: false,
        error: `Invalid behavior type. Must be one of: ${validBehaviorTypes.join(', ')}`
      }, { status: 400 })
    }

    const behaviorService = new UserBehaviorService()

    // Track the behavior using authenticated user ID
    await behaviorService.trackUserBehavior(user.id, behaviorType, {
      productId,
      categoryId,
      searchQuery,
      sessionId: sessionId || `session_${user.id}_${Date.now()}`,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        user_agent: request.headers.get('user-agent'),
        referrer: request.headers.get('referer')
      }
    })

    // If it's a product view, also increment the product view count
    if (behaviorType === 'product_view' && productId) {
      try {
        await supabase.rpc('increment_product_view_count', {
          product_uuid: productId
        })
        console.log(`✅ Incremented view count for product ${productId}`)
      } catch (error) {
        console.error('❌ Failed to increment product view count:', error)
        // Don't fail the entire request if view count increment fails
      }
    }

    return NextResponse.json({
      success: true,
      message: `${behaviorType} behavior tracked successfully`
    })

  } catch (error) {
    console.error('❌ Error tracking user behavior:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to track user behavior'
    }, { status: 500 })
  }
}
