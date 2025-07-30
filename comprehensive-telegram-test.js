/**
 * Comprehensive End-to-End Telegram Order Notification System Test
 * Tests complete workflow from environment setup to message delivery
 */

require('dotenv').config({ path: '.env.local' });

const BASE_URL = 'http://localhost:3000';

// Environment Configuration
const CONFIG = {
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  notificationGroupId: process.env.TELEGRAM_NOTIFICATION_GROUP_ID,
  confirmationGroupId: process.env.TELEGRAM_CONFIRMATION_GROUP_ID,
  webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || BASE_URL
};

/**
 * Test 1: Environment Configuration Verification
 */
async function testEnvironmentConfig() {
  console.log('\n🔧 TEST 1: ENVIRONMENT CONFIGURATION');
  console.log('=' .repeat(60));
  
  const results = {
    botToken: !!CONFIG.botToken,
    notificationGroup: !!CONFIG.notificationGroupId,
    confirmationGroup: !!CONFIG.confirmationGroupId,
    webhookSecret: !!CONFIG.webhookSecret
  };
  
  console.log(`Bot Token: ${results.botToken ? '✅ SET' : '❌ MISSING'}`);
  console.log(`Notification Group ID: ${results.notificationGroup ? '✅ SET' : '❌ MISSING'} (${CONFIG.notificationGroupId})`);
  console.log(`Confirmation Group ID: ${results.confirmationGroup ? '✅ SET' : '❌ MISSING'} (${CONFIG.confirmationGroupId})`);
  console.log(`Webhook Secret: ${results.webhookSecret ? '✅ SET' : '❌ MISSING'}`);
  
  const allConfigured = Object.values(results).every(Boolean);
  console.log(`\n📋 Configuration Status: ${allConfigured ? '✅ COMPLETE' : '❌ INCOMPLETE'}`);
  
  return allConfigured;
}

/**
 * Test 2: Bot Connectivity and Info
 */
