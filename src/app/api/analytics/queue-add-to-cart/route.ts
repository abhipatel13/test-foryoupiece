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

    // Normalize and validate item fields
    const qtyNum = Math.max(1, Number(quantity ?? 1) || 1)
    const priceNum = Math.max(0, Number(price ?? 0) || 0)
    const idStr = String(sku || 'unknown')

    if (!CAPIG_ID || !CAPIG_KEY || !PIXEL_ID) {
      console.warn('⚠️ CAPIG AddToCart not configured', {
        hasId: !!CAPIG_ID,
        hasKey: !!CAPIG_KEY,
        hasPixel: !!PIXEL_ID,
        preview: { currency, value: priceNum * qtyNum, first_content: { id: idStr, quantity: qtyNum, item_price: priceNum } }
      })
      // Do not fail the request; return success=false so UI is unaffected in dev
      return NextResponse.json({ success: false, error: 'CAPIG not configured', via: 'capig-direct' }, { status: 200 })
    }

    const contents = [
      { id: idStr, quantity: qtyNum, item_price: priceNum },
    ]
    const content_ids = contents.map(c => String(c.id))

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
        value: priceNum * qtyNum,
        contents,
        content_ids,
        content_type: 'product',
      },
    }

    // Attach test_event_code at the top level (as required by Meta/Stape for Test Events visibility)
    const bodyOut: any = { data: [event], pixel_id: PIXEL_ID }
    if (TEST_CODE) bodyOut.test_event_code = TEST_CODE

    // Debug Pixel/endpoint consistency + payload summary (no secrets)
    try {
      console.log('🧪 CAPI AddToCart debug', {
        pixelId: PIXEL_ID,
        capigUrl: CAPIG_URL,
        hasFbp: !!fbp,
        hasFbc: !!fbc,
        eventId: event.event_id,
        payload: {
          currency: event.custom_data?.currency,
          value: event.custom_data?.value,
          contents_len: Array.isArray(event.custom_data?.contents) ? event.custom_data.contents.length : 0,
          first_content: event.custom_data?.contents?.[0]
        }
      })
    } catch {}

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 12_000)
      const res = await fetch(CAPIG_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Try all common header casings used by Stape CAPIG proxies
          Identifier: CAPIG_ID!,
          'API-Key': CAPIG_KEY!,
          'X-Identifier': CAPIG_ID!,
          'X-Api-Key': CAPIG_KEY!,
          'x-identifier': CAPIG_ID!,
          'x-api-key': CAPIG_KEY!,
          Accept: 'application/json',
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
    } catch (err: any) {
      console.error('❌ CAPIG AddToCart network/error', { message: err?.message })
      // Do not fail the request; return success=false so UI is unaffected
      return NextResponse.json({ success: false, via: 'capig-direct', error: err?.message || 'Network error' }, { status: 200 })
    }
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Unknown error' }, { status: 500 })
  }
}

