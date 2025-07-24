import { NextRequest, NextResponse } from 'next/server'
import { couponService } from '@/lib/services/coupon-service'

/**
 * Get coupon statistics for admin dashboard
 * GET /api/admin/coupons/statistics
 */
export async function GET(request: NextRequest) {
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
}
