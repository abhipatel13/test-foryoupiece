import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { CategoriesService } from '@/lib/categories-service';

/**
 * Map category slugs to search keywords for product filtering
 * This provides fallback filtering for products not properly categorized
 */
function getCategoryKeywords(categorySlug: string): string[] {
  const keywordMap: Record<string, string[]> = {
    'hair': ['hair', 'shampoo', 'conditioner', 'treatment', 'scalp', 'keratin', 'ululis', 'honey', 'lucido'],
    'bath-body': ['bath', 'body', 'soap', 'wash', 'lotion', 'cream', 'dove', 'foam'],
    'skincare': ['skin', 'face', 'serum', 'moisturizer', 'cleanser', 'toner', 'mask', 'elixir', 'biore'],
    'makeup': ['makeup', 'cosmetic', 'foundation', 'lipstick', 'mascara', 'eyeshadow', 'blush'],
    'health-personal-care': ['health', 'supplement', 'vitamin', 'medicine', 'patch', 'eye drops', 'lycee'],
    'food-beverage': ['food', 'drink', 'tea', 'matcha', 'beverage', 'snack'],
    'home': ['home', 'household', 'cleaning', 'kitchen', 'bathroom']
  };

  return keywordMap[categorySlug] || [];
}

/**
 * FIXED Products API - STRICT CATEGORY FILTERING ONLY
 * This API uses ONLY category_id filtering - NO keyword fallbacks
 * GET /api/products
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🎯 FIXED API - STRICT CATEGORY FILTERING - TIMESTAMP:', new Date().toISOString());

    const url = new URL(request.url);
    const searchParams = url.searchParams;
    // Support both page-based and offset-based pagination
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50; // Default to 50 for category pages
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : (page - 1) * limit;

    const categorySlug = searchParams.get('category');
    const search = searchParams.get('search');
    const recentlyAdded = searchParams.get('recently_added') === 'true';

    console.log('🎯 FIXED API Query params:', { limit, page, offset, categorySlug, search, recentlyAdded });

    // Use Supabase service role client (bypasses RLS)
    const supabase = createServiceRoleClient();

    console.log('🔗 Supabase client created');

    // Build query with category filtering
    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('is_active', true);

    // STRICT CATEGORY FILTERING - NO KEYWORD FALLBACKS
    if (categorySlug) {
      console.log(`🎯 FIXED API: Filtering by category slug: ${categorySlug}`);

      const category = await CategoriesService.getCategoryBySlug(categorySlug);

      if (category) {
        console.log(`🎯 FIXED API: Found category: ${category.name_en || category.name_ja || 'Unknown'} (ID: ${category.id})`);

        // ONLY use category_id - NO keyword-based filtering
        query = query.eq('category_id', category.id);
        console.log(`🎯 FIXED API: Applied STRICT category_id filter ONLY`);
      } else {
        console.log(`🎯 FIXED API: Category not found, returning empty results`);
        // Return empty results if category not found
        return NextResponse.json({
          products: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasMore: false
          }
        });
      }
    }

    // Apply search filtering if provided
    if (search) {
      console.log(`🔍 Applying search filter: ${search}`);
      query = query.or(`name_en.ilike.%${search}%,name_ja.ilike.%${search}%,description_en.ilike.%${search}%,description_ja.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    // Apply sorting based on request type
    if (recentlyAdded) {
      // For recently added products, prioritize BoxHero sync timestamp, then creation date
      query = query
        .order('boxhero_last_sync_at', { ascending: false, nullsLast: true })
        .order('created_at', { ascending: false });
    } else {
      // Default sorting by creation date
      query = query.order('created_at', { ascending: false });
    }

    const { data: products, error, count } = await query
      .range(offset, offset + limit - 1);

    console.log(`🎯 FIXED API: Result - Products: ${products?.length || 0}, Total: ${count || 0}`);

    if (error) {
      console.error('🎯 FIXED API: Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch products', details: error.message },
        { status: 500 }
      );
    }

    const totalPages = Math.ceil((count || 0) / limit);
    const currentPage = Math.floor(offset / limit) + 1;

    return NextResponse.json({
      success: true,
      data: products || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        page: currentPage,
        totalPages,
        hasMore: (count || 0) > offset + limit,
        hasPrevious: offset > 0,
        startItem: offset + 1,
        endItem: Math.min(offset + limit, count || 0),
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
