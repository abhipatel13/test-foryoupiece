import { NextRequest, NextResponse } from 'next/server'
import { couponService } from '@/lib/services/coupon-service'
import { createClient } from '@/lib/supabase/server'

/**
 * Apply a coupon to an order (used during checkout)
 * POST /api/coupons/apply
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🎫 Coupon application API called')

    // Get authenticated user
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const body = await request.json()
    const { code, orderId, orderTotal } = body

    if (!code || !orderId || orderTotal === undefined) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: code, orderId, or orderTotal'
      }, { status: 400 })
    }

    if (orderTotal < 0) {
      return NextResponse.json({
        success: false,
        error: 'Invalid order total'
      }, { status: 400 })
    }

    console.log('🎫 Applying coupon to order:', { code, userId: user.id, orderId, orderTotal })

    const applicationResult = await couponService.applyCouponToOrder(code, user.id, orderId, orderTotal)

    console.log('✅ Coupon application result:', applicationResult)

    if (!applicationResult.success) {
      return NextResponse.json({
        success: false,
        error: applicationResult.errorMessage
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: {
        discountAmount: applicationResult.discountAmount,
        coupon: applicationResult.coupon
      }
    })
  } catch (error: any) {
    console.error('❌ Coupon application failed:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to apply coupon'
    }, { status: 500 })
  }
}
