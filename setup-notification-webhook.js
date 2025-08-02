#!/usr/bin/env node

/**
 * Setup Telegram Webhook for Notification Bot
 * This script configures the webhook for the notification bot to handle both callback queries and text messages
 */

require('dotenv').config({ path: '.env.local' });

const NOTIFICATION_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!NOTIFICATION_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found in environment variables');
  process.exit(1);
}

if (!WEBHOOK_SECRET) {
  console.error('❌ TELEGRAM_WEBHOOK_SECRET not found in environment variables');
  process.exit(1);
}

/**
 * Set webhook for notification bot
 */
async function setupNotificationWebhook() {
  console.log('📡 Setting up notification bot webhook...');
  
  // For production, use the actual domain. For development, you'll need ngrok or similar
  const webhookUrl = process.env.NEXT_PUBLIC_WEBHOOK_URL || 'https://foryoupiece.com/api/webhook/telegram';
  
  console.log(`🎯 Target URL: ${webhookUrl}`);
  console.log(`🔐 Secret Token: ${WEBHOOK_SECRET ? 'SET' : 'NOT SET'}`);
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${NOTIFICATION_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: WEBHOOK_SECRET,
        allowed_updates: ['message', 'edited_message', 'callback_query'], // Support both text messages and button clicks
        drop_pending_updates: true // Clear any pending updates
      })
    });
    
    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ Notification bot webhook set successfully');
      console.log(`   URL: ${webhookUrl}`);
      console.log(`   Allowed updates: message, edited_message, callback_query`);
      return true;
    } else {
      console.error('❌ Failed to set notification bot webhook:', data.description);
      return false;
    }
  } catch (error) {
    console.error('❌ Error setting notification bot webhook:', error.message);
    return false;
  }
}

/**
 * Get current webhook info
 */
async function getWebhookInfo() {
  console.log('📋 Getting current webhook info...');
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${NOTIFICATION_BOT_TOKEN}/getWebhookInfo`);
    const data = await response.json();
    
    if (data.ok) {
      console.log('📋 Current webhook info:');
      console.log(`   URL: ${data.result.url || 'Not set'}`);
      console.log(`   Has custom certificate: ${data.result.has_custom_certificate}`);
      console.log(`   Pending update count: ${data.result.pending_update_count}`);
      console.log(`   Last error date: ${data.result.last_error_date || 'None'}`);
      console.log(`   Last error message: ${data.result.last_error_message || 'None'}`);
      console.log(`   Max connections: ${data.result.max_connections || 'Default'}`);
      console.log(`   Allowed updates: ${data.result.allowed_updates?.join(', ') || 'All'}`);
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
 * Delete webhook (useful for testing)
 */
async function deleteWebhook() {
  console.log('🗑️ Deleting webhook...');
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${NOTIFICATION_BOT_TOKEN}/deleteWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        drop_pending_updates: true
      })
    });
    
    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ Webhook deleted successfully');
      return true;
    } else {
      console.error('❌ Failed to delete webhook:', data.description);
      return false;
    }
  } catch (error) {
    console.error('❌ Error deleting webhook:', error.message);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'setup';
  
  console.log('🤖 Telegram Notification Bot Webhook Manager');
  console.log('='.repeat(50));
  
  switch (command) {
    case 'setup':
      await setupNotificationWebhook();
      break;
    case 'info':
      await getWebhookInfo();
      break;
    case 'delete':
      await deleteWebhook();
      break;
    default:
      console.log('Usage: node setup-notification-webhook.js [setup|info|delete]');
      console.log('  setup  - Set up the webhook (default)');
      console.log('  info   - Get current webhook information');
      console.log('  delete - Delete the current webhook');
  }
}

// Run the script
main().catch(console.error);
