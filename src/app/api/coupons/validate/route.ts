import { NextRequest, NextResponse } from 'next/server'
import { couponService } from '@/lib/services/coupon-service'
import { createClient } from '@/lib/supabase/server'

/**
 * Validate a coupon code for the current user
 * POST /api/coupons/validate
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🎫 Coupon validation API called')

    // Get authenticated user (required for validation to ensure correct targeting)
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required to validate coupons'
      }, { status: 401 })
    }

    const body = await request.json()
    const { code, orderTotal } = body || {}

    if (!code || orderTotal === undefined) {
      return NextResponse.json({
        success: false,
        error: 'Missing coupon code or order total'
      }, { status: 400 })
    }

    if (typeof orderTotal !== 'number' || Number.isNaN(orderTotal) || orderTotal < 0) {
      return NextResponse.json({
        success: false,
        error: 'Invalid order total'
      }, { status: 400 })
    }

    const userId = user.id
    console.log('🎫 Validating coupon:', { code, userId, orderTotal })

    const validationResult = await couponService.validateCoupon(code, userId, orderTotal)

    console.log('✅ Coupon validation result:', validationResult)

    return NextResponse.json({
      success: true,
      data: validationResult
    })
  } catch (error: any) {
    console.error('❌ Coupon validation failed:', error)
    // Map known auth errors to 401 instead of 500 when possible
    const message = error?.message || 'Failed to validate coupon'
    const status = message?.toLowerCase().includes('auth') ? 401 : 500
    return NextResponse.json({
      success: false,
      error: message
    }, { status })
  }
}
