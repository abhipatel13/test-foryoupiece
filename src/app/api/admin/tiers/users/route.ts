import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { withAdminAuth } from '@/lib/auth/admin-middleware';
import { getTierFromPoints } from '@/lib/utils';

/**
 * Admin Tier Tracking API - Get all users with tier information
 * GET /api/admin/tiers/users?page=1&limit=20&search=query&tier=silver&sort=points_desc
 */
export const GET = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('🏆 Admin tier tracking request received');

    const url = new URL(request.url);
    const searchParams = url.searchParams;
    
    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;
    
    // Filter parameters
    const search = searchParams.get('search')?.trim() || '';
    const tierFilter = searchParams.get('tier') || '';
    const sortBy = searchParams.get('sort') || 'points_desc';
    
    console.log('📊 Query params:', { page, limit, search, tierFilter, sortBy });

    const serviceClient = createServiceRoleClient();
    if (!serviceClient) {
      console.error('❌ Failed to create service role client');
      return NextResponse.json({
        success: false,
        error: 'Service configuration error'
      }, { status: 500 });
    }

    // Build the base query - use LEFT JOIN to include all users
    let query = serviceClient
      .from('users')
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone,
        avatar_url,
        points_balance,
        tier_level,
        total_points_earned,
        total_spent,
        total_orders,
        created_at,
        updated_at,
        permanent_free_shipping,
        user_ranks (
          rank,
          points_at_rank,
          achieved_at,
          is_current
        )
      `, { count: 'exact' });

    // Apply search filter
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Apply tier filter
    if (tierFilter && tierFilter !== 'all') {
      query = query.eq('tier_level', tierFilter);
    }

    // Apply sorting
    switch (sortBy) {
      case 'points_desc':
        query = query.order('total_points_earned', { ascending: false });
        break;
      case 'points_asc':
        query = query.order('total_points_earned', { ascending: true });
        break;
      case 'tier_desc':
        query = query.order('tier_level', { ascending: false });
        break;
      case 'tier_asc':
        query = query.order('tier_level', { ascending: true });
        break;
      case 'name_asc':
        query = query.order('first_name', { ascending: true });
        break;
      case 'created_desc':
        query = query.order('created_at', { ascending: false });
        break;
      default:
        query = query.order('total_points_earned', { ascending: false });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: users, error: usersError, count } = await query;

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch users'
      }, { status: 500 });
    }

    console.log('📊 Raw users fetched:', users?.length, 'Total count:', count);

    // Initialize missing user ranks for users without rank records
    const usersNeedingRanks = users?.filter(user => !user.user_ranks || user.user_ranks.length === 0) || [];

    if (usersNeedingRanks.length > 0) {
      console.log('🔧 Initializing ranks for', usersNeedingRanks.length, 'users without rank records');

      for (const user of usersNeedingRanks) {
        const totalPointsEarned = user.total_points_earned || 0;
        const calculatedTier = getTierFromPoints(totalPointsEarned);

        // Create initial rank record
        await serviceClient
          .from('user_ranks')
          .insert({
            user_id: user.id,
            rank: calculatedTier,
            points_at_rank: totalPointsEarned,
            achieved_at: user.created_at || new Date().toISOString(),
            is_current: true
          });

        // Update user's tier if it doesn't match
        if (user.tier_level !== calculatedTier) {
          await serviceClient
            .from('users')
            .update({
              tier_level: calculatedTier,
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id);
        }

        // Add the rank record to the user object for processing
        user.user_ranks = [{
          rank: calculatedTier,
          points_at_rank: totalPointsEarned,
          achieved_at: user.created_at || new Date().toISOString(),
          is_current: true
        }];
      }
    }

    // Process user data to include tier calculations and progress
    const processedUsers = (users || []).map(user => {
      const totalPointsEarned = user.total_points_earned || 0;
      const calculatedTier = getTierFromPoints(totalPointsEarned);
      
      // Tier thresholds
      const tierThresholds = {
        bronze: { min: 0, max: 4999, next: 'silver', nextThreshold: 5000 },
        silver: { min: 5000, max: 14999, next: 'gold', nextThreshold: 15000 },
        gold: { min: 15000, max: 34999, next: 'platinum', nextThreshold: 35000 },
        platinum: { min: 35000, max: 49999, next: 'diamond', nextThreshold: 50000 },
        diamond: { min: 50000, max: Infinity, next: null, nextThreshold: null }
      };

      const currentTierInfo = tierThresholds[calculatedTier as keyof typeof tierThresholds];
      const pointsToNext = currentTierInfo.nextThreshold 
        ? Math.max(0, currentTierInfo.nextThreshold - totalPointsEarned)
        : 0;
      
      const progressPercentage = currentTierInfo.nextThreshold
        ? Math.min(100, ((totalPointsEarned - currentTierInfo.min) / (currentTierInfo.nextThreshold - currentTierInfo.min)) * 100)
        : 100;

      // Get tier achievement date from user_ranks (handle missing ranks)
      const currentRankRecord = user.user_ranks?.find((rank: any) => rank.is_current && rank.rank === calculatedTier);
      const tierAchievedAt = currentRankRecord?.achieved_at || user.created_at;

      // Check if user is missing rank records and needs initialization
      const hasRankRecords = user.user_ranks && user.user_ranks.length > 0;
      const needsRankInit = !hasRankRecords;

      return {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatar_url,
        pointsBalance: user.points_balance || 0,
        totalPointsEarned: totalPointsEarned,
        totalSpent: user.total_spent || 0,
        totalOrders: user.total_orders || 0,
        storedTier: user.tier_level,
        calculatedTier: calculatedTier,
        tierMismatch: user.tier_level !== calculatedTier,
        currentTierInfo: {
          tier: calculatedTier,
          minPoints: currentTierInfo.min,
          maxPoints: currentTierInfo.max === Infinity ? null : currentTierInfo.max,
          nextTier: currentTierInfo.next,
          pointsToNext: pointsToNext,
          progressPercentage: Math.round(progressPercentage)
        },
        tierAchievedAt: tierAchievedAt,
        permanentFreeShipping: user.permanent_free_shipping || false,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        fullName: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Unknown User',
        needsRankInit,
        hasRankRecords
      };
    });

    // Calculate tier distribution for summary
    const tierDistribution = processedUsers.reduce((acc, user) => {
      const tier = user.calculatedTier;
      acc[tier] = (acc[tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('✅ Tier tracking data fetched successfully:', {
      totalUsers: count,
      returnedUsers: processedUsers.length,
      tierDistribution
    });

    return NextResponse.json({
      success: true,
      data: {
        users: processedUsers,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
          hasNext: offset + limit < (count || 0),
          hasPrev: page > 1
        },
        summary: {
          totalUsers: count || 0,
          tierDistribution,
          filters: {
            search,
            tier: tierFilter,
            sort: sortBy
          }
        }
      }
    });

  } catch (error) {
    console.error('❌ Admin tier tracking error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});
