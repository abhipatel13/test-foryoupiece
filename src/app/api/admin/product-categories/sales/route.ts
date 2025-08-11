import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { withAdminAuth } from '@/lib/auth/admin-middleware'

/**
 * Sales/Discount Products API Endpoint
 * GET /api/admin/product-categories/sales - Get products with discounts
 * PUT /api/admin/product-categories/sales - Bulk update discount prices
 */

/**
 * Get products with active discounts (compare_at_price > price)
 * GET /api/admin/product-categories/sales
 */
export const GET = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('💰 Sales Products API called');
    
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    
    // Parse query parameters
    const search = searchParams.get('search') || '';
    const discountMin = searchParams.get('discount_min') ? parseFloat(searchParams.get('discount_min')!) : 0;
    const discountMax = searchParams.get('discount_max') ? parseFloat(searchParams.get('discount_max')!) : 100;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortBy = searchParams.get('sort') || 'discount_desc';

    console.log('📊 Query params:', { search, discountMin, discountMax, limit, offset, sortBy });

    // Use service role client to bypass RLS
    const supabase = createServiceRoleClient();

    // Build base query for products with discounts OR high points rates
    let query = supabase
      .from('products')
      .select(`
        id,
        sku,
        name_en,
        name_ja,
        price,
        compare_at_price,
        points_rate,
        stock_quantity,
        is_active,
        images,
        created_at,
        updated_at,
        categories (
          id,
          name_en,
          slug
        )
      `, { count: 'exact' })
      .or('and(compare_at_price.not.is.null,compare_at_price.gt.0),points_rate.gt.1');

    // Add search filter
    if (search) {
      query = query.or(`name_en.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    // Execute query
    const { data: products, error, count } = await query
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('❌ Error fetching sales products:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch sales products: ' + error.message
      }, { status: 500 });
    }

    // Filter and calculate discount/reward data
    const salesProducts = (products || [])
      .filter(product => {
        // Include products with actual discounts OR high points rates
        const hasDiscount = product.compare_at_price && product.price && product.compare_at_price > product.price;
        const hasHighPointsRate = product.points_rate && product.points_rate > 1;
        return hasDiscount || hasHighPointsRate;
      })
      .map(product => {
        // Calculate discount data
        const hasDiscount = product.compare_at_price && product.price && product.compare_at_price > product.price;
        const discountAmount = hasDiscount ? product.compare_at_price - product.price : 0;
        const discountPercentage = hasDiscount ? Math.round((discountAmount / product.compare_at_price) * 100) : 0;

        // Calculate points data
        const pointsRate = product.points_rate || 1; // Default to 1% if not set
        const pointsEarned = Math.round(product.price * pointsRate);

        return {
          ...product,
          discount_amount: discountAmount,
          discount_percentage: discountPercentage,
          savings: discountAmount,
          points_rate: pointsRate,
          points_earned: pointsEarned,
          has_discount: hasDiscount,
          has_high_points: pointsRate > 1
        };
      })
      .filter(product => {
        // Apply discount percentage filters
        return product.discount_percentage >= discountMin && product.discount_percentage <= discountMax;
      });

    // Apply sorting
    salesProducts.sort((a, b) => {
      switch (sortBy) {
        case 'discount_desc':
          return b.discount_percentage - a.discount_percentage;
        case 'discount_asc':
          return a.discount_percentage - b.discount_percentage;
        case 'savings_desc':
          return b.savings - a.savings;
        case 'savings_asc':
          return a.savings - b.savings;
        case 'points_desc':
          return b.points_rate - a.points_rate;
        case 'points_asc':
          return a.points_rate - b.points_rate;
        case 'name_asc':
          return a.name_en.localeCompare(b.name_en);
        case 'name_desc':
          return b.name_en.localeCompare(a.name_en);
        case 'price_asc':
          return a.price - b.price;
        case 'price_desc':
          return b.price - a.price;
        default:
          // Sort by discount first, then by points rate
          if (b.discount_percentage !== a.discount_percentage) {
            return b.discount_percentage - a.discount_percentage;
          }
          return b.points_rate - a.points_rate;
      }
    });

    console.log(`✅ Sales products fetched: ${salesProducts.length} products with discounts`);

    return NextResponse.json({
      success: true,
      data: salesProducts,
      pagination: {
        total: salesProducts.length,
        limit,
        offset,
        hasMore: salesProducts.length === limit
      },
      summary: {
        total_products: salesProducts.length,
        discount_products: salesProducts.filter(p => p.has_discount).length,
        high_points_products: salesProducts.filter(p => p.has_high_points).length,
        average_discount: salesProducts.length > 0
          ? Math.round(salesProducts.reduce((sum, p) => sum + p.discount_percentage, 0) / salesProducts.length)
          : 0,
        average_points_rate: salesProducts.length > 0
          ? Math.round((salesProducts.reduce((sum, p) => sum + p.points_rate, 0) / salesProducts.length) * 10) / 10
          : 0,
        total_savings: salesProducts.reduce((sum, p) => sum + p.savings, 0)
      }
    });

  } catch (error) {
    console.error('❌ Sales products API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});

/**
 * Bulk update discount prices for multiple products
 * PUT /api/admin/product-categories/sales
 */
export const PUT = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('💰 Bulk sales update API called');
    
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
      const { id, price, compare_at_price, discount_percentage } = update;

      // Validate data
      if (!id) {
        results.push({ id, success: false, error: 'Missing product ID' });
        continue;
      }

      let updateData: any = {};

      if (operation === 'set_discount_percentage' && discount_percentage !== undefined) {
        // Calculate new compare_at_price based on discount percentage
        const currentPrice = price || 0;
        const newCompareAtPrice = Math.round((currentPrice / (1 - discount_percentage / 100)) * 100) / 100;
        updateData.compare_at_price = newCompareAtPrice;
      } else if (operation === 'set_prices' && price !== undefined && compare_at_price !== undefined) {
        // Validate price constraint
        if (compare_at_price < price) {
          results.push({ id, success: false, error: 'Compare at price must be greater than or equal to price' });
          continue;
        }
        updateData.price = price;
        updateData.compare_at_price = compare_at_price;
      } else if (operation === 'remove_discount') {
        updateData.compare_at_price = null;
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
    console.error('❌ Bulk sales update error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});
