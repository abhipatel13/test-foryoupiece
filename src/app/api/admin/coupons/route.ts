import { NextRequest, NextResponse } from 'next/server'
import { couponService } from '@/lib/services/coupon-service'
import { CouponFormData, CouponListRequest } from '@/types/coupon'

/**
 * Get all coupons with filtering, sorting, and pagination
 * GET /api/admin/coupons
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🎫 Admin coupons list API called')

    const url = new URL(request.url)
    const searchParams = url.searchParams

    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') as any
    const discountType = searchParams.get('discountType') as any
    const search = searchParams.get('search')
    const createdBy = searchParams.get('createdBy')
    const sortField = searchParams.get('sortField') as any
    const sortDirection = searchParams.get('sortDirection') as 'asc' | 'desc'

    // Build request object
    const listRequest: CouponListRequest = {
      page,
      limit,
      filters: {
        ...(status && { status }),
        ...(discountType && { discountType }),
        ...(search && { search }),
        ...(createdBy && { createdBy })
      },
      ...(sortField && sortDirection && {
        sort: {
          field: sortField,
          direction: sortDirection
        }
      })
    }

    console.log('📊 Query params:', listRequest)

    const result = await couponService.listCoupons(listRequest)

    return NextResponse.json({
      success: true,
      data: result.coupons,
      pagination: {
        page: result.page,
        limit,
        total: result.total,
        totalPages: result.totalPages
      }
    })
  } catch (error: any) {
    console.error('❌ Failed to list coupons:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to list coupons'
    }, { status: 500 })
  }
}

/**
 * Create a new coupon
 * POST /api/admin/coupons
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🎫 Admin create coupon API called')

    const body = await request.json()
    const { couponData, createdBy } = body

    if (!couponData) {
      return NextResponse.json({
        success: false,
        error: 'Missing coupon data'
      }, { status: 400 })
    }

    // Validate required fields
    const requiredFields = ['code', 'name', 'discountType', 'discountValue']
    for (const field of requiredFields) {
      if (!couponData[field]) {
        return NextResponse.json({
          success: false,
          error: `Missing required field: ${field}`
        }, { status: 400 })
      }
    }

    // Validate discount value
    if (couponData.discountType === 'percentage' && (couponData.discountValue <= 0 || couponData.discountValue > 100)) {
      return NextResponse.json({
        success: false,
        error: 'Percentage discount must be between 0 and 100'
      }, { status: 400 })
    }

    if (couponData.discountType === 'fixed_amount' && couponData.discountValue <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Fixed amount discount must be greater than 0'
      }, { status: 400 })
    }

    // Convert dates
    const formData: CouponFormData = {
      ...couponData,
      startsAt: new Date(couponData.startsAt || new Date()),
      expiresAt: couponData.expiresAt ? new Date(couponData.expiresAt) : undefined
    }

    console.log('📝 Creating coupon with data:', formData)

    const coupon = await couponService.createCoupon(formData, createdBy)

    if (!coupon) {
      return NextResponse.json({
        success: false,
        error: 'Failed to create coupon'
      }, { status: 500 })
    }

    console.log('✅ Coupon created successfully:', coupon.id)

    return NextResponse.json({
      success: true,
      data: coupon
    })
  } catch (error: any) {
    console.error('❌ Failed to create coupon:', error)
    
    // Handle specific errors
    if (error.message.includes('already exists')) {
      return NextResponse.json({
        success: false,
        error: 'A coupon with this code already exists'
      }, { status: 409 })
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to create coupon'
    }, { status: 500 })
  }
}

/**
 * Update an existing coupon
 * PUT /api/admin/coupons
 */
export async function PUT(request: NextRequest) {
  try {
    console.log('🎫 Admin update coupon API called')

    const body = await request.json()
    const { id, couponData } = body

    if (!id || !couponData) {
      return NextResponse.json({
        success: false,
        error: 'Missing coupon ID or data'
      }, { status: 400 })
    }

    // Validate discount value if provided
    if (couponData.discountType && couponData.discountValue !== undefined) {
      if (couponData.discountType === 'percentage' && (couponData.discountValue <= 0 || couponData.discountValue > 100)) {
        return NextResponse.json({
          success: false,
          error: 'Percentage discount must be between 0 and 100'
        }, { status: 400 })
      }

      if (couponData.discountType === 'fixed_amount' && couponData.discountValue <= 0) {
        return NextResponse.json({
          success: false,
          error: 'Fixed amount discount must be greater than 0'
        }, { status: 400 })
      }
    }

    // Convert dates if provided
    const formData: Partial<CouponFormData> = {
      ...couponData,
      ...(couponData.startsAt && { startsAt: new Date(couponData.startsAt) }),
      ...(couponData.expiresAt && { expiresAt: new Date(couponData.expiresAt) })
    }

    console.log('📝 Updating coupon with data:', { id, formData })

    const coupon = await couponService.updateCoupon(id, formData)

    if (!coupon) {
      return NextResponse.json({
        success: false,
        error: 'Coupon not found'
      }, { status: 404 })
    }

    console.log('✅ Coupon updated successfully:', coupon.id)

    return NextResponse.json({
      success: true,
      data: coupon
    })
  } catch (error: any) {
    console.error('❌ Failed to update coupon:', error)
    
    // Handle specific errors
    if (error.message.includes('already exists')) {
      return NextResponse.json({
        success: false,
        error: 'A coupon with this code already exists'
      }, { status: 409 })
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to update coupon'
    }, { status: 500 })
  }
}

/**
 * Delete a coupon
 * DELETE /api/admin/coupons
 */
export async function DELETE(request: NextRequest) {
  try {
    console.log('🎫 Admin delete coupon API called')

    const url = new URL(request.url)
    const id = url.searchParams.get('id')

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Missing coupon ID'
      }, { status: 400 })
    }

    console.log('🗑️ Deleting coupon:', id)

    const success = await couponService.deleteCoupon(id)

    if (!success) {
      return NextResponse.json({
        success: false,
        error: 'Failed to delete coupon'
      }, { status: 500 })
    }

    console.log('✅ Coupon deleted successfully:', id)

    return NextResponse.json({
      success: true,
      message: 'Coupon deleted successfully'
    })
  } catch (error: any) {
    console.error('❌ Failed to delete coupon:', error)
    
    // Surface error details to admin without blocking used-coupon deletion
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to delete coupon'
    }, { status: 500 })
  }
}
