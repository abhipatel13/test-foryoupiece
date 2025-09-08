import { NextRequest, NextResponse } from 'next/server'
import { shippingService } from '@/lib/services/shipping-service'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const body = await req.json().catch(() => ({}))
    const itemCount = Number(body?.itemCount ?? 0)
    const appliedCouponCode = (body?.appliedCouponCode ?? '') as string | undefined

    const result = await shippingService.calculateShipping({
      itemCount,
      userId: user?.id,
      appliedCouponCode: appliedCouponCode || undefined,
    })

    return NextResponse.json({ success: true, data: result }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed to calculate shipping' }, { status: 200 })
  }
}

