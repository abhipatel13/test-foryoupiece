/**
 * Thread Filtering Test for Telegram Stock Management
 * Verifies that ONLY Thread 3 messages are processed
 */

require('dotenv').config({ path: '.env.local' });

const BASE_URL = 'http://localhost:3000';

// Test messages from different threads
const THREAD_TESTS = [
  {
    name: "Thread 3 (SHOULD BE PROCESSED)",
    expected: "PROCESSED",
    message: {
      update_id: Math.floor(Date.now() / 1000),
      message: {
        message_id: Math.floor(Date.now() / 1000),
        from: {
          id: 123456789,
          first_name: "Test User",
          username: "testuser"
        },
        chat: {
          id: parseInt(process.env.TELEGRAM_STOCK_GROUP_ID),
          type: "supergroup"
        },
        message_thread_id: 3, // Thread 3 - SHOULD BE PROCESSED
        text: `🎀✨ ORDER CONFIRMATION ✨🎀

Customer: John Doe
Products:
1. Test Product x 1 = 50.00

Total: 50.00`,
        date: Math.floor(Date.now() / 1000)
      }
    }
  },
  {
    name: "Thread 2 (SHOULD BE IGNORED)",
    expected: "IGNORED",
    message: {
      update_id: Math.floor(Date.now() / 1000) + 1,
      message: {
        message_id: Math.floor(Date.now() / 1000) + 1,
        from: {
          id: 123456789,
          first_name: "Test User",
          username: "testuser"
        },
        chat: {
          id: parseInt(process.env.TELEGRAM_STOCK_GROUP_ID),
          type: "supergroup"
        },
        message_thread_id: 2, // Thread 2 - SHOULD BE IGNORED
        text: `🎀✨ ORDER CONFIRMATION ✨🎀

Customer: Jane Doe
Products:
1. Test Product x 1 = 50.00

Total: 50.00`,
        date: Math.floor(Date.now() / 1000)
      }
    }
  },
  {
    name: "Thread 1 (SHOULD BE IGNORED)",
    expected: "IGNORED",
    message: {
      update_id: Math.floor(Date.now() / 1000) + 2,
      message: {
        message_id: Math.floor(Date.now() / 1000) + 2,
        from: {
          id: 123456789,
          first_name: "Test User",
          username: "testuser"
        },
        chat: {
          id: parseInt(process.env.TELEGRAM_STOCK_GROUP_ID),
          type: "supergroup"
        },
        message_thread_id: 1, // Thread 1 - SHOULD BE IGNORED
        text: `🎀✨ ORDER CONFIRMATION ✨🎀

Customer: Bob Smith
Products:
1. Test Product x 1 = 50.00

Total: 50.00`,
        date: Math.floor(Date.now() / 1000)
      }
    }
  },
  {
    name: "Thread 4 (SHOULD BE IGNORED)",
    expected: "IGNORED",
    message: {
      update_id: Math.floor(Date.now() / 1000) + 3,
      message: {
        message_id: Math.floor(Date.now() / 1000) + 3,
        from: {
          id: 123456789,
          first_name: "Test User",
          username: "testuser"
        },
        chat: {
          id: parseInt(process.env.TELEGRAM_STOCK_GROUP_ID),
          type: "supergroup"
        },
        message_thread_id: 4, // Thread 4 - SHOULD BE IGNORED
        text: `🎀✨ ORDER CONFIRMATION ✨🎀

Customer: Alice Johnson
Products:
1. Test Product x 1 = 50.00

Total: 50.00`,
        date: Math.floor(Date.now() / 1000)
      }
    }
  },
  {
    name: "No Thread ID (SHOULD BE IGNORED)",
    expected: "IGNORED",
    message: {
      update_id: Math.floor(Date.now() / 1000) + 4,
      message: {
        message_id: Math.floor(Date.now() / 1000) + 4,
        from: {
          id: 123456789,
          first_name: "Test User",
          username: "testuser"
        },
        chat: {
          id: parseInt(process.env.TELEGRAM_STOCK_GROUP_ID),
          type: "supergroup"
        },
        // No message_thread_id - SHOULD BE IGNORED
        text: `🎀✨ ORDER CONFIRMATION ✨🎀

Customer: Charlie Brown
Products:
1. Test Product x 1 = 50.00

Total: 50.00`,
        date: Math.floor(Date.now() / 1000)
      }
    }
  }
];

