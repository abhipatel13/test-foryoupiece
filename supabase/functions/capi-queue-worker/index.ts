import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type QueueRow = {
  id: string
  event_name: string
  event_id: string
  order_id: string
  payload: any
  consent: boolean
  attempts: number
  status: 'queued'|'processing'|'sent'|'failed'
}

function json(res: any, status = 200) {
  return new Response(JSON.stringify(res), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input)
  return crypto.subtle.digest('SHA-256', data).then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''))
}

function normalizePhone(phone?: string | null) {
  if (!phone) return null
  return phone.replace(/[^0-9]/g, '')
}

function backoffSeconds(attempt: number) {
  switch (attempt) {
    case 0: return 0
    case 1: return 60
    case 2: return 300
    case 3: return 900
    case 4: return 3600
    case 5: return 21600
    default: return 86400
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  const CAPIG_URL = Deno.env.get('STAPE_CAPIG_URL') || 'https://capig.foryoupiece.com/events'
  const CAPIG_ID = Deno.env.get('STAPE_CAPIG_IDENTIFIER')
  const CAPIG_KEY = Deno.env.get('STAPE_CAPIG_API_KEY')
  const PIXEL_ID = Deno.env.get('META_PIXEL_ID')
  const TEST_CODE = Deno.env.get('META_TEST_EVENT_CODE')

  if (!CAPIG_ID || !CAPIG_KEY || !PIXEL_ID) {
    console.error('❌ Missing Stape/Meta env: identifier, api key, or pixel id')
    return json({ success: false, error: 'Server not configured' }, 500)
  }

  try {
    // pull up to N events ready for processing
    const { data: items, error } = await supabase
      .from('capi_event_queue')
      .select('*')
      .in('status', ['queued','failed'])
      .lte('next_attempt_at', new Date().toISOString())
      .lt('attempts', 7)
      .order('created_at', { ascending: true })
      .limit(25)

    if (error) throw error

    let processed = 0

    for (const q of items ?? []) {
      try {
        await supabase.from('capi_event_queue').update({ status: 'processing' }).eq('id', q.id)

        const now = Math.floor(Date.now() / 1000)
        const pd = q.payload || {}
        const user = (pd.user || {}) as any
        const client = (pd.client || {}) as any
        const cust = (pd.customer || {}) as any
        const order = (pd.order || {}) as any
        const custom = (pd.custom_data || pd.custom || {}) as any

        const email = (user.email || cust.email || order.email) as string | undefined
        const phone = (user.phone || cust.phone || order.phone) as string | undefined

        const emHash = email ? await sha256Hex(email.trim().toLowerCase()) : undefined
        const phDigits = normalizePhone(phone)
        const phHash = phDigits ? await sha256Hex(phDigits) : undefined

        const user_data: any = {
          client_ip_address: client.ip,
          client_user_agent: client.ua,
        }
        if (client.fbp) user_data.fbp = client.fbp
        if (client.fbc) user_data.fbc = client.fbc
        if (emHash) user_data.em = [emHash]
        if (phHash) user_data.ph = [phHash]

        const contents = (custom.contents || []).map((c: any) => ({
          id: String(c.id),
          quantity: Number(c.quantity || 1),
          item_price: Number(c.item_price || c.price || 0)
        }))

        const event: any = {
          event_name: q.event_name,
          event_time: now,
          event_id: String(q.event_id),
          action_source: 'website',
          event_source_url: custom.event_source_url || undefined,
          user_data,
          custom_data: {
            currency: custom.currency || 'USD',
            value: Number(custom.value || 0),
            contents,
            content_type: 'product'
          }
        }
        if (TEST_CODE) event.test_event_code = TEST_CODE

        const body = { data: [event], pixel_id: PIXEL_ID }

        const res = await fetch(CAPIG_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Identifier': CAPIG_ID,
            'API-Key': CAPIG_KEY,
          },
          body: JSON.stringify(body)
        })

        let responseBody: any = null
        try { responseBody = await res.json() } catch { responseBody = { text: await res.text() } }

        await supabase.from('capi_event_logs').insert({
          queue_id: q.id,
          attempt: (q.attempts ?? 0) + 1,
          status_code: res.status,
          request: body,
          response: responseBody
        })

        if (res.ok) {
          await supabase.from('capi_event_queue').update({ status: 'sent' }).eq('id', q.id)
        } else {
          const next = new Date(Date.now() + backoffSeconds((q.attempts ?? 0) + 1) * 1000).toISOString()
          await supabase.from('capi_event_queue').update({
            status: 'failed',
            attempts: (q.attempts ?? 0) + 1,
            next_attempt_at: next,
            last_error: responseBody?.error || responseBody?.message || `HTTP ${res.status}`
          }).eq('id', q.id)
        }
        processed++
      } catch (err: any) {
        console.error('❌ Worker error for row', err)
        const next = new Date(Date.now() + backoffSeconds(1) * 1000).toISOString()
        await supabase.from('capi_event_queue').update({
          status: 'failed',
          attempts: 1,
          next_attempt_at: next,
          last_error: err?.message || 'Worker error'
        }).eq('id', (q as any).id)
      }
    }

    return json({ success: true, processed })
  } catch (e: any) {
    console.error('❌ queue-worker fatal', e)
    return json({ success: false, error: e?.message || 'Unknown error' }, 500)
  }
})

