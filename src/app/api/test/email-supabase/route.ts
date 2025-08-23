import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * Test endpoint to verify Supabase Edge Function email sending
 * This tests the new email architecture using Supabase Edge Functions
 * instead of direct Resend API calls
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing Supabase Edge Function email sending...')

    const supabase = createServiceRoleClient()
    
    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'Failed to create Supabase service client'
      }, { status: 500 })
    }

    // Test email data
    const testEmailData = {
      to: 'akito12350@gmail.com',
      subject: 'Test Email via Supabase Edge Function',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">🧪 Email Service Test</h2>
          <p>This is a test email sent via Supabase Edge Function.</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <p><strong>Architecture:</strong> Supabase Edge Function → Resend SMTP</p>
          <p>If you receive this email, the new email service is working correctly!</p>
        </div>
      `,
      emailType: 'test',
      metadata: {
        test: true,
        timestamp: new Date().toISOString(),
        architecture: 'supabase-edge-function'
      }
    }

    console.log('📧 Calling Supabase Edge Function...')

    // Call the Edge Function
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: testEmailData
    })

    if (error) {
      console.error('❌ Edge Function error:', error)
      return NextResponse.json({
        success: false,
        error: error.message,
        details: error
      }, { status: 500 })
    }

    console.log('✅ Edge Function response:', data)

    return NextResponse.json({
      success: true,
      message: 'Email sent via Supabase Edge Function',
      data: data,
      testData: testEmailData
    })

  } catch (error: any) {
    console.error('❌ Test endpoint error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      stack: error.stack
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Email test endpoint - use POST to send test email',
    architecture: 'Supabase Edge Function',
    purpose: 'Test new email service without direct Resend API conflicts'
  })
}
