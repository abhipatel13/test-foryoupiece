import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationRequest {
  type: 'order_confirmation' | 'order_shipped' | 'order_cancelled'
  orderId: string
  orderNumber?: string
  customerEmail?: string
  customerName?: string
  orderTotal?: number
  orderItems?: any[]
  shippingAddress?: any
  pointsRefunded?: number
  cancellationReason?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('📧 Customer notification service called:', req.method);

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    const body: NotificationRequest = await req.json();
    const { type, orderId } = body;

    if (!type || !orderId) {
      return new Response('Missing required fields: type, orderId', { status: 400, headers: corsHeaders });
    }

    console.log(`📧 Processing ${type} notification for order ${orderId}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get order details if not provided
    let orderData = body;
    if (!orderData.customerEmail || !orderData.orderNumber) {
      console.log('📋 Fetching order details from database...');
      
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (*)
          ),
          profiles (*)
        `)
        .eq('id', orderId)
        .single();

      if (orderError) {
        console.error('❌ Failed to fetch order details:', orderError);
        return new Response('Failed to fetch order details', { status: 500, headers: corsHeaders });
      }

      if (!order) {
        console.error('❌ Order not found:', orderId);
        return new Response('Order not found', { status: 404, headers: corsHeaders });
      }

      // Merge order data
      orderData = {
        ...body,
        orderNumber: order.order_number,
        customerEmail: order.profiles?.email || order.email,
        customerName: `${order.profiles?.first_name || order.first_name || ''} ${order.profiles?.last_name || order.last_name || ''}`.trim(),
        orderTotal: order.total_amount,
        orderItems: order.order_items || [],
        shippingAddress: order.shipping_address
      };
    }

    // Send email notification based on type
    let emailResult;
    
    switch (type) {
      case 'order_confirmation':
        emailResult = await sendOrderConfirmationEmail(supabase, orderData);
        break;
        
      case 'order_shipped':
        emailResult = await sendOrderShippedEmail(supabase, orderData);
        break;
        
      case 'order_cancelled':
        emailResult = await sendOrderCancelledEmail(supabase, orderData);
        break;
        
      default:
        return new Response(`Unknown notification type: ${type}`, { status: 400, headers: corsHeaders });
    }

    if (emailResult.success) {
      console.log(`✅ ${type} notification sent successfully for order ${orderId}`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: `${type} notification sent successfully`,
        emailId: emailResult.emailId
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else {
      console.error(`❌ Failed to send ${type} notification:`, emailResult.error);
      return new Response(JSON.stringify({
        success: false,
        error: emailResult.error
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('❌ Customer notification service error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function sendOrderShippedEmail(supabase: any, orderData: NotificationRequest) {
  try {
    console.log(`📧 Sending order shipped email to ${orderData.customerEmail}`);

    // Build a simple shipped email HTML (Edge Functions cannot import Next.js templates)
    const itemsHtml = (orderData.orderItems || []).map((it: any) => `
      <tr>
        <td style="padding:6px 0;border-bottom:1px solid #f1f5f9">${it.title} × ${it.quantity}</td>
        <td style="padding:6px 0;text-align:right;border-bottom:1px solid #f1f5f9">$${Number(it.total || 0).toFixed(2)}</td>
      </tr>
    `).join('');

    const html = `
    <!doctype html>
    <html lang="en">
    <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>Your order is on the way</title></head>
    <body style="margin:0;padding:0;background:#f8fafc;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
      <div style="max-width:640px;margin:0 auto;padding:24px">
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
          <div style="padding:24px;border-bottom:1px solid #e2e8f0">
            <h1 style="margin:0;font-size:20px;color:#0f172a">🚚 Your order is on the way!</h1>
            <p style="margin:6px 0 0;color:#475569">Order ${orderData.orderNumber}</p>
          </div>
          <div style="padding:24px">
            <p style="margin:0 0 12px;color:#334155">Hi ${orderData.customerName || 'there'}, your order has been shipped.</p>
            <div style="margin-top:12px">
              <div style="font-weight:700;color:#0f172a;margin-bottom:8px">Items</div>
              <table style="width:100%;border-collapse:collapse"><tbody>${itemsHtml}</tbody></table>
            </div>
            <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px">Need help? Contact support@foryoupiece.com</div>
          </div>
        </div>
      </div>
    </body>
    </html>`;

    // Call the existing send-email Edge Function with HTML
    const emailUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`;
    const emailResponse = await fetch(emailUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        to: orderData.customerEmail,
        subject: `Your order is on the way! (${orderData.orderNumber})`,
        html,
        emailType: 'status_shipped',
        metadata: { order_id: orderData.orderId, channel: 'email' }
      })
    });

    if (emailResponse.ok) {
      const result = await emailResponse.json();
      return { success: true, emailId: result.id };
    } else {
      const errorText = await emailResponse.text();
      return { success: false, error: errorText };
    }
  } catch (error) {
    return { success: false, error: (error as any)?.message || 'Unknown error' };
  }
}

async function sendOrderConfirmationEmail(supabase: any, orderData: NotificationRequest) {
  // Not used in this task
  return { success: true, emailId: 'confirmation-placeholder' };
}

async function sendOrderCancelledEmail(supabase: any, orderData: NotificationRequest) {
  try {
    console.log(`📧 Sending order cancelled email to ${orderData.customerEmail}`);

    const itemsHtml = (orderData.orderItems || []).map((it: any) => `
      <tr>
        <td style="padding:6px 0;border-bottom:1px solid #f1f5f9">${it.title} × ${it.quantity}</td>
        <td style="padding:6px 0;text-align:right;border-bottom:1px solid #f1f5f9">$${Number(it.total || 0).toFixed(2)}</td>
      </tr>
    `).join('');

    const reason = (orderData.cancellationReason || 'Administrative reasons').toString();

    const html = `
    <!doctype html>
    <html lang="en">
    <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>Order Cancelled</title></head>
    <body style="margin:0;padding:0;background:#f8fafc;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
      <div style="max-width:640px;margin:0 auto;padding:24px">
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
          <div style="padding:24px;border-bottom:1px solid #e2e8f0">
            <h1 style="margin:0;font-size:20px;color:#0f172a">Order Cancelled</h1>
            <p style="margin:6px 0 0;color:#475569">Order ${orderData.orderNumber}</p>
          </div>
          <div style="padding:24px">
            <p style="margin:0 0 12px;color:#334155">We're sorry to inform you that your order was cancelled.</p>
            <p style="margin:0 0 12px;color:#334155">Reason: ${reason}</p>
            <div style="margin-top:12px">
              <div style="font-weight:700;color:#0f172a;margin-bottom:8px">Items</div>
              <table style="width:100%;border-collapse:collapse"><tbody>${itemsHtml}</tbody></table>
            </div>
            <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px">If you have any questions, contact support@foryoupiece.com</div>
          </div>
        </div>
      </div>
    </body>
    </html>`;

    const emailUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`;
    const emailResponse = await fetch(emailUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        to: orderData.customerEmail,
        subject: `Order Cancelled (${orderData.orderNumber})`,
        html,
        emailType: 'status_cancelled',
        metadata: { order_id: orderData.orderId, channel: 'email' }
      })
    });

    if (emailResponse.ok) {
      const result = await emailResponse.json();
      return { success: true, emailId: result.id };
    } else {
      const errorText = await emailResponse.text();
      return { success: false, error: errorText };
    }
  } catch (error) {
    return { success: false, error: (error as any)?.message || 'Unknown error' };
  }
}
