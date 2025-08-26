import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { withSecureAdminAuth } from '@/lib/auth/secure-admin-middleware'

/**
 * Admin Trending Products API Endpoint
 * GET /api/admin/trending-products - Get admin trending products data
 * POST /api/admin/trending-products - Add manual trending product
 * PUT /api/admin/trending-products - Update trending product
 * DELETE /api/admin/trending-products - Remove trending product
 */

export const GET = withSecureAdminAuth(async (request: NextRequest, { user, adminUser, session }) => {
  try {
    console.log('🔥 Admin Trending Products API called')

    const supabase = createServiceRoleClient()

    // Get all trending products with detailed information
    const { data: trendingProducts, error } = await supabase
      .rpc('get_trending_products')

    if (error) {
      console.error('Error fetching admin trending products:', error)
      return NextResponse.json({ 
        error: 'Failed to fetch trending products',
        details: error.message 
      }, { status: 500 })
    }

    // Get system settings
    const { data: settings } = await supabase
      .from('trending_system_settings')
      .select('setting_key, setting_value, description, updated_at')

    // Get refresh history
    const { data: refreshHistory } = await supabase
      .from('trending_refresh_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    // Get product sales stats for analysis
    const { data: salesStats } = await supabase
      .from('product_sales_stats')
      .select(`
        product_id,
        total_sales_count,
        last_30_days_sales,
        last_7_days_sales,
        trending_score,
        products!inner(name_en, sku, is_active)
      `)
      .order('trending_score', { ascending: false })
      .limit(20)

    console.log(`✅ Admin trending data compiled: ${trendingProducts?.length || 0} products`)

    return NextResponse.json({
      success: true,
      trending_products: trendingProducts || [],
      settings: settings || [],
      refresh_history: refreshHistory || [],
      top_products_by_score: salesStats || []
    })

  } catch (error) {
    console.error('Error in getAdminTrendingProducts:', error)
    return NextResponse.json({ 
      error: 'Failed to get admin trending products',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})

export const POST = withSecureAdminAuth(async (request: NextRequest, { user, adminUser, session }) => {
  try {
    const body = await request.json()
    const { product_id, position, user_id } = body

    console.log('➕ Adding manual trending product:', { product_id, position, user_id })

    if (!product_id) {
      return NextResponse.json({
        error: 'Missing required field: product_id'
      }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    // Check if product exists
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name_en, sku')
      .eq('id', product_id)
      .eq('is_active', true)
      .single()

    if (productError || !product) {
      return NextResponse.json({ 
        error: 'Product not found or inactive' 
      }, { status: 404 })
    }

    // Determine a safe position value to satisfy DB constraint but ignore for frontend ordering
    let nextPosition = 1
    try {
      const { data: maxRow } = await supabase
        .from('manual_trending_products')
        .select('position')
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle()
      nextPosition = (maxRow?.position || 0) + 1
    } catch (e) {
      // Fallback to 1
      nextPosition = 1
    }

    // Add to manual trending products (position kept for compatibility only)
    const { data: trendingProduct, error: insertError } = await supabase
      .from('manual_trending_products')
      .insert({
        product_id,
        position: nextPosition,
        is_active: true,
        created_by: user_id || adminUser.id
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error adding manual trending product:', insertError)
      return NextResponse.json({ 
        error: 'Failed to add trending product',
        details: insertError.message 
      }, { status: 500 })
    }

    console.log('✅ Manual trending product added successfully')

    return NextResponse.json({
      success: true,
      message: 'Trending product added successfully',
      trending_product: trendingProduct
    })

  } catch (error) {
    console.error('Error adding manual trending product:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})

export const PUT = withSecureAdminAuth(async (request: NextRequest, { user, adminUser, session }) => {
  try {
    const body = await request.json()
    const { trending_id, position, is_active } = body

    console.log('✏️ Updating trending product:', { trending_id, position, is_active })

    if (!trending_id) {
      return NextResponse.json({ 
        error: 'Missing required field: trending_id' 
      }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const updateData: any = { updated_at: new Date().toISOString() }
    if (position !== undefined) updateData.position = position
    if (is_active !== undefined) updateData.is_active = is_active

    const { data: updatedProduct, error } = await supabase
      .from('manual_trending_products')
      .update(updateData)
      .eq('id', trending_id)
      .select()
      .single()

    if (error) {
      console.error('Error updating trending product:', error)
      return NextResponse.json({ 
        error: 'Failed to update trending product',
        details: error.message 
      }, { status: 500 })
    }

    console.log('✅ Trending product updated successfully')

    return NextResponse.json({
      success: true,
      message: 'Trending product updated successfully',
      trending_product: updatedProduct
    })

  } catch (error) {
    console.error('Error updating trending product:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})

export const DELETE = withSecureAdminAuth(async (request: NextRequest, { user, adminUser, session }) => {
  try {
    const url = new URL(request.url)
    const trending_id = url.searchParams.get('trending_id')

    console.log('🗑️ Removing trending product:', { trending_id })

    if (!trending_id) {
      return NextResponse.json({ 
        error: 'Missing required parameter: trending_id' 
      }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const { error } = await supabase
      .from('manual_trending_products')
      .delete()
      .eq('id', trending_id)

    if (error) {
      console.error('Error removing trending product:', error)
      return NextResponse.json({ 
        error: 'Failed to remove trending product',
        details: error.message 
      }, { status: 500 })
    }

    console.log('✅ Trending product removed successfully')

    return NextResponse.json({
      success: true,
      message: 'Trending product removed successfully'
    })

  } catch (error) {
    console.error('Error removing trending product:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})
