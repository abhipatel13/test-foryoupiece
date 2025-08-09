import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * Get user's available coupons
 * Returns all coupons that the user can use, including tier-specific rewards
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🎫 User Coupons API called')

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.log('❌ User Coupons API: Authentication failed')
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const userId = user.id
    console.log('👤 User Coupons API: Fetching coupons for user:', userId)

    // Use service client for better performance
    const serviceClient = createServiceRoleClient()
    if (!serviceClient) {
      console.log('❌ User Coupons API: Service client creation failed')
      return NextResponse.json(
        { error: 'Service unavailable' },
        { status: 503 }
      )
    }

    // Fetch user's coupons - including both general coupons and tier-specific ones
    const { data: coupons, error: couponsError } = await serviceClient
      .from('coupons')
      .select(`
        id,
        code,
        name,
        description,
        discount_type,
        discount_value,
        expires_at,
        status,
        per_user_usage_limit,
        total_usage_limit,
        current_usage_count,
        allowed_user_ids,
        metadata,
        created_at
      `)
      .eq('status', 'active')
      .or(`allowed_user_ids.is.null,allowed_user_ids.cs.["${userId}"]`)

    if (couponsError) {
      console.error('❌ Error fetching user coupons:', couponsError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch coupons'
      }, { status: 500 })
    }

    // Get user's coupon usage history to calculate usage counts
    const { data: usageHistory, error: usageError } = await serviceClient
      .from('coupon_usage')
      .select('coupon_id, id')
      .eq('user_id', userId)

    if (usageError) {
      console.error('❌ Error fetching coupon usage:', usageError)
      // Don't fail the request, just log the error
    }

    // Process coupons to add usage information
    const processedCoupons = (coupons || []).map(coupon => {
      const userUsageCount = (usageHistory || []).filter(usage => usage.coupon_id === coupon.id).length
      
      // Check if coupon is still usable
      const isExpired = coupon.expires_at && new Date(coupon.expires_at) < new Date()
      const hasReachedUserLimit = coupon.per_user_usage_limit && userUsageCount >= coupon.per_user_usage_limit
      const hasReachedTotalLimit = coupon.total_usage_limit && coupon.current_usage_count >= coupon.total_usage_limit
      
      return {
        id: coupon.id,
        code: coupon.code,
        name: coupon.name,
        description: coupon.description,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        expires_at: coupon.expires_at,
        status: isExpired || hasReachedUserLimit || hasReachedTotalLimit ? 'expired' : coupon.status,
        usage_count: userUsageCount,
        per_user_usage_limit: coupon.per_user_usage_limit,
        total_usage_limit: coupon.total_usage_limit,
        current_usage_count: coupon.current_usage_count,
        metadata: coupon.metadata,
        created_at: coupon.created_at,
        is_tier_reward: coupon.metadata?.tier_reward || false,
        tier_level: coupon.metadata?.tier_level || null
      }
    })

    // Sort coupons: active first, then by creation date (newest first)
    processedCoupons.sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1
      if (a.status !== 'active' && b.status === 'active') return 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    console.log(`✅ User Coupons API: Found ${processedCoupons.length} coupons for user ${userId}`)

    return NextResponse.json({
      success: true,
      coupons: processedCoupons,
      metadata: {
        total_coupons: processedCoupons.length,
        active_coupons: processedCoupons.filter(c => c.status === 'active').length,
        tier_reward_coupons: processedCoupons.filter(c => c.is_tier_reward).length,
        generated_at: new Date().toISOString()
      }
    })

  } catch (error: any) {
    console.error('❌ User Coupons API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
