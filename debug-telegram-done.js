#!/usr/bin/env node

/**
 * Debug script to help troubleshoot /done command in real Telegram
 * This script checks the current state and provides debugging information
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Check for pending orders that can be completed with /done
 */
async function checkPendingOrders() {
  console.log('🔍 Checking for pending orders...');
  
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('order_number, telegram_status, telegram_workflow_state, created_at, total_amount')
      .eq('telegram_status', 'pending')
      .eq('telegram_workflow_state', 'notification_sent')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ Database error:', error);
      return;
    }

    if (!orders || orders.length === 0) {
      console.log('❌ No pending orders found that can be completed with /done');
      console.log('💡 To test /done command:');
      console.log('   1. Place a new order');
      console.log('   2. Wait for Telegram notification');
      console.log('   3. Reply with /done in the SAME THREAD (Thread ID 2)');
      return;
    }

    console.log(`✅ Found ${orders.length} pending order(s) that can be completed with /done:`);
    console.log('');
    
    orders.forEach((order, index) => {
      console.log(`${index + 1}. Order: ${order.order_number}`);
      console.log(`   Amount: $${order.total_amount}`);
      console.log(`   Created: ${new Date(order.created_at).toLocaleString()}`);
      console.log(`   Status: ${order.telegram_status} / ${order.telegram_workflow_state}`);
      console.log('');
    });

    console.log('💡 To complete any of these orders:');
    console.log('   1. Go to your Telegram notification group');
    console.log('   2. Find Thread ID 2 (where order notifications are sent)');
    console.log('   3. Reply with exactly: /done');
    console.log('   4. Make sure it\'s lowercase and no extra spaces');

  } catch (error) {
    console.error('❌ Error checking orders:', error);
  }
}

/**
 * Check Telegram configuration
 */
function checkTelegramConfig() {
  console.log('🔧 Checking Telegram configuration...');
  console.log('');
  
  const config = {
    'Notification Bot Token': process.env.TELEGRAM_BOT_TOKEN ? '✅ Set' : '❌ Missing',
    'Notification Group ID': process.env.TELEGRAM_NOTIFICATION_GROUP_ID || '❌ Missing',
    'Notification Thread ID': process.env.TELEGRAM_NOTIFICATION_THREAD_ID || '❌ Missing',
    'Webhook Secret': process.env.TELEGRAM_WEBHOOK_SECRET ? '✅ Set' : '❌ Missing',
    'Authorized Users': process.env.TELEGRAM_AUTHORIZED_USERS || '❌ Not set (allows all users)'
  };

  Object.entries(config).forEach(([key, value]) => {
    console.log(`   ${key}: ${value}`);
  });
  
  console.log('');
  
  if (!process.env.TELEGRAM_AUTHORIZED_USERS) {
    console.log('💡 TELEGRAM_AUTHORIZED_USERS is not set, so ANY user can use /done command');
    console.log('   This is fine for testing, but consider setting it for production');
  }
}

/**
 * Check recent webhook activity
 */
async function checkRecentActivity() {
  console.log('📊 Recent order activity (last 24 hours):');
  
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { data: orders, error } = await supabase
      .from('orders')
      .select('order_number, telegram_status, telegram_workflow_state, created_at, arrival_confirmed_by')
      .gte('created_at', yesterday.toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Database error:', error);
      return;
    }

    if (!orders || orders.length === 0) {
      console.log('   No orders in the last 24 hours');
      return;
    }

    orders.forEach((order, index) => {
      const status = order.telegram_workflow_state === 'delivery_notified' ? '✅ Completed' : '⏳ Pending';
      const confirmedBy = order.arrival_confirmed_by || 'Not confirmed';
      console.log(`   ${index + 1}. ${order.order_number} - ${status} - ${confirmedBy}`);
    });

  } catch (error) {
    console.error('❌ Error checking recent activity:', error);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🤖 Telegram /done Command Debug Tool');
  console.log('='.repeat(50));
  console.log('');

  checkTelegramConfig();
  console.log('');
  
  await checkPendingOrders();
  console.log('');
  
  await checkRecentActivity();
  console.log('');
  
  console.log('🔧 Troubleshooting Tips:');
  console.log('');
  console.log('1. ✅ Make sure you\'re in the correct Telegram group');
  console.log(`   Group ID should be: ${process.env.TELEGRAM_NOTIFICATION_GROUP_ID}`);
  console.log('');
  console.log('2. ✅ Make sure you\'re replying in Thread ID 2');
  console.log('   Look for the thread where order notifications are sent');
  console.log('');
  console.log('3. ✅ Type exactly: /done');
  console.log('   - Must be lowercase');
  console.log('   - No extra spaces');
  console.log('   - No other text');
  console.log('');
  console.log('4. ✅ Make sure there\'s a pending order');
  console.log('   - Order must have telegram_status = "pending"');
  console.log('   - Order must have telegram_workflow_state = "notification_sent"');
  console.log('');
  console.log('5. ✅ Check server logs');
  console.log('   - Look for webhook messages in your development console');
  console.log('   - Should see "📱 Telegram webhook received"');
  console.log('');
  
  console.log('✅ Debug completed');
}

// Run the debug tool
main().catch(console.error);