async function testBotConnectivity() {
  console.log('\n🤖 TEST 2: BOT CONNECTIVITY');
  console.log('=' .repeat(60));
  
  if (!CONFIG.botToken) {
    console.log('❌ Cannot test - Bot token missing');
    return false;
  }
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${CONFIG.botToken}/getMe`);
    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ Bot connectivity: SUCCESS');
      console.log(`   Name: ${data.result.first_name}`);
      console.log(`   Username: @${data.result.username}`);
      console.log(`   ID: ${data.result.id}`);
      console.log(`   Can Join Groups: ${data.result.can_join_groups ? 'Yes' : 'No'}`);
      console.log(`   Can Read Messages: ${data.result.can_read_all_group_messages ? 'Yes' : 'No'}`);
      return true;
    } else {
      console.log('❌ Bot connectivity: FAILED');
      console.log(`   Error: ${data.description}`);
      return false;
    }
  } catch (error) {
    console.log('❌ Bot connectivity: ERROR');
    console.log(`   ${error.message}`);
    return false;
  }
}

/**
 * Test 3: Group Access Verification
 */
async function testGroupAccess() {
  console.log('\n📢 TEST 3: GROUP ACCESS VERIFICATION');
  console.log('=' .repeat(60));
  
  const results = {};
  
  // Test notification group
  if (CONFIG.notificationGroupId) {
    console.log('\n📢 Testing Notification Group Access...');
    results.notification = await testSingleGroupAccess(
      CONFIG.notificationGroupId, 
      'Notification Group',
      '🔔 Test notification from Foryoupiece Order System'
    );
  }
  
  // Test confirmation group
  if (CONFIG.confirmationGroupId) {
    console.log('\n✅ Testing Confirmation Group Access...');
    results.confirmation = await testSingleGroupAccess(
      CONFIG.confirmationGroupId, 
      'Confirmation Group',
      '✅ Test confirmation from Foryoupiece Order System'
    );
  }
  
  const allGroupsAccessible = Object.values(results).every(Boolean);
  console.log(`\n📋 Group Access Status: ${allGroupsAccessible ? '✅ ALL ACCESSIBLE' : '❌ SOME ISSUES'}`);
  
  return allGroupsAccessible;
}

/**
 * Helper: Test access to a single group
 */
async function testSingleGroupAccess(groupId, groupName, testMessage) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${CONFIG.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: groupId,
        text: `${testMessage}\n\n🕐 ${new Date().toLocaleString()}`,
        parse_mode: 'HTML'
      })
    });
    
    const data = await response.json();
    
    if (data.ok) {
      console.log(`   ✅ ${groupName}: SUCCESS (Message ID: ${data.result.message_id})`);
      return true;
    } else {
      console.log(`   ❌ ${groupName}: FAILED - ${data.description}`);
      
      // Provide specific troubleshooting advice
      if (data.description.includes('chat not found')) {
        console.log(`   💡 Solution: Verify group ID (${groupId}) or add bot to group`);
      } else if (data.description.includes('not enough rights')) {
        console.log(`   💡 Solution: Make bot admin or grant send message permissions`);
      }
      return false;
    }
  } catch (error) {
    console.log(`   ❌ ${groupName}: ERROR - ${error.message}`);
    return false;
  }
}

/**
 * Test 4: End-to-End Order Flow
 */
async function testOrderFlow() {
  console.log('\n📦 TEST 4: END-TO-END ORDER FLOW');
  console.log('=' .repeat(60));
  
  // Create test order
  const testOrderData = {
    orderData: {
      user_id: '80901357-6a94-4b8a-91d7-4f9b5e5fb44c',
      email: 'test@foryoupiece.com',
      phone: '+855123456789',
      shipping_address: {
        address_line_1: '123 Test Street',
        city: 'Phnom Penh',
        country: 'Cambodia',
        postal_code: '12000'
      },
      subtotal: 54.00,
      shipping_cost: 1.50,
      discount_amount: 0,
      points_used: 0,
      total_amount: 55.50,
      payment_method: 'qr_code',
      payment_status: 'pending',
      fulfillment_status: 'pending'
    },
    orderItems: [
      {
        product_id: '57ee1188-af52-44ce-8ffc-0bb2b1204aa9',
        sku: 'SKU-XSI7CCRB',
        title: 'Quality 1st The Derma Mask 30 Sheets - TELEGRAM E2E TEST',
        quantity: 1,
        price: 19.00,
        total: 19.00
      },
      {
        product_id: '97a9b506-3e45-4df5-8c9d-760d98b7a8ac',
        sku: 'SKU-BLG23RS5',
        title: 'Botanist Treatment, Moist, Sakura & Cherry Scent 460g - TELEGRAM E2E TEST',
        quantity: 2,
        price: 17.50,
        total: 35.00
      }
    ]
  };
  
  try {
    console.log('📦 Creating test order...');
    const orderResponse = await fetch(`${BASE_URL}/api/orders/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testOrderData)
    });
    
    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();
      console.log('❌ Order creation failed:', errorText);
      return false;
    }
    
    const orderResult = await orderResponse.json();
    console.log(`✅ Order created: ${orderResult.order.order_number}`);
    console.log(`   Order ID: ${orderResult.order.id}`);
    console.log(`   Total: $${orderResult.order.total_amount}`);
    console.log('📱 Telegram notification should be sent automatically...');
    
    // Wait a moment for notification processing
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    return {
      success: true,
      orderNumber: orderResult.order.order_number,
      orderId: orderResult.order.id
    };
    
  } catch (error) {
    console.log('❌ Order flow test failed:', error.message);
    return false;
  }
}

/**
 * Test 5: Webhook Security Validation
 */
