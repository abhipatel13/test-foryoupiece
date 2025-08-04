import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching sample products for debugging...');
    
    const supabase = createServiceRoleClient();
    
    // Get a sample of products to understand the structure
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name_en, images, category_id, is_active')
      .eq('is_active', true)
      .limit(10);

    if (error) {
      console.error('❌ Error fetching products:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    // Also get categories to understand the relationship
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('id, name_en, slug')
      .eq('is_active', true);

    if (categoriesError) {
      console.error('❌ Error fetching categories:', categoriesError);
    }

    return NextResponse.json({
      success: true,
      data: {
        products: products || [],
        categories: categories || [],
        productCount: products?.length || 0,
        categoryCount: categories?.length || 0,
        sampleProduct: products?.[0] || null
      }
    });

  } catch (error) {
    console.error('🚨 Debug products error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
