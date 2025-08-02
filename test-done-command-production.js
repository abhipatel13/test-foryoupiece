#!/usr/bin/env node

/**
 * Test /done Command on Production
 * This script simulates a /done command to test the complete webhook flow
 */

require('dotenv').config({ path: '.env.local' });

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

/**
 * Test the /done command with production webhook
 */
async function testDoneCommand() {
  console.log('🧪 Testing /done command on production webhook...');
  
  // Simulate a Telegram update for /done command
  const telegramUpdate = {
    update_id: Date.now(),
    message: {
      message_id: Date.now(),
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
    console.log('📤 Sending /done command to production webhook...');
    console.log(`🎯 Target: https://foryoupiece.com/api/webhook/telegram`);
    
    // Use node-fetch or built-in fetch
    let fetch;
    try {
      fetch = (await import('node-fetch')).default;
    } catch {
      fetch = globalThis.fetch;
    }

    const response = await fetch('https://foryoupiece.com/api/webhook/telegram', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': WEBHOOK_SECRET || 'foryoupiece-webhook-secret'
      },
      body: JSON.stringify(telegramUpdate)
    });

    const result = await response.text();
    
    if (response.ok) {
      console.log('✅ Production webhook test successful!');
      console.log('📋 Response:', result);
      console.log('');
      console.log('🎉 The /done command should now:');
      console.log('   1. ✅ Process the latest pending order');
      console.log('   2. ✅ Send detailed confirmation to group -1002667614926 (thread 3)');
      console.log('   3. ✅ Update order status to completed');
      console.log('');
      console.log('📱 Check your Telegram confirmation group to see the detailed message!');
    } else {
      console.error('❌ Production webhook test failed:', response.status, result);
    }

  } catch (error) {
    console.error('❌ Error testing production webhook:', error.message);
  }
}

/**
 * Check pending orders
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

    console.log(`✅ Found ${orders.length} pending order(s) ready for /done testing:`);
    orders.forEach((order, index) => {
      console.log(`   ${index + 1}. ${order.order_number} - $${order.total_amount} (${new Date(order.created_at).toLocaleString()})`);
    });
    console.log('');

  } catch (error) {
    console.error('❌ Error checking orders:', error);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🤖 Production /done Command Test');
  console.log('='.repeat(50));
  console.log('');

  await checkPendingOrders();
  await testDoneCommand();
}

// Run the test
main().catch(console.error);
