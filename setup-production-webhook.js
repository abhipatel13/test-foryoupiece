#!/usr/bin/env node

/**
 * Setup Telegram Webhook for Production
 * This script configures the webhook to point to the production foryoupiece.com site
 */

require('dotenv').config({ path: '.env.local' });

const NOTIFICATION_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

// Production webhook URL
const PRODUCTION_WEBHOOK_URL = 'https://foryoupiece.com/api/webhook/telegram';

console.log('🚀 Setting up Telegram webhook for PRODUCTION');
console.log('='.repeat(60));
console.log('');

/**
 * Set webhook for production
 */
async function setupProductionWebhook() {
  console.log('📡 Configuring webhook for production...');
  console.log(`🎯 Target URL: ${PRODUCTION_WEBHOOK_URL}`);
  console.log(`🔐 Secret Token: ${WEBHOOK_SECRET ? 'SET' : 'NOT SET'}`);
  console.log('');

  if (!NOTIFICATION_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN not found in environment variables');
    return false;
  }

  if (!WEBHOOK_SECRET) {
    console.error('❌ TELEGRAM_WEBHOOK_SECRET not found in environment variables');
    return false;
  }

  try {
    // Use node-fetch or built-in fetch
    let fetch;
    try {
      fetch = (await import('node-fetch')).default;
    } catch {
      fetch = globalThis.fetch;
    }

    console.log('📤 Setting webhook...');
    const response = await fetch(`https://api.telegram.org/bot${NOTIFICATION_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: PRODUCTION_WEBHOOK_URL,
        secret_token: WEBHOOK_SECRET,
        allowed_updates: ['message', 'edited_message', 'callback_query'],
        drop_pending_updates: true // Clear any pending updates
      })
    });
    
    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ Production webhook set successfully!');
      console.log(`   URL: ${PRODUCTION_WEBHOOK_URL}`);
      console.log(`   Allowed updates: message, edited_message, callback_query`);
      console.log('');
      return true;
    } else {
      console.error('❌ Failed to set production webhook:', data.description);
      return false;
    }

  } catch (error) {
    console.error('❌ Error setting webhook:', error.message);
    return false;
  }
}

/**
 * Get current webhook info
 */
async function getWebhookInfo() {
  console.log('🔍 Checking current webhook status...');
  
  try {
    let fetch;
    try {
      fetch = (await import('node-fetch')).default;
    } catch {
      fetch = globalThis.fetch;
    }

    const response = await fetch(`https://api.telegram.org/bot${NOTIFICATION_BOT_TOKEN}/getWebhookInfo`);
    const data = await response.json();
    
    if (data.ok) {
      console.log('📋 Current Webhook Info:');
      console.log(`   URL: ${data.result.url || 'NOT SET'}`);
      console.log(`   Has Custom Certificate: ${data.result.has_custom_certificate}`);
      console.log(`   Pending Update Count: ${data.result.pending_update_count}`);
      console.log(`   Last Error Date: ${data.result.last_error_date || 'None'}`);
      console.log(`   Last Error Message: ${data.result.last_error_message || 'None'}`);
      console.log(`   Max Connections: ${data.result.max_connections || 'Default'}`);
      console.log(`   Allowed Updates: ${data.result.allowed_updates?.join(', ') || 'All'}`);
      console.log('');
      return data.result;
    } else {
      console.error('❌ Failed to get webhook info:', data.description);
      return null;
    }

  } catch (error) {
    console.error('❌ Error getting webhook info:', error.message);
    return null;
  }
}

/**
 * Test the production webhook
 */
async function testProductionWebhook() {
  console.log('🧪 Testing production webhook...');
  
  try {
    let fetch;
    try {
      fetch = (await import('node-fetch')).default;
    } catch {
      fetch = globalThis.fetch;
    }

    // Test if the webhook endpoint is accessible
    const response = await fetch(PRODUCTION_WEBHOOK_URL, {
      method: 'GET'
    });

    console.log(`📊 Production webhook accessibility test:`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Status Text: ${response.statusText}`);
    
    if (response.status === 405) {
      console.log('✅ Webhook endpoint is accessible (405 = Method Not Allowed for GET is expected)');
    } else if (response.status === 200) {
      console.log('✅ Webhook endpoint is accessible');
    } else {
      console.log('⚠️ Unexpected response - webhook may not be properly configured');
    }
    console.log('');

  } catch (error) {
    console.error('❌ Error testing production webhook:', error.message);
  }
}

/**
 * Check for pending orders that can be tested
 */
async function checkPendingOrders() {
  console.log('🔍 Checking for pending orders on production...');
  
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
      console.log('❌ No pending orders found for testing');
      console.log('💡 Place a new order on foryoupiece.com to test the webhook');
      return;
    }

    console.log(`✅ Found ${orders.length} pending order(s) ready for /done testing:`);
    orders.forEach((order, index) => {
      console.log(`   ${index + 1}. ${order.order_number} - $${order.total_amount}`);
    });
    console.log('');
    console.log('💡 To test: Go to your Telegram notification group and reply with /done');

  } catch (error) {
    console.error('❌ Error checking orders:', error);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🤖 Production Telegram Webhook Setup');
  console.log('='.repeat(50));
  console.log('');

  // Step 1: Check current webhook status
  await getWebhookInfo();

  // Step 2: Test production endpoint accessibility
  await testProductionWebhook();

  // Step 3: Set up production webhook
  const success = await setupProductionWebhook();

  if (success) {
    // Step 4: Verify webhook was set
    console.log('🔄 Verifying webhook configuration...');
    await getWebhookInfo();

    // Step 5: Check for pending orders to test
    await checkPendingOrders();

    console.log('🎉 Production webhook setup complete!');
    console.log('');
    console.log('📋 Next Steps:');
    console.log('   1. Go to your Telegram notification group');
    console.log('   2. Find a pending order notification');
    console.log('   3. Reply with /done to test the webhook');
    console.log('   4. Check the production logs or database for confirmation');
  } else {
    console.log('❌ Failed to set up production webhook');
  }
}

// Run the setup
main().catch(console.error);