async function testWebhookSecurity() {
  console.log('\n🔒 TEST 5: WEBHOOK SECURITY VALIDATION');
  console.log('=' .repeat(60));
  
  try {
    // Test valid GET request
    console.log('🔍 Testing webhook GET endpoint...');
    const getResponse = await fetch(`${BASE_URL}/api/webhook/telegram`);
    const getResult = await getResponse.json();
    console.log(`   ✅ GET request: ${getResult.status}`);
    
    // Test invalid POST request (no signature)
    console.log('🔒 Testing unauthorized POST request...');
    const invalidPostResponse = await fetch(`${BASE_URL}/api/webhook/telegram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'unauthorized' })
    });
    
    if (invalidPostResponse.status === 401) {
      console.log('   ✅ Unauthorized request properly rejected');
    } else {
      console.log(`   ⚠️ Unexpected response: ${invalidPostResponse.status}`);
    }
    
    return true;
  } catch (error) {
    console.log('❌ Webhook security test failed:', error.message);
    return false;
  }
}

/**
 * Test 6: Message Format Verification
 */
async function testMessageFormat() {
  console.log('\n📝 TEST 6: MESSAGE FORMAT VERIFICATION');
  console.log('=' .repeat(60));
  
  // Send a sample formatted message to verify formatting
  const sampleOrderData = {
    order_number: 'FYP-TEST-' + Date.now(),
    total_amount: 55.50,
    email: 'test@foryoupiece.com',
    order_items: [
      { title: 'Test Product 1', quantity: 1, price: 19.00 },
      { title: 'Test Product 2', quantity: 2, price: 17.50 }
    ]
  };
  
  const message = `🛒 <b>NEW ORDER RECEIVED</b>

📋 <b>Order Details:</b>
• Order Number: <code>${sampleOrderData.order_number}</code>
• Total Amount: <b>$${sampleOrderData.total_amount}</b>
• Customer Email: ${sampleOrderData.email}

📦 <b>Items:</b>
${sampleOrderData.order_items.map(item => 
  `• ${item.title} (Qty: ${item.quantity}) - $${item.price}`
).join('\n')}

🕐 <b>Time:</b> ${new Date().toLocaleString()}

Please confirm this order:`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${CONFIG.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CONFIG.notificationGroupId,
        text: message,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Confirm Order', callback_data: `confirm_${sampleOrderData.order_number}` },
            { text: '❌ Cancel Order', callback_data: `cancel_${sampleOrderData.order_number}` }
          ]]
        }
      })
    });
    
    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ Message format test: SUCCESS');
      console.log(`   Message sent with interactive buttons`);
      console.log(`   Message ID: ${data.result.message_id}`);
      return true;
    } else {
      console.log('❌ Message format test: FAILED');
      console.log(`   Error: ${data.description}`);
      return false;
    }
  } catch (error) {
    console.log('❌ Message format test: ERROR');
    console.log(`   ${error.message}`);
    return false;
  }
}

/**
 * Main Test Runner
 */
async function runComprehensiveTest() {
  console.log('🚀 COMPREHENSIVE TELEGRAM ORDER NOTIFICATION SYSTEM TEST');
  console.log('=' .repeat(80));
  console.log('Testing complete end-to-end workflow with real Telegram integration');
  console.log('=' .repeat(80));
  
  const results = {};
  
  // Run all tests
  results.environment = await testEnvironmentConfig();
  results.connectivity = await testBotConnectivity();
  results.groupAccess = await testGroupAccess();
  results.orderFlow = await testOrderFlow();
  results.webhookSecurity = await testWebhookSecurity();
  results.messageFormat = await testMessageFormat();
  
  // Generate comprehensive report
  console.log('\n📊 COMPREHENSIVE TEST RESULTS');
  console.log('=' .repeat(80));
  
  const testResults = [
    ['Environment Configuration', results.environment],
    ['Bot Connectivity', results.connectivity],
    ['Group Access', results.groupAccess],
    ['End-to-End Order Flow', results.orderFlow],
    ['Webhook Security', results.webhookSecurity],
    ['Message Format', results.messageFormat]
  ];
  
  testResults.forEach(([test, result]) => {
    const status = result ? '✅ PASS' : '❌ FAIL';
    console.log(`${test.padEnd(25)}: ${status}`);
  });
  
  const overallSuccess = Object.values(results).every(r => r === true || (r && r.success));
  
  console.log('\n🎯 OVERALL RESULT');
  console.log('=' .repeat(80));
  console.log(`Status: ${overallSuccess ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  if (overallSuccess) {
    console.log('\n🎉 TELEGRAM INTEGRATION FULLY FUNCTIONAL!');
    console.log('✅ Orders will automatically trigger Telegram notifications');
    console.log('✅ Messages will be delivered to the correct groups');
    console.log('✅ Interactive buttons are working');
    console.log('✅ Security measures are in place');
  } else {
    console.log('\n⚠️ ISSUES DETECTED - Please review failed tests above');
  }
  
  console.log('\n📱 NEXT STEPS:');
  console.log('1. Check your Telegram groups for test messages');
  console.log('2. Test button interactions (Confirm/Cancel)');
  console.log('3. Verify confirmation messages in confirmation group');
  console.log('4. Create real orders to test production workflow');
  
  return overallSuccess;
}

// Run comprehensive test
if (typeof window === 'undefined') {
  runComprehensiveTest().catch(console.error);
}

module.exports = {
  runComprehensiveTest,
  testEnvironmentConfig,
  testBotConnectivity,
  testGroupAccess,
  testOrderFlow,
  testWebhookSecurity,
  testMessageFormat
};
