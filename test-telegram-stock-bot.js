/**
 * Comprehensive Telegram Stock Management Bot Test Suite
 * Tests the complete workflow from bot authentication to stock updates
 */

require('dotenv').config({ path: '.env.local' });
// Using built-in fetch (Node.js 18+)

const BASE_URL = 'http://localhost:3000';

// Test Configuration
const CONFIG = {
  stockBotToken: process.env.TELEGRAM_STOCK_BOT_TOKEN,
  stockGroupId: process.env.TELEGRAM_STOCK_GROUP_ID,
  stockThreadId: process.env.TELEGRAM_STOCK_THREAD_ID,
  webhookSecret: process.env.TELEGRAM_STOCK_WEBHOOK_SECRET,
  processingEnabled: process.env.TELEGRAM_STOCK_PROCESSING_ENABLED,
  autoConfirm: process.env.TELEGRAM_STOCK_AUTO_CONFIRM,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || BASE_URL
};

console.log('🔧 Test Configuration:');
console.log('- Bot Token:', CONFIG.stockBotToken ? `${CONFIG.stockBotToken.substring(0, 10)}...` : 'NOT SET');
console.log('- Group ID:', CONFIG.stockGroupId);
console.log('- Thread ID:', CONFIG.stockThreadId);
console.log('- Processing Enabled:', CONFIG.processingEnabled);
console.log('- Auto Confirm:', CONFIG.autoConfirm);
console.log('- Site URL:', CONFIG.siteUrl);
console.log('');

/**
 * Test 1: Bot Authentication and Connection
 */
async function testBotAuthentication() {
  console.log('🤖 Testing Bot Authentication...');
  
  if (!CONFIG.stockBotToken) {
    console.error('❌ Bot token not configured');
    return false;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${CONFIG.stockBotToken}/getMe`);
    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ Bot authentication successful');
      console.log(`   Bot: @${data.result.username} (${data.result.first_name})`);
      console.log(`   ID: ${data.result.id}`);
      return true;
    } else {
      console.error('❌ Bot authentication failed:', data.description);
      return false;
    }
  } catch (error) {
    console.error('❌ Bot authentication error:', error.message);
    return false;
  }
}

/**
 * Test 2: Group Access Verification
 */
async function testGroupAccess() {
  console.log('👥 Testing Group Access...');
  
  if (!CONFIG.stockBotToken || !CONFIG.stockGroupId) {
    console.error('❌ Bot token or group ID not configured');
    return false;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${CONFIG.stockBotToken}/getChat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CONFIG.stockGroupId })
    });
    
    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ Group access verified');
      console.log(`   Group: ${data.result.title}`);
      console.log(`   Type: ${data.result.type}`);
      return true;
    } else {
      console.error('❌ Group access failed:', data.description);
      return false;
    }
  } catch (error) {
    console.error('❌ Group access error:', error.message);
    return false;
  }
}

/**
 * Test 3: Webhook Endpoint Verification
 */
async function testWebhookEndpoint() {
  console.log('🔗 Testing Webhook Endpoint...');
  
  try {
    const response = await fetch(`${CONFIG.siteUrl}/api/telegram/stock-webhook`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Webhook endpoint accessible');
      console.log(`   Status: ${data.status}`);
      console.log(`   Processing Enabled: ${data.processing_enabled}`);
      return true;
    } else {
      console.error('❌ Webhook endpoint failed:', response.status, response.statusText);
      return false;
    }
  } catch (error) {
    console.error('❌ Webhook endpoint error:', error.message);
    return false;
  }
}

/**
 * Test 4: Sample Stock Message Processing
 */
async function testStockMessageProcessing() {
  console.log('📦 Testing Stock Message Processing...');
  
  // Sample order confirmation message
  const sampleMessage = {
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
        id: parseInt(CONFIG.stockGroupId),
        type: "supergroup"
      },
      date: Math.floor(Date.now() / 1000),
      message_thread_id: parseInt(CONFIG.stockThreadId),
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

  try {
    const response = await fetch(`${CONFIG.siteUrl}/api/telegram/stock-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': CONFIG.webhookSecret
      },
      body: JSON.stringify(sampleMessage)
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Stock message processing test completed');
      console.log(`   Success: ${data.result?.success}`);
      console.log(`   Products Found: ${data.result?.productsFound || 0}`);
      console.log(`   Products Updated: ${data.result?.productsUpdated || 0}`);
      console.log(`   Products Failed: ${data.result?.productsFailed || 0}`);
      console.log(`   Unmatched Products: ${data.result?.unmatchedProducts || 0}`);
      return true;
    } else {
      console.error('❌ Stock message processing failed:', response.status, data);
      return false;
    }
  } catch (error) {
    console.error('❌ Stock message processing error:', error.message);
    return false;
  }
}

/**
 * Test 5: Security Validation
 */
async function testSecurityValidation() {
  console.log('🔒 Testing Security Validation...');
  
  // Test without webhook secret
  try {
    const response = await fetch(`${CONFIG.siteUrl}/api/telegram/stock-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'unauthorized' })
    });
    
    if (response.status === 401) {
      console.log('✅ Security validation working - unauthorized requests blocked');
      return true;
    } else {
      console.error('❌ Security validation failed - unauthorized request allowed');
      return false;
    }
  } catch (error) {
    console.error('❌ Security validation error:', error.message);
    return false;
  }
}

/**
 * Main Test Runner
 */
async function runAllTests() {
  console.log('🚀 Starting Telegram Stock Management Bot Tests\n');
  
  const tests = [
    { name: 'Bot Authentication', fn: testBotAuthentication },
    { name: 'Group Access', fn: testGroupAccess },
    { name: 'Webhook Endpoint', fn: testWebhookEndpoint },
    { name: 'Stock Message Processing', fn: testStockMessageProcessing },
    { name: 'Security Validation', fn: testSecurityValidation }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    console.log(`\n--- ${test.name} ---`);
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`❌ ${test.name} threw an error:`, error.message);
      failed++;
    }
    console.log(''); // Add spacing
  }
  
  console.log('📊 Test Results Summary:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Stock management system is ready.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the issues above.');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  testBotAuthentication,
  testGroupAccess,
  testWebhookEndpoint,
  testStockMessageProcessing,
  testSecurityValidation
};
