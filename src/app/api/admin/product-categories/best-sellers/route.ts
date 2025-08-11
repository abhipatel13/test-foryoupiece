import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { withAdminAuth } from '@/lib/auth/admin-middleware'

/**
 * Best Sellers API Endpoint
 * GET /api/admin/product-categories/best-sellers - Get best seller products
 * PUT /api/admin/product-categories/best-sellers - Bulk update best seller status/positions
 * POST /api/admin/product-categories/best-sellers - Add products to best sellers
 * DELETE /api/admin/product-categories/best-sellers - Remove products from best sellers
 */

/**
 * Get products marked as best sellers (is_best_seller = true)
 * GET /api/admin/product-categories/best-sellers
 */
export const GET = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('⭐ Best Sellers API called');
    
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    
    // Parse query parameters
    const search = searchParams.get('search') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortBy = searchParams.get('sort') || 'position_asc';
    const includeInactive = searchParams.get('include_inactive') === 'true';

    console.log('📊 Query params:', { search, limit, offset, sortBy, includeInactive });

    // Use service role client to bypass RLS
    const supabase = createServiceRoleClient();

    // Build base query for best seller products
    let query = supabase
      .from('products')
      .select(`
        id,
        sku,
        name_en,
        name_ja,
        price,
        compare_at_price,
        stock_quantity,
        is_active,
        is_best_seller,
        best_seller_position,
        images,
        created_at,
        updated_at,
        categories (
          id,
          name_en,
          slug
        )
      `, { count: 'exact' })
      .eq('is_best_seller', true);

    // Filter by active status unless including inactive
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    // Add search filter
    if (search) {
      query = query.or(`name_en.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    // Execute query
    const { data: products, error, count } = await query
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('❌ Error fetching best seller products:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch best seller products: ' + error.message
      }, { status: 500 });
    }

    // Process and sort best seller products
    const bestSellerProducts = (products || [])
      .map(product => {
        // Calculate discount info if applicable
        const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;
        const discountAmount = hasDiscount ? product.compare_at_price - product.price : 0;
        const discountPercentage = hasDiscount 
          ? Math.round((discountAmount / product.compare_at_price) * 100)
          : 0;

        return {
          ...product,
          has_discount: hasDiscount,
          discount_amount: discountAmount,
          discount_percentage: discountPercentage,
          position: product.best_seller_position || 999 // Default high position for unranked
        };
      });

    // Apply sorting
    bestSellerProducts.sort((a, b) => {
      switch (sortBy) {
        case 'position_asc':
          return a.position - b.position;
        case 'position_desc':
          return b.position - a.position;
        case 'name_asc':
          return a.name_en.localeCompare(b.name_en);
        case 'name_desc':
          return b.name_en.localeCompare(a.name_en);
        case 'price_asc':
          return a.price - b.price;
        case 'price_desc':
          return b.price - a.price;
        case 'stock_asc':
          return a.stock_quantity - b.stock_quantity;
        case 'stock_desc':
          return b.stock_quantity - a.stock_quantity;
        default:
          return a.position - b.position;
      }
    });

    console.log(`✅ Best seller products fetched: ${bestSellerProducts.length} products`);

    return NextResponse.json({
      success: true,
      data: bestSellerProducts,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      },
      summary: {
        total_best_sellers: bestSellerProducts.length,
        positioned_products: bestSellerProducts.filter(p => p.position < 999).length,
        unpositioned_products: bestSellerProducts.filter(p => p.position >= 999).length,
        with_discounts: bestSellerProducts.filter(p => p.has_discount).length
      }
    });

  } catch (error) {
    console.error('❌ Best sellers API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});

/**
 * Bulk update best seller status and positions
 * PUT /api/admin/product-categories/best-sellers
 */
export const PUT = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('⭐ Bulk best sellers update API called');
    
    const body = await request.json();
    const { updates, operation } = body;

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid updates data'
      }, { status: 400 });
    }

    console.log('📝 Bulk update data:', { operation, updatesCount: updates.length });

    const supabase = createServiceRoleClient();
    const results = [];

    for (const update of updates) {
      const { id, is_best_seller, best_seller_position } = update;

      // Validate data
      if (!id) {
        results.push({ id, success: false, error: 'Missing product ID' });
        continue;
      }

      let updateData: any = {};

      if (operation === 'set_positions') {
        updateData.is_best_seller = true;
        updateData.best_seller_position = best_seller_position || 0;
      } else if (operation === 'toggle_status') {
        updateData.is_best_seller = is_best_seller;
        if (!is_best_seller) {
          updateData.best_seller_position = null;
        }
      } else if (operation === 'remove_all') {
        updateData.is_best_seller = false;
        updateData.best_seller_position = null;
      }

      // Update product
      const { error: updateError } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        console.error(`❌ Error updating product ${id}:`, updateError);
        results.push({ id, success: false, error: updateError.message });
      } else {
        results.push({ id, success: true });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    console.log(`✅ Bulk update completed: ${successCount} success, ${errorCount} errors`);

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: results.length,
        success: successCount,
        errors: errorCount
      }
    });

  } catch (error) {
    console.error('❌ Bulk best sellers update error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});

/**
 * Add products to best sellers list
 * POST /api/admin/product-categories/best-sellers
 */
export const POST = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('⭐ Add to best sellers API called');
    
    const body = await request.json();
    const { product_ids, start_position } = body;

    if (!product_ids || !Array.isArray(product_ids)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid product_ids data'
      }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const results = [];
    let currentPosition = start_position || 1;

    for (const productId of product_ids) {
      const { error: updateError } = await supabase
        .from('products')
        .update({
          is_best_seller: true,
          best_seller_position: currentPosition
        })
        .eq('id', productId);

      if (updateError) {
        console.error(`❌ Error adding product ${productId} to best sellers:`, updateError);
        results.push({ id: productId, success: false, error: updateError.message });
      } else {
        results.push({ id: productId, success: true, position: currentPosition });
        currentPosition++;
      }
    }

    const successCount = results.filter(r => r.success).length;

    console.log(`✅ Added ${successCount} products to best sellers`);

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: results.length,
        success: successCount,
        errors: results.length - successCount
      }
    });

  } catch (error) {
    console.error('❌ Add to best sellers error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});

/**
 * Remove products from best sellers list
 * DELETE /api/admin/product-categories/best-sellers
 */
export const DELETE = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('⭐ Remove from best sellers API called');
    
    const body = await request.json();
    const { product_ids } = body;

    if (!product_ids || !Array.isArray(product_ids)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid product_ids data'
      }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const results = [];

    for (const productId of product_ids) {
      const { error: updateError } = await supabase
        .from('products')
        .update({
          is_best_seller: false,
          best_seller_position: null
        })
        .eq('id', productId);

      if (updateError) {
        console.error(`❌ Error removing product ${productId} from best sellers:`, updateError);
        results.push({ id: productId, success: false, error: updateError.message });
      } else {
        results.push({ id: productId, success: true });
      }
    }

    const successCount = results.filter(r => r.success).length;

    console.log(`✅ Removed ${successCount} products from best sellers`);

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: results.length,
        success: successCount,
        errors: results.length - successCount
      }
    });

  } catch (error) {
    console.error('❌ Remove from best sellers error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});
