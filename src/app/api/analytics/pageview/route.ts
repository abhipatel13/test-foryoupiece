import { NextRequest, NextResponse } from 'next/server'
import { cookies as nextCookies, headers as nextHeaders } from 'next/headers'

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  const port = process.env.PORT || '3001'
  return `http://localhost:${port}`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { eventId, sourceUrl, consent } = body || {}

    // Respect consent
    if (!consent) {
      return NextResponse.json({ success: false, error: 'Consent not granted' }, { status: 200 })
    }

    const hdrs = await nextHeaders()
    const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined
    const ua = hdrs.get('user-agent') || undefined

    const ck = await nextCookies()
    const fbp = ck.get('_fbp')?.value
    const fbc = ck.get('_fbc')?.value

    const RAW_CAPIG = (process.env.STAPE_CAPIG_URL || 'https://capig.foryoupiece.com/events').trim()
    let CAPIG_URL = RAW_CAPIG.replace(/\/$/, '')
    CAPIG_URL = CAPIG_URL.replace(/\/event$/, '/events')
    if (!/\/events$/.test(CAPIG_URL)) CAPIG_URL = `${CAPIG_URL}/events`

    const CAPIG_ID = process.env.STAPE_CAPIG_IDENTIFIER
    const CAPIG_KEY = process.env.STAPE_CAPIG_API_KEY
    const PIXEL_ID = process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID
    const TEST_CODE = process.env.META_TEST_EVENT_CODE

    // If CAPIG is not configured or explicitly disabled, no-op with 200 to avoid noisy failures
    const CAPIG_ENABLED = process.env.NEXT_PUBLIC_ENABLE_CAPI !== 'false'
    if (!CAPIG_ENABLED || !CAPIG_ID || !CAPIG_KEY || !PIXEL_ID) {
      return NextResponse.json({ success: false, via: 'disabled', reason: 'CAPIG not configured or disabled' }, { status: 200 })
    }

    const user_data: any = { client_ip_address: ip, client_user_agent: ua }
    if (fbp) user_data.fbp = fbp
    if (fbc) user_data.fbc = fbc

    const event: any = {
      event_name: 'PageView',
      event_time: Math.floor(Date.now() / 1000),
      event_id: String(eventId || `pv_${Date.now()}`),
      action_source: 'website',
      event_source_url: sourceUrl || `${getBaseUrl()}`,
      user_data,
    }

    const bodyOut: any = { data: [event], pixel_id: PIXEL_ID }
    if (TEST_CODE) bodyOut.test_event_code = TEST_CODE

    try { console.log('🧪 CAPI PageView debug', { pixelId: PIXEL_ID, capigUrl: CAPIG_URL, hasFbp: !!fbp, hasFbc: !!fbc, eventId: event.event_id }) } catch {}

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3_000)
    const res = await fetch(CAPIG_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Try all common header casings used by Stape CAPIG proxies
        'Identifier': CAPIG_ID!,
        'API-Key': CAPIG_KEY!,
        'X-Identifier': CAPIG_ID!,
        'X-Api-Key': CAPIG_KEY!,
        'x-identifier': CAPIG_ID!,
        'x-api-key': CAPIG_KEY!,
        'Accept': 'application/json',
      },
      body: JSON.stringify(bodyOut),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))

    const respBody = await res.json().catch(async () => ({ text: await res.text() }))
    const eventsReceived = (respBody && (respBody.events_received ?? respBody.eventsReceived)) ?? null
    const messages = (respBody && (respBody.messages || respBody.data?.messages)) || []
    console.log('🔁 CAPIG PageView response', { status: res.status, ok: res.ok, eventsReceived, messages, body: respBody })

    const success = !!res.ok && (eventsReceived === null || eventsReceived > 0)
    return NextResponse.json({ success, via: 'capig-direct', events_received: eventsReceived, messages })
  } catch (e: any) {
    // Return 200 with error payload to avoid failing client-side analytics calls
    return NextResponse.json({ success: false, via: 'capig-direct', error: e?.message || 'Unknown error' }, { status: 200 })
  }
}