async function testThreadFiltering() {
  console.log('🧪 Testing Thread Filtering for Telegram Stock Management\n');
  console.log('=' .repeat(70));
  
  console.log(`📋 Configuration:`);
  console.log(`   Target Group ID: ${process.env.TELEGRAM_STOCK_GROUP_ID}`);
  console.log(`   Target Thread ID: ${process.env.TELEGRAM_STOCK_THREAD_ID}`);
  console.log(`   Webhook Secret: ${process.env.TELEGRAM_WEBHOOK_SECRET ? '✅ SET' : '❌ MISSING'}`);
  console.log('');

  let passedTests = 0;
  let totalTests = THREAD_TESTS.length;

  for (const test of THREAD_TESTS) {
    console.log(`🔍 Testing: ${test.name}`);
    console.log(`   Thread ID: ${test.message.message.message_thread_id || 'undefined'}`);
    console.log(`   Expected: ${test.expected}`);
    
    try {
      const response = await fetch(`${BASE_URL}/api/telegram/stock-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-bot-api-secret-token': process.env.TELEGRAM_WEBHOOK_SECRET
        },
        body: JSON.stringify(test.message)
      });

      if (response.ok) {
        const data = await response.json();
        
        // Check if message was processed or ignored
        const wasProcessed = data.result && (
          data.result.productsUpdated > 0 || 
          data.result.productsFailed > 0 || 
          data.result.unmatchedProducts > 0
        );
        
        const wasIgnored = data.message && (
          data.message.includes('ignored') || 
          data.message.includes('Wrong thread') ||
          data.message.includes('Wrong group')
        );

        let actualResult;
        if (wasProcessed) {
          actualResult = "PROCESSED";
        } else if (wasIgnored) {
          actualResult = "IGNORED";
        } else {
          actualResult = "UNKNOWN";
        }

        console.log(`   Actual: ${actualResult}`);
        
        if (actualResult === test.expected) {
          console.log(`   ✅ PASS - Correctly ${actualResult.toLowerCase()}`);
          passedTests++;
        } else {
          console.log(`   ❌ FAIL - Expected ${test.expected}, got ${actualResult}`);
          console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
        }
        
      } else {
        console.log(`   ❌ FAIL - HTTP ${response.status}`);
        const error = await response.text();
        console.log(`   Error: ${error}`);
      }
      
    } catch (error) {
      console.log(`   ❌ FAIL - Network error: ${error.message}`);
    }
    
    console.log('');
  }

  console.log('=' .repeat(70));
  console.log(`🎯 Test Results: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('✅ ALL TESTS PASSED - Thread filtering is working correctly!');
    console.log('🎉 Only Thread 3 messages will be processed for stock updates.');
  } else {
    console.log('❌ SOME TESTS FAILED - Thread filtering needs attention.');
  }
  
  console.log('\n📋 Summary:');
  console.log('   - Thread 3: ✅ Will process ORDER CONFIRMATION messages');
  console.log('   - All other threads: ❌ Will be ignored');
  console.log('   - No thread ID: ❌ Will be ignored');
}

// Additional test for wrong group
async function testWrongGroup() {
  console.log('\n🔍 Testing Wrong Group (Should be ignored)');
  
  const wrongGroupMessage = {
    update_id: Math.floor(Date.now() / 1000) + 10,
    message: {
      message_id: Math.floor(Date.now() / 1000) + 10,
      from: {
        id: 123456789,
        first_name: "Test User",
        username: "testuser"
      },
      chat: {
        id: -1234567890, // Wrong group ID
        type: "supergroup"
      },
      message_thread_id: 3, // Correct thread but wrong group
      text: `🎀✨ ORDER CONFIRMATION ✨🎀

Customer: Wrong Group Test
Products:
1. Test Product x 1 = 50.00

Total: 50.00`,
      date: Math.floor(Date.now() / 1000)
    }
  };

  try {
    const response = await fetch(`${BASE_URL}/api/telegram/stock-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': process.env.TELEGRAM_WEBHOOK_SECRET
      },
      body: JSON.stringify(wrongGroupMessage)
    });

    if (response.ok) {
      const data = await response.json();
      
      const wasIgnored = data.message && (
        data.message.includes('ignored') || 
        data.message.includes('Wrong group')
      );

      if (wasIgnored) {
        console.log('   ✅ PASS - Wrong group correctly ignored');
      } else {
        console.log('   ❌ FAIL - Wrong group was processed');
        console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
      }
    }
  } catch (error) {
    console.log(`   ❌ Network error: ${error.message}`);
  }
}

// Run the tests
if (require.main === module) {
  testThreadFiltering()
    .then(() => testWrongGroup())
    .catch(console.error);
}

module.exports = { testThreadFiltering, THREAD_TESTS };
