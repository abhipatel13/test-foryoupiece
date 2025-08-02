#!/usr/bin/env node

/**
 * Test script to simulate "/done" webhook call
 * This simulates a Telegram text message webhook to test the order completion workflow
 */

require('dotenv').config({ path: '.env.local' });

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const NOTIFICATION_GROUP_ID = process.env.TELEGRAM_NOTIFICATION_GROUP_ID;
const NOTIFICATION_THREAD_ID = process.env.TELEGRAM_NOTIFICATION_THREAD_ID;

if (!WEBHOOK_SECRET || !NOTIFICATION_GROUP_ID || !NOTIFICATION_THREAD_ID) {
  console.error('❌ Missing required environment variables');
  console.error('Required: TELEGRAM_WEBHOOK_SECRET, TELEGRAM_NOTIFICATION_GROUP_ID, TELEGRAM_NOTIFICATION_THREAD_ID');
  process.exit(1);
}

/**
 * Simulate "/done" webhook call
 */
async function testDoneWebhook() {
  console.log('🧪 Testing "/done" webhook functionality...');
  console.log(`🎯 Target: http://localhost:3000/api/webhook/telegram`);
  console.log(`📱 Group ID: ${NOTIFICATION_GROUP_ID}`);
  console.log(`📱 Thread ID: ${NOTIFICATION_THREAD_ID}`);

  // Simulate a Telegram text message update
  const webhookPayload = {
    message: {
      message_id: 109,
      from: {
        id: 123456789, // Test user ID
        first_name: "Test",
        last_name: "User",
        username: "testuser"
      },
      chat: {
        id: parseInt(NOTIFICATION_GROUP_ID),
        type: "supergroup"
      },
      message_thread_id: parseInt(NOTIFICATION_THREAD_ID),
      text: "/done",
      date: Math.floor(Date.now() / 1000)
    }
  };

  try {
    console.log('📤 Sending webhook payload...');
    console.log('📋 Payload:', JSON.stringify(webhookPayload, null, 2));

    // Use node-fetch or built-in fetch
    const fetch = (await import('node-fetch')).default;

    const response = await fetch('http://localhost:3000/api/webhook/telegram', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': WEBHOOK_SECRET
      },
      body: JSON.stringify(webhookPayload)
    });

    const responseText = await response.text();

    console.log(`📥 Response Status: ${response.status}`);
    console.log(`📥 Response Body: ${responseText}`);

    if (response.ok) {
      console.log('✅ Webhook call successful!');
      console.log('🔍 Check the server logs for processing details');
      console.log('🔍 Check the database for order status updates');
      return true;
    } else {
      console.error('❌ Webhook call failed');
      return false;
    }
  } catch (error) {
    console.error('❌ Error calling webhook:', error.message);

    // Fallback: try with built-in fetch if available
    if (error.message.includes('node-fetch')) {
      console.log('🔄 Trying with built-in fetch...');
      try {
        const response = await fetch('http://localhost:3000/api/webhook/telegram', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Bot-Api-Secret-Token': WEBHOOK_SECRET
          },
          body: JSON.stringify(webhookPayload)
        });

        const responseText = await response.text();
        console.log(`📥 Response Status: ${response.status}`);
        console.log(`📥 Response Body: ${responseText}`);
        return response.ok;
      } catch (fallbackError) {
        console.error('❌ Fallback fetch also failed:', fallbackError.message);
        return false;
      }
    }

    return false;
  }
}

/**
 * Check order status after webhook
 */
async function checkOrderStatus() {
  console.log('\n🔍 Checking order status...');
  
  // This would require database access - for now just log instructions
  console.log('📋 To check order status, run this SQL query:');
  console.log(`SELECT order_number, telegram_status, telegram_workflow_state, arrival_confirmed_at, arrival_confirmed_by FROM orders WHERE order_number = 'FYP-20250802-1754119025966-UNCBV0';`);
}

/**
 * Main function
 */
async function main() {
  console.log('🤖 Telegram "/done" Webhook Test');
  console.log('='.repeat(50));

  const success = await testDoneWebhook();
  
  if (success) {
    await checkOrderStatus();
  }
  
  console.log('\n✅ Test completed');
}

// Run the test
main().catch(console.error);
