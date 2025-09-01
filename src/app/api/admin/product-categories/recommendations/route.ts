import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth/admin-middleware'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

// GET today's recommendations (or given date) for admin UI
export const GET = withAdminAuth(async (request: NextRequest) => {
  const supabase = createServiceRoleClient()
  const url = new URL(request.url)
  const type = (url.searchParams.get('type') as 'deals' | 'best_sellers' | 'both') || 'both'
  const date = url.searchParams.get('date') || new Date().toISOString().slice(0,10)
  const categoryId = url.searchParams.get('category_id') || ''
  const categorySlug = url.searchParams.get('category_slug') || ''
  const LIMIT = 25

  let resolvedCategoryId: string | null = null
  if (categoryId) {
    resolvedCategoryId = categoryId
  } else if (categorySlug) {
    const { data: cat, error: cErr } = await supabase.from('categories').select('id, slug').eq('slug', categorySlug).maybeSingle()
    if (cErr) {
      return NextResponse.json({ success: false, error: cErr.message }, { status: 500 })
    }
    resolvedCategoryId = cat?.id || null
  }

  // 1) Fetch today's recommendation rows only (no embed)
  let baseQuery = supabase
    .from('product_recommendations')
    .select('date, type, rank, score, reason, product_id, created_at, updated_at')
    .eq('date', date)
    .order('rank', { ascending: true })

  if (type !== 'both') baseQuery = baseQuery.eq('type', type)

  const { data: todayRows, error } = await baseQuery
  if (error) {
    const msg = error.message || ''
    const code: any = (error as any).code
    if (code === '42P01' || msg.toLowerCase().includes('relation') && msg.toLowerCase().includes('does not exist')) {
      // Table not created yet (migration pending) – return empty lists to avoid breaking UI
      return NextResponse.json({ success: true, data: { deals: [], best: [] }, date, note: 'product_recommendations table not found. Apply migrations.' })
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  // Track last updated timestamp from today's rows
  const lastUpdatedIso = (todayRows || [])
    .map((r: any) => (r.updated_at || r.created_at))
    .filter(Boolean)
    .sort((a: any, b: any) => new Date(b).getTime() - new Date(a).getTime())[0] || null

  // Fallback/backfill if we have fewer than LIMIT items for any type
  let candidateRows: any[] = [...(todayRows || [])]
  const needDeals = type === 'best_sellers' ? 0 : Math.max(0, LIMIT - (todayRows || []).filter((r:any)=>r.type==='deals').length)
  const needBest = type === 'deals' ? 0 : Math.max(0, LIMIT - (todayRows || []).filter((r:any)=>r.type==='best_sellers').length)

  if (needDeals > 0 || needBest > 0) {
    const pastStart = new Date(date)
    pastStart.setDate(pastStart.getDate() - 7)
    const pastStr = pastStart.toISOString().slice(0,10)

    // Pull recent historical recs ordered by date desc then score desc
    async function fetchBackfill(t: 'deals'|'best_sellers', needed: number) {
      if (needed <= 0) return [] as any[]
      let q = supabase
        .from('product_recommendations')
        .select('date, type, rank, score, reason, product_id')
        .lt('date', date)
        .gte('date', pastStr)
        .eq('type', t)
        .order('date', { ascending: false })
        .order('score', { ascending: false })
      const { data } = await q
      return (data || [])
    }

    const backfillDeals = await fetchBackfill('deals', needDeals)
    const backfillBest = await fetchBackfill('best_sellers', needBest)

    // Prefer today's rows; backfill to reach LIMIT later after product filtering
    candidateRows = [...candidateRows, ...backfillDeals, ...backfillBest]
  }

  // 2) Fetch products in one shot and map (apply category filter)
  const ids = Array.from(new Set((candidateRows || []).map((r: any) => r.product_id))).filter(Boolean)
  let productsMap = new Map<string, any>()
  if (ids.length > 0) {
    let prodQuery = supabase
      .from('products')
      .select('id, sku, name_en, price, compare_at_price, points_rate, stock_quantity, images, is_active, category_id, is_best_seller, best_seller_position')
      .in('id', ids as any)

    const { data: products, error: pErr } = await prodQuery
    if (pErr) {
      return NextResponse.json({ success: false, error: pErr.message }, { status: 500 })
    }

    const filtered = resolvedCategoryId
      ? (products || []).filter((p: any) => p.category_id === resolvedCategoryId)
      : (products || [])

    productsMap = new Map(filtered.map((p: any) => [p.id, p]))
  }

  // Build enriched list, only keep items with a product after filter
  const enrichedAll = (candidateRows || []).map((r: any) => ({
    date: r.date,
    type: r.type,
    rank: r.rank,
    score: r.score,
    reason: r.reason,
    product: productsMap.get(r.product_id) || null,
  })).filter((e: any) => !!e.product)

  // Split and enforce LIMIT per type (today first by rank, then fallback by score)
  const todaysByType = (t: 'deals'|'best_sellers') => (todayRows||[]).filter((r:any)=>r.type===t && productsMap.has(r.product_id))
  const fallbackByType = (t: 'deals'|'best_sellers') => (enrichedAll||[]).filter((e:any)=>e.type===t)

  const dealsToday = todaysByType('deals').sort((a:any,b:any)=>a.rank-b.rank)
  const bestToday = todaysByType('best_sellers').sort((a:any,b:any)=>a.rank-b.rank)

  const usedDealIds = new Set(dealsToday.map((r:any)=>r.product_id))
  const usedBestIds = new Set(bestToday.map((r:any)=>r.product_id))

  const dealsFallback = (candidateRows||[])
    .filter((r:any)=>r.type==='deals' && !usedDealIds.has(r.product_id))
    .sort((a:any,b:any)=>Number(b.score)-Number(a.score))
    .map((r:any)=>({
      date: r.date, type: r.type, rank: r.rank, score: r.score, reason: r.reason,
      product: productsMap.get(r.product_id)
    }))
    .filter((e:any)=>!!e.product)

  const bestFallback = (candidateRows||[])
    .filter((r:any)=>r.type==='best_sellers' && !usedBestIds.has(r.product_id))
    .sort((a:any,b:any)=>Number(b.score)-Number(a.score))
    .map((r:any)=>({
      date: r.date, type: r.type, rank: r.rank, score: r.score, reason: r.reason,
      product: productsMap.get(r.product_id)
    }))
    .filter((e:any)=>!!e.product)

  let deals = dealsToday
    .map((r:any)=>({ date: r.date, type: r.type, rank: r.rank, score: r.score, reason: r.reason, product: productsMap.get(r.product_id) }))
    .filter((e:any)=>!!e.product)
  if (deals.length < LIMIT) deals = [...deals, ...dealsFallback].slice(0, LIMIT)

  let best = bestToday
    .map((r:any)=>({ date: r.date, type: r.type, rank: r.rank, score: r.score, reason: r.reason, product: productsMap.get(r.product_id) }))
    .filter((e:any)=>!!e.product)
  if (best.length < LIMIT) best = [...best, ...bestFallback].slice(0, LIMIT)

  // Final safety fallback: if still empty but products exist, synthesize from products
  if ((deals.length === 0 || best.length === 0) && productsMap.size > 0) {
    const products = Array.from(productsMap.values()) as any[]
    if (deals.length === 0) {
      const promoRanked = products
        .map(p=>{
          const hasPriceDiscount = Number(p.compare_at_price||0) > Number(p.price||0)
          const hasEnhancedPoints = Number(p.points_rate||1) > 1
          const stock = Number(p.stock_quantity||0)
          const score = (hasPriceDiscount?1:0) + (hasEnhancedPoints?0.6:0) + Math.min(stock/100,0.4)
          return { p, score }
        })
        .sort((a,b)=>b.score-a.score)
        .slice(0, LIMIT)
        .map((x,idx)=>({ date, type:'deals' as const, rank: idx+1, score: Number(x.score.toFixed(4)), reason: ['Promotional fallback'], product: x.p }))
      deals = promoRanked
    }
    if (best.length === 0) {
      const bestRanked = products
        .map(p=>({ p, score: (p.is_best_seller?1:0) + Math.max(0, 1 - (p.best_seller_position||999)/100) }))
        .sort((a,b)=>b.score-a.score)
        .slice(0, LIMIT)
        .map((x,idx)=>({ date, type:'best_sellers' as const, rank: idx+1, score: Number(x.score.toFixed(4)), reason: ['Best-seller fallback'], product: x.p }))
      best = bestRanked
    }
  }

  return NextResponse.json({ success: true, data: { deals, best }, date, category_id: resolvedCategoryId, last_updated_iso: lastUpdatedIso })
})

