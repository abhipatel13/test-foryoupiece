/**
 * Test script to verify the email notification system
 * Run this after configuring RESEND_API_KEY in Supabase
 */

const SUPABASE_URL = 'https://xhfmyghtcugcocchzgja.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhoZm15Z2h0Y3VnY29jY2h6Z2phIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjgyODAzMCwiZXhwIjoyMDY4NDA0MDMwfQ.i_XZl5t2cWjdQ4i04F7J-nDQSMiIYmAFucNTlDsXVt0';

async function testEmailSystem() {
  console.log('🧪 Testing Email System...');
  
  try {
    // Test email payload
    const emailData = {
      to: 'akito12350@gmail.com',
      subject: 'Test Email - ForYouPiece System Check',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Email System Test</h2>
          <p>This is a test email to verify that the ForYouPiece email notification system is working correctly.</p>
          <p><strong>Test Details:</strong></p>
          <ul>
            <li>Timestamp: ${new Date().toISOString()}</li>
            <li>System: Customer Notification Service</li>
            <li>Status: Testing Configuration</li>
          </ul>
          <p>If you receive this email, the system is working properly!</p>
          <hr>
          <p style="color: #666; font-size: 12px;">This is an automated test email from ForYouPiece.</p>
        </div>
      `,
      emailType: 'system_test',
      metadata: {
        test: true,
        timestamp: new Date().toISOString()
      }
    };

    console.log('📧 Calling Supabase Edge Function...');
    
    // Call the send-email Edge Function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData)
    });

    const result = await response.json();
    
    console.log('📊 Response Status:', response.status);
    console.log('📊 Response Data:', result);

    if (response.ok) {
      console.log('✅ Email system test PASSED!');
      console.log('📧 Email should be delivered to akito12350@gmail.com');
      return true;
    } else {
      console.log('❌ Email system test FAILED!');
      console.log('🔍 Error details:', result);
      return false;
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    return false;
  }
}

// Run the test
testEmailSystem().then(success => {
  if (success) {
    console.log('\n🎉 Email system is working correctly!');
    console.log('✅ Ready to test with real orders');
  } else {
    console.log('\n🚨 Email system needs configuration');
    console.log('🔧 Check RESEND_API_KEY in Supabase secrets');
  }
});
