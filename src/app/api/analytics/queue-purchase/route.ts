import { NextRequest, NextResponse } from 'next/server'
import { cookies as nextCookies, headers as nextHeaders } from 'next/headers'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import crypto from 'crypto'

// Helper: site base URL
function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  const port = process.env.PORT || '3001'
  return `http://localhost:${port}`
}

function sha256Hex(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex')
}

function normalizePhone(phone?: string | null) {
  if (!phone) return null
  return phone.replace(/[^0-9]/g, '')
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

    // client hints (allow overrides from body.client forwarded by the creator route)
    const clientOverride = (body && typeof body === 'object' ? (body as any).client : undefined) || {}
    const hdrs = await nextHeaders()
    const ip = clientOverride.ip || hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined
    const ua = clientOverride.ua || hdrs.get('user-agent') || undefined

    // cookies (allow overrides when forwarded)
    const ck = await nextCookies()
    const fbp = clientOverride.fbp || ck.get('_fbp')?.value
    const fbc = clientOverride.fbc || ck.get('_fbc')?.value

    // Build contents
    const contents = (order.order_items || []).map((it: any) => ({ id: it.sku || it.title, quantity: it.quantity, item_price: it.price }))

    // Direct CAPIG (Stape) only
    const RAW_CAPIG = (process.env.STAPE_CAPIG_URL || 'https://capig.foryoupiece.com/events').trim()
    // Normalize: ensure trailing '/events' exactly; fix common misconfig '/event'
    let CAPIG_URL = RAW_CAPIG.replace(/\/$/, '')
    CAPIG_URL = CAPIG_URL.replace(/\/event$/, '/events')
    if (!/\/events$/.test(CAPIG_URL)) CAPIG_URL = `${CAPIG_URL}/events`
    const CAPIG_ID = process.env.STAPE_CAPIG_IDENTIFIER
    const CAPIG_KEY = process.env.STAPE_CAPIG_API_KEY
    // Fallback to NEXT_PUBLIC id when META_PIXEL_ID is not set in server envs
    const PIXEL_ID = process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID
    const TEST_CODE = process.env.META_TEST_EVENT_CODE

    if (!CAPIG_ID || !CAPIG_KEY || !PIXEL_ID) {
      return NextResponse.json({ success: false, error: 'CAPIG not configured' }, { status: 500 })
    }

    const email = (order.email || undefined) as string | undefined
    const phone = (order.phone || undefined) as string | undefined
    const emHash = email ? sha256Hex(email.trim().toLowerCase()) : undefined
    const phDigits = normalizePhone(phone)
    const phHash = phDigits ? sha256Hex(phDigits) : undefined

    const user_data: any = {
      client_ip_address: ip,
      client_user_agent: ua,
    }
    if (fbp) user_data.fbp = fbp
    if (fbc) user_data.fbc = fbc
    if (emHash) user_data.em = [emHash]
    if (phHash) user_data.ph = [phHash]

    const event: any = {
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_id: String(order.id),
      action_source: 'website',
      event_source_url: `${getBaseUrl()}/thank-you`,
      user_data,
      custom_data: {
        currency: order.currency || 'USD',
        value: Number(order.total_amount || 0),
        contents,
        content_type: 'product'
      }
    }
    if (TEST_CODE) event.test_event_code = TEST_CODE

    const bodyOut = { data: [event], pixel_id: PIXEL_ID }

    // Add timeout guard to external CAPIG call
    const capigController = new AbortController()
    const capigTimeout = setTimeout(() => capigController.abort(), 12_000)
    const capigRes = await fetch(CAPIG_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Identifier': CAPIG_ID,
        'API-Key': CAPIG_KEY,
      },
      body: JSON.stringify(bodyOut),
      signal: capigController.signal,
    }).finally(() => clearTimeout(capigTimeout))

    const capigRespBody = await capigRes.json().catch(async () => ({ text: await capigRes.text() }))
    console.log('🔁 CAPIG direct response', { status: capigRes.status, ok: capigRes.ok, body: capigRespBody })

    if (!capigRes.ok) {
      return NextResponse.json({ success: false, error: capigRespBody?.error || `HTTP ${capigRes.status}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, via: 'capig-direct' })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Unknown error' }, { status: 500 })
  }
}

