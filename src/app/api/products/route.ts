import { NextRequest, NextResponse } from 'next/server';
import { createAnonymousClient } from '@/lib/supabase/server';
import { CategoriesService } from '@/lib/categories-service'
import { sortProductsByStockPriority } from '@/lib/utils';

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
    const deals = searchParams.get('deals') === 'true';

    console.log('🎯 FIXED API Query params:', { limit, page, offset, categorySlug, search, recentlyAdded, deals });

    // SECURITY FIX: Use anonymous client instead of service role to ensure RLS applies
    const supabase = createAnonymousClient();

    console.log('🔗 Supabase client created');

    // SECURITY FIX: Explicit field selection instead of wildcard to prevent data leakage
    const safeFields = `
      id,
      name_en,
      name_ja,
      description_en,
      description_ja,
      short_description_en,
      short_description_ja,
      price,
      compare_at_price,
      images,
      stock_quantity,
      stock_status,
      category_id,
      brand,
      is_featured,
      tags,
      points_rate,
      created_at,
      updated_at
    `;

    // Build query with category filtering
    let query = supabase
      .from('products')
      .select(safeFields, { count: 'exact' })
      .eq('is_active', true)
      .eq('is_deleted', false); // SECURITY FIX: Exclude soft-deleted products

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

    // For deals filtering, we need to get all products first, then filter client-side
    // because the filtering logic is complex (discount OR enhanced points)
    let { data: products, error, count } = await query
      .range(offset, offset + limit - 1);

    // Apply deals filtering if requested
    if (deals && products) {
      console.log(`🎯 DEALS API: Filtering for deals and discounts`);

      // Filter products that have price discounts (compare_at_price > price)
      // TODO: Add enhanced points support when points_rate field is added to products table
      const dealsProducts = products.filter(product => {
        // Check for price discount (compare_at_price > price)
        const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;
        const hasValidPrice = typeof product.price === 'number' && product.price > 0;
        const hasImage = Array.isArray(product.images) && product.images.length > 0;
        const inStock = product.stock_quantity > 0;
        return hasDiscount && hasValidPrice && hasImage && inStock;
      });

      // Sort deals by discount percentage (descending)
      dealsProducts.sort((a, b) => {
        // Calculate discount percentages
        const aDiscountPercent = a.compare_at_price && a.compare_at_price > a.price
          ? ((a.compare_at_price - a.price) / a.compare_at_price) * 100
          : 0;
        const bDiscountPercent = b.compare_at_price && b.compare_at_price > b.price
          ? ((b.compare_at_price - b.price) / b.compare_at_price) * 100
          : 0;

        // Sort by discount percentage (descending)
        return bDiscountPercent - aDiscountPercent;
      });

      products = dealsProducts;
      count = dealsProducts.length;

      console.log(`🎯 DEALS API: Filtered to ${products.length} deals products`);
    }

    console.log(`🎯 FIXED API: Result - Products: ${products?.length || 0}, Total: ${count || 0}`);

    if (error) {
      console.error('🎯 FIXED API: Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch products', details: error.message },
        { status: 500 }
      );
    }

    // Apply global stock-priority sorting while preserving existing sort logic
    let sortedProducts = products || [];
    if (sortedProducts.length > 0) {
      // Define secondary sort function based on request type
      const secondarySort = (a: any, b: any) => {
        if (recentlyAdded) {
          // For recently added: BoxHero sync timestamp first, then creation date
          const aSync = a.boxhero_last_sync_at ? new Date(a.boxhero_last_sync_at).getTime() : 0;
          const bSync = b.boxhero_last_sync_at ? new Date(b.boxhero_last_sync_at).getTime() : 0;
          if (bSync !== aSync) return bSync - aSync;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        } else {
          // Default: creation date descending
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
      };

      sortedProducts = sortProductsByStockPriority(sortedProducts, secondarySort);
    }

    const totalPages = Math.ceil((count || 0) / limit);
    const currentPage = Math.floor(offset / limit) + 1;

    return NextResponse.json({
      success: true,
      data: sortedProducts,
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
