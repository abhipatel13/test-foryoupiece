/**
 * Check Telegram Webhook Configuration
 * Verifies if the stock bot webhook is properly configured
 */

require('dotenv').config({ path: '.env.local' });

const STOCK_BOT_TOKEN = process.env.TELEGRAM_STOCK_BOT_TOKEN;

console.log('🔍 Checking Telegram Webhook Configuration\n');

/**
 * Check current webhook info
 */
async function checkWebhookInfo() {
  console.log('📡 Checking current webhook configuration...');
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${STOCK_BOT_TOKEN}/getWebhookInfo`);
    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ Webhook Info Retrieved:');
      console.log(`   URL: ${data.result.url || 'NOT SET'}`);
      console.log(`   Has Custom Certificate: ${data.result.has_custom_certificate}`);
      console.log(`   Pending Update Count: ${data.result.pending_update_count}`);
      console.log(`   Last Error Date: ${data.result.last_error_date || 'None'}`);
      console.log(`   Last Error Message: ${data.result.last_error_message || 'None'}`);
      console.log(`   Max Connections: ${data.result.max_connections || 'Default'}`);
      console.log(`   Allowed Updates: ${JSON.stringify(data.result.allowed_updates) || 'All'}`);
      
      return data.result;
    } else {
      console.error('❌ Failed to get webhook info:', data.description);
      return null;
    }
  } catch (error) {
    console.error('❌ Error checking webhook info:', error.message);
    return null;
  }
}

/**
 * Set webhook to local development server
 */
async function setLocalWebhook() {
  console.log('\n🔧 Setting webhook to local development server...');
  
  // For local testing, we need to use a service like ngrok or expose the local server
  // For now, let's try to set it to localhost (this won't work for real Telegram webhooks)
  const webhookUrl = 'http://localhost:3000/api/telegram/stock-webhook';
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${STOCK_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: process.env.TELEGRAM_STOCK_WEBHOOK_SECRET,
        allowed_updates: ['message', 'edited_message']
      })
    });
    
    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ Webhook set successfully');
      console.log(`   URL: ${webhookUrl}`);
      return true;
    } else {
      console.error('❌ Failed to set webhook:', data.description);
      return false;
    }
  } catch (error) {
    console.error('❌ Error setting webhook:', error.message);
    return false;
  }
}

/**
 * Delete webhook (use polling instead)
 */
async function deleteWebhook() {
  console.log('\n🗑️ Deleting webhook (switching to polling mode)...');
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${STOCK_BOT_TOKEN}/deleteWebhook`, {
      method: 'POST'
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
 * Get recent updates using polling
 */
async function getUpdates() {
  console.log('\n📥 Getting recent updates (polling mode)...');
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${STOCK_BOT_TOKEN}/getUpdates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        limit: 10,
        timeout: 5
      })
    });
    
    const data = await response.json();
    
    if (data.ok) {
      console.log(`✅ Retrieved ${data.result.length} recent updates`);
      
      if (data.result.length > 0) {
        console.log('\n📋 Recent Messages:');
        data.result.forEach((update, index) => {
          if (update.message) {
            const msg = update.message;
            console.log(`   ${index + 1}. From: ${msg.from?.first_name || 'Unknown'}`);
            console.log(`      Chat: ${msg.chat.id} (Thread: ${msg.message_thread_id || 'None'})`);
            console.log(`      Text: ${msg.text?.substring(0, 100) || 'No text'}...`);
            console.log(`      Contains "ORDER CONFIRMATION": ${msg.text?.toLowerCase().includes('order confirmation') || false}`);
            console.log('');
          }
        });
      } else {
        console.log('   No recent messages found');
      }
      
      return data.result;
    } else {
      console.error('❌ Failed to get updates:', data.description);
      return [];
    }
  } catch (error) {
    console.error('❌ Error getting updates:', error.message);
    return [];
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🤖 Stock Bot Token:', STOCK_BOT_TOKEN ? `${STOCK_BOT_TOKEN.substring(0, 10)}...` : 'NOT SET');
  console.log('📍 Target Group:', process.env.TELEGRAM_STOCK_GROUP_ID);
  console.log('🧵 Target Thread:', process.env.TELEGRAM_STOCK_THREAD_ID);
  console.log('🔐 Webhook Secret:', process.env.TELEGRAM_STOCK_WEBHOOK_SECRET ? 'SET' : 'NOT SET');
  console.log('');
  
  // Step 1: Check current webhook configuration
  const webhookInfo = await checkWebhookInfo();
  
  // Step 2: If no webhook is set, try polling mode
  if (!webhookInfo || !webhookInfo.url) {
    console.log('\n💡 No webhook configured. Trying polling mode...');
    await deleteWebhook(); // Ensure we're in polling mode
    await getUpdates();
  } else {
    console.log('\n⚠️ Webhook is configured but may not be pointing to local server');
    console.log('   Real ORDER CONFIRMATION messages won\'t reach localhost');
    console.log('   Consider using ngrok or similar tool for local testing');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🔍 Diagnosis:');
  
  if (webhookInfo && webhookInfo.url) {
    if (webhookInfo.url.includes('localhost')) {
      console.log('✅ Webhook points to localhost - should work for local testing');
    } else {
      console.log('⚠️ Webhook points to external URL - real messages won\'t reach localhost');
      console.log('   Real ORDER CONFIRMATION messages are being sent to:', webhookInfo.url);
      console.log('   But we\'re testing on localhost:3000');
    }
  } else {
    console.log('⚠️ No webhook configured - Telegram is not sending messages to any endpoint');
    console.log('   This explains why real ORDER CONFIRMATION messages aren\'t being processed');
  }
  
  console.log('\n🔧 Solutions:');
  console.log('1. Use ngrok to expose localhost:3000 and set webhook to ngrok URL');
  console.log('2. Deploy to production and set webhook to production URL');
  console.log('3. Use polling mode for local testing (but won\'t catch real messages)');
}

// Run the check
main().catch(console.error);
