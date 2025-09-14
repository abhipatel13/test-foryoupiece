export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

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

    {
      const response = NextResponse.json({
        success: true,
        data: statistics
      })
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
      response.headers.set('Vary', 'Cookie, Authorization, Accept-Encoding')
      return response
    }
  } catch (error: any) {
    console.error('❌ Failed to get coupon statistics:', error)
    {
      const response = NextResponse.json({
        success: false,
        error: error.message || 'Failed to get coupon statistics'
      }, { status: 500 })
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
      response.headers.set('Vary', 'Cookie, Authorization, Accept-Encoding')
      return response
    }
  }
});
