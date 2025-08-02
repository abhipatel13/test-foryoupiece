require('dotenv').config({ path: '.env.local' });

const NOTIFICATION_BOT_TOKEN = process.env.TELEGRAM_NOTIFICATION_BOT_TOKEN;

async function checkWebhookStatus() {
  console.log('🔍 Checking Telegram webhook status...');
  
  try {
    // Use node-fetch or built-in fetch
    let fetch;
    try {
      fetch = (await import('node-fetch')).default;
    } catch {
      fetch = globalThis.fetch;
    }
    
    const response = await fetch(`https://api.telegram.org/bot${NOTIFICATION_BOT_TOKEN}/getWebhookInfo`);
    const data = await response.json();
    
    console.log('📋 Webhook Info:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.ok) {
      const webhook = data.result;
      console.log('\n📊 Webhook Status Summary:');
      console.log(`🔗 URL: ${webhook.url || 'NOT SET'}`);
      console.log(`✅ Has Custom Certificate: ${webhook.has_custom_certificate}`);
      console.log(`📊 Pending Updates: ${webhook.pending_update_count}`);
      console.log(`🕐 Last Error Date: ${webhook.last_error_date ? new Date(webhook.last_error_date * 1000).toISOString() : 'None'}`);
      console.log(`❌ Last Error Message: ${webhook.last_error_message || 'None'}`);
      console.log(`🔄 Max Connections: ${webhook.max_connections}`);
      console.log(`🏷️ Allowed Updates: ${webhook.allowed_updates?.join(', ') || 'All'}`);
      
      if (webhook.pending_update_count > 0) {
        console.log('\n⚠️ There are pending updates that might indicate webhook issues!');
      }
      
      if (webhook.last_error_message) {
        console.log('\n❌ Recent webhook errors detected!');
        console.log(`Error: ${webhook.last_error_message}`);
      }
      
      if (!webhook.url) {
        console.log('\n❌ No webhook URL is set! This explains why commands don\'t work.');
        console.log('💡 You need to set the webhook URL for the bot to receive messages.');
      }
    } else {
      console.error('❌ Failed to get webhook info:', data);
    }
    
  } catch (error) {
    console.error('❌ Error checking webhook status:', error.message);
  }
}

checkWebhookStatus();
