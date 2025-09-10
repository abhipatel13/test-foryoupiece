import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * Optimized Account Data API
 * Combines user profile, recent orders, and points data in a single request
 * to improve account page loading performance
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    console.log('👤 Account Data API called for user:', user.id)

    // Use service role client for better performance (bypasses RLS)
    const serviceClient = createServiceRoleClient()

    if (!serviceClient) {
      throw new Error('Failed to create service role client')
    }

    // Execute all queries in parallel for better performance
    let [profileResult, ordersResult, pointsResult] = await Promise.all([
      // 1. Get user profile
      serviceClient
        .from('users')
        .select(`
          id, email, phone, first_name, last_name, avatar_url,
          points_balance, total_points_earned, tier_level, total_spent, total_orders,
          preferred_language, created_at, updated_at
        `)
        .eq('id', user.id)
        .single(),

      // 2. Get recent orders (last 5)
      serviceClient
        .from('orders')
        .select(`
          id, order_number, total_amount, payment_status, fulfillment_status,
          created_at, updated_at,
          order_items(
            id, quantity, unit_price, total_price,
            product:products(id, name_en, images, sku)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),

      // 3. Get points summary (if needed for tier calculations)
      serviceClient
        .from('users')
        .select('points_balance, total_points_earned, tier_level, total_spent')
        .eq('id', user.id)
        .single()
    ])

    // If profile missing (PGRST116), ensure profile and retry selects once
    if (profileResult.error && (profileResult.error as any).code === 'PGRST116') {
      try {
        const minimal = {
          id: user.id,
          email: user.email ?? null,
          first_name: (user.user_metadata as any)?.first_name ?? null,
          last_name: (user.user_metadata as any)?.last_name ?? null,
          telegram_username: (user.user_metadata as any)?.telegram_username ?? null,
          preferred_language: 'en' as const
        }
        await serviceClient.from('users').upsert(minimal, { onConflict: 'id' })
        const [p2, , pts2] = await Promise.all([
          serviceClient
            .from('users')
            .select(`
              id, email, phone, first_name, last_name, avatar_url,
              points_balance, total_points_earned, tier_level, total_spent, total_orders,
              preferred_language, created_at, updated_at
            `)
            .eq('id', user.id)
            .single(),
          Promise.resolve(ordersResult),
          serviceClient
            .from('users')
            .select('points_balance, total_points_earned, tier_level, total_spent')
            .eq('id', user.id)
            .single()
        ])
        profileResult = p2
        pointsResult = pts2
      } catch (e) {
        console.warn('ensure-profile (account-data) upsert failed (non-fatal):', e)
      }
    }
    // Secondary guard: if still PGRST116 (e.g., duplicates), collapse to most recent row
    if (profileResult.error && (profileResult.error as any).code === 'PGRST116') {
      try {
        const collapse = await serviceClient
          .from('users')
          .select(`id, email, phone, first_name, last_name, avatar_url, points_balance, total_points_earned, tier_level, total_spent, total_orders, preferred_language, created_at, updated_at`)
          .eq('id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
        if (collapse.data && collapse.data[0]) {
          profileResult = { data: collapse.data[0], error: null, count: 1, status: 200, statusText: 'OK' } as any
        }
      } catch (e) {
        console.warn('account-data collapse fallback failed:', e)
      }
    }


    // Handle errors
    if (profileResult.error) {
      console.error('❌ Error fetching profile:', profileResult.error)
      throw new Error('Failed to fetch user profile')
    }

    if (ordersResult.error) {
      console.error('❌ Error fetching orders:', ordersResult.error)
      // Don't throw for orders - they're not critical
    }

    if (pointsResult.error) {
      console.error('❌ Error fetching points:', pointsResult.error)
      // Don't throw for points - they're not critical
    }

    // Process the data
    const profile = profileResult.data
    const orders = ordersResult.data || []
    const pointsData = pointsResult.data

    // Calculate tier progress (if points data available)
    let tierProgress = null
    if (pointsData) {
      const tierThresholds = {
        bronze: 0,
        silver: 5000,
        gold: 15000,
        platinum: 35000,
        diamond: 50000
      }

      // Use lifetime total_points_earned for tier progress, not current balance
      const currentTier = pointsData.tier_level || 'bronze'
      const totalPointsEarned = pointsData.total_points_earned || 0

      // Find next tier
      const tiers = Object.entries(tierThresholds)
      const currentTierIndex = tiers.findIndex(([tier]) => tier === currentTier)
      const nextTier = tiers[currentTierIndex + 1]

      if (nextTier) {
        const [nextTierName, nextTierThreshold] = nextTier
        const pointsToNext = nextTierThreshold - totalPointsEarned
        const progressPercentage = Math.min(100, (totalPointsEarned / nextTierThreshold) * 100)

        tierProgress = {
          current_tier: currentTier,
          next_tier: nextTierName,
          current_points: totalPointsEarned,
          points_to_next: Math.max(0, pointsToNext),
          progress_percentage: progressPercentage
        }
      }
    }

    // Calculate order statistics
    const orderStats = {
      total_orders: orders.length,
      pending_orders: orders.filter(order => order.payment_status === 'pending').length,
      completed_orders: orders.filter(order => order.fulfillment_status === 'delivered').length,
      total_spent: orders.reduce((sum, order) => sum + (order.total_amount || 0), 0)
    }

    const response = {
      success: true,
      data: {
        profile,
        recent_orders: orders,
        tier_progress: tierProgress,
        order_stats: orderStats,
        metadata: {
          generated_at: new Date().toISOString(),
          orders_count: orders.length
        }
      }
    }

    console.log(`✅ Account data generated successfully for user ${user.id}:`, {
      profile: !!profile,
      orders: orders.length,
      tier_progress: !!tierProgress
    })

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Account Data API Error:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch account data',
      data: {
        profile: null,
        recent_orders: [],
        tier_progress: null,
        order_stats: {
          total_orders: 0,
          pending_orders: 0,
          completed_orders: 0,
          total_spent: 0
        },
        metadata: {
          generated_at: new Date().toISOString(),
          orders_count: 0
        }
      }
    }, { status: 500 })
  }
}
