/**
 * Debug Stock Message Validation
 * Tests each validation step to understand why messages are being rejected
 */

require('dotenv').config({ path: '.env.local' });

const BASE_URL = 'http://localhost:3000';

// Test message that should work
const testMessage = {
  update_id: 123456789,
  message: {
    message_id: 1001,
    from: {
      id: 123456789,
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
    text: `✅ PAID

Customer Information:
👤 Name: John Doe
📧 Email: john.doe@example.com
📱 Phone: +855123456789
🏦 ABA Bank Name: Test Bank

Shipping Address:
📍 123 Test Street, Phnom Penh, Cambodia

Order Summary:
💰 Subtotal: $25.00
🚚 Shipping: $1.50
🎯 Discount: -$2.50
⭐ Points Used: -$1.00 (100 points)
💳 Total: $23.00
💳 Payment Method: QR Code

Order Items:
1. Test Product A x 2 = $20.00
2. Test Product B x 1 = $5.00

Order #: ORD-20250131-001`
  }
};

console.log('🔍 Debugging Stock Message Validation\n');

console.log('📋 Configuration:');
console.log(`- Group ID: ${process.env.TELEGRAM_STOCK_GROUP_ID}`);
console.log(`- Thread ID: ${process.env.TELEGRAM_STOCK_THREAD_ID}`);
console.log(`- Processing Enabled: ${process.env.TELEGRAM_STOCK_PROCESSING_ENABLED}`);
console.log('');

console.log('📝 Test Message Details:');
console.log(`- Chat ID: ${testMessage.message.chat.id}`);
console.log(`- Thread ID: ${testMessage.message.message_thread_id}`);
console.log(`- Has Text: ${!!testMessage.message.text}`);
console.log(`- Contains "✅ PAID": ${testMessage.message.text.toLowerCase().includes('✅ paid')}`);
console.log(`- Contains "ORDER CONFIRMATION": ${testMessage.message.text.toLowerCase().includes('order confirmation')}`);
console.log('');

console.log('🔍 Message Text Preview:');
console.log(testMessage.message.text.substring(0, 200) + '...');
console.log('');

// Test validation step by step
async function debugValidation() {
  console.log('🧪 Testing Validation Steps...\n');
  
  // Step 1: Check if message has required fields
  console.log('Step 1: Basic Message Structure');
  console.log(`✓ Has message: ${!!testMessage.message}`);
  console.log(`✓ Has text: ${!!testMessage.message.text}`);
  console.log(`✓ Has chat: ${!!testMessage.message.chat}`);
  console.log(`✓ Has from: ${!!testMessage.message.from}`);
  console.log('');
  
  // Step 2: Check group and thread matching
  console.log('Step 2: Group and Thread Validation');
  const expectedGroupId = parseInt(process.env.TELEGRAM_STOCK_GROUP_ID || '0');
  const expectedThreadId = parseInt(process.env.TELEGRAM_STOCK_THREAD_ID || '0');
  const actualGroupId = testMessage.message.chat.id;
  const actualThreadId = testMessage.message.message_thread_id;
  
  console.log(`✓ Expected Group ID: ${expectedGroupId}`);
  console.log(`✓ Actual Group ID: ${actualGroupId}`);
  console.log(`✓ Group Match: ${actualGroupId === expectedGroupId}`);
  console.log(`✓ Expected Thread ID: ${expectedThreadId}`);
  console.log(`✓ Actual Thread ID: ${actualThreadId}`);
  console.log(`✓ Thread Match: ${actualThreadId === expectedThreadId}`);
  console.log('');
  
  // Step 3: Check text content validation
  console.log('Step 3: Text Content Validation');
  const text = testMessage.message.text.toLowerCase();
  const hasPaid = text.includes('✅ paid');
  const hasOrderConfirmation = text.includes('order confirmation');
  const hasOrderId = text.includes('#order');
  
  console.log(`✓ Contains "✅ paid": ${hasPaid}`);
  console.log(`✓ Contains "order confirmation": ${hasOrderConfirmation}`);
  console.log(`✓ Contains "#order": ${hasOrderId}`);
  console.log(`✓ Text validation passes: ${(hasPaid || hasOrderConfirmation) && !hasOrderId}`);
  console.log('');
  
  // Step 4: Check product patterns
  console.log('Step 4: Product Pattern Validation');
  const lines = testMessage.message.text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const productPatterns = [
    /^(\d+)\.?\s+(.+?)\s*[x*×]\s*(\d+)\s*=\s*([\d.,]+)[\$]?/i,
    /^(.+?)\s*[x*×]\s*(\d+)\s*=\s*([\d.,]+)[\$]?/i,
    /^(\d+)\s+(.+?)\s*[x*×]\s*(\d+)\s*=\s*([\d.,]+)[\$]?/i,
    /^(.+?)\s*\([x*×](\d+)\)\s*=\s*([\d.,]+)[\$]?/i,
    /^(.+?)\s*[x*×]\s*(\d+)\s*=\s*([\d.,]+)[\$]?/i
  ];
  
  let foundProducts = 0;
  for (const line of lines) {
    console.log(`Testing line: "${line}"`);
    for (let i = 0; i < productPatterns.length; i++) {
      const pattern = productPatterns[i];
      if (pattern.test(line)) {
        console.log(`✓ Found product pattern (Pattern ${i+1}): "${line}"`);
        foundProducts++;
        break;
      } else {
        console.log(`  Pattern ${i+1} no match: ${pattern}`);
      }
    }
    if (foundProducts === 0) {
      console.log(`  No patterns matched for: "${line}"`);
    }
  }
  
  console.log(`✓ Total product patterns found: ${foundProducts}`);
  console.log(`✓ Has product patterns: ${foundProducts > 0}`);
  console.log('');
  
  // Step 5: Test actual webhook call
  console.log('Step 5: Webhook Call Test');
  try {
    const response = await fetch(`${BASE_URL}/api/telegram/stock-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': process.env.TELEGRAM_STOCK_WEBHOOK_SECRET
      },
      body: JSON.stringify(testMessage)
    });
    
    const data = await response.json();
    console.log(`✓ Response Status: ${response.status}`);
    console.log(`✓ Response Data:`, JSON.stringify(data, null, 2));
  } catch (error) {
    console.log(`❌ Webhook Error: ${error.message}`);
  }
}

debugValidation().catch(console.error);
