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
            const telegramResponse = await fetch(telegramUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(telegramPayload)
            });

            if (telegramResponse.ok) {
              console.log(`📱 Confirmation message sent for order ${order.order_number}`);
            } else {
              console.error('❌ Failed to send confirmation message:', await telegramResponse.text());
            }
          } catch (error) {
            console.error('❌ Error sending confirmation message:', error);
          }
        }

        // Answer the callback query to remove loading state
        const answerCallbackUrl = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
        const answerPayload = {
          callback_query_id: callbackQuery.id,
          text: `Order ${action}ed successfully!`,
          show_alert: false
        };

        try {
          await fetch(answerCallbackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(answerPayload)
          });
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
