import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { withAdminAuth } from '@/lib/auth/admin-middleware';

/**
 * Admin Tier Rewards History API
 * GET /api/admin/tier-rewards/history
 */
export const GET = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('🎁 Admin tier rewards history request received');

    const serviceClient = createServiceRoleClient();
    if (!serviceClient) {
      console.error('❌ Failed to create service role client');
      return NextResponse.json({
        success: false,
        error: 'Service configuration error'
      }, { status: 500 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const search = searchParams.get('search') || '';
    const tier = searchParams.get('tier') || '';
    const type = searchParams.get('type') || '';
    const status = searchParams.get('status') || '';

    const offset = (page - 1) * limit;

    console.log('📋 Tier rewards history params:', {
      page,
      limit,
      search: search.substring(0, 50),
      tier,
      type,
      status,
      adminId: adminUser.id
    });

    // Build base query - Note: tier_reward_history table doesn't exist yet, 
    // so we'll create a mock response for now and implement the actual table later
    let query = serviceClient
      .from('tier_reward_history')
      .select(`
        id,
        user_id,
        tier_level,
        reward_type,
        reward_value,
        reward_description,
        status,
        coupon_id,
        coupon_code,
        point_transaction_id,
        awarded_at,
        expires_at,
        users!inner(
          first_name,
          last_name,
          email,
          avatar_url
        )
      `, { count: 'exact' });

    // Apply filters
    if (search.trim()) {
      query = query.or(`users.email.ilike.%${search}%,reward_description.ilike.%${search}%`);
    }

    if (tier) {
      query = query.eq('tier_level', tier);
    }

    if (type) {
      query = query.eq('reward_type', type);
    }

    if (status) {
      query = query.eq('status', status);
    }

    // Apply pagination and ordering
    query = query
      .order('awarded_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: rewards, error: rewardsError, count } = await query;

    if (rewardsError) {
      console.error('❌ Error fetching tier rewards history:', rewardsError);
      
      // If table doesn't exist, return mock data for now
      if (rewardsError.code === '42P01') {
        console.log('📝 Tier reward history table not found, returning mock data');
        return NextResponse.json({
          success: true,
          data: {
            rewards: [],
            totalRecords: 0,
            totalPages: 0,
            currentPage: page,
            hasNextPage: false,
            hasPreviousPage: false
          },
          message: 'Tier reward history table not yet implemented'
        });
      }

      return NextResponse.json({
        success: false,
        error: 'Failed to fetch tier rewards history: ' + rewardsError.message
      }, { status: 500 });
    }

    const totalRecords = count || 0;
    const totalPages = Math.ceil(totalRecords / limit);

    // Format the rewards data
    const formattedRewards = rewards?.map(reward => ({
      ...reward,
      user: reward.users
    })) || [];

    console.log('✅ Tier rewards history fetched successfully:', {
      totalRecords,
      currentPage: page,
      totalPages,
      rewardsCount: formattedRewards.length
    });

    return NextResponse.json({
      success: true,
      data: {
        rewards: formattedRewards,
        totalRecords,
        totalPages,
        currentPage: page,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    });

  } catch (error) {
    console.error('❌ Admin tier rewards history error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});
