/**
 * Local Test for Telegram Stock Management Webhook
 * Simulates a real Telegram webhook call with ORDER CONFIRMATION message
 */

require('dotenv').config({ path: '.env.local' });

const BASE_URL = 'http://localhost:3000';

// Test message that should trigger stock updates
const TEST_ORDER_CONFIRMATION = {
  update_id: 123456789,
  message: {
    message_id: Math.floor(Date.now() / 1000), // Use timestamp to avoid duplicates
    from: {
      id: 123456789, // Replace with your actual Telegram user ID
      first_name: "Test User",
      username: "testuser"
    },
    chat: {
      id: parseInt(process.env.TELEGRAM_STOCK_GROUP_ID),
      type: "supergroup"
    },
    message_thread_id: parseInt(process.env.TELEGRAM_STOCK_THREAD_ID),
    text: `🎀✨ ORDER CONFIRMATION ✨🎀

Customer: John Doe
Date: ${new Date().toLocaleDateString()}
Phone: +855 12 345 678

Products:
1. [Chiikawa Limited] Liquid Muhi S2a 50ml, For Itchiness and Redness x 1 = 2500.00
2. [Limited Edition] Ma & Me Latte Skin Care Body Wash 490ml x 2 = 3000.00
3. [NEW] TSUBAKI Premium EX Repair Mask 180g x 1 = 1500.00

Subtotal: 7000.00
Shipping: 1.50
Total: 7001.50

Payment Method: ABA Bank Transfer
Status: Confirmed`,
    date: Math.floor(Date.now() / 1000)
  }
};

// Test message that should be ignored (contains #Order)
const TEST_ORDER_NOTIFICATION = {
  update_id: 123456790,
  message: {
    message_id: Math.floor(Date.now() / 1000) + 1, // Use timestamp to avoid duplicates
    from: {
      id: 123456789,
      first_name: "Test User",
      username: "testuser"
    },
    chat: {
      id: parseInt(process.env.TELEGRAM_STOCK_GROUP_ID),
      type: "supergroup"
    },
    message_thread_id: parseInt(process.env.TELEGRAM_STOCK_THREAD_ID),
    text: `🎀✨ ORDER CONFIRMATION ✨🎀

Order #FYP-20250730-1234567890-ABCDEF

Customer: Jane Doe
Products:
1. Test Product x 1 = 50.00`,
    date: Math.floor(Date.now() / 1000)
  }
};

async function testStockWebhook() {
  console.log('🧪 Testing Telegram Stock Management Webhook Locally\n');
  console.log('=' .repeat(60));

  // Test 1: Valid ORDER CONFIRMATION message
  console.log('\n✅ Test 1: Valid ORDER CONFIRMATION Message');
  console.log('Expected: Should process and update stock');
  
  try {
    const response = await fetch(`${BASE_URL}/api/telegram/stock-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': process.env.TELEGRAM_WEBHOOK_SECRET
      },
      body: JSON.stringify(TEST_ORDER_CONFIRMATION)
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Response received successfully');
      console.log('📊 Result:', JSON.stringify(data, null, 2));
      
      if (data.result) {
        console.log(`   - Products Updated: ${data.result.productsUpdated || 0}`);
        console.log(`   - Products Failed: ${data.result.productsFailed || 0}`);
        console.log(`   - Processing Time: ${data.result.processingTimeMs || 0}ms`);
      }
    } else {
      const error = await response.text();
      console.log(`❌ Request failed with status ${response.status}`);
      console.log(`   Error: ${error}`);
    }
  } catch (error) {
    console.log(`❌ Network error: ${error.message}`);
  }

  // Test 2: Invalid message (contains #Order)
  console.log('\n❌ Test 2: Invalid Message (Contains Order ID)');
  console.log('Expected: Should be ignored');
  
  try {
    const response = await fetch(`${BASE_URL}/api/telegram/stock-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': process.env.TELEGRAM_WEBHOOK_SECRET
      },
      body: JSON.stringify(TEST_ORDER_NOTIFICATION)
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Response received successfully');
      console.log('📊 Result:', JSON.stringify(data, null, 2));
      
      if (data.message && data.message.includes('ignored')) {
        console.log('✅ Message correctly ignored as expected');
      } else {
        console.log('⚠️ Message was processed (should have been ignored)');
      }
    } else {
      const error = await response.text();
      console.log(`❌ Request failed with status ${response.status}`);
      console.log(`   Error: ${error}`);
    }
  } catch (error) {
    console.log(`❌ Network error: ${error.message}`);
  }

  // Test 3: Security test (no signature)
  console.log('\n🔒 Test 3: Security Test (No Signature)');
  console.log('Expected: Should be rejected with 401');
  
  try {
    const response = await fetch(`${BASE_URL}/api/telegram/stock-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // No signature header
      },
      body: JSON.stringify(TEST_ORDER_CONFIRMATION)
    });

    if (response.status === 401) {
      console.log('✅ Security test passed - request rejected without signature');
    } else {
      console.log(`⚠️ Security test failed - expected 401, got ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Network error: ${error.message}`);
  }

  // Test 4: Wrong signature
  console.log('\n🔒 Test 4: Security Test (Wrong Signature)');
  console.log('Expected: Should be rejected with 401');
  
  try {
    const response = await fetch(`${BASE_URL}/api/telegram/stock-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': 'wrong-secret-token'
      },
      body: JSON.stringify(TEST_ORDER_CONFIRMATION)
    });

    if (response.status === 401) {
      console.log('✅ Security test passed - request rejected with wrong signature');
    } else {
      console.log(`⚠️ Security test failed - expected 401, got ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Network error: ${error.message}`);
  }

  console.log('\n' + '=' .repeat(60));
  console.log('🎉 Local webhook testing completed!');
  console.log('\n📋 Next Steps:');
  console.log('1. ✅ Local testing complete');
  console.log('2. 🌐 Set up ngrok for public webhook URL');
  console.log('3. 🔗 Configure Telegram bot webhook');
  console.log('4. 📱 Test with real Telegram messages');
}

// Configuration check
function checkConfiguration() {
  console.log('📋 Configuration Check:');
  console.log(`   Stock Bot Token: ${process.env.TELEGRAM_STOCK_BOT_TOKEN ? '✅ SET' : '❌ MISSING'}`);
  console.log(`   Stock Group ID: ${process.env.TELEGRAM_STOCK_GROUP_ID ? '✅ SET' : '❌ MISSING'}`);
  console.log(`   Stock Thread ID: ${process.env.TELEGRAM_STOCK_THREAD_ID ? '✅ SET' : '❌ MISSING'}`);
  console.log(`   Webhook Secret: ${process.env.TELEGRAM_WEBHOOK_SECRET ? '✅ SET' : '❌ MISSING'}`);
  console.log(`   Processing Enabled: ${process.env.TELEGRAM_STOCK_PROCESSING_ENABLED || 'true'}`);
  console.log(`   Auto Confirm: ${process.env.TELEGRAM_STOCK_AUTO_CONFIRM || 'true'}`);
  console.log('');
}

// Run the test
if (require.main === module) {
  checkConfiguration();
  testStockWebhook().catch(console.error);
}

module.exports = { testStockWebhook, TEST_ORDER_CONFIRMATION, TEST_ORDER_NOTIFICATION };
