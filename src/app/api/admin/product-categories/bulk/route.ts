import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag, revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { withAdminAuth } from '@/lib/auth/admin-middleware'

/**
 * Bulk Operations API Endpoint for Product Categories
 * POST /api/admin/product-categories/bulk - Handle bulk operations for sales and best sellers
 */

interface BulkOperation {
  operation: 'apply_discount' | 'remove_discount' | 'set_best_seller' | 'remove_best_seller' | 'reorder_best_sellers'
  product_ids: string[]
  data?: {
    discount_percentage?: number
    compare_at_price?: number
    best_seller_positions?: { [productId: string]: number }
    start_position?: number
  }
}

/**
 * Handle bulk operations for product categories
 * POST /api/admin/product-categories/bulk
 */
export const POST = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('🔄 Bulk operations API called');
    
    const body: BulkOperation = await request.json();
    const { operation, product_ids, data } = body;

    if (!operation || !product_ids || !Array.isArray(product_ids)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid operation data'
      }, { status: 400 });
    }

    console.log('📝 Bulk operation:', { operation, productCount: product_ids.length, data });

    const supabase = createServiceRoleClient();
    const results = [];

    switch (operation) {
      case 'apply_discount':
        await handleApplyDiscount(supabase, product_ids, data, results);
        break;
      
      case 'remove_discount':
        await handleRemoveDiscount(supabase, product_ids, results);
        break;
      
      case 'set_best_seller':
        await handleSetBestSeller(supabase, product_ids, data, results);
        break;
      
      case 'remove_best_seller':
        await handleRemoveBestSeller(supabase, product_ids, results);
        break;
      
      case 'reorder_best_sellers':
        await handleReorderBestSellers(supabase, data, results);
        break;
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Unknown operation'
        }, { status: 400 });
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    console.log(`✅ Bulk operation completed: ${successCount} success, ${errorCount} errors`);

    // Revalidate caches affected by bulk operations
    try {
      // Sales-related operations affect product listings
      if (operation === 'apply_discount' || operation === 'remove_discount') {
        revalidateTag('products')
      }
      // Best-seller operations also impact product lists
      if (operation === 'set_best_seller' || operation === 'remove_best_seller' || operation === 'reorder_best_sellers') {
        revalidateTag('products')
      }
    } catch {}

    // Signal admin cache invalidation endpoint for broader client refreshes (best-effort)
    try {
      const requestOrigin = request.headers.get('origin') || `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}`
      fetch(`${requestOrigin}/api/admin/cache/invalidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cacheTypes: ['products'], reason: `bulk_${operation}`, forceRefresh: true })
      }).catch(() => {})
    } catch {}

    return NextResponse.json({
      success: true,
      operation,
      results,
      summary: {
        total: results.length,
        success: successCount,
        errors: errorCount
      }
    });

  } catch (error) {
    console.error('❌ Bulk operations error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});

/**
 * Apply discount to multiple products
 */
async function handleApplyDiscount(supabase: any, productIds: string[], data: any, results: any[]) {
  const discountPercentage = data?.discount_percentage;
  
  if (!discountPercentage || discountPercentage <= 0 || discountPercentage >= 100) {
    for (const id of productIds) {
      results.push({ id, success: false, error: 'Invalid discount percentage' });
    }
    return;
  }

  for (const productId of productIds) {
    try {
      // Get current product price
      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('price')
        .eq('id', productId)
        .single();

      if (fetchError || !product) {
        results.push({ id: productId, success: false, error: 'Product not found' });
        continue;
      }

      // Calculate new compare_at_price based on discount percentage
      const currentPrice = product.price;
      const newCompareAtPrice = Math.round((currentPrice / (1 - discountPercentage / 100)) * 100) / 100;

      // Update product
      const { error: updateError } = await supabase
        .from('products')
        .update({ compare_at_price: newCompareAtPrice })
        .eq('id', productId);

      if (updateError) {
        results.push({ id: productId, success: false, error: updateError.message });
      } else {
        results.push({ 
          id: productId, 
          success: true, 
          data: { 
            price: currentPrice, 
            compare_at_price: newCompareAtPrice,
            discount_percentage: discountPercentage
          }
        });
      }
    } catch (error) {
      results.push({ id: productId, success: false, error: 'Processing error' });
    }
  }
}

/**
 * Remove discount from multiple products
 */
async function handleRemoveDiscount(supabase: any, productIds: string[], results: any[]) {
  for (const productId of productIds) {
    const { error: updateError } = await supabase
      .from('products')
      .update({
        compare_at_price: null,
        points_rate: 1.0, // Reset to default 1.0%
      })
      .eq('id', productId);

    if (updateError) {
      results.push({ id: productId, success: false, error: updateError.message });
    } else {
      results.push({ id: productId, success: true });
    }
  }
}

/**
 * Set products as best sellers
 */
async function handleSetBestSeller(supabase: any, productIds: string[], data: any, results: any[]) {
  let currentPosition = data?.start_position || 1;

  for (const productId of productIds) {
    const { error: updateError } = await supabase
      .from('products')
      .update({
        is_best_seller: true,
        best_seller_position: currentPosition
      })
      .eq('id', productId);

    if (updateError) {
      results.push({ id: productId, success: false, error: updateError.message });
    } else {
      results.push({ 
        id: productId, 
        success: true, 
        data: { position: currentPosition }
      });
      currentPosition++;
    }
  }
}

/**
 * Remove products from best sellers
 */
async function handleRemoveBestSeller(supabase: any, productIds: string[], results: any[]) {
  for (const productId of productIds) {
    const { error: updateError } = await supabase
      .from('products')
      .update({
        is_best_seller: false,
        best_seller_position: null
      })
      .eq('id', productId);

    if (updateError) {
      results.push({ id: productId, success: false, error: updateError.message });
    } else {
      results.push({ id: productId, success: true });
    }
  }
}

/**
 * Reorder best seller positions
 */
async function handleReorderBestSellers(supabase: any, data: any, results: any[]) {
  const positions = data?.best_seller_positions;
  
  if (!positions || typeof positions !== 'object') {
    results.push({ success: false, error: 'Invalid positions data' });
    return;
  }

  for (const [productId, position] of Object.entries(positions)) {
    const { error: updateError } = await supabase
      .from('products')
      .update({ best_seller_position: position })
      .eq('id', productId);

    if (updateError) {
      results.push({ id: productId, success: false, error: updateError.message });
    } else {
      results.push({ 
        id: productId, 
        success: true, 
        data: { position }
      });
    }
  }
}
