#!/usr/bin/env node

/**
 * Test Telegram Webhook Locally
 * This script simulates a Telegram /done command to test the webhook processing
 */

require('dotenv').config({ path: '.env.local' });

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

/**
 * Simulate a Telegram /done message
 */
async function testWebhook() {
  console.log('🧪 Testing Telegram webhook locally...');
  
  // Simulate a Telegram update for /done command
  const telegramUpdate = {
    update_id: 123456789,
    message: {
      message_id: 1001,
      from: {
        id: 123456789,
        is_bot: false,
        first_name: "Test",
        username: "testuser",
        language_code: "en"
      },
      chat: {
        id: -1002251987881, // Notification group ID
        type: "supergroup",
        title: "Test Group"
      },
      date: Math.floor(Date.now() / 1000),
      text: "/done",
      message_thread_id: 2 // Thread ID 2 for notifications
    }
  };

  try {
    console.log('📤 Sending simulated /done command to webhook...');
    
    // Use node-fetch or built-in fetch
    let fetch;
    try {
      fetch = (await import('node-fetch')).default;
    } catch {
      fetch = globalThis.fetch;
    }

    const response = await fetch('http://localhost:3000/api/webhook/telegram', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': WEBHOOK_SECRET || 'foryoupiece-webhook-secret'
      },
      body: JSON.stringify(telegramUpdate)
    });

    const result = await response.text();
    
    if (response.ok) {
      console.log('✅ Webhook test successful!');
      console.log('📋 Response:', result);
    } else {
      console.error('❌ Webhook test failed:', response.status, result);
    }

  } catch (error) {
    console.error('❌ Error testing webhook:', error.message);
  }
}

/**
 * Check pending orders that can be completed with /done
 */
async function checkPendingOrders() {
  console.log('🔍 Checking for pending orders...');
  
  try {
    const { createClient } = await import('@supabase/supabase-js');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: orders, error } = await supabase
      .from('orders')
      .select('order_number, telegram_status, telegram_workflow_state, created_at, total_amount')
      .eq('telegram_status', 'pending')
      .eq('telegram_workflow_state', 'notification_sent')
      .order('created_at', { ascending: false })
      .limit(3);

    if (error) {
      console.error('❌ Database error:', error);
      return;
    }

    if (!orders || orders.length === 0) {
      console.log('❌ No pending orders found that can be completed with /done');
      return;
    }

    console.log(`✅ Found ${orders.length} pending order(s):`);
    orders.forEach((order, index) => {
      console.log(`   ${index + 1}. ${order.order_number} - $${order.total_amount}`);
    });

  } catch (error) {
    console.error('❌ Error checking orders:', error);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🤖 Telegram Webhook Test Tool');
  console.log('='.repeat(50));
  console.log('');

  await checkPendingOrders();
  console.log('');
  
  await testWebhook();
}

// Run the test
main().catch(console.error);
