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
    // Include SKU to ensure product detail links work from listing pages.
    const safeFields = `
      id,
      sku,
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

    // Track resolved category id once
    let categoryId: string | null = null

    // STRICT CATEGORY FILTERING - NO KEYWORD FALLBACKS
    if (categorySlug) {
      console.log(`🎯 FIXED API: Filtering by category slug: ${categorySlug}`);

      const category = await CategoriesService.getCategoryBySlug(categorySlug);

      if (category) {
        console.log(`🎯 FIXED API: Found category: ${category.name_en || category.name_ja || 'Unknown'} (ID: ${category.id})`);
        categoryId = category.id
        // ONLY use category_id - NO keyword-based filtering
        query = query.eq('category_id', categoryId);
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

    // Apply sorting fields (we'll apply them per stock group fetch)
    const applyOrdering = (q: any) => {
      if (recentlyAdded) {
        return q
          .order('boxhero_last_sync_at', { ascending: false, nullsLast: true })
          .order('created_at', { ascending: false })
      }
      return q.order('created_at', { ascending: false })
    }

    // DEALS view: Include products with (discount) OR (enhanced points > 1.0)
    if (deals) {
      // Pre-filter at DB level to promotions to avoid missing older discounted items
      const promoQuery = query.or('compare_at_price.gt.0,points_rate.gt.1.0')
      let { data: products, error } = await promoQuery.limit(1000)

      if (error) {
        console.error('🎯 DEALS API: Database error:', error)
        return NextResponse.json(
          { error: 'Failed to fetch products', details: error.message },
          { status: 500 }
        )
      }

      // Filter products that have (price discounts) OR (enhanced points)
      const dealsProducts = (products || []).filter(product => {
        const hasDiscount = product.compare_at_price && product.compare_at_price > product.price
        const hasEnhancedPoints = (product.points_rate ?? 1) > 1.0
        const hasValidPrice = typeof product.price === 'number' && product.price > 0
        const hasImage = Array.isArray(product.images) && product.images.length > 0
        const inStock = product.stock_quantity > 0
        return (hasDiscount || hasEnhancedPoints) && hasValidPrice && hasImage && inStock
      })

      // Sort: prioritize discount percentage, then points rate
      dealsProducts.sort((a, b) => {
        const aDiscountPercent = a.compare_at_price && a.compare_at_price > a.price
          ? ((a.compare_at_price - a.price) / a.compare_at_price) * 100
          : 0
        const bDiscountPercent = b.compare_at_price && b.compare_at_price > b.price
          ? ((b.compare_at_price - b.price) / b.compare_at_price) * 100
          : 0
        if (bDiscountPercent !== aDiscountPercent) return bDiscountPercent - aDiscountPercent
        const aPoints = (a.points_rate ?? 1)
        const bPoints = (b.points_rate ?? 1)
        return bPoints - aPoints
      })

      // For deals view ('See all'), return the complete list of qualifying products
      return NextResponse.json({
        success: true,
        data: dealsProducts,
        pagination: {
          total: dealsProducts.length,
          limit: dealsProducts.length,
          offset: 0,
          page: 1,
          totalPages: 1,
          hasMore: false,
          hasPrevious: false,
          startItem: 1,
          endItem: dealsProducts.length,
        },
      })
    }

    // GLOBAL stock-first pagination across pages
    // 1) Count in-stock and out-of-stock items matching filters
    const countBase = createAnonymousClient()
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('is_deleted', false)

    // Re-apply category filter for counts
    let inStockCountQuery = countBase.clone ? countBase.clone() : createAnonymousClient().from('products').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('is_deleted', false)
    let outStockCountQuery = countBase.clone ? countBase.clone() : createAnonymousClient().from('products').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('is_deleted', false)

    if (categorySlug) {
      const category = await CategoriesService.getCategoryBySlug(categorySlug)
      if (!category) {
        return NextResponse.json({
          products: [],
          pagination: { page, limit, total: 0, totalPages: 0, hasMore: false }
        })
      }
      inStockCountQuery = inStockCountQuery.eq('category_id', category.id)
      outStockCountQuery = outStockCountQuery.eq('category_id', category.id)
    }

    if (search) {
      const orClause = `name_en.ilike.%${search}%,name_ja.ilike.%${search}%,description_en.ilike.%${search}%,description_ja.ilike.%${search}%,sku.ilike.%${search}%`
      inStockCountQuery = inStockCountQuery.or(orClause)
      outStockCountQuery = outStockCountQuery.or(orClause)
    }

    const [{ count: inStockCount, error: inErr }, { count: outStockCount, error: outErr }] = await Promise.all([
      inStockCountQuery.gt('stock_quantity', 0),
      outStockCountQuery.lte('stock_quantity', 0)
    ])

    if (inErr || outErr) {
      console.error('❌ Count query error:', inErr || outErr)
      return NextResponse.json({ error: 'Failed to count products' }, { status: 500 })
    }

    const totalIn = inStockCount || 0
    const totalOut = outStockCount || 0
    const totalCount = totalIn + totalOut

    // 2) Fetch the correct slice(s)
    const supa = createAnonymousClient()
    const buildDataQuery = () => {
      let q = supa
        .from('products')
        .select(safeFields)
        .eq('is_active', true)
        .eq('is_deleted', false)

      if (categoryId) {
        q = q.eq('category_id', categoryId)
      }
      if (search) {
        q = q.or(`name_en.ilike.%${search}%,name_ja.ilike.%${search}%,description_en.ilike.%${search}%,description_ja.ilike.%${search}%,sku.ilike.%${search}%`)
      }
      return applyOrdering(q)
    }

    let results: any[] = []

    if (offset < totalIn) {
      // Fetch from in-stock first
      const start = offset
      const end = Math.min(totalIn - 1, offset + limit - 1)
      const { data: firstChunk, error: fetchErr1 } = await buildDataQuery()
        .gt('stock_quantity', 0)
        .range(start, end)

      if (fetchErr1) {
        console.error('❌ Fetch in-stock slice error:', fetchErr1)
        return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
      }
      results = firstChunk || []

      if (results.length < limit) {
        const need = limit - results.length
        const outStart = 0
        const outEnd = need - 1
        const { data: secondChunk, error: fetchErr2 } = await buildDataQuery()
          .lte('stock_quantity', 0)
          .range(outStart, outEnd)
        if (fetchErr2) {
          console.error('❌ Fetch out-of-stock tail error:', fetchErr2)
          return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
        }
        results = results.concat(secondChunk || [])
      }
    } else {
      // Entirely within out-of-stock pages
      const outStart = offset - totalIn
      const outEnd = outStart + limit - 1
      const { data: chunk, error: fetchErr } = await buildDataQuery()
        .lte('stock_quantity', 0)
        .range(outStart, outEnd)
      if (fetchErr) {
        console.error('❌ Fetch out-of-stock slice error:', fetchErr)
        return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
      }
      results = chunk || []
    }

    // 3) Response with accurate pagination meta
    const totalPages = Math.ceil(totalCount / limit)
    const currentPage = Math.floor(offset / limit) + 1

    return NextResponse.json({
      success: true,
      data: results,
      pagination: {
        total: totalCount,
        limit,
        offset,
        page: currentPage,
        totalPages,
        hasMore: totalCount > offset + results.length,
        hasPrevious: offset > 0,
        startItem: totalCount === 0 ? 0 : offset + 1,
        endItem: Math.min(offset + results.length, totalCount),
      },
    })

  } catch (error) {
    console.error('❌ Admin Products API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
    }, { status: 500 });
  }
}
