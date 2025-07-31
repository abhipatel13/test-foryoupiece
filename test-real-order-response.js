/**
 * Test Real Order Response
 * Shows exactly what response message should be sent for the real order
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

console.log('🔍 Testing Real Order Response Message\n');

async function testRealOrderResponse() {
  console.log('📡 Processing Real Order Message...\n');
  
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
    console.log(`Products Updated: ${data.result?.productsUpdated || 0}`);
    console.log(`Processing Time: ${data.result?.processingTimeMs || 0}ms`);
    console.log('');
    
    // Now let's manually generate what the response message should look like
    console.log('📝 Expected Response Message:');
    console.log('='.repeat(50));
    
    const timestamp = new Date().toLocaleString();
    const username = '@testuser';
    
    // This is what the response message should look like based on the stock manager code
    const expectedResponse = `📊 Stock Update Results

✅ Updated: 1 products
• Tsubaki premium volume &repair set: [OLD_STOCK] → [NEW_STOCK] (-1)

⏰ Processed at: ${timestamp}
👤 By: ${username}
⚡ Processing time: ${data.result?.processingTimeMs || 0}ms`;

    console.log(expectedResponse);
    console.log('='.repeat(50));
    console.log('');
    
    console.log('🔍 Where to Look for the Response:');
    console.log(`- Group: FORYOUWORK (${process.env.TELEGRAM_STOCK_GROUP_ID})`);
    console.log(`- Thread: ${process.env.TELEGRAM_STOCK_THREAD_ID}`);
    console.log('- Look for a message with "📊 Stock Update Results"');
    console.log('- The message should appear shortly after the order confirmation');
    console.log('');
    
    // Let's also send a manual test message to the same location
    console.log('📤 Sending Manual Test Message to Same Location...');
    
    const testMessage = `🧪 MANUAL TEST MESSAGE

This message is being sent to the same group and thread where stock update responses should appear.

📍 Location Details:
• Group ID: ${process.env.TELEGRAM_STOCK_GROUP_ID}
• Thread ID: ${process.env.TELEGRAM_STOCK_THREAD_ID}
• Time: ${new Date().toLocaleString()}

If you can see this message, then stock update responses should also be visible in the same location.`;

    const testResponse = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_STOCK_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_STOCK_GROUP_ID,
        message_thread_id: parseInt(process.env.TELEGRAM_STOCK_THREAD_ID),
        text: testMessage
      })
    });
    
    if (testResponse.ok) {
      const testResult = await testResponse.json();
      console.log(`✅ Manual test message sent successfully: ${testResult.result.message_id}`);
    } else {
      console.error('❌ Failed to send manual test message');
    }
    
    return data.result?.success || false;
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    return false;
  }
}

// Run the test
testRealOrderResponse().then(success => {
  console.log('\n' + '='.repeat(60));
  if (success) {
    console.log('🎉 Real order processing completed successfully!');
    console.log('');
    console.log('🔍 Next Steps:');
    console.log('1. Check the FORYOUWORK Telegram group');
    console.log('2. Look for Thread/Topic #3');
    console.log('3. Look for messages with "📊 Stock Update Results"');
    console.log('4. Look for the manual test message sent above');
    console.log('');
    console.log('💡 If you still don\'t see the messages:');
    console.log('- Make sure you\'re viewing the correct thread/topic');
    console.log('- Check if the group has message filtering enabled');
    console.log('- Verify you have permission to see bot messages');
  } else {
    console.log('⚠️  Real order processing failed - check the logs above');
  }
}).catch(console.error);
