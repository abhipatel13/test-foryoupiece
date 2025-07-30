/**
 * Test Multiple Products with Different Stock Scenarios
 * Tests various stock levels and product combinations
 */

require('dotenv').config({ path: '.env.local' });

const BASE_URL = 'http://localhost:3000';

// Test scenarios with different products and stock levels
const TEST_SCENARIOS = [
  {
    name: "Single Product - Normal Stock",
    message: `🎀✨ ORDER CONFIRMATION ✨🎀

📍 Customer Info
Name: Test User 1
Phone number: 123 456 7890
Address: Test Address

🛒 Items
Item name x Qty = Price
1. TSUBAKI Premium Volume & Repair Shampoo Treatment Set *1 = 19$

💰 Pricing Summary
• Total amount: $ 19

⚠️ Thank you for your purchase!`
  },
  {
    name: "Single Product - Zero Stock",
    message: `🎀✨ ORDER CONFIRMATION ✨🎀

📍 Customer Info
Name: Test User 2
Phone number: 123 456 7890
Address: Test Address

🛒 Items
Item name x Qty = Price
1. TSUBAKI Premium EX Intensive Repair Shampoo Treatment Set *1 = 25$

💰 Pricing Summary
• Total amount: $ 25

⚠️ Thank you for your purchase!`
  },
  {
    name: "Multiple Products - Mixed Stock",
    message: `🎀✨ ORDER CONFIRMATION ✨🎀

📍 Customer Info
Name: Test User 3
Phone number: 123 456 7890
Address: Test Address

🛒 Items
Item name x Qty = Price
1. TSUBAKI Premium Moist & Repair Shampoo Treatment Set *1 = 22$
2. Oshima Tsubaki Hair Water 180ml *2 = 30$

💰 Pricing Summary
• Total amount: $ 52

⚠️ Thank you for your purchase!`
  },
  {
    name: "High Quantity - Test Stock Depletion",
    message: `🎀✨ ORDER CONFIRMATION ✨🎀

📍 Customer Info
Name: Test User 4
Phone number: 123 456 7890
Address: Test Address

🛒 Items
Item name x Qty = Price
1. Tsubaki Conditioner Refill, Premium Volume & Repair, 600ml *3 = 45$

💰 Pricing Summary
• Total amount: $ 45

⚠️ Thank you for your purchase!`
  },
  {
    name: "Non-existent Product",
    message: `🎀✨ ORDER CONFIRMATION ✨🎀

📍 Customer Info
Name: Test User 5
Phone number: 123 456 7890
Address: Test Address

🛒 Items
Item name x Qty = Price
1. Non-Existent Product XYZ *1 = 99$

💰 Pricing Summary
• Total amount: $ 99

⚠️ Thank you for your purchase!`
  }
];

async function createTestMessage(scenario) {
  return {
    update_id: Math.floor(Date.now() / 1000) + Math.random() * 1000,
    message: {
      message_id: Math.floor(Date.now() / 1000) + Math.random() * 1000,
      from: {
        id: 123456789,
        first_name: "Test User",
        username: "testuser"
      },
      chat: {
        id: parseInt(process.env.TELEGRAM_STOCK_GROUP_ID),
        type: "supergroup"
      },
      message_thread_id: 3,
      text: scenario.message,
      date: Math.floor(Date.now() / 1000)
    }
  };
}

async function testScenario(scenario, index) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 TEST ${index + 1}: ${scenario.name}`);
  console.log(`${'='.repeat(80)}`);
  
  const testMessage = await createTestMessage(scenario);
  
  console.log('📋 Message Content:');
  console.log(testMessage.message.text);
  console.log('\n' + '-'.repeat(60));
  
  try {
    const response = await fetch(`${BASE_URL}/api/telegram/stock-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': process.env.TELEGRAM_WEBHOOK_SECRET
      },
      body: JSON.stringify(testMessage)
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Webhook response received');
      
      if (data.result) {
        console.log('\n📊 Processing Results:');
        console.log(`   Success: ${data.result.success}`);
        console.log(`   Products Updated: ${data.result.productsUpdated || 0}`);
        console.log(`   Products Failed: ${data.result.productsFailed || 0}`);
        console.log(`   Unmatched Products: ${data.result.unmatchedProducts || 0}`);
        console.log(`   Processing Time: ${data.result.processingTimeMs || 0}ms`);
        
        // Determine result status
        if (data.result.productsUpdated > 0) {
          console.log('\n🎉 RESULT: SUCCESS - Products were updated!');
        } else if (data.result.unmatchedProducts > 0) {
          console.log('\n⚠️ RESULT: NO MATCH - Products not found in database');
        } else if (data.result.productsFailed > 0) {
          console.log('\n❌ RESULT: FAILED - Products found but updates failed');
        } else {
          console.log('\n❓ RESULT: UNKNOWN - No products processed');
        }
      }
    } else {
      const error = await response.text();
      console.log(`❌ Webhook failed with status ${response.status}`);
      console.log(`Error: ${error}`);
    }
  } catch (error) {
    console.log(`❌ Network error: ${error.message}`);
  }
  
  // Wait a bit between tests to avoid overwhelming the server
  await new Promise(resolve => setTimeout(resolve, 2000));
}

async function checkCurrentStock() {
  console.log('\n📊 CURRENT STOCK LEVELS (Before Tests)');
  console.log('='.repeat(80));
  
  // Check stock for products we'll be testing
  const productsToCheck = [
    'TSUBAKI Premium Volume & Repair Shampoo Treatment Set',
    'TSUBAKI Premium EX Intensive Repair Shampoo Treatment Set',
    'TSUBAKI Premium Moist & Repair Shampoo Treatment Set',
    'Oshima Tsubaki Hair Water 180ml',
    'Tsubaki Conditioner Refill, Premium Volume & Repair, 600ml'
  ];
  
  for (const productName of productsToCheck) {
    try {
      const response = await fetch(`${BASE_URL}/api/supabase/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `SELECT name_en, sku, stock_quantity FROM products WHERE name_en = '${productName}' AND is_active = true ORDER BY stock_quantity DESC;`
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          data.forEach(product => {
            console.log(`📦 ${product.name_en}: ${product.stock_quantity} units (${product.sku})`);
          });
        } else {
          console.log(`❌ ${productName}: Not found`);
        }
      }
    } catch (error) {
      console.log(`❌ Error checking ${productName}: ${error.message}`);
    }
  }
}

async function runAllTests() {
  console.log('🚀 STARTING COMPREHENSIVE PRODUCT TESTING');
  console.log('Testing different stock scenarios and product combinations\n');
  
  // Check initial stock levels
  await checkCurrentStock();
  
  // Run all test scenarios
  for (let i = 0; i < TEST_SCENARIOS.length; i++) {
    await testScenario(TEST_SCENARIOS[i], i);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('🏁 ALL TESTS COMPLETED');
  console.log('='.repeat(80));
  console.log('Check the server logs for detailed processing information.');
  console.log('Verify stock levels in the database to confirm updates.');
}

// Run the tests
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests, TEST_SCENARIOS };
