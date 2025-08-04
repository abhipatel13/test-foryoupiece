import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Debug endpoint to test wishlist functionality
 * GET /api/debug/wishlist
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Test 1: Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required',
        debug: {
          authError: authError?.message,
          hasUser: !!user
        }
      }, { status: 401 })
    }

    console.log('🔍 Debug: User authenticated:', user.id)

    // Test 2: Check if user exists in users table
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .eq('id', user.id)
      .single()

    console.log('🔍 Debug: User record:', userRecord, 'Error:', userError)

    // Test 3: Check if wishlist_items table exists by trying to query it
    const { data: tableTest, error: tableError } = await supabase
      .from('wishlist_items')
      .select('id')
      .limit(1)

    console.log('🔍 Debug: Table test:', tableTest, 'Error:', tableError)

    // Test 4: Try to query products table
    const { data: productsTest, error: productsError } = await supabase
      .from('products')
      .select('id, name_en')
      .limit(1)

    console.log('🔍 Debug: Products test:', productsTest, 'Error:', productsError)

    // Test 5: Try the actual wishlist query
    const { data: wishlistItems, error: wishlistError } = await supabase
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
          sku
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    console.log('🔍 Debug: Wishlist query result:', wishlistItems, 'Error:', wishlistError)

    return NextResponse.json({
      success: true,
      debug: {
        user: {
          id: user.id,
          email: user.email,
          userRecordExists: !!userRecord,
          userRecordError: userError?.message
        },
        database: {
          wishlistTableExists: !tableError,
          tableError: tableError?.message,
          productsTableExists: !productsError,
          productsError: productsError?.message
        },
        wishlistQuery: {
          success: !wishlistError,
          error: wishlistError?.message,
          itemCount: wishlistItems?.length || 0,
          items: wishlistItems
        }
      }
    })

  } catch (error) {
    console.error('❌ Debug API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      debug: {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined
      }
    }, { status: 500 })
  }
}
