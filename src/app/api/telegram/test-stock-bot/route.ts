import { NextRequest, NextResponse } from 'next/server';

/**
 * Test Telegram Stock Bot Connectivity
 * GET /api/telegram/test-stock-bot
 * 
 * This endpoint tests:
 * 1. Bot token validity
 * 2. Bot permissions in the specified group
 * 3. Thread access permissions
 * 4. Ability to send test messages
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing Telegram Stock Bot connectivity...');

    const botToken = process.env.TELEGRAM_STOCK_BOT_TOKEN;
    const groupId = process.env.TELEGRAM_STOCK_GROUP_ID;
    const threadId = process.env.TELEGRAM_STOCK_THREAD_ID;

    if (!botToken) {
      return NextResponse.json({
        success: false,
        error: 'TELEGRAM_STOCK_BOT_TOKEN not configured'
      }, { status: 500 });
    }

    if (!groupId || !threadId) {
      return NextResponse.json({
        success: false,
        error: 'TELEGRAM_STOCK_GROUP_ID or TELEGRAM_STOCK_THREAD_ID not configured'
      }, { status: 500 });
    }

    const results = {
      botToken: botToken ? `${botToken.substring(0, 10)}...` : 'Not set',
      groupId,
      threadId,
      tests: {} as any
    };

    // Test 1: Get bot info
    console.log('🤖 Testing bot token validity...');
    try {
      const botInfoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const botInfo = await botInfoResponse.json();
      
      if (botInfo.ok) {
        results.tests.botInfo = {
          success: true,
          data: {
            id: botInfo.result.id,
            username: botInfo.result.username,
            first_name: botInfo.result.first_name,
            can_join_groups: botInfo.result.can_join_groups,
            can_read_all_group_messages: botInfo.result.can_read_all_group_messages,
            supports_inline_queries: botInfo.result.supports_inline_queries
          }
        };
        console.log('✅ Bot token is valid');
      } else {
        results.tests.botInfo = {
          success: false,
          error: botInfo.description
        };
        console.log('❌ Bot token is invalid:', botInfo.description);
      }
    } catch (error) {
      results.tests.botInfo = {
        success: false,
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }

    // Test 2: Get chat info
    console.log('🏠 Testing group access...');
    try {
      const chatInfoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getChat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: groupId })
      });
      const chatInfo = await chatInfoResponse.json();
      
      if (chatInfo.ok) {
        results.tests.chatInfo = {
          success: true,
          data: {
            id: chatInfo.result.id,
            title: chatInfo.result.title,
            type: chatInfo.result.type,
            description: chatInfo.result.description?.substring(0, 100) + '...' || 'No description'
          }
        };
        console.log('✅ Bot has access to the group');
      } else {
        results.tests.chatInfo = {
          success: false,
          error: chatInfo.description
        };
        console.log('❌ Bot cannot access group:', chatInfo.description);
      }
    } catch (error) {
      results.tests.chatInfo = {
        success: false,
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }

    // Test 3: Get bot permissions in chat
    console.log('🔐 Testing bot permissions...');
    try {
      const permissionsResponse = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chat_id: groupId,
          user_id: results.tests.botInfo?.data?.id
        })
      });
      const permissions = await permissionsResponse.json();
      
      if (permissions.ok) {
        results.tests.permissions = {
          success: true,
          data: {
            status: permissions.result.status,
            can_send_messages: permissions.result.can_send_messages,
            can_send_media_messages: permissions.result.can_send_media_messages,
            can_send_polls: permissions.result.can_send_polls,
            can_send_other_messages: permissions.result.can_send_other_messages,
            can_add_web_page_previews: permissions.result.can_add_web_page_previews,
            can_change_info: permissions.result.can_change_info,
            can_invite_users: permissions.result.can_invite_users,
            can_pin_messages: permissions.result.can_pin_messages
          }
        };
        console.log('✅ Bot permissions retrieved');
      } else {
        results.tests.permissions = {
          success: false,
          error: permissions.description
        };
        console.log('❌ Cannot get bot permissions:', permissions.description);
      }
    } catch (error) {
      results.tests.permissions = {
        success: false,
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }

    // Test 4: Send a test message (optional - only if previous tests pass)
    const sendTestMessage = request.nextUrl.searchParams.get('send_test') === 'true';
    if (sendTestMessage && results.tests.botInfo?.success && results.tests.chatInfo?.success) {
      console.log('📤 Sending test message...');
      try {
        const testMessage = `🧪 Stock Bot Test Message\n\nTimestamp: ${new Date().toISOString()}\nBot: ${results.tests.botInfo.data.username}\nGroup: ${results.tests.chatInfo.data.title}\nThread: ${threadId}`;
        
        const sendResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: groupId,
            message_thread_id: parseInt(threadId),
            text: testMessage,
            parse_mode: 'Markdown'
          })
        });
        const sendResult = await sendResponse.json();
        
        if (sendResult.ok) {
          results.tests.sendMessage = {
            success: true,
            data: {
              message_id: sendResult.result.message_id,
              date: sendResult.result.date
            }
          };
          console.log('✅ Test message sent successfully');
        } else {
          results.tests.sendMessage = {
            success: false,
            error: sendResult.description
          };
          console.log('❌ Failed to send test message:', sendResult.description);
        }
      } catch (error) {
        results.tests.sendMessage = {
          success: false,
          error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }

    // Calculate overall success
    const allTests = Object.values(results.tests);
    const successfulTests = allTests.filter((test: any) => test.success).length;
    const totalTests = allTests.length;
    
    const overallSuccess = successfulTests === totalTests;

    console.log(`🏁 Test completed: ${successfulTests}/${totalTests} tests passed`);

    return NextResponse.json({
      success: overallSuccess,
      summary: `${successfulTests}/${totalTests} tests passed`,
      configuration: {
        botToken: results.botToken,
        groupId: results.groupId,
        threadId: results.threadId
      },
      tests: results.tests,
      recommendations: generateRecommendations(results.tests)
    });

  } catch (error) {
    console.error('❌ Test endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  }
}

/**
 * Generate recommendations based on test results
 */
function generateRecommendations(tests: any): string[] {
  const recommendations: string[] = [];

  if (!tests.botInfo?.success) {
    recommendations.push('❌ Bot token is invalid or expired. Please check TELEGRAM_STOCK_BOT_TOKEN.');
  }

  if (!tests.chatInfo?.success) {
    recommendations.push('❌ Bot cannot access the group. Make sure the bot is added to the group and has proper permissions.');
  }

  if (tests.permissions?.success && tests.permissions.data.status !== 'administrator') {
    recommendations.push('⚠️ Bot is not an administrator. Consider making it an admin for better reliability.');
  }

  if (tests.permissions?.success && !tests.permissions.data.can_send_messages) {
    recommendations.push('❌ Bot cannot send messages. Please grant message sending permissions.');
  }

  if (!tests.sendMessage?.success && tests.sendMessage) {
    recommendations.push('❌ Bot cannot send messages to the thread. Check thread permissions and ID.');
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ All tests passed! The bot is properly configured.');
  }

  return recommendations;
}
