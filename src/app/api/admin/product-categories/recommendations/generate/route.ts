import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth/admin-middleware'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export const POST = withAdminAuth(async (request: NextRequest) => {
  const body = await request.json().catch(() => ({}))
  const refreshType = body?.refresh_type || 'manual'
  let categoryId: string | '' = body?.category_id || ''
  const categorySlug: string | '' = body?.category_slug || ''

  try {
    if (!categoryId && categorySlug) {
      const supabase = createServiceRoleClient()
      const { data: cat, error } = await supabase
        .from('categories')
        .select('id, slug')
        .eq('slug', categorySlug)
        .maybeSingle()
      if (error) {
        const safeMsg = error.message || 'Failed to resolve category by slug'
        return NextResponse.json({ success: false, error: safeMsg }, { status: 500 })
      }
      categoryId = (cat?.id as string) || ''
    }

    const { generateDailyRecommendations } = await import('@/lib/services/recommendations-admin')
    const result = await generateDailyRecommendations(refreshType, categoryId || undefined)
    return NextResponse.json({ success: true, ...result, refresh_type: refreshType, category_id: categoryId || null })
  } catch (error: any) {
    const msg: string = (error?.message as string) || ''
    const code: any = (error && (error as any).code) || undefined
    const isMissing = code === '42P01' || (typeof msg === 'string' && msg.toLowerCase().includes('relation') && msg.toLowerCase().includes('does not exist'))
    if (isMissing) {
      const date = new Date().toISOString().slice(0,10)
      return NextResponse.json({ success: true, date, counts: { deals: 0, best_sellers: 0 }, note: 'product_recommendations table not found. Apply migrations.', refresh_type: refreshType, category_id: categoryId || null })
    }
    const safeMsg = msg || `Recommendation generation failed${code ? ` (code: ${code})` : ''}`
    return NextResponse.json({ success: false, error: safeMsg }, { status: 500 })
  }
})

