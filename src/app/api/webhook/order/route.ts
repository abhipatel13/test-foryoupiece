import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { telegramNotificationService } from '@/lib/telegram/notification-service';

/**
 * Order Webhook Handler
 * Triggers Telegram notifications for order events
 * POST /api/webhook/order
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📦 Order webhook received');

    const body = await request.json();
    const { order_id, action } = body;

    if (!order_id) {
      console.error('❌ Missing order_id in webhook payload');
      return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
    }

    if (!action || action !== 'created') {
      console.error('❌ Invalid or missing action in webhook payload');
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
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
 */
export async function GET(request: NextRequest) {
  console.log('📦 Order webhook GET request received');
  
  return NextResponse.json({ 
    status: 'Order webhook endpoint is active',
    timestamp: new Date().toISOString(),
    endpoints: {
      telegram_notifications: '/api/webhook/order',
      telegram_callbacks: '/api/webhook/telegram'
    }
  });
}
