import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token',
}

interface TelegramCallbackQuery {
  id: string;
  from: {
    id: number;
    first_name: string;
    username?: string;
  };
  data: string;
}

interface TelegramUpdate {
  callback_query?: TelegramCallbackQuery;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔔 Telegram webhook received:', req.method);

    // Validate webhook secret
    const telegramSignature = req.headers.get('x-telegram-bot-api-secret-token');
    const expectedSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
    
    if (expectedSecret && telegramSignature !== expectedSecret) {
      console.error('❌ Invalid webhook signature');
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    // Parse request body
    const update: TelegramUpdate = await req.json();
    console.log('📨 Telegram update:', JSON.stringify(update, null, 2));

    // Handle callback queries (button clicks)
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const callbackData = callbackQuery.data;
      const userId = callbackQuery.from.id;
      const username = callbackQuery.from.username || callbackQuery.from.first_name;

      console.log(`🔘 Button clicked: ${callbackData} by ${username} (${userId})`);

      // Parse callback data
      if (callbackData.startsWith('confirm_') || callbackData.startsWith('cancel_')) {
        const [action, orderId] = callbackData.split('_');
        
        if (!orderId) {
          console.error('❌ Invalid callback data format:', callbackData);
          return new Response('Invalid callback data', { status: 400, headers: corsHeaders });
        }

        console.log(`🎯 Processing ${action} for order: ${orderId}`);

        // Initialize Supabase client
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Update order status
        const updateData = action === 'confirm'
          ? {
              payment_status: 'verified',
              fulfillment_status: 'shipped',
              telegram_status: 'confirmed',
              processed_by: `${username} (@${callbackQuery.from.username || 'unknown'})`,
              processed_at: new Date().toISOString()
            }
          : {
              payment_status: 'failed',
              fulfillment_status: 'cancelled',
              telegram_status: 'cancelled',
              processed_by: `${username} (@${callbackQuery.from.username || 'unknown'})`,
              processed_at: new Date().toISOString()
            };

        console.log(`🔄 Updating order ${orderId} with:`, updateData);

        const { data, error } = await supabase
          .from('orders')
          .update(updateData)
          .eq('id', orderId)
          .select();

        if (error) {
          console.error('❌ Database update error:', error);
          return new Response('Database error', { status: 500, headers: corsHeaders });
        }

        if (!data || data.length === 0) {
          console.error('❌ Order not found:', orderId);
          return new Response('Order not found', { status: 404, headers: corsHeaders });
        }

        console.log(`✅ Order ${orderId} status updated to ${action}ed`);

        // Fetch order details once for downstream notifications
        let orderDetails: any = null;
        try {
          const { data: od, error: odErr } = await supabase
            .from('orders')
            .select(`
              *,
              order_items (*),
              users!orders_user_id_fkey (*)
            `)
            .eq('id', orderId)
            .single();
          if (odErr) {
            console.error('❌ Failed to fetch order details:', odErr);
          } else {
            orderDetails = od;
          }
        } catch (e) {
          console.error('❌ Error fetching order details:', e);
        }

        // Send customer email notification based on action
        if (action === 'confirm') {
          try {
            console.log(`📧 Sending order shipped email notification for order ${orderId}...`);

            if (orderDetails) {
              // Call the customer notification service via Edge Function
              const notificationUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/customer-notification`;
              const notificationPayload = {
                type: 'order_shipped',
                orderId: orderDetails.id,
                orderNumber: orderDetails.order_number,
                customerEmail: orderDetails.users?.email || orderDetails.email,
                customerName: `${orderDetails.users?.first_name || orderDetails.first_name || ''} ${orderDetails.users?.last_name || orderDetails.last_name || ''}`.trim(),
                orderTotal: orderDetails.total_amount,
                orderItems: orderDetails.order_items || [],
                shippingAddress: orderDetails.shipping_address
              };

              const notificationResponse = await fetch(notificationUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
                },
                body: JSON.stringify(notificationPayload)
              });

              if (notificationResponse.ok) {
                console.log(`✅ Order shipped email notification sent successfully for order ${orderId}`);
              } else {
                const errorText = await notificationResponse.text();
                console.error(`❌ Failed to send order shipped email notification:`, errorText);
              }
            }
          } catch (emailError) {
            console.error(`❌ Failed to send order shipped email notification:`, emailError);
            // Don't fail the order confirmation if email fails
          }
        } else if (action === 'cancel') {
          try {
            console.log(`📧 Sending order cancelled email notification for order ${orderId}...`);

            if (orderDetails) {
              const notificationUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/customer-notification`;
              const notificationPayload = {
                type: 'order_cancelled',
                orderId: orderDetails.id,
                orderNumber: orderDetails.order_number,
                customerEmail: orderDetails.users?.email || orderDetails.email,
                customerName: `${orderDetails.users?.first_name || orderDetails.first_name || ''} ${orderDetails.users?.last_name || orderDetails.last_name || ''}`.trim(),
                orderTotal: orderDetails.total_amount,
                orderItems: orderDetails.order_items || [],
                cancellationReason: orderDetails.cancelled_reason || 'Cancelled by admin via Telegram'
              };

              const notificationResponse = await fetch(notificationUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
                },
                body: JSON.stringify(notificationPayload)
              });

              if (notificationResponse.ok) {
                console.log(`✅ Order cancelled email notification sent successfully for order ${orderId}`);
              } else {
                const errorText = await notificationResponse.text();
                console.error(`❌ Failed to send order cancelled email notification:`, errorText);
              }
            }
          } catch (emailError) {
            console.error(`❌ Failed to send order cancelled email notification:`, emailError);
            // Don't fail the order cancellation if email fails
          }
        }

