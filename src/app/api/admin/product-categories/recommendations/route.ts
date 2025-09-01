import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth/admin-middleware'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

// GET today's recommendations (or given date) for admin UI
export const GET = withAdminAuth(async (request: NextRequest) => {
  const supabase = createServiceRoleClient()
  const url = new URL(request.url)
  const type = (url.searchParams.get('type') as 'deals' | 'best_sellers' | 'both') || 'both'
  const date = url.searchParams.get('date') || new Date().toISOString().slice(0,10)

  // 1) Fetch recommendation rows only (no embed) to avoid PostgREST relationship issues
  let baseQuery = supabase
    .from('product_recommendations')
    .select('date, type, rank, score, reason, product_id')
    .eq('date', date)
    .order('rank', { ascending: true })

  if (type !== 'both') baseQuery = baseQuery.eq('type', type)

  const { data: rows, error } = await baseQuery
  if (error) {
    const msg = error.message || ''
    const code: any = (error as any).code
    if (code === '42P01' || msg.toLowerCase().includes('relation') && msg.toLowerCase().includes('does not exist')) {
      // Table not created yet (migration pending) – return empty lists to avoid breaking UI
      return NextResponse.json({ success: true, data: { deals: [], best: [] }, date, note: 'product_recommendations table not found. Apply migrations.' })
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  // 2) Fetch products in one shot and map
  const ids = Array.from(new Set((rows || []).map((r: any) => r.product_id))).filter(Boolean)
  let productsMap = new Map<string, any>()
  if (ids.length > 0) {
    const { data: products, error: pErr } = await supabase
      .from('products')
      .select('id, sku, name_en, price, compare_at_price, points_rate, stock_quantity, images, is_active')
      .in('id', ids as any)
    if (pErr) {
      return NextResponse.json({ success: false, error: pErr.message }, { status: 500 })
    }
    productsMap = new Map((products || []).map((p: any) => [p.id, p]))
  }

  const enriched = (rows || []).map((r: any) => ({
    date: r.date,
    type: r.type,
    rank: r.rank,
    score: r.score,
    reason: r.reason,
    product: productsMap.get(r.product_id) || null,
  })).filter((e: any) => !!e.product)

  const deals = enriched.filter((r: any) => r.type === 'deals')
  const best = enriched.filter((r: any) => r.type === 'best_sellers')

  return NextResponse.json({ success: true, data: { deals, best }, date })
})

