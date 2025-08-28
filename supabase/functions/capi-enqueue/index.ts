import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type EnqueueBody = {
  event_name: 'Purchase' | string
  event_id: string
  order_id: string
  consent: boolean
  payload: Record<string, unknown>
}

function json(res: any, status = 200) {
  return new Response(JSON.stringify(res), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const auth = req.headers.get('authorization')
    const secret = Deno.env.get('CAPIG_ENQUEUE_SECRET')
    if (!secret || auth !== `Bearer ${secret}`) return json({ success: false, error: 'Unauthorized' }, 401)

    const body = (await req.json()) as EnqueueBody
    if (!body?.event_name || !body?.event_id || !body?.order_id || !body?.payload) {
      return json({ success: false, error: 'Missing required fields' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data, error } = await supabase.from('capi_event_queue').insert({
      event_name: body.event_name,
      event_id: body.event_id,
      order_id: body.order_id,
      consent: !!body.consent,
      payload: body.payload,
      status: body.consent ? 'queued' : 'failed',
      last_error: body.consent ? null : 'Consent not granted',
      next_attempt_at: new Date().toISOString()
    }).select('id').single()

    if (error) {
      console.error('❌ capi-enqueue insert error', error)
      return json({ success: false, error: error.message }, 500)
    }

    return json({ success: true, id: data.id })
  } catch (e: any) {
    console.error('❌ capi-enqueue error', e)
    return json({ success: false, error: e?.message || 'Unknown error' }, 500)
  }
})

