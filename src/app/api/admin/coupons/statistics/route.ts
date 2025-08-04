import { NextRequest, NextResponse } from 'next/server'
import { couponService } from '@/lib/services/coupon-service'
import { withAdminAuth } from '@/lib/auth/admin-middleware'

/**
 * Get coupon statistics for admin dashboard
 * GET /api/admin/coupons/statistics
 */
export const GET = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('📊 Admin coupon statistics API called')

    const statistics = await couponService.getCouponStatistics()

    console.log('✅ Coupon statistics retrieved successfully')

    return NextResponse.json({
      success: true,
      data: statistics
    })
  } catch (error: any) {
    console.error('❌ Failed to get coupon statistics:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to get coupon statistics'
    }, { status: 500 })
  }
});
