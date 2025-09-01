import { NextRequest, NextResponse } from 'next/server'
import { cookies as nextCookies, headers as nextHeaders } from 'next/headers'

// Helper: site base URL (used for event_source_url fallback)
function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  const port = process.env.PORT || '3001'
  return `http://localhost:${port}`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const {
      eventId,
      sku,
      name,
      price,
      quantity,
      currency = 'USD',
      sourceUrl,
      consent,
    } = body || {}

    if (!consent) {
      return NextResponse.json({ success: false, error: 'Consent not granted' }, { status: 200 })
    }

    // Build client hints
    const hdrs = await nextHeaders()
    const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined
    const ua = hdrs.get('user-agent') || undefined

    // Read cookies for fbp/fbc (these are vital for matching + dedup)
    const ck = await nextCookies()
    const fbp = ck.get('_fbp')?.value
    const fbc = ck.get('_fbc')?.value

    // Stape CAPIG configuration
    const RAW_CAPIG = (process.env.STAPE_CAPIG_URL || 'https://capig.foryoupiece.com/events').trim()
    let CAPIG_URL = RAW_CAPIG.replace(/\/$/, '')
    CAPIG_URL = CAPIG_URL.replace(/\/event$/, '/events')
    if (!/\/events$/.test(CAPIG_URL)) CAPIG_URL = `${CAPIG_URL}/events`

    const CAPIG_ID = process.env.STAPE_CAPIG_IDENTIFIER
    const CAPIG_KEY = process.env.STAPE_CAPIG_API_KEY
    const PIXEL_ID = process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID // fallback fix
    const TEST_CODE = process.env.META_TEST_EVENT_CODE

    if (!CAPIG_ID || !CAPIG_KEY || !PIXEL_ID) {
      return NextResponse.json({ success: false, error: 'CAPIG not configured' }, { status: 500 })
    }

    const contents = [
      { id: String(sku || name || 'unknown'), quantity: Number(quantity || 1), item_price: Number(price || 0) },
    ]
    const content_ids = contents.map(c => c.id)

    const user_data: any = {
      client_ip_address: ip,
      client_user_agent: ua,
    }
    if (fbp) user_data.fbp = fbp
    if (fbc) user_data.fbc = fbc

    const event: any = {
      event_name: 'AddToCart',
      event_time: Math.floor(Date.now() / 1000),
      event_id: String(eventId || `atc_${Date.now()}`),
      action_source: 'website',
      event_source_url: sourceUrl || `${getBaseUrl()}`,
      user_data,
      custom_data: {
        currency,
        value: Number(price || 0) * Number(quantity || 1),
        contents,
        content_ids,
        content_type: 'product',
      },
    }

    // Attach test_event_code at the top level (as required by Meta/Stape for Test Events visibility)
    const bodyOut: any = { data: [event], pixel_id: PIXEL_ID }
    if (TEST_CODE) bodyOut.test_event_code = TEST_CODE

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12_000)
    const res = await fetch(CAPIG_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Identifier: CAPIG_ID!,
        'API-Key': CAPIG_KEY!,
      },
      body: JSON.stringify(bodyOut),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))

    const respBody = await res.json().catch(async () => ({ text: await res.text() }))
    // Extract Graph API-like stats if available
    const eventsReceived = (respBody && (respBody.events_received ?? respBody.eventsReceived)) ?? null
    const messages = (respBody && (respBody.messages || respBody.data?.messages)) || []
    console.log('🔁 CAPIG AddToCart response', { status: res.status, ok: res.ok, eventsReceived, messages, body: respBody })

    // Treat OK+0 received as soft failure (still return 200 to avoid UX impact but flag success=false)
    const success = !!res.ok && (eventsReceived === null || eventsReceived > 0)
    return NextResponse.json({ success, via: 'capig-direct', events_received: eventsReceived, messages })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Unknown error' }, { status: 500 })
  }
}

