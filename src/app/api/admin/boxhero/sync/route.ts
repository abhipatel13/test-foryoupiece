import { NextRequest, NextResponse } from 'next/server';
import { BoxHeroSyncService } from '@/lib/boxhero-sync';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { withAdminAuth } from '@/lib/auth/admin-middleware';

const BOXHERO_API_TOKEN = process.env.BOXHERO_API_TOKEN;

/**
 * POST /api/admin/boxhero/sync
 * Manually trigger comprehensive BoxHero sync (categories + products + stock quantities)
 */
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    console.log('🔄 Manual BoxHero comprehensive sync triggered via API');
    const startTime = Date.now(); // Track sync start time for metrics

    // Get the user who triggered the sync (optional)
    const body = await request.json().catch(() => ({}));
    const triggeredBy = body.triggeredBy || 'api';
    const syncImages = body.syncImages !== false; // Default to true
    const syncProducts = body.syncProducts !== false; // Default to true

    // Step 1: Perform category sync (existing functionality)
    console.log('📂 Step 1: Syncing categories...');
    const categoryResult = await BoxHeroSyncService.syncCategoriesComprehensive(triggeredBy, syncImages);

    let productResult = { itemsUpdated: 0, itemsSkipped: 0, totalItemsProcessed: 0, errors: [], duration: 0 };

    // Step 2: Perform product stock sync (new functionality)
    if (syncProducts && categoryResult.success && BOXHERO_API_TOKEN) {
      console.log('📦 Step 2: Syncing product stock quantities...');

      try {
        const productSyncResult = await syncProductStockQuantities(triggeredBy);
        productResult = productSyncResult;

        if (productResult.errors.length === 0) {
          console.log(`✅ Product sync completed: ${productResult.itemsUpdated} updated, ${productResult.itemsSkipped} skipped`);
        } else {
          console.error('❌ Product sync completed with errors:', productResult.errors);
        }
      } catch (error) {
        console.error('❌ Product sync error:', error);
        productResult.errors.push(error instanceof Error ? error.message : 'Unknown product sync error');
      }
    }

    // Combine results
    const totalDuration = categoryResult.duration + productResult.duration;
    const success = categoryResult.success && productResult.errors.length === 0;
    if (success) {
      console.log(`✅ BoxHero comprehensive sync completed successfully!`);
      console.log(`📊 Categories: ${categoryResult.categoriesSynced}, Products: ${productResult.itemsUpdated}, Duration: ${totalDuration}ms`);

      // Store BoxHero sync metrics in sync_reports table for dashboard
      try {
        console.log('📊 Storing BoxHero sync metrics for dashboard...');
        const supabase = createServiceRoleClient();

        // Get the actual BoxHero metrics by fetching from BoxHero API
        const boxHeroItems = await fetchBoxHeroItems();
        const uniqueProducts = boxHeroItems.length;
        const totalQuantity = boxHeroItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

        console.log(`📊 BoxHero metrics calculated from API: ${uniqueProducts} unique products, ${totalQuantity} total units`);

        // Store in sync_reports table
        const { error: reportError } = await supabase
          .from('sync_reports')
          .insert({
            sync_type: 'boxhero_comprehensive',
            status: 'completed',
            started_at: new Date(startTime).toISOString(),
            completed_at: new Date().toISOString(),
            duration_ms: totalDuration,
            after_stats: {
              products: uniqueProducts,
              total_stock: totalQuantity,
              categories: categoryResult.categoriesSynced
            },
            products_updated: productResult.itemsUpdated,
            categories_updated: categoryResult.categoriesSynced,
            triggered_by: triggeredBy
          });

        if (reportError) {
          console.error('❌ Failed to store sync metrics:', reportError);
        } else {
          console.log('✅ BoxHero sync metrics stored successfully for dashboard');
        }
      } catch (metricsError) {
        console.error('❌ Error storing BoxHero sync metrics:', metricsError);
        // Don't fail the sync if metrics storage fails
      }

      // Invalidate frontend caches after successful sync
      try {
        // Send cache invalidation signal to frontend
        const cacheInvalidationResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/cache/invalidate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            keys: ['products', 'categories', 'inventory'],
            reason: 'boxhero_sync_completed'
          })
        });

        if (!cacheInvalidationResponse.ok) {
          console.warn('⚠️ Cache invalidation failed, but sync completed successfully');
        } else {
          console.log('✅ Frontend cache invalidated after BoxHero sync');
        }
      } catch (cacheError) {
        console.warn('⚠️ Cache invalidation error:', cacheError);
        // Don't fail the sync if cache invalidation fails
      }

      return NextResponse.json({
        success: true,
        message: 'BoxHero comprehensive sync completed successfully',
        data: {
          categoriesSynced: categoryResult.categoriesSynced,
          totalItemsProcessed: categoryResult.totalItemsProcessed,
          imagesUpdated: categoryResult.imagesUpdated,
          productsUpdated: productResult.itemsUpdated,
          productsSkipped: productResult.itemsSkipped,
          productItemsProcessed: productResult.totalItemsProcessed,
          duration: totalDuration,
          timestamp: new Date().toISOString(),
          cacheInvalidated: true
        }
      });
    } else {
      console.error('❌ BoxHero comprehensive sync failed');

      return NextResponse.json(
        {
          success: false,
          message: 'BoxHero comprehensive sync failed',
          error: productResult.errors.length > 0 ? productResult.errors.join(', ') : categoryResult.error || 'Sync failed',
          data: {
            categoriesSynced: categoryResult.categoriesSynced,
            totalItemsProcessed: categoryResult.totalItemsProcessed,
            imagesUpdated: categoryResult.imagesUpdated,
            productsUpdated: productResult.itemsUpdated,
            productsSkipped: productResult.itemsSkipped,
            productItemsProcessed: productResult.totalItemsProcessed,
            errors: productResult.errors,
            duration: totalDuration,
            timestamp: new Date().toISOString()
          }
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Manual sync API error:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Failed to trigger BoxHero sync',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
});

/**
 * Sync product stock quantities from BoxHero to Supabase
 */
async function syncProductStockQuantities(triggeredBy: string) {
  const startTime = Date.now();
  let itemsUpdated = 0;
  let itemsSkipped = 0;
  let errors: string[] = [];

  try {
    // Step 1: Fetch all items from BoxHero API
    console.log('📡 Fetching items from BoxHero API...');
    const boxHeroItems = await fetchBoxHeroItems();

    if (!boxHeroItems || boxHeroItems.length === 0) {
      throw new Error('No items received from BoxHero API');
    }

    console.log(`📊 Received ${boxHeroItems.length} items from BoxHero`);

    // Step 2: Update stock quantities in Supabase
    console.log('💾 Updating stock quantities in Supabase...');
    const supabase = createServiceRoleClient();

    for (const item of boxHeroItems) {
      try {
        // Find product by SKU (skip deleted products)
        const { data: products, error: findError } = await supabase
          .from('products')
          .select('id, name_en, stock_quantity, is_deleted, is_trending, tags')
          .eq('sku', item.sku)
          .eq('is_deleted', false) // Skip deleted products
          .limit(1);

        if (findError) {
          console.error(`❌ Error finding product with SKU ${item.sku}:`, findError);
          errors.push(`Find error for SKU ${item.sku}: ${findError.message}`);
          continue;
        }

        if (!products || products.length === 0) {
          console.log(`⚠️ Product not found for SKU: ${item.sku}`);
          itemsSkipped++;
          continue;
        }

        const product = products[0];
        const currentStock = product.stock_quantity || 0;
        const newStock = item.quantity || 0;

        // Determine trending from BoxHero attrs if available
        const attrs = (item as any).attrs as Array<{ name: string; value?: any }>|undefined;
        const boxHeroTags = Array.isArray(attrs) ? attrs.map(a => a.name).filter(Boolean) : [];
        const isTrendingFromBoxHero = boxHeroTags.some(tag => {
          const t = String(tag).toLowerCase();
          return t.includes('trending') || t.includes('trend');
        });

        // Build update payload
        const updatePayload: any = {
          updated_at: new Date().toISOString()
        };
        if (currentStock !== newStock) {
          updatePayload.stock_quantity = newStock;
        }
        // Only set is_trending to true if BoxHero marks it trending; never unset here (manual flag respected)
        if (isTrendingFromBoxHero && product.is_trending !== true) {
          updatePayload.is_trending = true;
        }
        // Optionally merge tags if present
        if (boxHeroTags.length > 0) {
          const existingTags: string[] = Array.isArray(product.tags) ? product.tags : [];
          const merged = Array.from(new Set([...(existingTags || []), ...boxHeroTags]));
          updatePayload.tags = merged;
        }

        if (Object.keys(updatePayload).length > 1) { // more than just updated_at
          const { error: updateError } = await supabase
            .from('products')
            .update(updatePayload)
            .eq('id', product.id);

          if (updateError) {
            console.error(`❌ Error updating product ${product.id}:`, updateError);
            errors.push(`Update error for ${product.name_en}: ${updateError.message}`);
          } else {
            if (updatePayload.stock_quantity !== undefined) {
              console.log(`✅ Updated ${product.name_en}: ${currentStock} → ${newStock}`);
            }
            if (updatePayload.is_trending) {
              console.log(`🔥 Marked trending based on BoxHero tags: ${product.name_en}`);
            }
            itemsUpdated++;
          }
        } else {
          itemsSkipped++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Error processing item ${item.sku}:`, errorMessage);
        errors.push(`Processing error for ${item.sku}: ${errorMessage}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Product stock sync completed! Updated: ${itemsUpdated}, Skipped: ${itemsSkipped}, Errors: ${errors.length}`);

    return {
      itemsUpdated,
      itemsSkipped,
      totalItemsProcessed: boxHeroItems.length,
      errors: errors.slice(0, 10), // Limit error list
      duration
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Product stock sync failed:', errorMessage);

    return {
      itemsUpdated: 0,
      itemsSkipped: 0,
      totalItemsProcessed: 0,
      errors: [errorMessage],
      duration: Date.now() - startTime
    };
  }
}

/**
 * Fetch all items from BoxHero API with pagination
 */
async function fetchBoxHeroItems() {
  const allItems: any[] = [];
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const url = new URL('https://rest.boxhero-app.com/v1/items');
    if (cursor) {
      url.searchParams.set('cursor', cursor);
    }
    url.searchParams.set('limit', '100'); // Max items per request

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${BOXHERO_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`BoxHero API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.items && Array.isArray(data.items)) {
      allItems.push(...data.items);
    }

    hasMore = data.has_more || false;
    cursor = data.cursor || null;

    console.log(`📡 Fetched ${data.items?.length || 0} items (total: ${allItems.length})`);
  }

  return allItems;
}

/**
 * GET /api/admin/boxhero/sync
 * Get sync status and history
 */
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    console.log('📊 Fetching BoxHero sync status...');
    
    const status = await BoxHeroSyncService.getSyncStatus();
    
    return NextResponse.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Sync status API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        message: 'Failed to get sync status',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
});
