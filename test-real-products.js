/**
 * Test Stock Management with Real Products from Database
 * This test uses actual products from the database to verify the complete workflow
 */

require('dotenv').config({ path: '.env.local' });

const BASE_URL = 'http://localhost:3000';

/**
 * Test with real products that should exist in the database
 */
async function testWithRealProducts() {
  console.log('🧪 Testing Stock Management with Real Products\n');
  
  // First, let's get some real products from the database
  console.log('📋 Fetching real products from database...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/products?limit=5`);
    const data = await response.json();
    
    if (!response.ok || !data.data || data.data.length === 0) {
      console.log('❌ No products found in database or API error');
      console.log('Response:', data);
      return false;
    }

    console.log(`✅ Found ${data.data.length} products in database`);

    // Use the first few products for testing (skip out of stock products)
    const availableProducts = data.data.filter(p => p.stock_quantity > 0);
    const testProducts = availableProducts.slice(0, 2);
    console.log('\n📦 Test Products:');
    testProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name_en} (Stock: ${product.stock_quantity})`);
    });
    
    // Create a test message with real products
    const testMessage = {
      update_id: Date.now(),
      message: {
        message_id: Math.floor(Date.now() / 1000),
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
💰 Subtotal: $50.00
🚚 Shipping: $1.50
💳 Total: $51.50
💳 Payment Method: QR Code

Order Items:
1. ${testProducts[0].name_en} x 1 = $25.00
2. ${testProducts[1].name_en} x 1 = $25.00

Order #: ORD-${Date.now()}`
      }
    };
    
    console.log('\n🔍 Test Message Preview:');
    console.log(testMessage.message.text.substring(0, 300) + '...');
    
    // Test the stock webhook with real products
    console.log('\n📡 Testing Stock Webhook with Real Products...');
    
    const webhookResponse = await fetch(`${BASE_URL}/api/telegram/stock-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': process.env.TELEGRAM_STOCK_WEBHOOK_SECRET
      },
      body: JSON.stringify(testMessage)
    });
    
    const webhookData = await webhookResponse.json();
    
    console.log('\n📊 Webhook Response:');
    console.log(`Status: ${webhookResponse.status}`);
    console.log(`Success: ${webhookData.result?.success}`);
    console.log(`Products Found: ${webhookData.result?.productsFound || 0}`);
    console.log(`Products Updated: ${webhookData.result?.productsUpdated || 0}`);
    console.log(`Products Failed: ${webhookData.result?.productsFailed || 0}`);
    console.log(`Unmatched Products: ${webhookData.result?.unmatchedProducts || 0}`);
    console.log(`Processing Time: ${webhookData.result?.processingTimeMs || 0}ms`);
    
    if (webhookData.result?.success) {
      console.log('\n✅ Stock update completed successfully!');
      
      // Verify the stock changes in the database
      console.log('\n🔍 Verifying stock changes...');
      const verifyResponse = await fetch(`${BASE_URL}/api/products?limit=5`);
      const verifyData = await verifyResponse.json();

      if (verifyResponse.ok && verifyData.data) {
        const updatedProducts = verifyData.data.filter(p =>
          testProducts.some(tp => tp.id === p.id)
        );
        
        console.log('📦 Updated Product Stock:');
        updatedProducts.forEach((product, index) => {
          const originalProduct = testProducts.find(tp => tp.id === product.id);
          const stockChange = product.stock_quantity - originalProduct.stock_quantity;
          console.log(`${index + 1}. ${product.name_en}`);
          console.log(`   Before: ${originalProduct.stock_quantity} → After: ${product.stock_quantity} (${stockChange >= 0 ? '+' : ''}${stockChange})`);
        });
      }
      
      return true;
    } else {
      console.log('\n⚠️ Stock update completed but with issues');
      if (webhookData.result?.unmatchedProducts > 0) {
        console.log('   Some products could not be matched to database entries');
      }
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    return false;
  }
}

/**
 * Test product matching with various name formats
 */
async function testProductMatching() {
  console.log('\n🔍 Testing Product Name Matching...\n');
  
  // Test different product name formats that might appear in messages
  const testCases = [
    {
      name: "Exact Match Test",
      message: `✅ PAID
Order Items:
1. Sony WH-1000XM5 Wireless Headphones x 1 = $300.00`,
      expectedMatches: 1
    },
    {
      name: "Partial Match Test", 
      message: `✅ PAID
Order Items:
1. Sony Headphones x 1 = $300.00`,
      expectedMatches: 1
    },
    {
      name: "Case Insensitive Test",
      message: `✅ PAID
Order Items:
1. SONY WH-1000XM5 WIRELESS HEADPHONES x 1 = $300.00`,
      expectedMatches: 1
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`--- ${testCase.name} ---`);
    
    const testMessage = {
      update_id: Date.now() + Math.random(),
      message: {
        message_id: Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000),
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
        body: JSON.stringify(testMessage)
      });
      
      const data = await response.json();
      const productsFound = data.result?.productsFound || 0;
      const matchedProducts = productsFound - (data.result?.unmatchedProducts || 0);
      
      console.log(`Products Found: ${productsFound}`);
      console.log(`Products Matched: ${matchedProducts}`);
      console.log(`Expected Matches: ${testCase.expectedMatches}`);
      
      if (matchedProducts >= testCase.expectedMatches) {
        console.log('✅ PASSED');
      } else {
        console.log('❌ FAILED');
      }
      
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
    }
    
    console.log('');
  }
}

/**
 * Main test runner
 */
async function runRealProductTests() {
  console.log('🚀 Starting Real Product Stock Management Tests\n');
  console.log('=' .repeat(60));
  
  const tests = [
    { name: 'Real Products Test', fn: testWithRealProducts },
    { name: 'Product Matching Test', fn: testProductMatching }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    console.log(`\n=== ${test.name} ===`);
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
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Real Product Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All real product tests passed!');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the issues above.');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runRealProductTests().catch(console.error);
}

module.exports = {
  runRealProductTests,
  testWithRealProducts,
  testProductMatching
};
