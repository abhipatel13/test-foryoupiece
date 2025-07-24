import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * Update points rate for products (Admin only)
 * PATCH /api/admin/products/points-rate
 */
export async function PATCH(request: NextRequest) {
  try {
    console.log('🎯 Admin Points Rate Update API called')
    
    const body = await request.json()
    const { productIds, pointsRate, bulkUpdate = false } = body

    // Validate input
    if (!productIds || (!Array.isArray(productIds) && typeof productIds !== 'string')) {
      return NextResponse.json({
        success: false,
        error: 'Product IDs are required (string or array)'
      }, { status: 400 })
    }

    if (typeof pointsRate !== 'number' || pointsRate < 0 || pointsRate > 100) {
      return NextResponse.json({
        success: false,
        error: 'Points rate must be a number between 0 and 100'
      }, { status: 400 })
    }

    console.log('📝 Updating points rate:', { productIds, pointsRate, bulkUpdate })

    // Use service role client to bypass RLS
    const supabase = createServiceRoleClient()
    
    if (!supabase) {
      console.error('❌ Failed to create service role client')
      return NextResponse.json({
        success: false,
        error: 'Service configuration error'
      }, { status: 500 })
    }

    let updateResult

    if (bulkUpdate && Array.isArray(productIds)) {
      // Bulk update multiple products
      const { data, error } = await supabase
        .from('products')
        .update({ points_rate: pointsRate })
        .in('id', productIds)
        .select('id, name_en, points_rate')

      updateResult = { data, error }
    } else {
      // Single product update
      const productId = Array.isArray(productIds) ? productIds[0] : productIds
      
      const { data, error } = await supabase
        .from('products')
        .update({ points_rate: pointsRate })
        .eq('id', productId)
        .select('id, name_en, points_rate')
        .single()

      updateResult = { data: data ? [data] : null, error }
    }

    if (updateResult.error) {
      console.error('❌ Database update error:', updateResult.error)
      return NextResponse.json({
        success: false,
        error: updateResult.error.message
      }, { status: 500 })
    }

    console.log('✅ Points rate updated successfully:', updateResult.data)

    return NextResponse.json({
      success: true,
      message: `Points rate updated to ${pointsRate}% for ${updateResult.data?.length || 0} product(s)`,
      products: updateResult.data
    })

  } catch (error: any) {
    console.error('❌ Admin Points Rate Update API error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}

/**
 * Get products with their current points rates (Admin only)
 * GET /api/admin/products/points-rate
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📊 Admin Points Rate Query API called')
    
    const url = new URL(request.url)
    const searchParams = url.searchParams
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0

    console.log('📊 Query params:', { search, category, limit, offset })

    // Use service role client to bypass RLS
    const supabase = createServiceRoleClient()
    
    if (!supabase) {
      console.error('❌ Failed to create service role client')
      return NextResponse.json({
        success: false,
        error: 'Service configuration error',
        products: []
      }, { status: 500 })
    }

    // Build query
    let query = supabase
      .from('products')
      .select(`
        id,
        sku,
        name_en,
        price,
        compare_at_price,
        points_rate,
        is_active,
        categories (
          id,
          name_en,
          slug
        )
      `, { count: 'exact' })

    // Apply filters
    if (search) {
      query = query.or(`name_en.ilike.%${search}%,sku.ilike.%${search}%`)
    }

    if (category) {
      query = query.eq('category_id', category)
    }

    // Apply pagination
    query = query
      .range(offset, offset + limit - 1)
      .order('name_en', { ascending: true })

    const { data: products, error, count } = await query

    if (error) {
      console.error('❌ Database query error:', error)
      return NextResponse.json({
        success: false,
        error: error.message,
        products: []
      }, { status: 500 })
    }

    console.log(`✅ Retrieved ${products?.length || 0} products with points rates`)

    return NextResponse.json({
      success: true,
      products: products || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      }
    })

  } catch (error: any) {
    console.error('❌ Admin Points Rate Query API error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
      products: []
    }, { status: 500 })
  }
}

/**
 * Bulk update points rates from CSV or form data (Admin only)
 * POST /api/admin/products/points-rate
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📤 Admin Bulk Points Rate Update API called')
    
    const body = await request.json()
    const { updates } = body

    // Validate input
    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({
        success: false,
        error: 'Updates array is required'
      }, { status: 400 })
    }

    // Validate each update
    for (const update of updates) {
      if (!update.productId || typeof update.pointsRate !== 'number' || update.pointsRate < 0 || update.pointsRate > 100) {
        return NextResponse.json({
          success: false,
          error: 'Each update must have productId and pointsRate (0-100)'
        }, { status: 400 })
      }
    }

    console.log('📝 Processing bulk points rate updates:', updates.length)

    // Use service role client to bypass RLS
    const supabase = createServiceRoleClient()
    
    if (!supabase) {
      console.error('❌ Failed to create service role client')
      return NextResponse.json({
        success: false,
        error: 'Service configuration error'
      }, { status: 500 })
    }

    const results = []
    const errors = []

    // Process each update
    for (const update of updates) {
      try {
        const { data, error } = await supabase
          .from('products')
          .update({ points_rate: update.pointsRate })
          .eq('id', update.productId)
          .select('id, name_en, points_rate')
          .single()

        if (error) {
          errors.push({ productId: update.productId, error: error.message })
        } else {
          results.push(data)
        }
      } catch (err: any) {
        errors.push({ productId: update.productId, error: err.message })
      }
    }

    console.log(`✅ Bulk update completed: ${results.length} success, ${errors.length} errors`)

    return NextResponse.json({
      success: errors.length === 0,
      message: `Updated ${results.length} products, ${errors.length} errors`,
      results,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error: any) {
    console.error('❌ Admin Bulk Points Rate Update API error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}
