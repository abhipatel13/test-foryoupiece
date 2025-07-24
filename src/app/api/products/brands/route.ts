import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * GET /api/products/brands
 * Get unique brands from products in the database
 */
export async function GET() {
  try {
    console.log('📦 Fetching unique brands from products...')
    
    const supabase = createServiceRoleClient()
    
    // Get unique brands from active products
    const { data: products, error } = await supabase
      .from('products')
      .select('brand')
      .eq('is_active', true)
      .not('brand', 'is', null)
      .not('brand', 'eq', '')
    
    if (error) {
      console.error('❌ Error fetching brands:', error)
      throw error
    }
    
    // Extract unique brands and sort them
    const uniqueBrands = [...new Set(
      products
        .map(p => p.brand)
        .filter(brand => brand && brand.trim() !== '')
    )].sort()
    
    console.log(`✅ Found ${uniqueBrands.length} unique brands`)
    
    return NextResponse.json({
      success: true,
      brands: uniqueBrands,
      total: uniqueBrands.length
    })
    
  } catch (error) {
    console.error('❌ Brands API error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch brands',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
