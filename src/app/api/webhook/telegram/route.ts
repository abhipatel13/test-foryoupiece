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
      console.error('❌ Telegram webhook validation failed', {
        hasHeaders: !!request.headers,
        bodyLength: bodyText.length,
        timestamp: new Date().toISOString()
      });
      return NextResponse.json({
        error: 'Unauthorized',
        details: 'Webhook authentication failed'
      }, { status: 401 });
    }

    // Parse the incoming update with error handling
    let update;
    try {
      update = JSON.parse(bodyText);
    } catch (parseError) {
      console.error('❌ Invalid JSON in Telegram webhook payload:', parseError);
      return NextResponse.json({
        error: 'Invalid JSON payload',
        details: 'Webhook payload must be valid JSON'
      }, { status: 400 });
    }

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
    if (!update || typeof update !== 'object') {
      console.error('❌ Invalid Telegram update structure:', typeof update);
      return NextResponse.json({
        error: 'Invalid update structure',
        details: 'Update must be a valid object'
      }, { status: 400 });
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
 * GET endpoint for webhook verification
 * Limited information to prevent information disclosure
 */
export async function GET(request: NextRequest) {
  console.log('📱 Telegram webhook GET request received');

  // Create response with minimal information
  const response = NextResponse.json({
    status: 'active',
    timestamp: new Date().toISOString(),
    version: '1.0'
  });

  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}
