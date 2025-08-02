require('dotenv').config({ path: '.env.local' });

const NOTIFICATION_BOT_TOKEN = process.env.TELEGRAM_NOTIFICATION_BOT_TOKEN;
const WEBHOOK_URL = process.env.NEXT_PUBLIC_WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

async function setupWebhook() {
  console.log('🔧 Setting up Telegram webhook...');
  console.log(`🤖 Bot Token: ${NOTIFICATION_BOT_TOKEN ? 'SET' : 'NOT SET'}`);
  console.log(`🔗 Webhook URL: ${WEBHOOK_URL || 'NOT SET'}`);
  console.log(`🔐 Webhook Secret: ${WEBHOOK_SECRET ? 'SET' : 'NOT SET'}`);
  
  if (!NOTIFICATION_BOT_TOKEN) {
    console.error('❌ TELEGRAM_NOTIFICATION_BOT_TOKEN not set in .env.local');
    return;
  }
  
  if (!WEBHOOK_URL) {
    console.error('❌ NEXT_PUBLIC_WEBHOOK_URL not set in .env.local');
    console.log('💡 For local testing, you can use ngrok or similar service');
    console.log('💡 For production, use your domain: https://yourdomain.com/api/webhook/telegram');
    return;
  }
  
  try {
    // Use node-fetch or built-in fetch
    let fetch;
    try {
      fetch = (await import('node-fetch')).default;
    } catch {
      fetch = globalThis.fetch;
    }
    
    // Set webhook
    const webhookData = {
      url: WEBHOOK_URL,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: true
    };
    
    if (WEBHOOK_SECRET) {
      webhookData.secret_token = WEBHOOK_SECRET;
    }
    
    console.log('📤 Setting webhook...');
    const response = await fetch(`https://api.telegram.org/bot${NOTIFICATION_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookData)
    });
    
    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ Webhook set successfully!');
      console.log(`🔗 URL: ${WEBHOOK_URL}`);
      console.log(`🔐 Secret: ${WEBHOOK_SECRET ? 'SET' : 'NOT SET'}`);
      console.log('📋 Allowed Updates: message, callback_query');
      
      // Verify webhook
      console.log('\n🔍 Verifying webhook...');
      const verifyResponse = await fetch(`https://api.telegram.org/bot${NOTIFICATION_BOT_TOKEN}/getWebhookInfo`);
      const verifyData = await verifyResponse.json();
      
      if (verifyData.ok) {
        const webhook = verifyData.result;
        console.log('✅ Webhook verification successful!');
        console.log(`📊 Pending Updates: ${webhook.pending_update_count}`);
        console.log(`🕐 Last Error: ${webhook.last_error_message || 'None'}`);
      }
      
    } else {
      console.error('❌ Failed to set webhook:', data);
    }
    
  } catch (error) {
    console.error('❌ Error setting webhook:', error.message);
  }
}

async function deleteWebhook() {
  console.log('🗑️ Deleting webhook...');
  
  try {
    let fetch;
    try {
      fetch = (await import('node-fetch')).default;
    } catch {
      fetch = globalThis.fetch;
    }
    
    const response = await fetch(`https://api.telegram.org/bot${NOTIFICATION_BOT_TOKEN}/deleteWebhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ drop_pending_updates: true })
    });
    
    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ Webhook deleted successfully!');
    } else {
      console.error('❌ Failed to delete webhook:', data);
    }
    
  } catch (error) {
    console.error('❌ Error deleting webhook:', error.message);
  }
}

// Check command line arguments
const command = process.argv[2];

if (command === 'delete') {
  deleteWebhook();
} else {
  setupWebhook();
}
