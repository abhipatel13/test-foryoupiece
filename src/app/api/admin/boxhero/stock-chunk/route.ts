import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth/admin-middleware'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const BOXHERO_API_TOKEN = process.env.BOXHERO_API_TOKEN

let __locations_cache: { items: any[]; ts: number } | null = null
const LOC_TTL_MS = 60_000
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * POST /api/admin/boxhero/stock-chunk
 * Processes a single page of BoxHero items and updates stock quantities for matched products.
 * Use this endpoint repeatedly with the returned cursor until hasMore === false.
 */
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    if (!BOXHERO_API_TOKEN) {
      return NextResponse.json({ success: false, error: 'BoxHero API token not configured' }, { status: 500 })
    }

    const { cursor: inputCursor, limit: inputLimit } = await request.json().catch(() => ({ }))
    const limit = Number.isFinite(inputLimit) && inputLimit > 0 ? Math.min(100, inputLimit) : 100

    // Resolve locations to find the exact "Instock items" location IDs
    const locations = await fetchBoxHeroLocationsCached()
    const inStockIds = (locations || [])
      .filter((l: any) => { const n = (((l.name ?? '') + '').trim().replace(/\s+/g, ' ')).toLowerCase(); return n === 'instock items' })
      .map((l: any) => Number(l.id))

    // Safety guard: if we cannot resolve in-stock locations, abort to avoid zeroing stock
    if (!inStockIds || inStockIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Unable to resolve in-stock locations. Aborting chunk to prevent accidental zeroing of stock.',
        retryable: true
      }, { status: 503 })
    }

    // Fetch one page
    const page = await fetchBoxHeroItemsPage(inputCursor ?? null, limit)

    // Filter out preorder-named products
    const items = (page.items || []).filter((it: any) => !(/(\(preorder\))\s*$/i.test((it.name || '').trim())))

    // Update stock for matched products only
    const supabase = createServiceRoleClient()

    let itemsUpdated = 0
    let itemsSkipped = 0
    const errors: string[] = []

    for (const item of items) {
      try {
        const { data: products, error: findError } = await supabase
          .from('products')
          .select('id, name_en, stock_quantity, is_deleted')
          .eq('sku', item.sku)
          .eq('is_deleted', false)
          .limit(1)

        if (findError) {
          errors.push(`Find error for SKU ${item.sku}: ${findError.message}`)
          continue
        }

        if (!products || products.length === 0) {
          itemsSkipped++
          continue
        }

        const product = products[0]
        const currentStockRaw = Number(product.stock_quantity)
        const currentStock = Number.isFinite(currentStockRaw) ? Math.max(0, Math.floor(currentStockRaw)) : 0

        const qList = Array.isArray((item as any).quantities) ? (item as any).quantities : []
        const newStock = qList.reduce((sum: number, loc: any) => {
          const qty = Number(loc?.quantity)
          const safeQty = Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : 0
          const locId = Number(loc?.location_id)
          return sum + (inStockIds.includes(locId) ? safeQty : 0)
        }, 0)

        if (currentStock !== newStock) {
          const { error: updateError } = await supabase
            .from('products')
            .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
            .eq('id', product.id)

          if (updateError) {
            errors.push(`Update error for ${product.name_en}: ${updateError.message}`)
          } else {
            itemsUpdated++
          }
        } else {
          itemsSkipped++
        }
      } catch (err) {
        errors.push(`Processing error for ${item?.sku || 'unknown'}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        itemsUpdated,
        itemsSkipped,
        processed: items.length,
      },
      cursor: page.cursor || null,
      hasMore: !!page.has_more,
      timestamp: new Date().toISOString(),
      errors: errors.slice(0, 10),
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
})

async function fetchBoxHeroItemsPage(cursor: string | null, limit: number) {
  const url = new URL('https://rest.boxhero-app.com/v1/items')
  if (cursor) url.searchParams.set('cursor', cursor)
  url.searchParams.set('limit', String(limit))

  await sleep(200)
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${BOXHERO_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  })

  if (response.status === 429) {
    const reset = response.headers.get('X-Ratelimit-Reset')
    let waitMs = 1000
    if (reset) {
      const n = parseInt(reset, 10)
      if (Number.isFinite(n)) {
        const nowSec = Math.floor(Date.now() / 1000)
        const isEpoch = n > nowSec + 5
        let seconds = isEpoch ? Math.max(0, n - nowSec) : n
        seconds = Math.min(Math.max(seconds, 1), 5)
        waitMs = seconds * 1000
      }
    }
    await sleep(waitMs)
    return fetchBoxHeroItemsPage(cursor, limit)
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`BoxHero items error: ${response.status} ${response.statusText} ${text}`)
  }

  return response.json()
}

async function fetchBoxHeroLocations() {
  const url = new URL('https://rest.boxhero-app.com/v1/locations')
  await sleep(200)
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${BOXHERO_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  })

  if (response.status === 429) {
    const reset = response.headers.get('X-Ratelimit-Reset')
    let waitMs = 1000
    if (reset) {
      const n = parseInt(reset, 10)
      if (Number.isFinite(n)) {
        const nowSec = Math.floor(Date.now() / 1000)
        const isEpoch = n > nowSec + 5
        let seconds = isEpoch ? Math.max(0, n - nowSec) : n
        seconds = Math.min(Math.max(seconds, 1), 5)
        waitMs = seconds * 1000
      }
    }
    await sleep(waitMs)
    return fetchBoxHeroLocations()
  }

  if (!response.ok) {
    return [] as any[]
  }

  const data = await response.json()
  return Array.isArray(data.items) ? data.items : []
}

async function fetchBoxHeroLocationsCached() {
  const now = Date.now()
  if (__locations_cache && (now - __locations_cache.ts) < LOC_TTL_MS) return __locations_cache.items
  const items = await fetchBoxHeroLocations()
  __locations_cache = { items, ts: now }
  return items
}
