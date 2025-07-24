import { NextRequest, NextResponse } from 'next/server'
import { couponService } from '@/lib/services/coupon-service'

/**
 * Get a specific coupon by ID
 * GET /api/admin/coupons/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🎫 Admin get coupon API called:', params.id)

    const coupon = await couponService.getCouponById(params.id)

    if (!coupon) {
      return NextResponse.json({
        success: false,
        error: 'Coupon not found'
      }, { status: 404 })
    }

    console.log('✅ Coupon retrieved successfully:', coupon.id)

    return NextResponse.json({
      success: true,
      data: coupon
    })
  } catch (error: any) {
    console.error('❌ Failed to get coupon:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to get coupon'
    }, { status: 500 })
  }
}
