import { NextRequest, NextResponse } from 'next/server'
import { cookies as nextCookies, headers as nextHeaders } from 'next/headers'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

// Helper: site base URL
function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  const port = process.env.PORT || '3001'
  return `http://localhost:${port}`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { orderId, consent } = body || {}
    if (!orderId) return NextResponse.json({ success: false, error: 'orderId required' }, { status: 400 })

    // Respect consent
    if (!consent) {
      return NextResponse.json({ success: false, error: 'Consent not granted' }, { status: 200 })
    }

    const service = createServiceRoleClient()
    if (!service) return NextResponse.json({ success: false, error: 'Service unavailable' }, { status: 500 })

    // Load order + items minimally for payload
    const { data: order, error } = await service
      .from('orders')
      .select('id, email, phone, currency, total_amount, created_at, order_items(title, quantity, price, total, sku)')
      .eq('id', orderId)
      .single()

    if (error || !order) {
      return NextResponse.json({ success: false, error: error?.message || 'Order not found' }, { status: 404 })
    }

    // client hints
    const hdrs = await nextHeaders()
    const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined
    const ua = hdrs.get('user-agent') || undefined

    // cookies
    const ck = await nextCookies()
    const fbp = ck.get('_fbp')?.value
    const fbc = ck.get('_fbc')?.value

    // Build contents
    const contents = (order.order_items || []).map((it: any) => ({ id: it.sku || it.title, quantity: it.quantity, item_price: it.price }))

    const payload = {
      pixel_id: process.env.META_PIXEL_ID,
      client: { fbp, fbc, ip, ua },
      order: { id: order.id, email: order.email, phone: order.phone },
      custom_data: {
        currency: order.currency || 'USD',
        value: Number(order.total_amount || 0),
        contents,
        event_source_url: `${getBaseUrl()}/thank-you` // optional
      }
    }

    const secret = process.env.CAPIG_ENQUEUE_SECRET
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!secret || !supabaseUrl) {
      return NextResponse.json({ success: false, error: 'Server not configured' }, { status: 500 })
    }

    const res = await fetch(`https://xhfmyghtcugcocchzgja.functions.supabase.co/capi-enqueue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        'X-ENQUEUE-SECRET': process.env.CAPIG_ENQUEUE_SECRET!,
      },
      body: JSON.stringify({
        event_name: 'Purchase',
        event_id: String(order.id),
        order_id: order.id,
        consent: true,
        payload
      })
    })

    const result = await res.json().catch(() => ({}))
    console.log(`🔍 CAPI enqueue response: status=${res.status}, ok=${res.ok}, body=${JSON.stringify(result).slice(0, 200)}`)
    if (!res.ok || !result?.success) {
      return NextResponse.json({ success: false, error: result?.error || `HTTP ${res.status}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: result.id })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Unknown error' }, { status: 500 })
  }
}

