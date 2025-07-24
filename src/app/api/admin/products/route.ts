import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

/**
 * Get products with filtering and pagination (Admin endpoint for testing)
 * GET /api/admin/products
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Admin Products API called');
    
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    console.log('📊 Query params:', { limit, offset });

    // Use Supabase service role client (bypasses RLS)
    const supabase = createServiceRoleClient();
    
    console.log('🔗 Supabase client created');

    const { data: products, error, count } = await supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    console.log('📦 Database query result:', { 
      productsCount: products?.length, 
      totalCount: count, 
      error: error?.message 
    });

    if (error) {
      console.error('❌ Database error:', error);
      return NextResponse.json({
        success: false,
        error: error.message,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: products || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    });

  } catch (error) {
    console.error('❌ Admin Products API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
    }, { status: 500 });
  }
}
