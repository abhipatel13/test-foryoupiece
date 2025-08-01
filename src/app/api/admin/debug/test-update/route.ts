import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { withAdminAuth } from '@/lib/auth/admin-middleware'

/**
 * Debug API to test product updates and identify production issues
 * POST /api/admin/debug/test-update
 */
export const POST = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('🔍 DEBUG: Test update API called')
    
    const body = await request.json()
    const { productId, testData } = body

    if (!productId) {
      return NextResponse.json({
        success: false,
        error: 'Product ID is required'
      }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    
    if (!supabase) {
      console.error('❌ DEBUG: Failed to create service role client')
      return NextResponse.json({
        success: false,
        error: 'Service role client creation failed',
        debug: {
          environment: process.env.NODE_ENV,
          hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL
        }
      }, { status: 500 })
    }

    console.log('🔍 DEBUG: Environment check:', {
      nodeEnv: process.env.NODE_ENV,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      serviceKeyLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length,
      urlValue: process.env.NEXT_PUBLIC_SUPABASE_URL
    })

    // Test 1: Check if we can read the product
    console.log('🔍 DEBUG: Test 1 - Reading product')
    const { data: product, error: readError } = await supabase
      .from('products')
      .select('id, sku, name_en, is_best_seller, best_seller_position')
      .eq('id', productId)
      .single()

    if (readError) {
      console.error('❌ DEBUG: Read error:', readError)
      return NextResponse.json({
        success: false,
        error: 'Failed to read product',
        debug: {
          readError: readError.message,
          code: readError.code,
          details: readError.details
        }
      }, { status: 500 })
    }

    console.log('✅ DEBUG: Product read successful:', product)

    // Test 2: Try a simple update (just updated_at)
    console.log('🔍 DEBUG: Test 2 - Simple update (updated_at only)')
    const { data: simpleUpdate, error: simpleError } = await supabase
      .from('products')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', productId)
      .select('id, updated_at')
      .single()

    if (simpleError) {
      console.error('❌ DEBUG: Simple update error:', simpleError)
      return NextResponse.json({
        success: false,
        error: 'Simple update failed',
        debug: {
          simpleError: simpleError.message,
          code: simpleError.code,
          details: simpleError.details
        }
      }, { status: 500 })
    }

    console.log('✅ DEBUG: Simple update successful:', simpleUpdate)

    // Test 3: Try updating best seller fields specifically
    console.log('🔍 DEBUG: Test 3 - Best seller fields update')
    const testBestSeller = testData?.is_best_seller ?? true
    const testPosition = testData?.best_seller_position ?? 999

    const { data: bestSellerUpdate, error: bestSellerError } = await supabase
      .from('products')
      .update({
        is_best_seller: testBestSeller,
        best_seller_position: testPosition,
        updated_at: new Date().toISOString()
      })
      .eq('id', productId)
      .select('id, is_best_seller, best_seller_position, updated_at')
      .single()

    if (bestSellerError) {
      console.error('❌ DEBUG: Best seller update error:', bestSellerError)
      return NextResponse.json({
        success: false,
        error: 'Best seller update failed',
        debug: {
          bestSellerError: bestSellerError.message,
          code: bestSellerError.code,
          details: bestSellerError.details,
          updateData: {
            is_best_seller: testBestSeller,
            best_seller_position: testPosition
          }
        }
      }, { status: 500 })
    }

    console.log('✅ DEBUG: Best seller update successful:', bestSellerUpdate)

    // Test 4: Verify the update persisted by reading again
    console.log('🔍 DEBUG: Test 4 - Verify persistence')
    const { data: verifyProduct, error: verifyError } = await supabase
      .from('products')
      .select('id, sku, name_en, is_best_seller, best_seller_position, updated_at')
      .eq('id', productId)
      .single()

    if (verifyError) {
      console.error('❌ DEBUG: Verify read error:', verifyError)
      return NextResponse.json({
        success: false,
        error: 'Failed to verify update',
        debug: {
          verifyError: verifyError.message,
          code: verifyError.code
        }
      }, { status: 500 })
    }

    console.log('✅ DEBUG: Verification successful:', verifyProduct)

    return NextResponse.json({
      success: true,
      message: 'All tests passed',
      debug: {
        environment: process.env.NODE_ENV,
        originalProduct: product,
        simpleUpdate: simpleUpdate,
        bestSellerUpdate: bestSellerUpdate,
        verifyProduct: verifyProduct,
        testData: {
          is_best_seller: testBestSeller,
          best_seller_position: testPosition
        }
      }
    })

  } catch (error) {
    console.error('❌ DEBUG: Unexpected error:', error)
    return NextResponse.json({
      success: false,
      error: 'Unexpected error occurred',
      debug: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    }, { status: 500 })
  }
})
