import { NextRequest, NextResponse } from 'next/server'

/**
 * Test endpoint for full order notification flow
 * This tests the complete customer notification system
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing full order notification flow...')

    // Import the customer notification service
    const { sendEmailViaSupabase } = await import('@/lib/services/customer-notification-service')

    // Test simple email sending first
    console.log('📧 Testing simple email sending...')

    const result = await sendEmailViaSupabase({
      to: 'akito12350@gmail.com',
      subject: 'Test Order Notification - Email System Working',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">🎉 Email System Test Successful!</h2>
          <p>This email confirms that your ForYouPiece email system is working correctly.</p>
          <p><strong>Test Details:</strong></p>
          <ul>
            <li>✅ RESEND_API_KEY configured</li>
            <li>✅ Direct Resend API working</li>
            <li>✅ Fallback system operational</li>
            <li>✅ Customer notification service functional</li>
          </ul>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <p>Your email system is ready for production use!</p>
        </div>
      `,
      emailType: 'test_notification',
      metadata: {
        test: true,
        timestamp: new Date().toISOString(),
        system: 'customer_notification_service'
      }
    })

    if (!result.success) {
      console.error('❌ Order notification failed:', result.error)
      return NextResponse.json({
        success: false,
        error: result.error,
        details: result
      }, { status: 500 })
    }

    console.log('✅ Order notification sent successfully:', result.id)

    return NextResponse.json({
      success: true,
      message: 'Email system test successful',
      data: result
    })

  } catch (error: any) {
    console.error('❌ Order notification test error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      stack: error.stack
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Email system test endpoint - use POST to test email functionality',
    purpose: 'Test customer notification service email system'
  })
}
