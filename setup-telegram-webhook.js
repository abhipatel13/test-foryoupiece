/**
 * Setup Telegram Webhook for Stock Bot
 * Configures the webhook to point to our local development server
 */

require('dotenv').config({ path: '.env.local' });

const STOCK_BOT_TOKEN = process.env.TELEGRAM_STOCK_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.TELEGRAM_STOCK_WEBHOOK_SECRET;

console.log('🔧 Setting up Telegram Webhook for Stock Bot\n');

/**
 * Set webhook to local development server using ngrok
 */
async function setupWebhook() {
  console.log('📡 Setting up webhook...');
  
  // For local development, we need to use ngrok or similar
  // But first, let's try with a public URL if available
  const webhookUrl = process.env.WEBHOOK_URL || 'http://localhost:3000/api/telegram/stock-webhook';
  
  console.log(`🎯 Target URL: ${webhookUrl}`);
  console.log(`🔐 Secret Token: ${WEBHOOK_SECRET ? 'SET' : 'NOT SET'}`);
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${STOCK_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: WEBHOOK_SECRET,
        allowed_updates: ['message', 'edited_message'],
        drop_pending_updates: true // Clear any pending updates
      })
    });
    
    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ Webhook set successfully!');
      return true;
    } else {
      console.error('❌ Failed to set webhook:', data.description);
      
      // If localhost fails, provide guidance
      if (data.description && data.description.includes('localhost')) {
        console.log('\n💡 Localhost webhooks don\'t work with Telegram.');
        console.log('   You need to use a public URL. Options:');
        console.log('   1. Use ngrok: npx ngrok http 3000');
        console.log('   2. Deploy to production');
        console.log('   3. Use a service like localtunnel');
      }
      
      return false;
    }
  } catch (error) {
    console.error('❌ Error setting webhook:', error.message);
    return false;
  }
}

/**
 * Process pending updates manually
 */
async function processPendingUpdates() {
  console.log('\n📥 Processing pending ORDER CONFIRMATION messages...');
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${STOCK_BOT_TOKEN}/getUpdates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        limit: 100,
        timeout: 1
      })
    });
    
    const data = await response.json();
    
    if (data.ok && data.result.length > 0) {
      console.log(`📋 Found ${data.result.length} pending updates`);
      
      // Filter for ORDER CONFIRMATION messages in the correct group/thread
      const orderConfirmations = data.result.filter(update => {
        const message = update.message;
        return message && 
               message.chat.id.toString() === process.env.TELEGRAM_STOCK_GROUP_ID &&
               message.message_thread_id?.toString() === process.env.TELEGRAM_STOCK_THREAD_ID &&
               message.text?.toLowerCase().includes('order confirmation');
      });
      
      console.log(`🎯 Found ${orderConfirmations.length} ORDER CONFIRMATION messages to process`);
      
      // Process each ORDER CONFIRMATION message
      for (const update of orderConfirmations) {
        console.log(`\n📦 Processing ORDER CONFIRMATION from ${update.message.from?.first_name}...`);
        
        try {
          const response = await fetch('http://localhost:3000/api/telegram/stock-webhook', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Telegram-Bot-Api-Secret-Token': WEBHOOK_SECRET
            },
            body: JSON.stringify(update)
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log(`   ✅ Processed successfully: ${result.result?.productsUpdated || 0} products updated`);
          } else {
            console.log(`   ❌ Processing failed: ${response.status}`);
          }
        } catch (error) {
          console.log(`   ❌ Error processing: ${error.message}`);
        }
      }
      
      // Clear the processed updates
      if (orderConfirmations.length > 0) {
        const lastUpdateId = Math.max(...data.result.map(u => u.update_id));
        await fetch(`https://api.telegram.org/bot${STOCK_BOT_TOKEN}/getUpdates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            offset: lastUpdateId + 1,
            limit: 1
          })
        });
        console.log(`\n🧹 Cleared processed updates (up to ${lastUpdateId})`);
      }
      
    } else {
      console.log('📭 No pending updates found');
    }
  } catch (error) {
    console.error('❌ Error processing pending updates:', error.message);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🤖 Stock Bot Token:', STOCK_BOT_TOKEN ? `${STOCK_BOT_TOKEN.substring(0, 10)}...` : 'NOT SET');
  console.log('📍 Target Group:', process.env.TELEGRAM_STOCK_GROUP_ID);
  console.log('🧵 Target Thread:', process.env.TELEGRAM_STOCK_THREAD_ID);
  console.log('');
  
  // Step 1: Try to set up webhook
  const webhookSet = await setupWebhook();
  
  // Step 2: Process any pending ORDER CONFIRMATION messages
  await processPendingUpdates();
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 Summary:');
  
  if (webhookSet) {
    console.log('✅ Webhook configured successfully');
    console.log('   Future ORDER CONFIRMATION messages will be processed automatically');
  } else {
    console.log('⚠️ Webhook setup failed');
    console.log('   You need to use a public URL for webhooks to work');
    console.log('   Consider using ngrok: npx ngrok http 3000');
  }
  
  console.log('\n🔧 Next Steps:');
  console.log('1. If webhook failed, use ngrok to expose localhost:3000');
  console.log('2. Run this script again with WEBHOOK_URL=https://your-ngrok-url.ngrok.io/api/telegram/stock-webhook');
  console.log('3. Test by posting a new ORDER CONFIRMATION message');
}

// Run the setup
main().catch(console.error);
