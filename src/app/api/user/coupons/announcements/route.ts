import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { couponService } from '@/lib/services/coupon-service'

export const dynamic = 'force-dynamic'

/**
 * Get an eligible targeted coupon announcement for the authenticated user.
 * Returns at most one coupon the user hasn't seen yet (server-side persisted).
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const svc = createServiceRoleClient()
    if (!svc) return NextResponse.json({ success: false, error: 'Service unavailable' }, { status: 503 })

    // Already seen coupons for this user
    const { data: seenRows } = await svc
      .from('coupon_popup_views')
      .select('coupon_id')
      .eq('user_id', user.id)

    const seenSet = new Set((seenRows || []).map(r => r.coupon_id))

    // Find eligible targeted coupons (server-side eligibility checks)
    const eligible = await couponService.getEligibleTargetedCouponsForUser(user.id, 5)
    const unseen = eligible.filter((c: any) => !seenSet.has(c.id))

    if (!unseen.length) {
      return NextResponse.json({ success: true, data: { coupon: null } })
    }

    // Choose the most recent eligible unseen coupon
    const c = unseen[0]
    const responseCoupon = {
      id: c.id,
      code: c.code,
      title: (c.metadata?.public_title as string) || c.name,
      description: (c.metadata?.public_description as string) || c.description || '',
      expires_at: c.expires_at || null
    }

    return NextResponse.json({ success: true, data: { coupon: responseCoupon } })
  } catch (error: any) {
    console.error('❌ Coupon announcements GET error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

