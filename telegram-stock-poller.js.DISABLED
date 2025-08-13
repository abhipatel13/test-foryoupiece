/**
 * Telegram Stock Message Poller
 * Continuously polls for new ORDER CONFIRMATION messages and processes them
 * This is a workaround for webhook issues - run this alongside your server
 */

require('dotenv').config({ path: '.env.local' });

const STOCK_BOT_TOKEN = process.env.TELEGRAM_STOCK_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.TELEGRAM_STOCK_WEBHOOK_SECRET;
const BASE_URL = 'http://localhost:3000';
const POLL_INTERVAL = 5000; // 5 seconds

let lastUpdateId = 0;
let isProcessing = false;

console.log('🤖 Telegram Stock Message Poller Started');
console.log('📍 Monitoring Group:', process.env.TELEGRAM_STOCK_GROUP_ID);
console.log('🧵 Monitoring Thread:', process.env.TELEGRAM_STOCK_THREAD_ID);
console.log('⏱️ Poll Interval:', POLL_INTERVAL / 1000, 'seconds');
console.log('🔄 Polling for ORDER CONFIRMATION messages...\n');

/**
 * Poll for new messages and process ORDER CONFIRMATION messages
 */
async function pollAndProcess() {
  if (isProcessing) {
    return; // Skip if already processing
  }
  
  isProcessing = true;
  
  try {
    // Get new updates since last poll
    const response = await fetch(`https://api.telegram.org/bot${STOCK_BOT_TOKEN}/getUpdates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offset: lastUpdateId + 1,
        limit: 10,
        timeout: 2
      })
    });
    
    const data = await response.json();
    
    if (!data.ok) {
      console.error('❌ Failed to get updates:', data.description);
      return;
    }
    
    if (data.result.length === 0) {
      // No new messages - this is normal
      return;
    }
    
    console.log(`📥 Received ${data.result.length} new updates`);
    
    // Update last update ID
    lastUpdateId = Math.max(...data.result.map(u => u.update_id));
    
    // Filter for ORDER CONFIRMATION messages in the correct group/thread
    const orderConfirmations = data.result.filter(update => {
      const message = update.message;
      if (!message) return false;
      
      const isCorrectGroup = message.chat.id.toString() === process.env.TELEGRAM_STOCK_GROUP_ID;
      const isCorrectThread = message.message_thread_id?.toString() === process.env.TELEGRAM_STOCK_THREAD_ID;
      const isOrderConfirmation = message.text?.toLowerCase().includes('order confirmation');
      
      return isCorrectGroup && isCorrectThread && isOrderConfirmation;
    });
    
    if (orderConfirmations.length > 0) {
      console.log(`🎯 Found ${orderConfirmations.length} new ORDER CONFIRMATION messages!`);
      
      // Process each ORDER CONFIRMATION message
      for (const update of orderConfirmations) {
        await processOrderConfirmation(update);
      }
    }
    
  } catch (error) {
    console.error('❌ Polling error:', error.message);
  } finally {
    isProcessing = false;
  }
}

/**
 * Process a single ORDER CONFIRMATION message
 */
async function processOrderConfirmation(update) {
  const message = update.message;
  const timestamp = new Date().toLocaleString();
  
  console.log(`\n📦 [${timestamp}] Processing ORDER CONFIRMATION`);
  console.log(`   From: ${message.from?.first_name || 'Unknown'}`);
  console.log(`   Update ID: ${update.update_id}`);
  
  // Extract customer name from message for logging
  const customerMatch = message.text.match(/Name:\s*([^\n]+)/);
  const customerName = customerMatch ? customerMatch[1].trim() : 'Unknown';
  console.log(`   Customer: ${customerName}`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/telegram/stock-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': WEBHOOK_SECRET
      },
      body: JSON.stringify(update)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`   ✅ SUCCESS: ${result.result?.productsUpdated || 0} products updated`);
      console.log(`   📊 Processing time: ${result.result?.processingTimeMs || 0}ms`);
      
      if (result.result?.productsUpdated > 0) {
        console.log(`   🎉 Stock quantities updated and response sent to Telegram!`);
      }
    } else {
      const errorText = await response.text();
      console.log(`   ❌ FAILED: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
  }
}

/**
 * Start polling
 */
function startPolling() {
  console.log('🚀 Starting continuous polling...\n');
  
  // Initial poll
  pollAndProcess();
  
  // Set up interval polling
  const intervalId = setInterval(pollAndProcess, POLL_INTERVAL);
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down poller...');
    clearInterval(intervalId);
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down poller...');
    clearInterval(intervalId);
    process.exit(0);
  });
}

// Start the poller
startPolling();
