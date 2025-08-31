import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Production-ready email function with verified domain
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('📧 Email function called:', req.method)

    // Initialize Supabase client for logging
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const resendApiKey = Deno.env.get('RESEND_API_KEY')

    if (!resendApiKey) {
      console.error('❌ RESEND_API_KEY not configured')
      return new Response(JSON.stringify({
        success: false,
        error: 'RESEND_API_KEY not configured'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    console.log('📧 Email request:', {
      to: body.to,
      subject: body.subject,
      emailType: body.emailType
    })

    // Normalize recipients with production safety for overrides
    const isProd = (Deno.env.get('VERCEL_ENV') === 'production') || (Deno.env.get('NODE_ENV') === 'production')
    const forceTo = Deno.env.get('RESEND_OVERRIDE_ALL_TO')
    const overrideEnabled = (Deno.env.get('RESEND_OVERRIDE_ENABLED') || '').toLowerCase() === 'true'
    const devOverride = Deno.env.get('DEV_EMAIL_OVERRIDE') || 'akito12350@gmail.com'

    let recipients = Array.isArray(body.to) ? body.to : [body.to]
    if (forceTo && (!isProd || overrideEnabled)) {
      recipients = [forceTo]
      try { console.log('📧 Email override active (edge send-email)', { env: Deno.env.get('NODE_ENV'), enabled: overrideEnabled }) } catch {}
    } else if (!isProd && devOverride) {
      recipients = [devOverride]
    }

    const emailPayload = {
      from: 'Foryoupiece <no-reply@foryoupiece.com>',
      to: recipients,
      subject: body.subject,
      html: body.html,
    }

    console.log('📧 Sending email via Resend API...')

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    })

    const result = await response.json()
    const success = response.ok

    console.log('📧 Resend API response:', {
      status: response.status,
      success,
      data: result
    })

    // Return proper error status codes for failed requests
    if (!success) {
      console.error('❌ Resend API failed:', result)
      return new Response(
        JSON.stringify({
          success: false,
          error: result.message || `HTTP ${response.status}`,
          status: response.status,
          data: result
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: response.status >= 500 ? 500 : 400, // Return appropriate error status
        }
      )
    }

    // Log the email attempt to database
    await supabase.from('email_logs').insert({
      recipient: recipients.join(','),
      subject: body.subject,
      email_type: body.emailType || 'generic',
      status: success ? 'sent' : 'failed',
      error_message: success ? null : (result?.error || `HTTP ${response.status}`),
      metadata: body.metadata || {},
      created_at: new Date().toISOString(),
    })

    if (!success) {
      console.error('❌ Email sending failed:', result)
      return new Response(JSON.stringify({
        success: false,
        error: result?.error || `HTTP ${response.status}`
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('✅ Email sent successfully:', result.id)

    return new Response(JSON.stringify({
      success: true,
      id: result.id,
      message: 'Email sent successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Email function error:', error)

    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
