import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Production-ready email function with verified domain
Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

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

    // Normalize recipients
    const recipients = Array.isArray(body.to) ? body.to : [body.to]

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
