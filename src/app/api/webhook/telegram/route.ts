import { NextRequest, NextResponse } from 'next/server';
import { handleTelegramUpdate } from '@/lib/telegram/callback-handler';
import { telegramNotificationService } from '@/lib/telegram/notification-service';

/**
 * Telegram Webhook Handler
 * Handles incoming updates from Telegram Bot API
 * POST /api/webhook/telegram
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📱 Telegram webhook received');

    // Get request body as text for validation
    const bodyText = await request.text();

    // Validate webhook authenticity
    if (!telegramNotificationService.validateWebhookRequest(request.headers, bodyText)) {
      console.error('❌ Webhook validation failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse the incoming update
    const update = JSON.parse(bodyText);

    // Log the update for debugging (remove sensitive data in production)
    const updateType = update.callback_query ? 'callback_query' :
                      update.message ? 'message' :
                      update.edited_message ? 'edited_message' : 'unknown';
    const username = update.callback_query?.from?.username ||
                    update.message?.from?.username ||
                    update.edited_message?.from?.username || 'unknown';

    console.log(`📱 Telegram ${updateType} received from: ${username}`);

    if (update.message?.text) {
      console.log(`📱 Message text: "${update.message.text}"`);
    }
    if (update.edited_message?.text) {
      console.log(`📱 Edited message text: "${update.edited_message.text}"`);
    }

    // Validate the update structure
    if (!update) {
      console.error('❌ Invalid update: empty body');
      return NextResponse.json({ error: 'Invalid update' }, { status: 400 });
    }

    // Handle the update
    const success = await handleTelegramUpdate(update);
    
    if (success) {
      console.log('✅ Telegram update processed successfully');
      return NextResponse.json({ ok: true });
    } else {
      console.error('❌ Failed to process Telegram update');
      return NextResponse.json({ error: 'Failed to process update' }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Telegram webhook error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * GET endpoint for webhook verification (optional)
 * Some services require a GET endpoint to verify the webhook
 */
export async function GET(request: NextRequest) {
  console.log('📱 Telegram webhook GET request received');
  
  // You can add webhook verification logic here if needed
  return NextResponse.json({ 
    status: 'Telegram webhook endpoint is active',
    timestamp: new Date().toISOString()
  });
}
