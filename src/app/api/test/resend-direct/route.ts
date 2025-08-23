import { NextRequest, NextResponse } from 'next/server'

/**
 * Test direct Resend API call to verify API key works
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing direct Resend API call...')

    // Check if RESEND_API_KEY is available in Next.js environment
    const resendApiKey = process.env.RESEND_API_KEY
    
    if (!resendApiKey) {
      return NextResponse.json({
        success: false,
        error: 'RESEND_API_KEY not found in Next.js environment',
        debug: {
          hasKey: false,
          keyLength: 0
        }
      }, { status: 500 })
    }

    console.log('✅ RESEND_API_KEY found in Next.js environment')
    console.log('🔑 API Key length:', resendApiKey.length)
    console.log('🔑 API Key prefix:', resendApiKey.substring(0, 10) + '...')

    // Test the API key with a simple call to Resend
    const testPayload = {
      from: 'Foryoupiece <no-reply@foryoupiece.com>',
      to: ['akito12350@gmail.com'],
      subject: 'Direct Resend API Test',
      html: '<h1>Direct API Test</h1><p>Testing Resend API directly from Next.js</p>'
    }

    console.log('📧 Making direct call to Resend API...')

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    })

    const result = await response.json()
    
    console.log('📧 Resend API response:', {
      status: response.status,
      statusText: response.statusText,
      success: response.ok,
      result: result
    })

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: 'Resend API call failed',
        debug: {
          status: response.status,
          statusText: response.statusText,
          result: result,
          hasKey: true,
          keyLength: resendApiKey.length
        }
      }, { status: response.status })
    }

    return NextResponse.json({
      success: true,
      message: 'Direct Resend API call successful!',
      debug: {
        emailId: result.id,
        status: response.status,
        hasKey: true,
        keyLength: resendApiKey.length
      }
    })

  } catch (error: any) {
    console.error('❌ Direct Resend test error:', error)
    return NextResponse.json({
      success: false,
      error: 'Direct Resend test failed',
      debug: {
        exception: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      }
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Direct Resend API Test Endpoint',
    usage: 'POST to this endpoint to test direct Resend API call',
    purpose: 'Verify RESEND_API_KEY works outside of Edge Functions'
  })
}
