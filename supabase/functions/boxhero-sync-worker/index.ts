import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(res: any, status = 200) {
  return new Response(JSON.stringify(res), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const startTs = Date.now()
  const budgetMs = 50_000 // keep under typical 60s edge timeout
  let jobId: string | undefined

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const boxHeroToken = Deno.env.get('BOXHERO_API_TOKEN')!

    if (!supabaseUrl || !serviceKey || !boxHeroToken) {
      return json({ success: false, error: 'Missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/BOXHERO_API_TOKEN' }, 500)
    }

    let supabase: any = createClient(supabaseUrl, serviceKey)

    const body = await req.json().catch(() => ({}))
    jobId = (body?.job_id as string | undefined)

    // resolve job
    let job: any = await getJob(supabase, jobId)
    if (!job) {
      // no job queued; nothing to do
      return json({ success: true, message: 'No queued job' })
    }

    // mark processing
    if (job.status === 'queued') {
      await supabase
        .from('boxhero_sync_jobs')
        .update({ status: 'processing', started_at: new Date().toISOString() })
        .eq('id', job.id)
    }

    // fetch locations once
    const locations = await fetchBoxHeroLocations(boxHeroToken)
    const inStockIds = (locations || [])
      .filter((l: any) => ((l.name ?? '').toString().trim().replace(/\s+/g, ' ').toLowerCase()) === 'instock items')
      .map((l: any) => Number(l.id))

    // Safety guard: if we cannot resolve in-stock locations, abort to avoid zeroing stock
    if (!inStockIds || inStockIds.length === 0) {
      await supabase
        .from('boxhero_sync_jobs')
        .update({ status: 'failed', error: 'Unable to resolve in-stock locations. Aborting to prevent accidental zeroing of stock.' })
        .eq('id', job.id)
      return json({ success: false, error: 'Unable to resolve in-stock locations', retryable: true }, 503)
    }

    let cursor: string | null = job.cursor || null
    let totalProcessed = job.processed_items || 0
    let totalUpdated = job.updated_items || 0
    let totalSkipped = job.skipped_items || 0
    let lastHasMore = true

    while (Date.now() - startTs < budgetMs) {
      const page = await fetchBoxHeroItemsPage(boxHeroToken, cursor, 100)
      const items = (page.items || []).filter((it: any) => !(/(\(preorder\))\s*$/i.test((it.name || '').trim())))

      if (!items || items.length === 0) {
        // no more items
        cursor = page.cursor || null
        lastHasMore = !!page.has_more
        if (!page.has_more) break
      }

      // build sku list and fetch matching products in one go
      const skus = items.map((i: any) => i.sku).filter((s: any) => typeof s === 'string' && s.length > 0)
      let productsBySku: Record<string, any> = {}
      if (skus.length > 0) {
        // chunk IN queries to avoid param limits
        const chunkSize = 100
        for (let i = 0; i < skus.length; i += chunkSize) {
          const chunk = skus.slice(i, i + chunkSize)
          const { data, error } = await supabase
            .from('products')
            .select('id, sku, stock_quantity, is_deleted, is_trending, tags')
            .in('sku', chunk)
            .eq('is_deleted', false)
          if (error) {
            console.error('❌ products fetch error', error)
            // continue anyway
          } else {
            for (const p of data || []) productsBySku[p.sku] = p
          }
        }
      }

      let updatedCount = 0
      let skippedCount = 0

      // update in small batches to avoid per-row overhead
      const updateBatch: Array<{ id: string, update: any, name?: string }> = []

      for (const item of items) {
        try {
          const product = productsBySku[item.sku]
          if (!product) { skippedCount++; continue }

          // compute stock from selected locations
          const qList = Array.isArray(item.quantities) ? item.quantities : []
          const newStock = qList.reduce((sum: number, loc: any) => {
            const qty = Number(loc?.quantity)
            const safeQty = Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : 0
            const locId = Number(loc?.location_id)
            return sum + (inStockIds.includes(locId) ? safeQty : 0)
          }, 0)

          const current = Number(product.stock_quantity)
          const currentStock = Number.isFinite(current) ? Math.max(0, Math.floor(current)) : 0
          const update: any = { updated_at: new Date().toISOString() }
          if (currentStock !== newStock) update.stock_quantity = newStock

          // trending tags from attrs (names only), only set true
          const attrs = Array.isArray(item.attrs) ? item.attrs : []
          const boxHeroTags = attrs.map((a: any) => a?.name).filter(Boolean).map((t: any) => String(t).toLowerCase())
          const isTrendingFromBH = boxHeroTags.some((t: string) => t.includes('trending') || t.includes('trend'))
          if (isTrendingFromBH && product.is_trending !== true) update.is_trending = true
          if (boxHeroTags.length > 0) {
            const existing: string[] = Array.isArray(product.tags) ? product.tags : []
            const merged = Array.from(new Set([...(existing || []), ...boxHeroTags]))
            update.tags = merged
          }

          if (Object.keys(update).length > 1) {
            updateBatch.push({ id: product.id, update, name: product.name_en })
          } else {
            skippedCount++
          }
        } catch (_) {
          skippedCount++
        }
      }

      // flush in small groups
      const groupSize = 50
      for (let i = 0; i < updateBatch.length; i += groupSize) {
        const group = updateBatch.slice(i, i + groupSize)
        // Perform updates one by one to avoid complex RPC; still batched in groups
        for (const row of group) {
          const { error: upErr } = await supabase
            .from('products')
            .update(row.update)
            .eq('id', row.id)
          if (upErr) console.error('❌ product update error', upErr)
        }
      }

      updatedCount += updateBatch.length

      totalProcessed += items.length
      totalUpdated += updatedCount
      totalSkipped += skippedCount
      cursor = page.cursor || null

      // update job progress
      await supabase
        .from('boxhero_sync_jobs')
        .update({
          processed_items: totalProcessed,
          updated_items: totalUpdated,
          skipped_items: totalSkipped,
          cursor,
          total_items: totalProcessed + (page.has_more ? 1 : 0),
        })
        .eq('id', job.id)

      lastHasMore = !!page.has_more
      if (!page.has_more) break
    }

    // If loop finished because there is no next page, mark completed. If we hit the time budget, leave as processing.
    const done = lastHasMore === false
    await supabase
      .from('boxhero_sync_jobs')
      .update({ status: done ? 'completed' : 'processing' })
      .eq('id', job.id)

    return json({ success: true, job_id: job.id, processed: totalProcessed, updated: totalUpdated, skipped: totalSkipped, done })
  } catch (e: any) {
    console.error('❌ boxhero-sync-worker error', e)
    try {
      // Best-effort: mark the job as failed so UI can reflect error state
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (supabaseUrl && serviceKey) {
        const sb = createClient(supabaseUrl, serviceKey)
        if (jobId) {
          await sb.from('boxhero_sync_jobs')
            .update({ status: 'failed', error: (e && e.message) ? e.message : 'Unknown error' })
            .eq('id', jobId)
        }
      }
    } catch {}
    return json({ success: false, error: e?.message || 'Unknown error' }, 500)
  }
})

async function fetchBoxHeroItemsPage(token: string, cursor: string | null, limit: number) {
  const url = new URL('https://rest.boxhero-app.com/v1/items')
  if (cursor) url.searchParams.set('cursor', cursor)
  url.searchParams.set('limit', String(limit))

  const res = await fetch(url.toString(), { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } })
  if (!res.ok) throw new Error(`BoxHero items error: ${res.status}`)
  return res.json()
}

async function fetchBoxHeroLocations(token: string) {
  const url = new URL('https://rest.boxhero-app.com/v1/locations')
  const res = await fetch(url.toString(), { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } })
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data.items) ? data.items : []
}

async function getJob(supabase: any, jobId?: string) {
  if (jobId) {
    const { data } = await supabase.from('boxhero_sync_jobs').select('*').eq('id', jobId).single()
    return data
  }
  const { data } = await supabase
    .from('boxhero_sync_jobs')
    .select('*')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(1)
  return (data && data[0]) || null
}
