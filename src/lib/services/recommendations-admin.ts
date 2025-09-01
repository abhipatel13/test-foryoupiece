import { createServiceRoleClient } from '@/lib/supabase/service-role'

function normalize(value: number, min: number, max: number): number {
  if (!isFinite(value) || !isFinite(min) || !isFinite(max) || max <= min) return 0
  const n = (value - min) / (max - min)
  return Math.max(0, Math.min(1, n))
}

function todayDateString(): string {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export async function generateDailyRecommendations(
  refreshType: 'manual' | 'scheduled' | 'conditional' = 'manual',
  categoryId?: string
) {
  const t0 = Date.now()
  const supabase = createServiceRoleClient()
  const limit = 25

  const end = new Date()
  const start30 = new Date(); start30.setDate(end.getDate() - 30)
  const start7 = new Date(); start7.setDate(end.getDate() - 7)
  const dateStr = todayDateString()

  let prodQuery = supabase
    .from('products')
    .select('id, sku, name_en, price, compare_at_price, points_rate, tags, stock_quantity, is_active, is_best_seller, best_seller_position, category_id')
    .eq('is_active', true)

  if (categoryId) {
    prodQuery = prodQuery.eq('category_id', categoryId)
  }

  const { data: products, error: prodErr } = await prodQuery
  if (prodErr) throw new Error(prodErr.message)

  const productIds = (products || []).map(p => p.id)

  let sales30Map = new Map<string, any>()
  let sales7Map = new Map<string, any>()
  try {
    const { data: sales30 } = await supabase.rpc('get_sales_analytics', {
      start_date: start30.toISOString(),
      end_date: end.toISOString(),
      min_sales_threshold: 0,
    })
    ;(sales30||[]).forEach((r:any)=>sales30Map.set(r.product_id, r))
  } catch {}
  let sales7Raw: any[] = []
  try {
    const { data: sales7 } = await supabase.rpc('get_sales_analytics', {
      start_date: start7.toISOString(),
      end_date: end.toISOString(),
      min_sales_threshold: 0,
    })
    sales7Raw = sales7 || []
    sales7Raw.forEach((r:any)=>sales7Map.set(r.product_id, r))
  } catch {}

  const { data: searchClickRows } = await supabase
    .from('user_search_history')
    .select('clicked_product_id')
    .gte('created_at', start30.toISOString())
    .lte('created_at', end.toISOString())
    .not('clicked_product_id', 'is', null)
  const searchClicksMap = new Map<string, number>()
  for (const r of (searchClickRows || [])) {
    const pid = (r as any).clicked_product_id as string
    if (!pid) continue
    searchClicksMap.set(pid, (searchClicksMap.get(pid) || 0) + 1)
  }

  const { data: viewRows } = await supabase
    .from('user_behavior_tracking')
    .select('product_id')
    .eq('behavior_type', 'product_view')
    .gte('created_at', start30.toISOString())
    .lte('created_at', end.toISOString())
    .not('product_id', 'is', null)
  const viewsMap = new Map<string, number>()
  for (const r of (viewRows || [])) {
    const pid = (r as any).product_id as string
    if (!pid) continue
    viewsMap.set(pid, (viewsMap.get(pid) || 0) + 1)
  }

  const last2 = new Date(); last2.setDate(end.getDate() - 2)
  const since = last2.toISOString().slice(0,10)
  const { data: recentDeals } = await supabase.from('product_recommendations').select('product_id').eq('type','deals').gte('date', since)
  const recentDealsSet = new Set((recentDeals||[]).map(r=>r.product_id))
  const { data: recentBest } = await supabase.from('product_recommendations').select('product_id').eq('type','best_sellers').gte('date', since)
  const recentBestSet = new Set((recentBest||[]).map(r=>r.product_id))

  const stockValues = (products||[]).map(p=>Number(p.stock_quantity)||0)
  const stockMin = Math.min(0, ...stockValues)
  const stockMax = Math.max(1, ...stockValues)
  const ordersValues = (products||[]).map(p=>Number(sales30Map.get(p.id)?.order_count||0))
  const ordersMin = Math.min(0, ...ordersValues)
  const ordersMax = Math.max(1, ...ordersValues)
  const revenueValues = (products||[]).map(p=>Number(sales30Map.get(p.id)?.total_revenue||0))
  const revenueMin = Math.min(0, ...revenueValues)
  const revenueMax = Math.max(1, ...revenueValues)
  const unitsValues = (products||[]).map(p=>Number(sales30Map.get(p.id)?.total_units_sold||0))
  const unitsMin = Math.min(0, ...unitsValues)
  const unitsMax = Math.max(1, ...unitsValues)
  const searchValues = (products||[]).map(p=>Number(searchClicksMap.get(p.id)||0))
  const searchMin = Math.min(0, ...searchValues)
  const searchMax = Math.max(1, ...searchValues)
  const viewsValues = (products||[]).map(p=>Number(viewsMap.get(p.id)||0))
  const viewsMin = Math.min(0, ...viewsValues)
  const viewsMax = Math.max(1, ...viewsValues)

  const dealsCandidates = (products||[]).map(p=>{
    const stockScore = normalize(Number((p as any).stock_quantity)||0, stockMin, stockMax)
    const orderCount = Number(sales30Map.get((p as any).id)?.order_count||0)
    const lowSalesScore = 1 - normalize(orderCount, ordersMin, ordersMax)

    // Promotional signals
    const hasPriceDiscount = Number((p as any).compare_at_price||0) > Number((p as any).price||0)
    const pointsRate = Number((p as any).points_rate || 1)
    const hasEnhancedPoints = pointsRate > 1.0
    const tags = ((p as any).tags || []) as string[]
    const promoTag = Array.isArray(tags) && tags.some(t => `${t}`.toLowerCase().includes('promo') || `${t}`.toLowerCase().includes('deal') || `${t}`.toLowerCase().includes('discount'))

    const promoScore = (
      (hasPriceDiscount ? 0.5 : 0) +
      (hasEnhancedPoints ? Math.min((pointsRate - 1.0) * 0.5, 0.5) : 0) +
      (promoTag ? 0.3 : 0)
    )

    const bestSellerBoost = (p as any).is_best_seller ? 0.1 : 0
    const noveltyPenalty = recentDealsSet.has((p as any).id) ? -0.25 : 0
    const randomNudge = (Math.sin(Date.now()/86400000 + productIds.indexOf((p as any).id)) + 1) / 20

    // Expanded deals scoring: cast a wider net for “anything promotional”
    const score = 0.35*stockScore + 0.25*lowSalesScore + 0.3*promoScore + 0.05*bestSellerBoost + 0.05*randomNudge + noveltyPenalty

    const reasons: string[] = []
    if (stockScore > 0.7) reasons.push('High stock to move')
    if (lowSalesScore > 0.6) reasons.push('Low purchase frequency')
    if (hasPriceDiscount) reasons.push('Price discount available')
    if (hasEnhancedPoints) reasons.push(`Enhanced points: ${pointsRate.toFixed(2)}x`)
    if (promoTag) reasons.push('Promotional tag detected')
    if (bestSellerBoost > 0) reasons.push('Periodic best-seller mix')
    if (noveltyPenalty < 0) reasons.push('Rotated for freshness')
    return { product_id: (p as any).id, score, reasons }
  }).sort((a,b)=>b.score-a.score)

  const topBest = (products||[]).filter(p=>p.is_best_seller)
    .sort((a,b)=>(a.best_seller_position||999)-(b.best_seller_position||999))
    .slice(0,5).map(p=>p.id)

  const mixedSet = new Set<string>()
  const dealsTop: { product_id: string; score: number; reasons: string[] }[] = []
  for (const c of dealsCandidates) { if (dealsTop.length>=limit) break; if (mixedSet.has(c.product_id)) continue; dealsTop.push(c); mixedSet.add(c.product_id) }
  let injected = 0
  for (const bid of topBest) { if (injected>=3) break; if (!mixedSet.has(bid)) { dealsTop.splice(Math.min(dealsTop.length-5, dealsTop.length), 0, { product_id: bid, score: (dealsTop[dealsTop.length-1]?.score||0)-0.01, reasons: ['Popular item mix-in'] }); mixedSet.add(bid); injected++ } }
  const dealsFinal = dealsTop.slice(0, limit).map((c,idx)=>({ date: dateStr, type: 'deals' as const, product_id: c.product_id, rank: idx+1, score: Number(c.score.toFixed(4)), reason: c.reasons }))

  const bestCandidates = (products||[]).map(p=>{
    const s30 = sales30Map.get(p.id); const s7 = sales7Map.get(p.id)
    const units = Number(s30?.total_units_sold||0)
    const revenue = Number(s30?.total_revenue||0)
    const orders = Number(s30?.order_count||0)
    const recentUnits = Number(s7?.total_units_sold||0)
    const unitsScore = normalize(units, unitsMin, unitsMax)
    const revenueScore = normalize(revenue, revenueMin, revenueMax)
    const freqScore = normalize(orders, ordersMin, ordersMax)
    const searchScore = normalize(Number(searchClicksMap.get(p.id)||0), searchMin, searchMax)
    const views = Number(viewsMap.get(p.id)||0)
    const convRate = views>0 ? orders/views : 0
    const convScore = normalize(convRate, 0, 0.2)
    const recentTrendScore = normalize(recentUnits, 0, Math.max(1, ...sales7Raw.map((r:any)=>Number(r.total_units_sold||0))))
    const score = 0.35*unitsScore + 0.2*revenueScore + 0.15*freqScore + 0.15*searchScore + 0.1*convScore + 0.05*recentTrendScore
    const reasons: string[] = []
    if (unitsScore>0.7) reasons.push('High units sold')
    if (revenueScore>0.7) reasons.push('Strong revenue')
    if (freqScore>0.7) reasons.push('Frequent orders')
    if (searchScore>0.6) reasons.push('Popular in search')
    if (convScore>0.5) reasons.push('High conversion rate')
    if (recentTrendScore>0.6) reasons.push('Trending recently')
    const novelty = recentBestSet.has(p.id) ? -0.02 : 0
    return { product_id: p.id, score: score+novelty, reasons }
  }).sort((a,b)=>b.score-a.score)

  const bestFinal = bestCandidates.slice(0, limit).map((c,idx)=>({ date: dateStr, type: 'best_sellers' as const, product_id: c.product_id, rank: idx+1, score: Number(c.score.toFixed(4)), reason: c.reasons }))

  const payload = [...dealsFinal, ...bestFinal]

  // Upsert recommendations with robust error handling
  try {
    const { error: upsertErr } = await supabase
      .from('product_recommendations')
      .upsert(payload, { onConflict: 'date,type,product_id' })
    if (upsertErr) {
      const msg = (upsertErr.message || '').toLowerCase()
      const code: any = (upsertErr as any).code
      const isMissing = code === '42P01' || (msg.includes('relation') && msg.includes('does not exist')) || msg.trim() === ''
      if (isMissing) {
        // Table missing or error not descriptive (likely missing migrations): behave gracefully
        return { date: dateStr, counts: { deals: 0, best_sellers: 0 }, note: 'product_recommendations table not found. Apply migrations.' }
      }
      throw new Error(upsertErr.message || `Upsert into product_recommendations failed${code ? ` (code: ${code})` : ''}`)
    }
  } catch (e: any) {
    const raw = (e?.message as string) || ''
    const msg = raw.toLowerCase()
    const code: any = e?.code
    const isMissing = code === '42P01' || (msg.includes('relation') && msg.includes('does not exist')) || msg.trim() === ''
    if (isMissing) {
      return { date: dateStr, counts: { deals: 0, best_sellers: 0 }, note: 'product_recommendations table not found. Apply migrations.' }
    }
    throw new Error(raw || `Recommendation upsert failed${code ? ` (code: ${code})` : ''}`)
  }

  // Insert run record non-blocking
  try {
    await supabase
      .from('product_recommendation_runs')
      .insert({ type: 'both', algorithm_version: 'v1', products_count: payload.length, execution_time_ms: Date.now()-t0, notes: `refresh_type=${refreshType}` })
  } catch (e: any) {
    // Swallow errors here; log could be added if a logger exists
  }

  return { date: dateStr, counts: { deals: dealsFinal.length, best_sellers: bestFinal.length } }
}

