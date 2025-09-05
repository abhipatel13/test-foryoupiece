import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { withAdminAuth } from '@/lib/auth/admin-middleware';


const BOXHERO_API_TOKEN = process.env.BOXHERO_API_TOKEN;

interface BoxHeroItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  quantities?: Array<{ location_id: number; quantity: number }>;
  price?: number;
  category?: string;
  location_id?: number;
}


/**
 * CSRF validation: enforce same-site Origin/Referer and optional double-submit token check.
 * This is soft-enforcing the token (if both header and cookie exist, they must match),
 * while always requiring same-site Origin/Referer to avoid breaking existing flows.
 */
function validateCsrf(request: NextRequest): { ok: boolean; reason?: string } {
  const siteOrigin = new URL(request.url).origin
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

  // Enforce same-site origin/referrer
  if (origin && origin !== siteOrigin) {
    return { ok: false, reason: 'origin_mismatch' }
  }
  if (!origin && referer && !referer.startsWith(siteOrigin)) {
    return { ok: false, reason: 'referer_mismatch' }
  }

  // Optional double-submit token (non-breaking): if both present, they must match
  const headerToken = request.headers.get('x-csrf-token') || request.headers.get('x-xsrf-token')
  const cookieToken = request.cookies.get('fyp_admin_csrf')?.value || request.cookies.get('csrfToken')?.value
  if (headerToken && cookieToken && headerToken !== cookieToken) {
    return { ok: false, reason: 'csrf_token_mismatch' }
  }

  return { ok: true }
}

/**
 * POST /api/admin/boxhero/sync-products
 * Sync product stock quantities from BoxHero to Supabase
 */
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    // Method validation (defense-in-depth)
    if (request.method !== 'POST') {
      return NextResponse.json({ success: false, error: 'Method Not Allowed' }, { status: 405 })
    }

    // CSRF validation: same-site Origin/Referer and optional token match
    const csrf = validateCsrf(request)
    if (!csrf.ok) {
      return NextResponse.json({ success: false, error: 'CSRF validation failed', reason: csrf.reason }, { status: 403 })
    }

    console.log('🔄 Starting BoxHero product stock sync...')

    if (!BOXHERO_API_TOKEN) {
      throw new Error('BoxHero API token not configured')
    }

    const body = await request.json().catch(() => ({}))
    const triggeredBy = body.triggeredBy || 'api'

    const startTime = Date.now()
    let itemsUpdated = 0
    let itemsSkipped = 0
    let errors: string[] = []

    // Step 1: Fetch all items from BoxHero API
    console.log('📡 Fetching items from BoxHero API...')
    const boxHeroItems = await fetchBoxHeroItems()

    // Resolve locations and prepare filters
    const locations = await fetchBoxHeroLocations()
    const inStockIds = (locations || [])
      .filter((l: any) => (l.name || '') === 'Instock items')
      .map((l: any) => Number(l.id))

    // Exclude preorder-named products
    const itemsToProcess = boxHeroItems.filter((it: any) => !/(\(preorder\))\s*$/i.test((it.name || '').trim()))

    if (!itemsToProcess || itemsToProcess.length === 0) {
      throw new Error('No items received from BoxHero API')
    }

    console.log(`📊 Received ${boxHeroItems.length} items from BoxHero`)

    // Step 2: Update stock quantities in Supabase
    console.log('💾 Updating stock quantities in Supabase...')
    const supabase = createServiceRoleClient()

    for (const item of itemsToProcess) {
      try {
        // Find product by SKU (skip deleted products)
        const { data: products, error: findError } = await supabase
          .from('products')
          .select('id, name, stock_quantity, is_deleted')
          .eq('sku', item.sku)
          .eq('is_deleted', false) // Skip deleted products
          .limit(1)

        if (findError) {
          console.error(`❌ Error finding product with SKU ${item.sku}:`, findError)
          errors.push(`Find error for SKU ${item.sku}: ${findError.message}`)
          continue
        }

        if (!products || products.length === 0) {
          console.log(`⚠️ Product not found for SKU: ${item.sku}`)
          itemsSkipped++
          continue
        }

        const product = products[0]
        const currentStock = product.stock_quantity || 0
        // Calculate stock from "Instock items" location(s) only
        const qList = Array.isArray((item as any).quantities) ? (item as any).quantities : []
        const newStock = qList.reduce((sum: number, loc: any) => {
          const qty = Number(loc?.quantity)
          const safeQty = Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : 0
          const locId = Number(loc?.location_id)
          return sum + (inStockIds.includes(locId) ? safeQty : 0)
        }, 0)

        // Only update if stock quantity has changed
        if (currentStock !== newStock) {
          const { error: updateError } = await supabase
            .from('products')
            .update({
              stock_quantity: newStock,
              updated_at: new Date().toISOString()
            })
            .eq('id', product.id)

          if (updateError) {
            console.error(`❌ Error updating product ${product.id}:`, updateError)
            errors.push(`Update error for ${product.name}: ${updateError.message}`)
          } else {
            console.log(`✅ Updated ${product.name}: ${currentStock} → ${newStock}`)
            itemsUpdated++
          }
        } else {
          itemsSkipped++
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`❌ Error processing item ${item.sku}:`, errorMessage)
        errors.push(`Processing error for ${item.sku}: ${errorMessage}`)
      }
    }

    const duration = Date.now() - startTime
    const success = errors.length === 0

    console.log(`✅ Product stock sync completed!`)
    console.log(`📊 Updated: ${itemsUpdated}, Skipped: ${itemsSkipped}, Errors: ${errors.length}, Duration: ${duration}ms`)

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
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Product stock sync failed:', errorMessage)

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
    )
  }
}, { rateLimitType: 'admin_boxhero_sync' })

/**
 * Fetch all items from BoxHero API with pagination
 */
async function fetchBoxHeroItems(): Promise<BoxHeroItem[]> {
  const allItems: BoxHeroItem[] = [];
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
        'Accept': 'application/json',
      },


    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`BoxHero API error: ${response.status} ${response.statusText}${errText ? ` - ${errText.substring(0, 200)}` : ''}`);
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
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    // Status check endpoint remains available to authenticated admins
    return NextResponse.json({
      success: true,
      message: 'Product sync endpoint is available',
      data: {
        endpoint: '/api/admin/boxhero/sync-products',
        methods: ['POST'],
        description: 'Sync product stock quantities from BoxHero to Supabase'
      }
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to get sync status' },
      { status: 500 }
    )


  }
})


/**
 * Fetch BoxHero locations (id, name)
 */
async function fetchBoxHeroLocations() {
  const url = new URL('https://rest.boxhero-app.com/v1/locations');
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${BOXHERO_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    console.warn('\u26a0\ufe0f BoxHero locations API error:', response.status, response.statusText);
    return [] as any[];
  }

  const data = await response.json();
  return Array.isArray(data.items) ? data.items : [];
}
