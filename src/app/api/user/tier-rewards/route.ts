import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Tier Rewards API: Starting request processing')

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    console.log('📋 Tier Rewards API: Request details:', {
      url: request.url,
      userId,
      headers: Object.fromEntries(request.headers.entries())
    })

    if (!userId) {
      console.log('❌ Tier Rewards API: Missing userId parameter')
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Verify user authentication
    console.log('🔐 Tier Rewards API: Creating Supabase server client for authentication')
    const supabase = await createClient()

    if (!supabase) {
      console.log('❌ Tier Rewards API: Failed to create Supabase client')
      return NextResponse.json(
        { error: 'Service unavailable', details: 'Failed to create authentication client' },
        { status: 503 }
      )
    }

    console.log('🔐 Tier Rewards API: Getting user from session')
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    console.log('🔐 Tier Rewards API: Authentication result:', {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      authError: authError?.message,
      authErrorCode: authError?.status
    })

    if (authError || !user) {
      console.log('❌ Tier Rewards API: Authentication failed:', {
        authError: authError?.message,
        hasUser: !!user
      })
      return NextResponse.json(
        { error: 'Unauthorized', details: authError?.message },
        { status: 401 }
      )
    }

    // Ensure user can only access their own rewards
    console.log('🔒 Tier Rewards API: Checking user authorization:', {
      authenticatedUserId: user.id,
      requestedUserId: userId,
      match: user.id === userId
    })

    if (user.id !== userId) {
      console.log('❌ Tier Rewards API: User ID mismatch - forbidden access')
      return NextResponse.json(
        { error: 'Forbidden: Can only access your own tier rewards' },
        { status: 403 }
      )
    }

    // Use service client to fetch tier rewards
    console.log('🔧 Tier Rewards API: Creating service role client')
    const serviceClient = createServiceRoleClient()

    if (!serviceClient) {
      console.log('❌ Tier Rewards API: Service client creation failed')
      return NextResponse.json(
        { error: 'Service unavailable' },
        { status: 503 }
      )
    }

    console.log('📊 Tier Rewards API: Querying tier_reward_history for user:', userId)
    const { data, error } = await serviceClient
      .from('tier_reward_history')
      .select(`
        id,
        tier_level,
        reward_type,
        reward_value,
        reward_description,
        status,
        awarded_at,
        expires_at,
        coupons!tier_reward_history_coupon_id_fkey (
          code
        )
      `)
      .eq('user_id', userId)
      .order('awarded_at', { ascending: false })

    console.log('📊 Tier Rewards API: Database query result:', {
      hasData: !!data,
      dataLength: data?.length || 0,
      hasError: !!error,
      error: error?.message
    })

    if (error) {
      console.error('❌ Tier Rewards API: Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch tier rewards', details: error.message },
        { status: 500 }
      )
    }

    // Transform the data to match the expected format
    console.log('🔄 Tier Rewards API: Transforming data for response')
    const rewards = (data || []).map(reward => ({
      id: reward.id,
      user_id: userId,
      tier_level: reward.tier_level,
      reward_type: reward.reward_type,
      reward_value: reward.reward_value || 0,
      reward_description: reward.reward_description,
      status: reward.status,
      coupon_code: (reward.coupons && typeof reward.coupons === 'object' && 'code' in reward.coupons) ? reward.coupons.code : undefined,
      awarded_at: reward.awarded_at,
      expires_at: reward.expires_at
    }))

    console.log('✅ Tier Rewards API: Successfully returning rewards:', {
      rewardsCount: rewards.length,
      userId
    })

    return NextResponse.json({ rewards })

  } catch (error) {
    console.error('❌ Tier Rewards API: Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
