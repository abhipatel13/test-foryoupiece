import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export const dynamic = 'force-dynamic'

/**
 * Mark a coupon announcement as seen for the authenticated user and create a user notification (if missing).
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const { couponId } = await req.json().catch(() => ({}))
    if (!couponId || typeof couponId !== 'string') {
      return NextResponse.json({ success: false, error: 'couponId required' }, { status: 400 })
    }

    const svc = createServiceRoleClient()
    if (!svc) return NextResponse.json({ success: false, error: 'Service unavailable' }, { status: 503 })

    // Upsert seen record
    const { error: seenErr } = await svc
      .from('coupon_popup_views')
      .upsert({ user_id: user.id, coupon_id: couponId }, { onConflict: 'user_id,coupon_id', ignoreDuplicates: true })

    if (seenErr) {
      console.error('Failed to upsert coupon_popup_views', seenErr)
    }

    // Load coupon details
    const { data: coupon, error: couponErr } = await svc
      .from('coupons')
      .select('id, code, name, description, expires_at, metadata')
      .eq('id', couponId)
      .single()

    if (!couponErr && coupon) {
      // Check if notification already exists for this user/coupon
      const { data: existing } = await svc
        .from('notifications')
        .select('id')
        .eq('user_id', user.id)
        .contains('metadata', { coupon_id: coupon.id })
        .limit(1)

      if (!existing || existing.length === 0) {
        const title = (coupon.metadata?.public_title as string) || 'New coupon for you'
        const message = `${coupon.name || 'Coupon'}: Code ${coupon.code}${coupon.expires_at ? ` (expires ${new Date(coupon.expires_at).toLocaleDateString()})` : ''}`
        await svc.from('notifications').insert({
          user_id: user.id,
          title,
          message,
          type: 'success',
          metadata: { coupon_id: coupon.id, code: coupon.code, source: 'coupon_announcement' }
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('\u274c Coupon announcements SEEN error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

