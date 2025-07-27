import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { withAdminAuth } from '@/lib/auth/admin-middleware';

/**
 * Admin Tier Analytics API
 * GET /api/admin/tiers/analytics?startDate=2024-01-01&endDate=2024-12-31
 */
export const GET = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('📊 Admin tier analytics request received');

    const url = new URL(request.url);
    const searchParams = url.searchParams;
    
    // Date range parameters
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    
    console.log('📊 Analytics params:', { startDate, endDate });

    const serviceClient = createServiceRoleClient();
    if (!serviceClient) {
      console.error('❌ Failed to create service role client');
      return NextResponse.json({
        success: false,
        error: 'Service configuration error'
      }, { status: 500 });
    }

    // Get tier analytics using the database function
    const { data: tierAnalytics, error: analyticsError } = await serviceClient
      .rpc('get_tier_analytics', {
        p_start_date: startDate || null,
        p_end_date: endDate || null
      });

    if (analyticsError) {
      console.error('❌ Error fetching tier analytics:', analyticsError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch tier analytics'
      }, { status: 500 });
    }

    // Get tier coupon analytics using the database function
    const { data: couponAnalytics, error: couponError } = await serviceClient
      .rpc('get_tier_coupon_analytics', {
        p_start_date: startDate || null,
        p_end_date: endDate || null
      });

    if (couponError) {
      console.error('❌ Error fetching tier coupon analytics:', couponError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch tier coupon analytics'
      }, { status: 500 });
    }

    // Get recent tier changes
    let tierChangesQuery = serviceClient
      .from('tier_reset_logs')
      .select(`
        id,
        old_tier,
        new_tier,
        reason,
        reset_at,
        users!inner (
          first_name,
          last_name,
          email
        ),
        admin_users!inner (
          users!inner (
            first_name,
            last_name,
            email
          )
        )
      `)
      .order('reset_at', { ascending: false })
      .limit(10);

    if (startDate) {
      tierChangesQuery = tierChangesQuery.gte('reset_at', startDate);
    }
    if (endDate) {
      tierChangesQuery = tierChangesQuery.lte('reset_at', endDate);
    }

    const { data: recentTierChanges, error: changesError } = await tierChangesQuery;

    if (changesError) {
      console.error('❌ Error fetching recent tier changes:', changesError);
      // Don't fail the entire request, just log the error
    }

    // Process tier analytics data
    const processedTierAnalytics = (tierAnalytics || []).map(tier => ({
      tierLevel: tier.tier_level,
      userCount: parseInt(tier.user_count.toString()),
      totalPointsEarned: parseInt(tier.total_points_earned.toString()),
      totalSpent: parseFloat(tier.total_spent.toString()),
      avgPointsPerUser: parseFloat(tier.avg_points_per_user.toString()),
      avgSpentPerUser: parseFloat(tier.avg_spent_per_user.toString()),
      tierUpgradesCount: parseInt(tier.tier_upgrades_count.toString()),
      tierResetsCount: parseInt(tier.tier_resets_count.toString())
    }));

    // Process coupon analytics data
    const processedCouponAnalytics = (couponAnalytics || []).map(coupon => ({
      tierLevel: coupon.tier_level,
      couponCode: coupon.coupon_code,
      couponName: coupon.coupon_name,
      usageCount: parseInt(coupon.usage_count.toString()),
      totalDiscountAmount: parseFloat(coupon.total_discount_amount.toString()),
      avgDiscountAmount: parseFloat(coupon.avg_discount_amount.toString()),
      totalOrderValue: parseFloat(coupon.total_order_value.toString())
    }));

    // Process recent tier changes
    const processedTierChanges = (recentTierChanges || []).map(change => ({
      id: change.id,
      oldTier: change.old_tier,
      newTier: change.new_tier,
      reason: change.reason,
      resetAt: change.reset_at,
      user: {
        name: [change.users.first_name, change.users.last_name].filter(Boolean).join(' ') || 'Unknown User',
        email: change.users.email
      },
      admin: {
        name: [change.admin_users.users.first_name, change.admin_users.users.last_name].filter(Boolean).join(' ') || 'Unknown Admin',
        email: change.admin_users.users.email
      }
    }));

    // Calculate summary statistics
    const totalUsers = processedTierAnalytics.reduce((sum, tier) => sum + tier.userCount, 0);
    const totalPointsEarned = processedTierAnalytics.reduce((sum, tier) => sum + tier.totalPointsEarned, 0);
    const totalSpent = processedTierAnalytics.reduce((sum, tier) => sum + tier.totalSpent, 0);
    const totalTierUpgrades = processedTierAnalytics.reduce((sum, tier) => sum + tier.tierUpgradesCount, 0);
    const totalTierResets = processedTierAnalytics.reduce((sum, tier) => sum + tier.tierResetsCount, 0);

    const totalCouponUsage = processedCouponAnalytics.reduce((sum, coupon) => sum + coupon.usageCount, 0);
    const totalCouponDiscount = processedCouponAnalytics.reduce((sum, coupon) => sum + coupon.totalDiscountAmount, 0);

    // Calculate tier distribution percentages
    const tierDistribution = processedTierAnalytics.map(tier => ({
      tierLevel: tier.tierLevel,
      userCount: tier.userCount,
      percentage: totalUsers > 0 ? Math.round((tier.userCount / totalUsers) * 100) : 0
    }));

    // Group coupon analytics by tier
    const couponAnalyticsByTier = processedCouponAnalytics.reduce((acc, coupon) => {
      if (!acc[coupon.tierLevel]) {
        acc[coupon.tierLevel] = [];
      }
      acc[coupon.tierLevel].push(coupon);
      return acc;
    }, {} as Record<string, typeof processedCouponAnalytics>);

    const summary = {
      totalUsers,
      totalPointsEarned,
      totalSpent,
      avgPointsPerUser: totalUsers > 0 ? Math.round(totalPointsEarned / totalUsers) : 0,
      avgSpentPerUser: totalUsers > 0 ? Math.round(totalSpent / totalUsers) : 0,
      totalTierUpgrades,
      totalTierResets,
      totalCouponUsage,
      totalCouponDiscount,
      avgCouponDiscount: totalCouponUsage > 0 ? Math.round(totalCouponDiscount / totalCouponUsage) : 0
    };

    console.log('✅ Tier analytics fetched successfully:', {
      tierCount: processedTierAnalytics.length,
      couponAnalyticsCount: processedCouponAnalytics.length,
      recentChangesCount: processedTierChanges.length,
      summary
    });

    return NextResponse.json({
      success: true,
      data: {
        tierAnalytics: processedTierAnalytics,
        couponAnalytics: processedCouponAnalytics,
        couponAnalyticsByTier,
        recentTierChanges: processedTierChanges,
        tierDistribution,
        summary,
        dateRange: {
          startDate: startDate || null,
          endDate: endDate || null
        }
      }
    });

  } catch (error) {
    console.error('❌ Admin tier analytics error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});
