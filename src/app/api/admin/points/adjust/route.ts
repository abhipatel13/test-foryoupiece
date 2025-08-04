import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { createClient } from '@/lib/supabase/server';
import { getTierFromPoints } from '@/lib/utils';
import { TierRewardsService } from '@/lib/services/tier-rewards-service';

/**
 * Admin Points Adjustment API
 * POST /api/admin/points/adjust
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Admin points adjustment request received');

    // Use service role client for admin operations (authentication handled by middleware)
    const serviceClient = createServiceRoleClient();

    if (!serviceClient) {
      console.error('❌ Failed to create service role client');
      return NextResponse.json({
        success: false,
        error: 'Service configuration error'
      }, { status: 500 });
    }

    // Parse request body
    const body = await request.json();
    const { userId, pointsAdjustment, reason } = body;

    // Validate input
    if (!userId || typeof pointsAdjustment !== 'number' || !reason) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: userId, pointsAdjustment, reason'
      }, { status: 400 });
    }

    if (Math.abs(pointsAdjustment) > 100000) {
      return NextResponse.json({
        success: false,
        error: 'Points adjustment cannot exceed ±100,000 points'
      }, { status: 400 });
    }

    if (reason.trim().length < 5) {
      return NextResponse.json({
        success: false,
        error: 'Reason must be at least 5 characters long'
      }, { status: 400 });
    }

    console.log('📊 Processing points adjustment:', {
      userId,
      pointsAdjustment,
      reason: reason.substring(0, 50) + '...',
      adminUserId: '80901357-6a94-4b8a-91d7-4f9b5e5fb44c'
    });

    // Verify target user exists
    const { data: targetUser, error: userError } = await serviceClient
      .from('users')
      .select('id, points_balance, total_points_earned, tier_level, first_name, last_name, email')
      .eq('id', userId)
      .single();

    if (userError || !targetUser) {
      console.error('❌ Target user not found:', userError);
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 });
    }

    // Get current user data for tier calculation
    const currentPointsBalance = targetUser.points_balance || 0;
    const currentTotalEarned = targetUser.total_points_earned || 0;
    const currentTier = targetUser.tier_level;

    // Calculate new values
    const newPointsBalance = Math.max(0, currentPointsBalance + pointsAdjustment);

    // For positive adjustments (adding points), update total_points_earned
    // For negative adjustments (removing points), don't reduce total_points_earned
    const newTotalEarned = pointsAdjustment > 0
      ? currentTotalEarned + pointsAdjustment
      : currentTotalEarned;

    // Calculate new tier based on updated total_points_earned
    const newTier = getTierFromPoints(newTotalEarned);

    console.log('🔄 Points adjustment calculation:', {
      currentPointsBalance,
      currentTotalEarned,
      currentTier,
      pointsAdjustment,
      newPointsBalance,
      newTotalEarned,
      newTier,
      tierChanged: currentTier !== newTier
    });

    // Call the database function to adjust points
    // For now, use the current user as admin (in production, get from session)
    const adminUserId = '80901357-6a94-4b8a-91d7-4f9b5e5fb44c'; // Current logged-in user

    const { data: adjustmentResult, error: adjustmentError } = await serviceClient
      .rpc('admin_adjust_user_points', {
        target_user_id: userId,
        admin_user_id: adminUserId,
        points_adjustment: pointsAdjustment,
        reason_text: reason.trim()
      });

    if (adjustmentError) {
      console.error('❌ Points adjustment failed:', adjustmentError);
      return NextResponse.json({
        success: false,
        error: 'Failed to adjust points: ' + adjustmentError.message
      }, { status: 500 });
    }

    const result = adjustmentResult[0];
    
    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: 'Points adjustment failed'
      }, { status: 500 });
    }

    console.log('✅ Points adjustment successful:', {
      userId,
      pointsBefore: result.points_before,
      pointsAfter: result.points_after,
      newTier: result.new_tier,
      transactionId: result.transaction_id,
      adjustmentId: result.adjustment_id,
      tierChanged: currentTier !== newTier
    });

    // Get updated user information
    const { data: updatedUser, error: updatedUserError } = await serviceClient
      .from('users')
      .select('id, points_balance, tier_level, total_points_earned, first_name, last_name, email')
      .eq('id', userId)
      .single();

    if (updatedUserError) {
      console.error('❌ Failed to fetch updated user:', updatedUserError);
    }

    // Check for tier upgrades and award rewards if tier changed
    let tierRewardsResult = null;
    if (currentTier !== result.new_tier && pointsAdjustment > 0) {
      try {
        console.log('🎁 Checking for tier rewards due to tier promotion:', {
          userId,
          oldTier: currentTier,
          newTier: result.new_tier
        });

        const tierRewardsService = new TierRewardsService();
        tierRewardsResult = await tierRewardsService.checkAndAwardTierUpgrade(userId);

        if (tierRewardsResult.success) {
          console.log('✅ Tier rewards awarded successfully:', {
            rewardsCount: tierRewardsResult.rewardsAwarded.length,
            errors: tierRewardsResult.errors
          });
        } else {
          console.error('❌ Tier rewards failed:', tierRewardsResult.errors);
        }
      } catch (tierRewardsError) {
        console.error('❌ Error processing tier rewards:', tierRewardsError);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        pointsBefore: result.points_before,
        pointsAfter: result.points_after,
        pointsChanged: pointsAdjustment,
        oldTier: currentTier,
        newTier: result.new_tier,
        tierChanged: currentTier !== newTier,
        transactionId: result.transaction_id,
        adjustmentId: result.adjustment_id,
        user: updatedUser || targetUser,
        dollarValueBefore: (result.points_before / 1000).toFixed(2),
        dollarValueAfter: (result.points_after / 1000).toFixed(2),
        dollarValueChanged: (pointsAdjustment / 1000).toFixed(2),
        totalPointsEarnedBefore: currentTotalEarned,
        totalPointsEarnedAfter: updatedUser?.total_points_earned || newTotalEarned,
        tierRewards: tierRewardsResult ? {
          success: tierRewardsResult.success,
          rewardsAwarded: tierRewardsResult.rewardsAwarded,
          rewardsCount: tierRewardsResult.rewardsAwarded.length,
          errors: tierRewardsResult.errors
        } : null
      }
    });

  } catch (error) {
    console.error('❌ Admin points adjustment error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * Get points adjustment history
 * GET /api/admin/points/adjust?userId=xxx&limit=20&offset=0
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📊 Fetching points adjustment history');

    // Use service role client for admin operations (authentication handled by middleware)
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
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = serviceClient
      .from('admin_point_adjustments')
      .select(`
        *,
        user:users!admin_point_adjustments_user_id_fkey(
          id, first_name, last_name, email, points_balance, tier_level
        ),
        admin:users!admin_point_adjustments_admin_user_id_fkey(
          id, first_name, last_name, email
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: adjustments, error: adjustmentsError } = await query;

    if (adjustmentsError) {
      console.error('❌ Failed to fetch adjustments:', adjustmentsError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch adjustment history'
      }, { status: 500 });
    }

    // Get total count for pagination
    let countQuery = serviceClient
      .from('admin_point_adjustments')
      .select('*', { count: 'exact', head: true });

    if (userId) {
      countQuery = countQuery.eq('user_id', userId);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('❌ Failed to get count:', countError);
    }

    console.log(`✅ Retrieved ${adjustments.length} adjustment records`);

    return NextResponse.json({
      success: true,
      data: {
        adjustments: adjustments.map(adj => ({
          ...adj,
          dollarValueBefore: (adj.points_before / 1000).toFixed(2),
          dollarValueAfter: (adj.points_after / 1000).toFixed(2),
          dollarValueChanged: (adj.points_changed / 1000).toFixed(2)
        })),
        pagination: {
          total: count || 0,
          limit,
          offset,
          hasMore: (count || 0) > offset + limit
        }
      }
    });

  } catch (error) {
    console.error('❌ Get adjustment history error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
