/**
 * Process Pending ORDER CONFIRMATION Messages
 * Manually processes the ORDER CONFIRMATION messages we found in polling
 */

require('dotenv').config({ path: '.env.local' });

const STOCK_BOT_TOKEN = process.env.TELEGRAM_STOCK_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.TELEGRAM_STOCK_WEBHOOK_SECRET;
const BASE_URL = 'http://localhost:3000';

console.log('📦 Processing Pending ORDER CONFIRMATION Messages\n');

/**
 * Get and process pending ORDER CONFIRMATION messages
 */
async function processPendingOrders() {
  console.log('📥 Fetching pending messages...');
  
  try {
    // Get all pending updates
    const response = await fetch(`https://api.telegram.org/bot${STOCK_BOT_TOKEN}/getUpdates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        limit: 100,
        timeout: 1
      })
    });
    
    const data = await response.json();
    
    if (!data.ok) {
      console.error('❌ Failed to get updates:', data.description);
      return;
    }
    
    console.log(`📋 Found ${data.result.length} total updates`);
    
    // Filter for ORDER CONFIRMATION messages in the correct group/thread
    const orderConfirmations = data.result.filter(update => {
      const message = update.message;
      if (!message) return false;
      
      const isCorrectGroup = message.chat.id.toString() === process.env.TELEGRAM_STOCK_GROUP_ID;
      const isCorrectThread = message.message_thread_id?.toString() === process.env.TELEGRAM_STOCK_THREAD_ID;
      const isOrderConfirmation = message.text?.toLowerCase().includes('order confirmation');
      
      console.log(`   Update ${update.update_id}: Group=${isCorrectGroup}, Thread=${isCorrectThread}, OrderConf=${isOrderConfirmation}`);
      
      return isCorrectGroup && isCorrectThread && isOrderConfirmation;
    });
    
    console.log(`\n🎯 Found ${orderConfirmations.length} ORDER CONFIRMATION messages to process`);
    
    if (orderConfirmations.length === 0) {
      console.log('📭 No ORDER CONFIRMATION messages found to process');
      return;
    }
    
    // Process each ORDER CONFIRMATION message
    let successCount = 0;
    let failureCount = 0;
    
    for (const [index, update] of orderConfirmations.entries()) {
      const message = update.message;
      console.log(`\n📦 Processing ORDER CONFIRMATION ${index + 1}/${orderConfirmations.length}`);
      console.log(`   From: ${message.from?.first_name || 'Unknown'}`);
      console.log(`   Date: ${new Date(message.date * 1000).toLocaleString()}`);
      console.log(`   Update ID: ${update.update_id}`);
      
      // Show first few lines of the message
      const messageLines = message.text.split('\n');
      console.log(`   Content: ${messageLines[0]}...`);
      
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
          
          if (result.result?.details) {
            console.log(`      Products found: ${result.result.productsFound || 0}`);
            console.log(`      Products failed: ${result.result.productsFailed || 0}`);
            console.log(`      Processing time: ${result.result.processingTimeMs || 0}ms`);
          }
          
          successCount++;
        } else {
          const errorText = await response.text();
          console.log(`   ❌ FAILED: ${response.status} - ${errorText}`);
          failureCount++;
        }
      } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
        failureCount++;
      }
      
      // Small delay between requests
      if (index < orderConfirmations.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Processing Results:');
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failureCount}`);
    console.log(`📈 Success Rate: ${Math.round((successCount / (successCount + failureCount)) * 100)}%`);
    
    // Clear the processed updates
    if (orderConfirmations.length > 0) {
      const lastUpdateId = Math.max(...data.result.map(u => u.update_id));
      console.log(`\n🧹 Clearing processed updates (up to ${lastUpdateId})...`);
      
      await fetch(`https://api.telegram.org/bot${STOCK_BOT_TOKEN}/getUpdates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offset: lastUpdateId + 1,
          limit: 1
        })
      });
      
      console.log('✅ Updates cleared');
    }
    
  } catch (error) {
    console.error('❌ Error processing pending orders:', error.message);
  }
}

/**
 * Check server logs
 */
async function checkServerLogs() {
  console.log('\n📋 Recent server activity:');
  console.log('   Check the Next.js server terminal for processing logs');
  console.log('   Look for messages like:');
  console.log('   - "📦 Telegram stock webhook received"');
  console.log('   - "✅ Stock update completed"');
  console.log('   - "✅ Stock response sent successfully"');
}

/**
 * Main function
 */
async function main() {
  console.log('🤖 Stock Bot Token:', STOCK_BOT_TOKEN ? `${STOCK_BOT_TOKEN.substring(0, 10)}...` : 'NOT SET');
  console.log('📍 Target Group:', process.env.TELEGRAM_STOCK_GROUP_ID);
  console.log('🧵 Target Thread:', process.env.TELEGRAM_STOCK_THREAD_ID);
  console.log('🔐 Webhook Secret:', WEBHOOK_SECRET ? 'SET' : 'NOT SET');
  console.log('🌐 Local Server:', BASE_URL);
  console.log('');
  
  await processPendingOrders();
  await checkServerLogs();
  
  console.log('\n🔧 Next Steps:');
  console.log('1. Check the Next.js server terminal for processing logs');
  console.log('2. Check the Telegram group for response messages');
  console.log('3. Verify stock quantities were updated in the database');
  console.log('4. Set up proper webhook for future automatic processing');
}

// Run the processing
main().catch(console.error);
