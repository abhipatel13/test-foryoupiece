import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Get user's wishlist items
 * GET /api/wishlist
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    console.log('💝 Wishlist API: Fetching wishlist for user:', user.id)

    // Fetch wishlist items with product details
    const { data: wishlistItems, error } = await supabase
      .from('wishlist_items')
      .select(`
        id,
        created_at,
        product:products(
          id,
          name_en,
          description_en,
          price,
          compare_at_price,
          sku,
          images,
          stock_quantity,
          is_active,
          category:categories(
            id,
            name_en,
            slug
          )
        ),
        variant:product_variants(
          id,
          title,
          price,
          compare_at_price,
          sku,
          stock_quantity
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Wishlist API error:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch wishlist'
      }, { status: 500 })
    }

    console.log(`✅ Wishlist API: Retrieved ${wishlistItems?.length || 0} items`)

    return NextResponse.json({
      success: true,
      data: wishlistItems || [],
      meta: {
        count: wishlistItems?.length || 0,
        userId: user.id
      }
    })

  } catch (error) {
    console.error('❌ Wishlist API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

/**
 * Add item to wishlist
 * POST /api/wishlist
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const body = await request.json()
    const { productId, variantId } = body

    if (!productId) {
      return NextResponse.json({
        success: false,
        error: 'Product ID is required'
      }, { status: 400 })
    }

    console.log('💝 Wishlist API: Adding item to wishlist:', { userId: user.id, productId, variantId })

    // Check if product exists and is active
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name_en, is_active')
      .eq('id', productId)
      .eq('is_active', true)
      .single()

    if (productError || !product) {
      return NextResponse.json({
        success: false,
        error: 'Product not found or inactive'
      }, { status: 404 })
    }

    // Check if item already exists in wishlist
    const { data: existingItem } = await supabase
      .from('wishlist_items')
      .select('id')
      .eq('user_id', user.id)
      .eq('product_id', productId)
      .eq('variant_id', variantId || null)
      .single()

    if (existingItem) {
      return NextResponse.json({
        success: false,
        error: 'This item is already in your wishlist',
        isAlreadyInWishlist: true
      }, { status: 409 })
    }

    // Add to wishlist
    const { data: wishlistItem, error } = await supabase
      .from('wishlist_items')
      .insert({
        user_id: user.id,
        product_id: productId,
        variant_id: variantId || null
      })
      .select(`
        id,
        created_at,
        product:products(
          id,
          name_en,
          price,
          images
        )
      `)
      .single()

    if (error) {
      console.error('❌ Wishlist add error:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to add item to wishlist'
      }, { status: 500 })
    }

    console.log('✅ Wishlist API: Item added successfully')

    return NextResponse.json({
      success: true,
      data: wishlistItem,
      message: `${product.name_en} added to your wishlist`
    })

  } catch (error) {
    console.error('❌ Wishlist API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

/**
 * Remove item from wishlist
 * DELETE /api/wishlist
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const url = new URL(request.url)
    const productId = url.searchParams.get('productId')
    const variantId = url.searchParams.get('variantId')

    if (!productId) {
      return NextResponse.json({
        success: false,
        error: 'Product ID is required'
      }, { status: 400 })
    }

    console.log('💝 Wishlist API: Removing item from wishlist:', { userId: user.id, productId, variantId })

    // Build delete query
    let query = supabase
      .from('wishlist_items')
      .delete()
      .eq('user_id', user.id)
      .eq('product_id', productId)

    // Add variant filter if provided
    if (variantId) {
      query = query.eq('variant_id', variantId)
    } else {
      query = query.is('variant_id', null)
    }

    const { error } = await query

    if (error) {
      console.error('❌ Wishlist remove error:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to remove item from wishlist'
      }, { status: 500 })
    }

    console.log('✅ Wishlist API: Item removed successfully')

    return NextResponse.json({
      success: true,
      message: 'Item removed from wishlist'
    })

  } catch (error) {
    console.error('❌ Wishlist API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
