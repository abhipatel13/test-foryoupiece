import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  to: string | string[]
  subject: string
  html: string
  text?: string
  emailType?: string
  metadata?: Record<string, any>
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('📧 Email function called:', req.method)

    // Verify authorization
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('❌ Missing authorization header')
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    // Parse request body
    const emailRequest: EmailRequest = await req.json()
    console.log('📧 Email request:', {
      to: emailRequest.to,
      subject: emailRequest.subject,
      emailType: emailRequest.emailType
    })

    // Validate required fields
    if (!emailRequest.to || !emailRequest.subject || !emailRequest.html) {
      console.error('❌ Missing required email fields')
      return new Response('Missing required fields: to, subject, html', { 
        status: 400, 
        headers: corsHeaders 
      })
    }

    // Initialize Supabase client for logging
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Normalize recipients
    const recipients = Array.isArray(emailRequest.to) ? emailRequest.to : [emailRequest.to]
    
    // Get environment variables for email configuration
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'no-reply@foryoupiece.com'
    const fromName = Deno.env.get('RESEND_FROM_NAME') || 'Foryoupiece'
    
    // Check for development overrides
    const forceToOverride = Deno.env.get('RESEND_OVERRIDE_ALL_TO')
    const devEmailOverride = Deno.env.get('DEV_EMAIL_OVERRIDE')
    const isProduction = Deno.env.get('DENO_DEPLOYMENT_ID') // Supabase Edge Functions production indicator
    
    let finalRecipients = recipients
    
    // Apply email overrides for testing
    if (forceToOverride) {
      finalRecipients = [forceToOverride]
      console.log('📧 Using force override email:', forceToOverride)
    } else if (!isProduction && devEmailOverride) {
      finalRecipients = [devEmailOverride]
      console.log('📧 Using dev override email:', devEmailOverride)
    }

    if (!resendApiKey) {
      console.error('❌ RESEND_API_KEY not configured')
      
      // Log the failure
      await supabase.from('email_logs').insert({
        recipient: finalRecipients.join(','),
        subject: emailRequest.subject,
        email_type: emailRequest.emailType || 'generic',
        status: 'failed',
        error_message: 'Missing RESEND_API_KEY configuration',
        metadata: emailRequest.metadata || {},
        created_at: new Date().toISOString(),
      })

      return new Response('Email service not configured', { 
        status: 500, 
        headers: corsHeaders 
      })
    }

    // Prepare email payload
    const emailPayload = {
      from: `${fromName} <${fromEmail}>`,
      to: finalRecipients,
      subject: emailRequest.subject,
      html: emailRequest.html,
      ...(emailRequest.text && { text: emailRequest.text })
    }

    console.log('📧 Sending email via Resend API...')

    // Send email via Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    })

    const responseData = await response.json()
    const success = response.status >= 200 && response.status < 300

    console.log('📧 Resend API response:', {
      status: response.status,
      success,
      data: responseData
    })

    // Log the email attempt
    await supabase.from('email_logs').insert({
      recipient: finalRecipients.join(','),
      subject: emailRequest.subject,
      email_type: emailRequest.emailType || 'generic',
      status: success ? 'sent' : 'failed',
      error_message: success ? null : (responseData?.error || `HTTP ${response.status}`),
      metadata: emailRequest.metadata || {},
      created_at: new Date().toISOString(),
    })

    if (!success) {
      console.error('❌ Email sending failed:', responseData)
      return new Response(JSON.stringify({
        success: false,
        error: responseData?.error || `HTTP ${response.status}`
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('✅ Email sent successfully:', responseData.id)

    return new Response(JSON.stringify({
      success: true,
      id: responseData.id,
      message: 'Email sent successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Email function error:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
