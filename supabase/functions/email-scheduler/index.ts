import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('⏰ Email scheduler triggered')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check for pending emails
    const { data: pendingEmails, error: pendingError } = await supabase
      .rpc('get_pending_emails', { p_limit: 1 })

    if (pendingError) {
      throw new Error(`Failed to check pending emails: ${pendingError.message}`)
    }

    const hasPendingEmails = pendingEmails && pendingEmails.length > 0

    console.log(`📊 Found ${pendingEmails?.length || 0} pending emails`)

    let workerResult = null

    if (hasPendingEmails) {
      console.log('🚀 Invoking email worker...')
      
      // Invoke the email worker
      const { data: workerData, error: workerError } = await supabase.functions.invoke('email-worker', {
        body: { trigger: 'scheduler' }
      })

      if (workerError) {
        console.error('❌ Email worker invocation failed:', workerError)
        throw new Error(`Email worker failed: ${workerError.message}`)
      }

      workerResult = workerData
      console.log('✅ Email worker completed:', workerResult)
    } else {
      console.log('📭 No pending emails, skipping worker invocation')
    }

    return new Response(
      JSON.stringify({
        success: true,
        pending_emails: pendingEmails?.length || 0,
        worker_invoked: hasPendingEmails,
        worker_result: workerResult,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('❌ Email scheduler error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
