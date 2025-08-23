import { NextRequest, NextResponse } from 'next/server';
import { handleTelegramUpdate } from '@/lib/telegram/callback-handler';
import { telegramNotificationService } from '@/lib/telegram/notification-service';

/**
 * Test endpoint to simulate Telegram webhook calls
 * POST /api/test/telegram-webhook
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🧪 TEST: Simulating Telegram webhook call');

    // Get the order ID from the request body
    const { orderId, action = 'confirm' } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    console.log(`🧪 TEST: Simulating ${action} action for order ${orderId}`);

    // Create a mock Telegram callback query update
    const mockUpdate = {
      callback_query: {
        id: 'test_callback_' + Date.now(),
        from: {
          id: 123456789,
          first_name: 'Test',
          last_name: 'User',
          username: 'testuser'
        },
        message: {
          message_id: 123,
          chat: {
            id: -1002251987881
          },
          text: 'Test order notification message'
        },
        data: `${action}_${orderId}`
      }
    };

    console.log('🧪 TEST: Mock update created:', {
      action: action,
      orderId: orderId,
      callbackData: mockUpdate.callback_query.data
    });

    // Test webhook validation with the mock update
    const mockBodyText = JSON.stringify(mockUpdate);
    const mockHeaders = new Headers();

    console.log('🧪 TEST: Testing webhook validation...');
    const isValidWebhook = telegramNotificationService.validateWebhookRequest(mockHeaders, mockBodyText);

    if (!isValidWebhook) {
      console.error('❌ TEST: Webhook validation failed');
      return NextResponse.json({
        success: false,
        message: `Webhook validation failed for order ${orderId}`,
        orderId: orderId,
        action: action
      }, { status: 401 });
    }

    console.log('✅ TEST: Webhook validation passed');

    // Process the mock update
    const success = await handleTelegramUpdate(mockUpdate);

    if (success) {
      console.log('✅ TEST: Telegram webhook simulation successful');
      return NextResponse.json({ 
        success: true, 
        message: `Order ${orderId} ${action} processed successfully`,
        orderId: orderId,
        action: action
      });
    } else {
      console.error('❌ TEST: Telegram webhook simulation failed');
      return NextResponse.json({ 
        success: false, 
        message: `Failed to process ${action} for order ${orderId}`,
        orderId: orderId,
        action: action
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ TEST: Telegram webhook simulation error:', error);
    return NextResponse.json({ 
      error: 'Test simulation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * GET endpoint for test information
 */
export async function GET() {
  return NextResponse.json({
    message: 'Telegram webhook test endpoint',
    usage: 'POST with { "orderId": "uuid", "action": "confirm|cancel" }',
    timestamp: new Date().toISOString()
  });
}
