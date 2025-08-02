#!/usr/bin/env node

/**
 * Test Webhook Locally
 * This script tests the webhook locally to see exactly what message is being generated
 */

require('dotenv').config({ path: '.env.local' });

async function testWebhookLocally() {
  console.log('🧪 Testing webhook locally...');
  
  try {
    // Import the webhook handler
    const { POST } = await import('./src/app/api/webhook/telegram/route.js');
    
    // Create a mock /done request
    const mockRequest = {
      json: async () => ({
        message: {
          message_id: 12345,
          from: {
            id: 123456789,
            is_bot: false,
            first_name: 'Test',
            last_name: 'User',
            username: 'testuser'
          },
          chat: {
            id: -1002251987881,
            type: 'supergroup',
            title: 'Test Group'
          },
          date: Math.floor(Date.now() / 1000),
          text: '/done',
          message_thread_id: 2
        }
      })
    };

    console.log('📤 Sending /done command to local webhook...');
    
    // Call the webhook handler
    const response = await POST(mockRequest);
    const result = await response.json();
    
    console.log('✅ Local webhook response:', result);
    
  } catch (error) {
    console.error('❌ Error testing webhook locally:', error);
  }
}

// Run the test
testWebhookLocally().catch(console.error);
