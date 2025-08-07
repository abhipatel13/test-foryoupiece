import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { telegramNotificationService } from '@/lib/telegram/notification-service';
import crypto from 'crypto';

/**
 * Verify webhook signature using HMAC SHA-256
 */
function verifyWebhookSignature(payload: string, signature: string): boolean {
  const webhookSecret = process.env.WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('❌ WEBHOOK_SECRET environment variable not configured');
    return false;
  }

  if (!signature) {
    console.error('❌ No signature provided in webhook request');
    return false;
  }

  try {
    // Remove 'sha256=' prefix if present (common in webhook implementations)
    const cleanSignature = signature.startsWith('sha256=') ? signature.slice(7) : signature;

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(cleanSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('❌ Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Order Webhook Handler
 * Triggers Telegram notifications for order events
 * POST /api/webhook/order
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📦 Order webhook received');

    // Get request body as text for signature verification
    const bodyText = await request.text();

    // Verify webhook signature
    const signature = request.headers.get('x-webhook-signature') ||
                     request.headers.get('x-hub-signature-256') ||
                     request.headers.get('signature');

    if (!signature) {
      console.error('❌ Order webhook missing signature header');
      return NextResponse.json({
        error: 'Missing signature header',
        details: 'Webhook requests must include a valid signature header'
      }, { status: 401 });
    }

    if (!verifyWebhookSignature(bodyText, signature)) {
      console.error('❌ Order webhook signature verification failed', {
        signatureLength: signature.length,
        bodyLength: bodyText.length,
        timestamp: new Date().toISOString()
      });
      return NextResponse.json({
        error: 'Invalid signature',
        details: 'Webhook signature verification failed'
      }, { status: 401 });
    }

    console.log('✅ Order webhook signature verified');

    // Parse the JSON body with error handling
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch (parseError) {
      console.error('❌ Invalid JSON in webhook payload:', parseError);
      return NextResponse.json({
        error: 'Invalid JSON payload',
        details: 'Webhook payload must be valid JSON'
      }, { status: 400 });
    }

    const { order_id, action } = body;

    if (!order_id) {
      console.error('❌ Missing order_id in webhook payload');
      return NextResponse.json({
        error: 'Missing required field',
        details: 'order_id is required in webhook payload'
      }, { status: 400 });
    }

    if (!action) {
      console.error('❌ Missing action in webhook payload');
      return NextResponse.json({
        error: 'Missing required field',
        details: 'action is required in webhook payload'
      }, { status: 400 });
    }

    if (action !== 'created') {
      console.error('❌ Invalid action in webhook payload:', action);
      return NextResponse.json({
        error: 'Invalid action',
        details: 'Only "created" action is supported'
      }, { status: 400 });
    }

    console.log(`📦 Processing order webhook for order: ${order_id}, action: ${action}`);

    // Get order details from database
    const supabase = createServiceRoleClient();
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          title,
          quantity,
          price,
          total
        )
      `)
      .eq('id', order_id)
      .single();

    if (error || !order) {
      console.error('❌ Order not found:', error);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    console.log(`📦 Found order: ${order.order_number}`);

    // Send Telegram notification
    const notificationSent = await telegramNotificationService.sendOrderNotification(order);

    if (notificationSent) {
      console.log(`✅ Telegram notification sent successfully for order ${order.order_number}`);
      return NextResponse.json({ 
        success: true, 
        message: 'Telegram notification sent',
        order_number: order.order_number
      });
    } else {
      console.error(`❌ Failed to send Telegram notification for order ${order.order_number}`);
      return NextResponse.json({ 
        error: 'Failed to send Telegram notification',
        order_number: order.order_number
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Order webhook error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * GET endpoint for webhook status check
 * Limited information to prevent information disclosure
 */
export async function GET(request: NextRequest) {
  console.log('📦 Order webhook GET request received');

  // Add security headers
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
