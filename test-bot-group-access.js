/**
 * Test Bot Group Access
 * Verifies if the bot can access the Telegram group and send messages
 */

require('dotenv').config({ path: '.env.local' });

const CONFIG = {
  botToken: process.env.TELEGRAM_STOCK_BOT_TOKEN,
  groupId: process.env.TELEGRAM_STOCK_GROUP_ID,
  threadId: process.env.TELEGRAM_STOCK_THREAD_ID
};

console.log('🤖 Testing Bot Group Access\n');

console.log('📋 Configuration:');
console.log(`- Bot Token: ${CONFIG.botToken ? `${CONFIG.botToken.substring(0, 10)}...` : 'NOT SET'}`);
console.log(`- Group ID: ${CONFIG.groupId}`);
console.log(`- Thread ID: ${CONFIG.threadId}`);
console.log('');

/**
 * Test 1: Bot Info
 */
async function testBotInfo() {
  console.log('🤖 Testing Bot Info...');
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${CONFIG.botToken}/getMe`);
    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ Bot Info Retrieved:');
      console.log(`   Bot: @${data.result.username} (${data.result.first_name})`);
      console.log(`   ID: ${data.result.id}`);
      console.log(`   Can Join Groups: ${data.result.can_join_groups}`);
      console.log(`   Can Read All Group Messages: ${data.result.can_read_all_group_messages}`);
      return true;
    } else {
      console.error('❌ Bot info failed:', data.description);
      return false;
    }
  } catch (error) {
    console.error('❌ Bot info error:', error.message);
    return false;
  }
}

/**
 * Test 2: Group Access
 */
async function testGroupAccess() {
  console.log('\n👥 Testing Group Access...');
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${CONFIG.botToken}/getChat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CONFIG.groupId })
    });
    
    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ Group Access Verified:');
      console.log(`   Group: ${data.result.title}`);
      console.log(`   Type: ${data.result.type}`);
      console.log(`   Member Count: ${data.result.member_count || 'Unknown'}`);
      return true;
    } else {
      console.error('❌ Group access failed:', data.description);
      console.error('   This usually means the bot is not added to the group or lacks permissions');
      return false;
    }
  } catch (error) {
    console.error('❌ Group access error:', error.message);
    return false;
  }
}

/**
 * Test 3: Bot Permissions in Group
 */
async function testBotPermissions() {
  console.log('\n🔐 Testing Bot Permissions...');
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${CONFIG.botToken}/getChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: CONFIG.groupId,
        user_id: CONFIG.botToken.split(':')[0] // Bot ID is the first part of the token
      })
    });
    
    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ Bot Permissions Retrieved:');
      console.log(`   Status: ${data.result.status}`);
      console.log(`   Can Send Messages: ${data.result.can_send_messages !== false}`);
      console.log(`   Can Send Media: ${data.result.can_send_media_messages !== false}`);
      console.log(`   Can Send Other Messages: ${data.result.can_send_other_messages !== false}`);
      return data.result.status !== 'left' && data.result.status !== 'kicked';
    } else {
      console.error('❌ Bot permissions check failed:', data.description);
      return false;
    }
  } catch (error) {
    console.error('❌ Bot permissions error:', error.message);
    return false;
  }
}

/**
 * Test 4: Send Test Message
 */
async function testSendMessage() {
  console.log('\n📤 Testing Send Message...');
  
  const testMessage = `🧪 Test Message from Stock Bot

⏰ Sent at: ${new Date().toLocaleString()}
🤖 Bot: @Checkingstocksfinalfypbot
📍 Group: ${CONFIG.groupId}
🧵 Thread: ${CONFIG.threadId}

This is a test message to verify the bot can send messages to this group and thread.`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${CONFIG.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CONFIG.groupId,
        message_thread_id: parseInt(CONFIG.threadId),
        text: testMessage
      })
    });
    
    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ Test Message Sent Successfully:');
      console.log(`   Message ID: ${data.result.message_id}`);
      console.log(`   Chat ID: ${data.result.chat.id}`);
      console.log(`   Thread ID: ${data.result.message_thread_id || 'None'}`);
      return true;
    } else {
      console.error('❌ Send message failed:', data.description);
      console.error('   Error Code:', data.error_code);
      
      // Provide specific guidance based on error
      if (data.error_code === 403) {
        console.error('   🔧 Solution: Add the bot to the group and give it permission to send messages');
      } else if (data.error_code === 400 && data.description.includes('thread')) {
        console.error('   🔧 Solution: Check if the thread ID is correct or if the group supports threads');
      }
      
      return false;
    }
  } catch (error) {
    console.error('❌ Send message error:', error.message);
    return false;
  }
}

/**
 * Test 5: Check Recent Messages (if bot can read)
 */
async function testReadMessages() {
  console.log('\n📖 Testing Read Messages...');
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${CONFIG.botToken}/getUpdates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        limit: 5,
        timeout: 1
      })
    });
    
    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ Bot Can Read Updates:');
      console.log(`   Recent Updates: ${data.result.length}`);
      
      if (data.result.length > 0) {
        const recentUpdate = data.result[data.result.length - 1];
        if (recentUpdate.message) {
          console.log(`   Latest Message From: ${recentUpdate.message.from?.first_name || 'Unknown'}`);
          console.log(`   Latest Message Chat: ${recentUpdate.message.chat.id}`);
        }
      }
      
      return true;
    } else {
      console.error('❌ Read messages failed:', data.description);
      return false;
    }
  } catch (error) {
    console.error('❌ Read messages error:', error.message);
    return false;
  }
}

/**
 * Main Test Runner
 */
async function runBotTests() {
  console.log('🚀 Starting Bot Group Access Tests\n');
  console.log('='.repeat(60));
  
  const tests = [
    { name: 'Bot Info', fn: testBotInfo },
    { name: 'Group Access', fn: testGroupAccess },
    { name: 'Bot Permissions', fn: testBotPermissions },
    { name: 'Send Message', fn: testSendMessage },
    { name: 'Read Messages', fn: testReadMessages }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    console.log(`\n--- ${test.name} Test ---`);
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
  console.log('📊 Bot Access Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All bot tests passed! The bot is properly configured.');
  } else {
    console.log('\n⚠️  Some tests failed. The bot may need to be added to the group or given proper permissions.');
    console.log('\n🔧 Next Steps:');
    console.log('1. Add @Checkingstocksfinalfypbot to the Telegram group');
    console.log('2. Give the bot permission to send messages');
    console.log('3. Ensure the bot can access the specific thread (if using topics)');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runBotTests().catch(console.error);
}

module.exports = {
  runBotTests,
  testBotInfo,
  testGroupAccess,
  testBotPermissions,
  testSendMessage,
  testReadMessages
};
