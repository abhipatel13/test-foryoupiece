import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

const BOXHERO_API_TOKEN = process.env.BOXHERO_API_TOKEN;

interface BoxHeroItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  price?: number;
  category?: string;
  location_id?: number;
}

/**
 * POST /api/admin/boxhero/sync-products
 * Sync product stock quantities from BoxHero to Supabase
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting BoxHero product stock sync...');

    if (!BOXHERO_API_TOKEN) {
      throw new Error('BoxHero API token not configured');
    }

    const body = await request.json().catch(() => ({}));
    const triggeredBy = body.triggeredBy || 'api';

    const startTime = Date.now();
    let itemsUpdated = 0;
    let itemsSkipped = 0;
    let errors: string[] = [];

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
          .select('id, name, stock_quantity, is_deleted')
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

        // Only update if stock quantity has changed
        if (currentStock !== newStock) {
          const { error: updateError } = await supabase
            .from('products')
            .update({ 
              stock_quantity: newStock,
              updated_at: new Date().toISOString()
            })
            .eq('id', product.id);

          if (updateError) {
            console.error(`❌ Error updating product ${product.id}:`, updateError);
            errors.push(`Update error for ${product.name}: ${updateError.message}`);
          } else {
            console.log(`✅ Updated ${product.name}: ${currentStock} → ${newStock}`);
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
    const success = errors.length === 0;

    console.log(`✅ Product stock sync completed!`);
    console.log(`📊 Updated: ${itemsUpdated}, Skipped: ${itemsSkipped}, Errors: ${errors.length}, Duration: ${duration}ms`);

    return NextResponse.json({
      success,
      message: success ? 'Product stock sync completed successfully' : 'Product stock sync completed with errors',
      data: {
        itemsUpdated,
        itemsSkipped,
        totalItemsProcessed: boxHeroItems.length,
        errors: errors.slice(0, 10), // Limit error list
        duration,
        timestamp: new Date().toISOString(),
        triggeredBy
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Product stock sync failed:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        message: 'Product stock sync failed',
        error: errorMessage,
        data: {
          itemsUpdated: 0,
          itemsSkipped: 0,
          totalItemsProcessed: 0,
          errors: [errorMessage],
          duration: 0,
          timestamp: new Date().toISOString(),
          triggeredBy: 'api'
        }
      },
      { status: 500 }
    );
  }
}

/**
 * Fetch all items from BoxHero API with pagination
 */
async function fetchBoxHeroItems(): Promise<BoxHeroItem[]> {
  const allItems: BoxHeroItem[] = [];
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const url = new URL('https://rest-api.boxhero.io/v2/items');
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
 * GET /api/admin/boxhero/sync-products
 * Get sync status and recent sync history
 */
export async function GET() {
  try {
    // This could be enhanced to return actual sync history from a log table
    return NextResponse.json({
      success: true,
      message: 'Product sync endpoint is available',
      data: {
        endpoint: '/api/admin/boxhero/sync-products',
        methods: ['POST'],
        description: 'Sync product stock quantities from BoxHero to Supabase'
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to get sync status' },
      { status: 500 }
    );
  }
}
