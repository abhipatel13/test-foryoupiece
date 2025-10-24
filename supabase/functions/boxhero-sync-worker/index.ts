import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function fetchBoxHeroCategories(token: string) {
  const url = new URL('https://rest.boxhero-app.com/v1/categories')
  await sleep(200)
  const res = await fetch(url.toString(), { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } })
  if (res.status === 429) {
    const reset = res.headers.get('X-Ratelimit-Reset')
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
    return fetchBoxHeroCategories(token)
  }
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data.items) ? data.items : []
}

function json(res: any, status = 200) {
  return new Response(JSON.stringify(res), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function getFunctionsBaseUrlFromSupabaseUrl(supabaseUrl: string): string | null {
  try {
    const u = new URL(supabaseUrl)
    const host = u.hostname // e.g. abcdef.supabase.co
    const ref = host.split('.')[0]
    if (!ref) return null
    return `https://${ref}.functions.supabase.co`
  } catch {
    return null
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const startTs = Date.now()
  let budgetMs = 50_000 // keep under typical 60s edge timeout
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
    // Optional: allow caller to reduce per-invocation processing budget
    const reqBudget = Number((body as any)?.budget_ms)
    if (Number.isFinite(reqBudget) && reqBudget > 0) {
      budgetMs = Math.min(50_000, Math.max(200, Math.floor(reqBudget)))
    }

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

    // categories sync on first run
    if (!job.cursor && Number(job.processed_items || 0) === 0) {
      try {
        const categories = await fetchBoxHeroCategories(boxHeroToken)
        const filtered = (Array.isArray(categories) ? categories : []).filter((c: any) => String(c?.name) !== 'Uncategorized')
        const toUpsert = filtered.map((c: any, i: number) => ({
          name_en: String(c.name),
          name_ja: String(c.name),
          slug: slugify(String(c.name)),
          description_en: `${c.name} products from BoxHero inventory`,
          description_ja: `${c.name} products from BoxHero inventory`,
          parent_id: null,
          is_active: true,
          sort_order: i + 1,
          source: 'boxhero',
          updated_at: new Date().toISOString(),
        }))
        if (toUpsert.length > 0) {
          // Upsert first; only after success, deactivate any categories not present in the new set
          const { error: upErr } = await supabase
            .from('categories')
            .upsert(toUpsert, { onConflict: 'slug', ignoreDuplicates: false })
          if (upErr) throw upErr

          const newSlugs = new Set(toUpsert.map((c: any) => c.slug))
          const { data: activeCats, error: selErr } = await supabase
            .from('categories')
            .select('id, slug, source')
            .eq('is_active', true)
            .or('source.eq.boxhero,source.is.null')
          if (!selErr && Array.isArray(activeCats)) {
            const idsToDeactivate = activeCats.filter((c: any) => !newSlugs.has(String(c.slug))).map((c: any) => c.id)
            if (idsToDeactivate.length > 0) {
              await supabase.from('categories').update({ is_active: false }).in('id', idsToDeactivate)
            }
          }
        } else {
          console.warn('categories sync: fetched empty set; skipping deactivation to avoid wiping categories')
        }
      } catch (e) {
        console.warn('categories sync error', e)
      }
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
      .update({ status: done ? 'completed' : 'processing', completed_at: done ? new Date().toISOString() : null })
      .eq('id', job.id)

    // If not done, auto-chain another invocation to continue processing
    if (!done) {
      const base = getFunctionsBaseUrlFromSupabaseUrl(supabaseUrl)
      if (base) {
        const fnUrl = `${base}/boxhero-sync-worker`
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`
        }
        // Await the next invocation briefly to ensure it is dispatched before this runtime ends
        const controller = new AbortController()
        const t = setTimeout(() => controller.abort(), 6000)
        try {
          await fetch(fnUrl, { method: 'POST', headers, body: JSON.stringify({ job_id: job.id, budget_ms: 45_000 }), signal: controller.signal })
        } catch (_) {
          // ignore; the next invocation may still have been accepted
        } finally {
          clearTimeout(t)
        }
      }
    }

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

function slugify(name: string) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function fetchBoxHeroItemsPage(token: string, cursor: string | null, limit: number) {
  const url = new URL('https://rest.boxhero-app.com/v1/items')
  if (cursor) url.searchParams.set('cursor', cursor)
  url.searchParams.set('limit', String(limit))

  await sleep(200)
  const res = await fetch(url.toString(), { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } })
  if (res.status === 429) {
    const reset = res.headers.get('X-Ratelimit-Reset')
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
    return fetchBoxHeroItemsPage(token, cursor, limit)
  }
  if (!res.ok) throw new Error(`BoxHero items error: ${res.status}`)
  return res.json()
}

async function fetchBoxHeroLocations(token: string) {
  const url = new URL('https://rest.boxhero-app.com/v1/locations')
  await sleep(200)
  const res = await fetch(url.toString(), { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } })
  if (res.status === 429) {
    const reset = res.headers.get('X-Ratelimit-Reset')
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
    return fetchBoxHeroLocations(token)
  }
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
