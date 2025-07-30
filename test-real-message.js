/**
 * Test with Real Telegram Message Format
 * Tests the exact message format from your Telegram group
 */

require('dotenv').config({ path: '.env.local' });

const BASE_URL = 'http://localhost:3000';

// Your actual message format
const REAL_MESSAGE_TEST = {
  update_id: Math.floor(Date.now() / 1000),
  message: {
    message_id: Math.floor(Date.now() / 1000),
    from: {
      id: 123456789,
      first_name: "Meylinh Hay",
      username: "testuser"
    },
    chat: {
      id: parseInt(process.env.TELEGRAM_STOCK_GROUP_ID),
      type: "supergroup"
    },
    message_thread_id: 3,
    text: `🎀✨ ORDER CONFIRMATION ✨🎀

📍 Customer Info
Name: Meylinh Hay
Phone number: 076 555 6393
Address: Grab

🛒 Items
Item name x Qty = Price
1. TSUBAKI Premium Volume & Repair Shampoo Treatment Set *1 = 19$

💰 Pricing Summary
• Delivery Fee: $
• Total amount: $ 19
• Deposit: $
• Amount Due: $ 19✅

📌 Important Notes
🔴 Final Sale : Orders are final and non-refundable. No cancellations, returns, or exchanges accepted.
🚚 Delivery : We will notify you once your items are ready for delivery.

⚠️ Thank you for your purchase!`,
    date: Math.floor(Date.now() / 1000)
  }
};

async function testRealMessage() {
  console.log('🧪 Testing Real Telegram Message Format\n');
  console.log('=' .repeat(60));
  
  console.log('📋 Message Content:');
  console.log(REAL_MESSAGE_TEST.message.text);
  console.log('\n' + '=' .repeat(60));
  
  console.log('\n🔍 Testing Product Extraction...');
  
  // Test the parsing logic locally first
  const lines = REAL_MESSAGE_TEST.message.text.split('\n');
  console.log('\n📝 All lines:');
  lines.forEach((line, index) => {
    console.log(`${index + 1}: "${line.trim()}"`);
  });
  
  // Test product patterns
  const productPatterns = [
    /^(\d+)\.?\s+(.+?)\s*[x*×]\s*(\d+)\s*=\s*([\d.,]+)[\$]?/i,
    /^(.+?)\s*[x*×]\s*(\d+)\s*=\s*([\d.,]+)[\$]?/i,
    /^(\d+)\s+(.+?)\s*[x*×]\s*(\d+)\s*=\s*([\d.,]+)[\$]?/i,
    /^(.+?)\s*\([x*×](\d+)\)\s*=\s*([\d.,]+)[\$]?/i
  ];
  
  console.log('\n🔍 Testing Product Line Extraction:');
  const productLine = "1. TSUBAKI Premium Volume & Repair Shampoo Treatment Set *1 = 19$";
  console.log(`Product line: "${productLine}"`);
  
  for (let i = 0; i < productPatterns.length; i++) {
    const pattern = productPatterns[i];
    const match = productLine.match(pattern);
    if (match) {
      console.log(`✅ Pattern ${i + 1} matched:`);
      console.log(`   Full match: "${match[0]}"`);
      console.log(`   Product name: "${match[2] || match[1]}"`);
      console.log(`   Quantity: "${match[3] || match[2]}"`);
      console.log(`   Price: "${match[4] || match[3]}"`);
      break;
    } else {
      console.log(`❌ Pattern ${i + 1} did not match`);
    }
  }
  
  console.log('\n🌐 Testing Webhook Processing...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/telegram/stock-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': process.env.TELEGRAM_WEBHOOK_SECRET
      },
      body: JSON.stringify(REAL_MESSAGE_TEST)
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Webhook response received');
      console.log('📊 Result:', JSON.stringify(data, null, 2));
      
      if (data.result) {
        console.log('\n📈 Processing Summary:');
        console.log(`   Products Found: ${data.result.productsFound || 0}`);
        console.log(`   Products Updated: ${data.result.productsUpdated || 0}`);
        console.log(`   Products Failed: ${data.result.productsFailed || 0}`);
        console.log(`   Unmatched Products: ${data.result.unmatchedProducts || 0}`);
        console.log(`   Processing Time: ${data.result.processingTimeMs || 0}ms`);
        
        if (data.result.productsUpdated > 0) {
          console.log('\n✅ SUCCESS: Products were updated!');
        } else if (data.result.unmatchedProducts > 0) {
          console.log('\n⚠️ WARNING: Products found but not matched in database');
        } else {
          console.log('\n❌ ISSUE: No products were processed');
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
}

// Test specific product search
async function testProductSearch() {
  console.log('\n🔍 Testing Product Search in Database...');
  
  const searchTerms = [
    "TSUBAKI Premium Volume & Repair Shampoo Treatment Set",
    "tsubaki premium volume",
    "Premium Volume & Repair",
    "TSUBAKI Premium Volume"
  ];
  
  for (const term of searchTerms) {
    console.log(`\n🔍 Searching for: "${term}"`);
    
    try {
      const response = await fetch(`${BASE_URL}/api/products/search?q=${encodeURIComponent(term)}`);
      if (response.ok) {
        const data = await response.json();
        console.log(`   Found ${data.length || 0} results`);
        if (data.length > 0) {
          data.slice(0, 3).forEach(product => {
            console.log(`   - ${product.name_en} (Stock: ${product.stock_quantity})`);
          });
        }
      } else {
        console.log(`   Search API not available (${response.status})`);
      }
    } catch (error) {
      console.log(`   Search failed: ${error.message}`);
    }
  }
}

// Run the tests
if (require.main === module) {
  testRealMessage()
    .then(() => testProductSearch())
    .catch(console.error);
}

module.exports = { testRealMessage, REAL_MESSAGE_TEST };
