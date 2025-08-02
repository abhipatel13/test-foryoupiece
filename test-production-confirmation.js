#!/usr/bin/env node

/**
 * Test Production Confirmation Message
 * This script tests the actual production webhook to see the confirmation message format
 */

require('dotenv').config({ path: '.env.local' });

/**
 * Test the production confirmation message
 */
async function testProductionConfirmation() {
  console.log('🧪 Testing production confirmation message...');
  
  try {
    // Send /done command to production webhook
    const webhookUrl = 'https://foryoupiece.com/api/webhook/telegram';
    
    const testMessage = {
      message: {
        message_id: 12345,
        from: {
          id: 123456789,
          is_bot: false,
          first_name: 'Test',
          last_name: 'User',
          username: 'testuser'
        },
        chat: {
          id: -1002251987881,
          type: 'supergroup',
          title: 'Test Group'
        },
        date: Math.floor(Date.now() / 1000),
        text: '/done',
        message_thread_id: 2
      }
    };

    console.log('📤 Sending /done command to production webhook...');
    console.log(`🎯 Target: ${webhookUrl}`);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testMessage)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Production webhook test successful!');
      console.log('📋 Response:', result);
      console.log('');
      console.log('🎉 The /done command should now:');
      console.log('   1. ✅ Process the latest pending order');
      console.log('   2. ✅ Send detailed confirmation to group -1002667614926 (thread 3)');
      console.log('   3. ✅ Update order status to completed');
      console.log('');
      console.log('📱 Check your Telegram confirmation group to see if the customer data is now showing correctly!');
      console.log('');
      console.log('🔍 Look for:');
      console.log('   • Name: Should show real name (not "N/A N/A")');
      console.log('   • Phone: Should show real phone number (not "N/A")');
      console.log('   • ABA Bank Name: Should show real bank name (not "N/A")');
      console.log('   • Shipping Address: Should show full address (not "N/A")');
    } else {
      console.error('❌ Production webhook test failed!');
      console.error('📋 Response:', result);
    }

  } catch (error) {
    console.error('❌ Error testing production confirmation:', error);
  }
}

/**
 * Check if there are pending orders
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
      .select('order_number, total_amount, created_at')
      .eq('payment_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ Database error:', error);
      return;
    }

    if (!orders || orders.length === 0) {
      console.log('❌ No pending orders found for testing');
      return;
    }

    console.log(`✅ Found ${orders.length} pending order(s) ready for /done testing:`);
    orders.forEach((order, index) => {
      const date = new Date(order.created_at).toLocaleString();
      console.log(`   ${index + 1}. ${order.order_number} - $${order.total_amount} (${date})`);
    });
    console.log('');

  } catch (error) {
    console.error('❌ Error checking pending orders:', error);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🤖 Production Confirmation Message Test');
  console.log('='.repeat(50));
  console.log('');

  await checkPendingOrders();
  await testProductionConfirmation();
}

// Run the test
main().catch(console.error);