        // After confirmation, optionally forward ORDER CONFIRMATION to stock group to trigger stock webhook
        if (action === 'confirm' && orderDetails && Deno.env.get('TELEGRAM_STOCK_FORWARD_ON_CONFIRM') === 'true') {
          try {
            const stockBotToken = Deno.env.get('TELEGRAM_STOCK_BOT_TOKEN');
            const stockGroupId = Deno.env.get('TELEGRAM_STOCK_GROUP_ID');
            const stockThreadId = Deno.env.get('TELEGRAM_STOCK_THREAD_ID');
            if (!stockBotToken || !stockGroupId || !stockThreadId) {
              console.warn('⚠️ Stock bot configuration incomplete, skipping ORDER CONFIRMATION message');
            } else {
              // Build ORDER CONFIRMATION message expected by stock webhook
              const customerName = (orderDetails.users?.first_name || orderDetails.first_name || '') + ' ' + (orderDetails.users?.last_name || orderDetails.last_name || '');
              const phoneNumber = orderDetails.shipping_address?.phone || orderDetails.phone || 'Not provided';
              const address = orderDetails.shipping_address || {};
              const addrLines = [] as string[];
              if (address.address1) addrLines.push(address.address1);
              if (address.address2) addrLines.push(address.address2);
              const addrComponents = [...addrLines, address.city, address.country, address.postal_code].filter((c: any) => c && String(c).trim() !== '');
              const fullAddress = addrComponents.length > 0 ? addrComponents.join(', ') : 'Not provided';

              const items = (orderDetails.order_items || []).map((it: any, i: number) => `${i + 1}. ${it.title} *${it.quantity} =${Number(it.price || 0)}$`).join('\n') || 'No items found';
              const shippingFee = Number(orderDetails.shipping_fee || orderDetails.shipping_cost || 0);
              const totalAmount = Number(orderDetails.total_amount || 0);

              const orderConfirmationMessage = `🎀✨ ORDER CONFIRMATION ✨🎀\n\n👤 Customer Info\nName: ${customerName.trim() || 'Unknown Customer'}\nPhone number: ${phoneNumber}\nAddress: ${fullAddress}\n\n🛒 Items\nItem name x Qty = Price\n${items}\n\n💰 Pricing Summary\n• Delivery Fee: $ ${shippingFee.toFixed(0)}\n• Total amount: $ ${totalAmount.toFixed(0)}\n• Deposit: $\n• Amount Due: $ ${totalAmount.toFixed(0)} ✅✅\n\n📌 Important Notes\n🚨 Final Sale : Orders are final and non-refundable. No cancellations, returns, or exchanges accepted.\n🚚 Delivery : We will notify you once your items are ready for delivery.\n\n🙏 Thank you for your purchase! 🤍`;

              const stockUrl = `https://api.telegram.org/bot${stockBotToken}/sendMessage`;
              const payload = { chat_id: stockGroupId, message_thread_id: parseInt(stockThreadId), text: orderConfirmationMessage };
              const sendRes = await postWithRetry(stockUrl, payload, 3);
              if (sendRes?.ok) {
                console.log('✅ ORDER CONFIRMATION sent to stock group to trigger stock deduction');
              } else {
                console.error('❌ Failed to send ORDER CONFIRMATION to stock group:', sendRes?.description || 'Unknown error');
              }
            }
          } catch (err) {
            console.error('❌ Error sending ORDER CONFIRMATION to stock group:', err);
          }
        }

