/**
 * Detailed Stock Message Parser Test
 * Tests the message parsing functionality with various order confirmation formats
 */

require('dotenv').config({ path: '.env.local' });

const BASE_URL = 'http://localhost:3000';

// Sample order confirmation messages with different formats
const testMessages = [
  {
    name: "Standard Order Format",
    message: `✅ PAID

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

Order #: ORD-20250131-001`,
    expectedProducts: 2
  },
  {
    name: "Multiple Products Format",
    message: `✅ PAID

Order Items:
1. Japanese Snack Pack x 3 = $45.00
2. Matcha Green Tea x 1 = $15.00
3. Ramen Noodles Premium x 2 = $24.00
4. Sake Set Traditional x 1 = $80.00

Total: $164.00`,
    expectedProducts: 4
  },
  {
    name: "Simple Format",
    message: `Order confirmed:
Product A x 1 = $10.00
Product B x 2 = $20.00`,
    expectedProducts: 2
  },
  {
    name: "No Products Format",
    message: `✅ PAID

Customer Information:
👤 Name: John Doe
📧 Email: john.doe@example.com

Total: $50.00
Payment Method: QR Code`,
    expectedProducts: 0
  }
];

/**
 * Test message parsing with different formats
 */
async function testMessageParsing() {
  console.log('📝 Testing Stock Message Parsing...\n');
  
  let totalTests = 0;
  let passedTests = 0;
  
  for (const testCase of testMessages) {
    console.log(`--- Testing: ${testCase.name} ---`);
    totalTests++;
    
    const sampleUpdate = {
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
          id: -1002667614926,
          type: "supergroup"
        },
        date: Math.floor(Date.now() / 1000),
        message_thread_id: 3,
        text: testCase.message
      }
    };
    
    try {
      const response = await fetch(`${BASE_URL}/api/telegram/stock-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': process.env.TELEGRAM_STOCK_WEBHOOK_SECRET
        },
        body: JSON.stringify(sampleUpdate)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        const productsFound = data.result?.productsFound || 0;
        console.log(`   Products Found: ${productsFound}`);
        console.log(`   Expected: ${testCase.expectedProducts}`);
        
        if (productsFound === testCase.expectedProducts) {
          console.log('   ✅ PASSED');
          passedTests++;
        } else {
          console.log('   ❌ FAILED - Product count mismatch');
        }
        
        if (data.result?.unmatchedProducts > 0) {
          console.log(`   ⚠️  Unmatched Products: ${data.result.unmatchedProducts}`);
        }
      } else {
        console.log(`   ❌ FAILED - HTTP ${response.status}: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`   ❌ FAILED - Error: ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log('📊 Message Parsing Test Results:');
  console.log(`✅ Passed: ${passedTests}/${totalTests}`);
  console.log(`📈 Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  return passedTests === totalTests;
}

/**
 * Test webhook security with various scenarios
 */
async function testWebhookSecurity() {
  console.log('🔒 Testing Webhook Security...\n');
  
  const securityTests = [
    {
      name: "Valid Secret Token",
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': process.env.TELEGRAM_STOCK_WEBHOOK_SECRET
      },
      expectedStatus: 200,
      shouldPass: true
    },
    {
      name: "Invalid Secret Token",
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': 'invalid-secret'
      },
      expectedStatus: 401,
      shouldPass: true
    },
    {
      name: "Missing Secret Token",
      headers: {
        'Content-Type': 'application/json'
      },
      expectedStatus: 401,
      shouldPass: true
    },
    {
      name: "Empty Body",
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': process.env.TELEGRAM_STOCK_WEBHOOK_SECRET
      },
      body: '',
      expectedStatus: 400,
      shouldPass: true
    }
  ];
  
  let totalTests = 0;
  let passedTests = 0;
  
  for (const test of securityTests) {
    console.log(`--- Testing: ${test.name} ---`);
    totalTests++;
    
    try {
      const response = await fetch(`${BASE_URL}/api/telegram/stock-webhook`, {
        method: 'POST',
        headers: test.headers,
        body: test.body || JSON.stringify({ test: 'data' })
      });
      
      console.log(`   Response Status: ${response.status}`);
      console.log(`   Expected Status: ${test.expectedStatus}`);
      
      if (response.status === test.expectedStatus) {
        console.log('   ✅ PASSED');
        passedTests++;
      } else {
        console.log('   ❌ FAILED - Status code mismatch');
      }
    } catch (error) {
      console.log(`   ❌ FAILED - Error: ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log('📊 Security Test Results:');
  console.log(`✅ Passed: ${passedTests}/${totalTests}`);
  console.log(`📈 Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  return passedTests === totalTests;
}

/**
 * Test GET endpoint for webhook verification
 */
async function testWebhookGetEndpoint() {
  console.log('🔍 Testing Webhook GET Endpoint...\n');
  
  try {
    const response = await fetch(`${BASE_URL}/api/telegram/stock-webhook`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ GET endpoint accessible');
      console.log(`   Status: ${data.status}`);
      console.log(`   Timestamp: ${data.timestamp}`);
      console.log(`   Processing Enabled: ${data.processing_enabled}`);
      return true;
    } else {
      console.log(`❌ GET endpoint failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ GET endpoint error: ${error.message}`);
    return false;
  }
}

/**
 * Main test runner
 */
async function runDetailedTests() {
  console.log('🚀 Starting Detailed Stock Management Tests\n');
  
  const tests = [
    { name: 'Message Parsing', fn: testMessageParsing },
    { name: 'Webhook Security', fn: testWebhookSecurity },
    { name: 'GET Endpoint', fn: testWebhookGetEndpoint }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    console.log(`\n=== ${test.name} Test ===`);
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
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 Overall Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All detailed tests passed!');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the issues above.');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runDetailedTests().catch(console.error);
}

module.exports = {
  runDetailedTests,
  testMessageParsing,
  testWebhookSecurity,
  testWebhookGetEndpoint
};
