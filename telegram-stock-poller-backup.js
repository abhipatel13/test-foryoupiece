/**
 * Telegram Stock Message Poller
 * Continuously polls for new ORDER CONFIRMATION messages and processes them
 * This is a workaround for webhook issues - run this alongside your server
 */

require('dotenv').config({ path: '.env.local' });

const STOCK_BOT_TOKEN = process.env.TELEGRAM_STOCK_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.TELEGRAM_STOCK_WEBHOOK_SECRET;
const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
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
async function pollMessages() {
  if (isProcessing) {
    return; // Skip if already processing
  }

  try {
    isProcessing = true;
    
    // Get updates from Telegram
    const telegramApiUrl = `https://api.telegram.org/bot${STOCK_BOT_TOKEN}/getUpdates`;
    const params = new URLSearchParams({
      offset: lastUpdateId + 1,
      limit: 10,
      timeout: 0
    });

    const response = await fetch(`${telegramApiUrl}?${params}`);
    
    if (!response.ok) {
      console.error('❌ Failed to fetch updates:', response.status, response.statusText);
      return;
    }

    const data = await response.json();
    
    if (!data.ok || !data.result || data.result.length === 0) {
      return; // No new messages
    }

    console.log(`📥 Received ${data.result.length} new updates`);

    // Update the last update ID
    lastUpdateId = Math.max(...data.result.map(update => update.update_id));

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
    console.error('❌ Error polling messages:', error.message);
  } finally {
    isProcessing = false;
  }
}

/**
 * Process a single ORDER CONFIRMATION message
 */
async function processOrderConfirmation(update) {
  const message = update.message;
  const customerName = extractCustomerName(message.text);
  
  console.log(`\n📦 [${new Date().toLocaleString()}] Processing ORDER CONFIRMATION`);
  console.log(`   From: ${message.from?.first_name || 'Unknown'}`);
  console.log(`   Update ID: ${update.update_id}`);
  console.log(`   Customer: ${customerName}`);
  
  const startTime = Date.now();
  
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
 * Extract customer name from ORDER CONFIRMATION message
 */
function extractCustomerName(messageText) {
  if (!messageText) return 'Unknown';
  
  // Look for "Name: [customer name]" pattern
  const nameMatch = messageText.match(/Name:\s*([^\n\r]+)/i);
  if (nameMatch && nameMatch[1].trim()) {
    return nameMatch[1].trim();
  }
  
  return 'Unknown';
}

/**
 * Start the continuous polling
 */
function startPolling() {
  console.log('🚀 Starting continuous polling...');
  
  // Initial poll
  pollMessages();
  
  // Set up interval polling
  setInterval(pollMessages, POLL_INTERVAL);
}

// Validate required environment variables
if (!STOCK_BOT_TOKEN) {
  console.error('❌ TELEGRAM_STOCK_BOT_TOKEN is required');
  process.exit(1);
}

if (!WEBHOOK_SECRET) {
  console.error('❌ TELEGRAM_STOCK_WEBHOOK_SECRET is required');
  process.exit(1);
}

if (!process.env.TELEGRAM_STOCK_GROUP_ID) {
  console.error('❌ TELEGRAM_STOCK_GROUP_ID is required');
  process.exit(1);
}

if (!process.env.TELEGRAM_STOCK_THREAD_ID) {
  console.error('❌ TELEGRAM_STOCK_THREAD_ID is required');
  process.exit(1);
}

// Start polling
startPolling();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Telegram Stock Message Poller...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down Telegram Stock Message Poller...');
  process.exit(0);
});