        // Send confirmation message to Telegram
        const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
        const confirmationGroupId = Deno.env.get('TELEGRAM_CONFIRMATION_GROUP_ID');
        const confirmationThreadId = Deno.env.get('TELEGRAM_CONFIRMATION_THREAD_ID');

        if (botToken && confirmationGroupId) {
          const order = data[0];
          const confirmationMessage = `
🎉 <b>ORDER ${action.toUpperCase()}ED</b>

📋 <b>Order:</b> ${order.order_number}
👤 <b>Processed by:</b> ${username}
⏰ <b>Time:</b> ${new Date().toLocaleString()}
💰 <b>Amount:</b> $${order.total_amount}

${action === 'confirm' ? '✅ Order confirmed and marked as shipped' : '❌ Order cancelled'}
          `.trim();

          const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
          const telegramPayload = {
            chat_id: confirmationGroupId,
            message_thread_id: confirmationThreadId ? parseInt(confirmationThreadId) : undefined,
            text: confirmationMessage,
            parse_mode: 'HTML'
          };

          try {
            const telegramResponse = await postWithRetry(telegramUrl, telegramPayload, 3);
            if (telegramResponse?.ok) {
              console.log(`📱 Confirmation message sent for order ${order.order_number}`);
            } else {
              console.error('❌ Failed to send confirmation message:', telegramResponse?.description || 'Unknown error');
            }
          } catch (error) {
            console.error('❌ Error sending confirmation message:', error);
          }
        }

        // Answer the callback query to remove loading state (with simple retry)
        const answerCallbackUrl = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
        const answerPayload = {
          callback_query_id: callbackQuery.id,
          text: `Order ${action}ed successfully!`,
          show_alert: false
        };

        // Retry helper honoring 429 retry_after
        const postWithRetry = async (url: string, body: any, maxRetries = 3) => {
          let attempt = 0;
          let lastErr: any = null;
          while (attempt < maxRetries) {
            attempt++;
            try {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 10000);
              const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal,
              });
              clearTimeout(timeout);
              const text = await resp.text();
              let json: any = undefined;
              try { json = JSON.parse(text); } catch { json = { ok: false, description: text }; }
              if (resp.status === 429) {
                const retryAfterSec = Number(json?.parameters?.retry_after) || 1;
                const waitMs = Math.min(Math.max(retryAfterSec, 1) * 1000 * attempt, 30000);
                console.warn(`⚠️ Telegram 429 for ${url} (attempt ${attempt}). Waiting ${waitMs}ms`);
                await new Promise(r => setTimeout(r, waitMs));
                continue;
              }
              if (!resp.ok) {
                lastErr = new Error(json?.description || `HTTP ${resp.status}`);
                const waitMs = Math.min(500 * attempt, 3000);
                if (attempt < maxRetries) {
                  console.warn(`⚠️ Telegram POST failed for ${url} (attempt ${attempt}): ${lastErr.message}. Retrying in ${waitMs}ms`);
                  await new Promise(r => setTimeout(r, waitMs));
                  continue;
                }
              }
              return json;
            } catch (e: any) {
              lastErr = e;
              const waitMs = Math.min(500 * attempt, 3000);
              if (attempt < maxRetries) {
                console.warn(`⚠️ Telegram POST error for ${url} (attempt ${attempt}): ${e?.message || e}. Retrying in ${waitMs}ms`);
                await new Promise(r => setTimeout(r, waitMs));
                continue;
              }
              return { ok: false, description: e?.message || 'Network error' };
            }
          }
          return { ok: false, description: lastErr?.message || 'Unknown error' };
        };

        try {
          await postWithRetry(answerCallbackUrl, answerPayload, 3);
          console.log('✅ Callback query answered');
        } catch (error) {
          console.error('❌ Error answering callback query:', error);
        }

        return new Response('OK', { headers: corsHeaders });
      }
    }

    return new Response('OK', { headers: corsHeaders });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    return new Response('Internal Server Error', { status: 500, headers: corsHeaders });
  }
})
