export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag, revalidatePath } from 'next/cache';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { withAdminAuth } from '@/lib/auth/admin-middleware';

/**
 * Admin Tier-Specific Coupon Management API
 * GET /api/admin/tiers/coupons - Get tier-specific coupons with analytics
 * POST /api/admin/tiers/coupons - Create tier-specific coupon
 */

export const GET = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('🎫 Admin tier coupons request received');

    const url = new URL(request.url);
    const searchParams = url.searchParams;

    // Filter parameters
    const tierFilter = searchParams.get('tier') || '';
    const statusFilter = searchParams.get('status') || 'active';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';

    console.log('📊 Query params:', { tierFilter, statusFilter, startDate, endDate });

    const serviceClient = createServiceRoleClient();
    if (!serviceClient) {
      console.error('❌ Failed to create service role client');
      return NextResponse.json({
        success: false,
        error: 'Service configuration error'
      }, { status: 500 });
    }

    // Get tier-specific coupons with usage analytics
    let couponsQuery = serviceClient
      .from('coupons')
      .select(`
        id,
        code,
        name,
        description,
        discount_type,
        discount_value,
        total_usage_limit,
        per_user_usage_limit,
        current_usage_count,
        minimum_order_amount,
        starts_at,
        expires_at,
        status,
        is_tier_specific,
        tier_restrictions,
        created_at,
        updated_at,
        tier_coupon_usage_tracking (
          id,
          user_tier_at_usage,
          discount_amount,
          order_total,
          used_at
        )
      `)
      .eq('is_tier_specific', true);

    // Apply status filter
    if (statusFilter && statusFilter !== 'all') {
      couponsQuery = couponsQuery.eq('status', statusFilter);
    }

    const { data: coupons, error: couponsError } = await couponsQuery
      .order('created_at', { ascending: false });

    if (couponsError) {
      console.error('❌ Error fetching tier coupons:', couponsError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch tier coupons'
      }, { status: 500 });
    }

    // Process coupons data with analytics
    const processedCoupons = (coupons || []).map(coupon => {
      const usageTracking = coupon.tier_coupon_usage_tracking || [];

      // Filter by date range if provided
      let filteredUsage = usageTracking;
      if (startDate) {
        filteredUsage = filteredUsage.filter(usage =>
          new Date(usage.used_at) >= new Date(startDate)
        );
      }
      if (endDate) {
        filteredUsage = filteredUsage.filter(usage =>
          new Date(usage.used_at) <= new Date(endDate)
        );
      }

      // Filter by tier if provided
      if (tierFilter && tierFilter !== 'all') {
        filteredUsage = filteredUsage.filter(usage =>
          usage.user_tier_at_usage === tierFilter
        );
      }

      // Calculate analytics
      const tierUsageStats = filteredUsage.reduce((acc, usage) => {
        const tier = usage.user_tier_at_usage;
        if (!acc[tier]) {
          acc[tier] = {
            count: 0,
            totalDiscount: 0,
            totalOrderValue: 0
          };
        }
        acc[tier].count += 1;
        acc[tier].totalDiscount += parseFloat(usage.discount_amount.toString());
        acc[tier].totalOrderValue += parseFloat(usage.order_total.toString());
        return acc;
      }, {} as Record<string, { count: number; totalDiscount: number; totalOrderValue: number }>);

      const totalUsage = filteredUsage.length;
      const totalDiscount = filteredUsage.reduce((sum, usage) =>
        sum + parseFloat(usage.discount_amount.toString()), 0
      );
      const totalOrderValue = filteredUsage.reduce((sum, usage) =>
        sum + parseFloat(usage.order_total.toString()), 0
      );

      return {
        id: coupon.id,
        code: coupon.code,
        name: coupon.name,
        description: coupon.description,
        discountType: coupon.discount_type,
        discountValue: coupon.discount_value,
        totalUsageLimit: coupon.total_usage_limit,
        perUserUsageLimit: coupon.per_user_usage_limit,
        currentUsageCount: coupon.current_usage_count,
        minimumOrderAmount: coupon.minimum_order_amount,
        startsAt: coupon.starts_at,
        expiresAt: coupon.expires_at,
        status: coupon.status,
        isTierSpecific: coupon.is_tier_specific,
        tierRestrictions: coupon.tier_restrictions,
        createdAt: coupon.created_at,
        updatedAt: coupon.updated_at,
        analytics: {
          totalUsage,
          totalDiscount,
          totalOrderValue,
          averageDiscount: totalUsage > 0 ? totalDiscount / totalUsage : 0,
          averageOrderValue: totalUsage > 0 ? totalOrderValue / totalUsage : 0,
          tierBreakdown: tierUsageStats
        }
      };
    });

    // Filter by tier restrictions if tier filter is applied
    const finalCoupons = tierFilter && tierFilter !== 'all'
      ? processedCoupons.filter(coupon => {
          const restrictions = coupon.tierRestrictions as string[] | null;
          return restrictions && restrictions.includes(tierFilter);
        })
      : processedCoupons;

    // Calculate summary statistics
    const summary = {
      totalCoupons: finalCoupons.length,
      activeCoupons: finalCoupons.filter(c => c.status === 'active').length,
      totalUsage: finalCoupons.reduce((sum, c) => sum + c.analytics.totalUsage, 0),
      totalDiscount: finalCoupons.reduce((sum, c) => sum + c.analytics.totalDiscount, 0),
      tierDistribution: finalCoupons.reduce((acc, coupon) => {
        const restrictions = coupon.tierRestrictions as string[] | null;
        if (restrictions) {
          restrictions.forEach(tier => {
            acc[tier] = (acc[tier] || 0) + 1;
          });
        }
        return acc;
      }, {} as Record<string, number>)
    };

    console.log('✅ Tier coupons fetched successfully:', {
      totalCoupons: finalCoupons.length,
      summary
    });

    {
      const response = NextResponse.json({
        success: true,
        data: {
          coupons: finalCoupons,
          summary,
          filters: {
            tier: tierFilter,
            status: statusFilter,
            startDate,
            endDate
          }
        }
      })
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
      response.headers.set('Vary', 'Cookie, Authorization, Accept-Encoding')
      return response
    }

  } catch (error) {
    console.error('❌ Admin tier coupons error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});

export const POST = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('🎫 Admin create tier coupon request received');

    const body = await request.json();
    const {
      code,
      name,
      description,
      discountType,
      discountValue,
      tierRestrictions,
      totalUsageLimit,
      perUserUsageLimit,
      minimumOrderAmount,
      expiresAt
    } = body;

    if (!code || !name || !discountType || !discountValue || !tierRestrictions) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 });
    }

    console.log('📋 Create tier coupon params:', {
      code,
      name,
      discountType,
      discountValue,
      tierRestrictions,
      adminId: adminUser.id
    });

    const serviceClient = createServiceRoleClient();
    if (!serviceClient) {
      console.error('❌ Failed to create service role client');
      return NextResponse.json({
        success: false,
        error: 'Service configuration error'
      }, { status: 500 });
    }

    // Check if coupon code already exists
    const { data: existingCoupon, error: checkError } = await serviceClient
      .from('coupons')
      .select('id')
      .eq('code', code.toUpperCase().trim())
      .single();

    if (existingCoupon) {
      return NextResponse.json({
        success: false,
        error: 'Coupon code already exists'
      }, { status: 400 });
    }

    // Create the tier-specific coupon
    const couponData = {
      code: code.toUpperCase().trim(),
      name: name.trim(),
      description: description?.trim() || null,
      discount_type: discountType,
      discount_value: parseFloat(discountValue),
      is_tier_specific: true,
      tier_restrictions: JSON.stringify(tierRestrictions),
      total_usage_limit: totalUsageLimit || null,
      per_user_usage_limit: perUserUsageLimit || null,
      minimum_order_amount: minimumOrderAmount || null,
      expires_at: expiresAt || null,
      status: 'active',
      created_by: adminUser.user_id,
      metadata: {
        created_by_admin: true,
        tier_specific: true,
        admin_user_id: adminUser.id
      }
    };

    const { data: newCoupon, error: createError } = await serviceClient
      .from('coupons')
      .insert(couponData)
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating tier coupon:', createError);
      return NextResponse.json({
        success: false,
        error: 'Failed to create tier coupon: ' + createError.message
      }, { status: 500 });
    }

    console.log('✅ Tier coupon created successfully:', {
      id: newCoupon.id,
      code: newCoupon.code,
      tierRestrictions
    });

    {
      // Revalidate caches affected by coupon changes
      try {
        revalidateTag('coupons')
        revalidatePath('/en/fyponly-admin/coupons')
      } catch {}

      const response = NextResponse.json({
        success: true,
        data: {
          coupon: {
            id: newCoupon.id,
            code: newCoupon.code,
            name: newCoupon.name,
            description: newCoupon.description,
            discountType: newCoupon.discount_type,
            discountValue: newCoupon.discount_value,
            tierRestrictions: JSON.parse(newCoupon.tier_restrictions || '[]'),
            createdAt: newCoupon.created_at
          }
        },
        message: `Tier-specific coupon "${newCoupon.code}" created successfully`
      })
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
      response.headers.set('Vary', 'Cookie, Authorization, Accept-Encoding')
      return response
    }

  } catch (error) {
    console.error('❌ Admin create tier coupon error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});
