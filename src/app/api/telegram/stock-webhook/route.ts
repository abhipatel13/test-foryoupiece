import { NextRequest, NextResponse } from 'next/server';
import { stockManager } from '@/lib/telegram/stock-manager';
import { stockMessageParser, TelegramUpdate } from '@/lib/telegram/stock-message-parser';

/**
 * Telegram Stock Management Webhook Handler
 * Handles incoming updates from Telegram Bot API for stock management
 * POST /api/telegram/stock-webhook
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📦 Telegram stock webhook received');

    // Check if stock processing is enabled
    if (process.env.TELEGRAM_STOCK_PROCESSING_ENABLED !== 'true') {
      console.log('📦 Stock processing is disabled');
      return NextResponse.json({ ok: true, message: 'Stock processing disabled' });
    }

    // Get request body as text for validation
    const bodyText = await request.text();

    // Validate webhook authenticity using existing webhook secret
    if (!validateWebhookRequest(request.headers, bodyText)) {
      console.error('❌ Stock webhook validation failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse the incoming update
    const update: TelegramUpdate = JSON.parse(bodyText);

    // Log the update for debugging
    console.log('📦 Stock update received from:', 
      update.message?.from?.username || update.edited_message?.from?.username || 'unknown');

    // Validate the update structure
    if (!update || (!update.message && !update.edited_message)) {
      console.error('❌ Invalid stock update: no message');
      return NextResponse.json({ error: 'Invalid update' }, { status: 400 });
    }

    // Check if this is a valid stock message
    if (!stockMessageParser.isValidStockMessage(update)) {
      console.log('📦 Message does not meet stock update criteria, ignoring');
      return NextResponse.json({ ok: true, message: 'Message ignored' });
    }

    // Explicitly ignore edited messages to prevent duplicate deductions
    if (update.edited_message) {
      console.log('📦 Edited Telegram message detected at route level — skipping processing');
      return NextResponse.json({ ok: true, message: 'Edited message ignored' });
    }

    console.log('📦 Processing stock update message...');

    // Process the stock update
    const result = await stockManager.processStockUpdate(update);

    // Send response back to Telegram if configured
    if (result.responseMessage && process.env.TELEGRAM_STOCK_AUTO_CONFIRM === 'true') {
      await sendStockResponse(result.responseMessage, result.messageId);
    }

    // Log the result
    if (result.success) {
      console.log(`✅ Stock update completed: ${result.productsUpdated} products updated, ${result.productsFailed} failed`);
    } else {
      console.error(`❌ Stock update failed: ${result.errors.join(', ')}`);
    }

    return NextResponse.json({
      ok: true,
      result: {
        success: result.success,
        productsUpdated: result.productsUpdated,
        productsFailed: result.productsFailed,
        unmatchedProducts: result.unmatchedProducts.length,
        processingTimeMs: result.processingTimeMs
      }
    });

  } catch (error) {
    console.error('❌ Telegram stock webhook error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * GET endpoint for webhook verification
 */
export async function GET(request: NextRequest) {
  console.log('📦 Telegram stock webhook GET request received');
  
  return NextResponse.json({ 
    status: 'Telegram stock webhook endpoint is active',
    timestamp: new Date().toISOString(),
    processing_enabled: process.env.TELEGRAM_STOCK_PROCESSING_ENABLED === 'true'
  });
}

/**
 * Validate webhook request authenticity
 */
function validateWebhookRequest(headers: Headers, body: string): boolean {
  const telegramSignature = headers.get('x-telegram-bot-api-secret-token');
  const expectedSecret = process.env.TELEGRAM_STOCK_WEBHOOK_SECRET;

  if (!expectedSecret) {
    console.warn('⚠️ No stock webhook secret configured');
    return false;
  }

  if (!telegramSignature) {
    console.warn('⚠️ No Telegram signature in request');
    return false;
  }

  console.log('🔐 Validating webhook secret...');
  const isValid = telegramSignature === expectedSecret;
  if (!isValid) {
    console.warn('⚠️ Stock webhook secret mismatch');
  }
  return isValid;
}

/**
 * Send response message back to Telegram
 */
async function sendStockResponse(message: string, replyToMessageId?: number): Promise<boolean> {
  try {
    const botToken = process.env.TELEGRAM_STOCK_BOT_TOKEN;
    const groupId = process.env.TELEGRAM_STOCK_GROUP_ID;
    const threadId = process.env.TELEGRAM_STOCK_THREAD_ID;

    if (!botToken || !groupId || !threadId) {
      console.warn('⚠️ Stock bot configuration incomplete, cannot send response');
      return false;
    }

    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    const payload = {
      chat_id: groupId,
      message_thread_id: parseInt(threadId),
      text: message
      // Removed reply_to_message_id to avoid "message not found" errors in testing
    };

    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Stock response sent successfully:', result.result?.message_id);
      return true;
    } else {
      const error = await response.text();
      console.error('❌ Failed to send stock response:', error);
      return false;
    }

  } catch (error) {
    console.error('❌ Error sending stock response:', error);
    return false;
  }
}

/**
 * Rate limiting middleware (basic implementation)
 */
const requestCounts = new Map<string, { count: number; resetTime: number }>();

function isRateLimited(identifier: string, maxRequests: number = 10, windowMs: number = 60000): boolean {
  const now = Date.now();
  const record = requestCounts.get(identifier);

  if (!record || now > record.resetTime) {
    requestCounts.set(identifier, { count: 1, resetTime: now + windowMs });
    return false;
  }

  if (record.count >= maxRequests) {
    return true;
  }

  record.count++;
  return false;
}
