import { NextRequest, NextResponse } from 'next/server'
import { sendEmailViaResend } from '@/lib/integrations/resend'

export async function GET(request: NextRequest) {
  // Check if this is a development/testing environment
  const isDev = process.env.NODE_ENV !== 'production'
  const isPreview = process.env.VERCEL_ENV === 'preview'
  
  if (!isDev && !isPreview) {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  // Check environment variables
  const config = {
    hasResendApiKey: !!process.env.RESEND_API_KEY,
    resendApiKeyLength: process.env.RESEND_API_KEY?.length || 0,
    resendFromEmail: process.env.RESEND_FROM_EMAIL || 'no-reply@foryoupiece.com',
    resendFromName: process.env.RESEND_FROM_NAME || 'Foryoupiece',
    hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseServiceKeyLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    devEmailOverride: process.env.DEV_EMAIL_OVERRIDE,
    forceToOverride: process.env.RESEND_OVERRIDE_ALL_TO,
  }

  // Test email sending if requested
  const testEmail = request.nextUrl.searchParams.get('test')
  if (testEmail === 'true') {
    try {
      const result = await sendEmailViaResend({
        to: 'akito12350@gmail.com',
        subject: 'Test Email Configuration',
        html: '<p>This is a test email to verify Resend configuration.</p>',
        emailType: 'test',
        metadata: { test: true, timestamp: new Date().toISOString() }
      })

      return NextResponse.json({
        config,
        testResult: result
      })
    } catch (error: any) {
      return NextResponse.json({
        config,
        testResult: {
          success: false,
          error: error.message
        }
      })
    }
  }

  return NextResponse.json({ config })
}
