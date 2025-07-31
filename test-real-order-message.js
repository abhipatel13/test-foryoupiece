/**
 * Test Real Order Confirmation Message
 * Tests the exact message format from the screenshot
 */

require('dotenv').config({ path: '.env.local' });

const BASE_URL = 'http://localhost:3000';

// Exact message from the screenshot
const realOrderMessage = {
  update_id: Date.now(),
  message: {
    message_id: Math.floor(Date.now() / 1000),
    from: {
      id: 123456789, // Test user ID that's authorized
      is_bot: false,
      first_name: "Test",
      username: "testuser"
    },
    chat: {
      id: parseInt(process.env.TELEGRAM_STOCK_GROUP_ID),
      type: "supergroup"
    },
    date: Math.floor(Date.now() / 1000),
    message_thread_id: parseInt(process.env.TELEGRAM_STOCK_THREAD_ID),
    text: `🎀✨ ORDER CONFIRMATION ✨🎀

👤 Customer Info
Name: Sok Vannary
Phone number: 0975353884
Address: mondulkiri

🛒 Items
Item name x Qty = Price
1. Tsubaki premium volume &repair set *1 =19$

💰 Pricing Summary
• Delivery Fee: $ 2
• Total amount: $ 21
• Deposit: $
• Amount Due: $ 21 ✅✅

📌 Important Notes
🚨 Final Sale : Orders are final and non-refundable. No cancellations, returns, or exchanges accepted.
🚚 Delivery : We will notify you once your items are ready for delivery.

🙏 Thank you for your purchase! 🤍`
  }
};

console.log('🔍 Testing Real Order Confirmation Message\n');

console.log('📋 Configuration Check:');
console.log(`- Group ID: ${process.env.TELEGRAM_STOCK_GROUP_ID}`);
console.log(`- Thread ID: ${process.env.TELEGRAM_STOCK_THREAD_ID}`);
console.log(`- Processing Enabled: ${process.env.TELEGRAM_STOCK_PROCESSING_ENABLED}`);
console.log(`- Authorized Users: ${process.env.TELEGRAM_STOCK_AUTHORIZED_USERS}`);
console.log('');

console.log('📝 Real Message Analysis:');
console.log('- Contains "ORDER CONFIRMATION":', realOrderMessage.message.text.toLowerCase().includes('order confirmation'));
console.log('- Contains "✅ PAID":', realOrderMessage.message.text.toLowerCase().includes('✅ paid'));
console.log('- Product line: "1. Tsubaki premium volume &repair set *1 =19$"');
console.log('');

// Test the patterns manually
const productLine = "1. Tsubaki premium volume &repair set *1 =19$";
const patterns = [
  /^(\d+)\.?\s+(.+?)\s*[x*×]\s*(\d+)\s*=\s*\$?([\d.,]+)[\$]?/i,
  /^(.+?)\s*[x*×]\s*(\d+)\s*=\s*\$?([\d.,]+)[\$]?/i,
  /^(\d+)\s+(.+?)\s*[x*×]\s*(\d+)\s*=\s*\$?([\d.,]+)[\$]?/i,
  /^(.+?)\s*\([x*×](\d+)\)\s*=\s*\$?([\d.,]+)[\$]?/i,
  /^(.+?)\s*[x*×]\s*(\d+)\s*=\s*\$?([\d.,]+)[\$]?/i
];

console.log('🧪 Pattern Testing:');
patterns.forEach((pattern, index) => {
  const match = pattern.test(productLine);
  console.log(`Pattern ${index + 1}: ${match ? '✅ MATCH' : '❌ NO MATCH'} - ${pattern}`);
  if (match) {
    const result = productLine.match(pattern);
    console.log(`  Captured groups:`, result.slice(1));
  }
});
console.log('');

async function testRealMessage() {
  console.log('📡 Testing Real Order Message with Webhook...\n');
  
  try {
    const response = await fetch(`${BASE_URL}/api/telegram/stock-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': process.env.TELEGRAM_STOCK_WEBHOOK_SECRET
      },
      body: JSON.stringify(realOrderMessage)
    });
    
    const data = await response.json();
    
    console.log('📊 Webhook Response:');
    console.log(`Status: ${response.status}`);
    console.log(`Success: ${data.result?.success}`);
    console.log(`Products Found: ${data.result?.productsFound || 0}`);
    console.log(`Products Updated: ${data.result?.productsUpdated || 0}`);
    console.log(`Products Failed: ${data.result?.productsFailed || 0}`);
    console.log(`Unmatched Products: ${data.result?.unmatchedProducts || 0}`);
    console.log(`Processing Time: ${data.result?.processingTimeMs || 0}ms`);
    
    if (data.result?.details) {
      console.log('\n📋 Detailed Results:');
      console.log(JSON.stringify(data.result.details, null, 2));
    }
    
    if (data.error) {
      console.log('\n❌ Error Details:');
      console.log(data.error);
    }
    
    return data.result?.success || false;
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    return false;
  }
}

// Run the test
testRealMessage().then(success => {
  console.log('\n' + '='.repeat(50));
  if (success) {
    console.log('🎉 Real order message test PASSED!');
  } else {
    console.log('⚠️  Real order message test FAILED - needs debugging');
  }
}).catch(console.error);
