import { NextRequest, NextResponse } from 'next/server'
import { couponService } from '@/lib/services/coupon-service'

/**
 * Get coupon usage history
 * GET /api/admin/coupons/usage
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📊 Admin coupon usage API called')

    const url = new URL(request.url)
    const searchParams = url.searchParams

    // Parse query parameters
    const couponId = searchParams.get('couponId') || undefined
    const userId = searchParams.get('userId') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    console.log('📊 Query params:', { couponId, userId, page, limit })

    const result = await couponService.getCouponUsageHistory(couponId, userId, page, limit)

    return NextResponse.json({
      success: true,
      data: result.usage,
      pagination: {
        page: result.page,
        limit,
        total: result.total,
        totalPages: result.totalPages
      }
    })
  } catch (error: any) {
    console.error('❌ Failed to get coupon usage:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to get coupon usage'
    }, { status: 500 })
  }
}
