import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token',
}

interface TelegramMessage {
  message_id: number;
  from?: {
    id: number;
    first_name: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
  };
  message_thread_id?: number;
  text?: string;
  date: number;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
}

interface ParsedProduct {
  rawText: string;
  extractedName: string;
  quantity: number;
  price?: number;
  lineNumber: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('📦 Telegram stock webhook received:', req.method);

    // Validate webhook secret
    const telegramSignature = req.headers.get('x-telegram-bot-api-secret-token');
    const expectedSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
    
    if (expectedSecret && telegramSignature !== expectedSecret) {
      console.error('❌ Invalid stock webhook signature');
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    // Parse request body
    const update: TelegramUpdate = await req.json();
    console.log('📦 Stock update:', JSON.stringify(update, null, 2));

    // Check if stock processing is enabled
    const processingEnabled = Deno.env.get('TELEGRAM_STOCK_PROCESSING_ENABLED') === 'true';
    if (!processingEnabled) {
      console.log('📦 Stock processing is disabled');
      return new Response(JSON.stringify({ ok: true, message: 'Stock processing disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate message structure
    const message = update.message || update.edited_message;
    if (!message || !message.text) {
      console.log('📦 No text message found, ignoring');
      return new Response(JSON.stringify({ ok: true, message: 'No text message' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if message is from correct group and thread
    const stockGroupId = parseInt(Deno.env.get('TELEGRAM_STOCK_GROUP_ID') || '0');
    const stockThreadId = parseInt(Deno.env.get('TELEGRAM_STOCK_THREAD_ID') || '0');

    if (message.chat.id !== stockGroupId) {
      console.log(`📦 Message not from stock group (${message.chat.id} !== ${stockGroupId}), ignoring`);
      return new Response(JSON.stringify({ ok: true, message: 'Wrong group' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (message.message_thread_id !== stockThreadId) {
      console.log(`📦 Message not from stock thread (${message.message_thread_id} !== ${stockThreadId}), ignoring`);
      return new Response(JSON.stringify({ ok: true, message: 'Wrong thread' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if message contains "ORDER CONFIRMATION"
    const messageText = message.text.toLowerCase();
    if (!messageText.includes('order confirmation')) {
      console.log('📦 Message does not contain "ORDER CONFIRMATION", ignoring');
      return new Response(JSON.stringify({ ok: true, message: 'Not order confirmation' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if message contains "#Order" (order ID)
    if (messageText.includes('#order')) {
      console.log('📦 Message contains "#Order", ignoring (likely order notification)');
      return new Response(JSON.stringify({ ok: true, message: 'Contains order ID' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check user authorization
    const authorizedUsers = Deno.env.get('TELEGRAM_STOCK_AUTHORIZED_USERS');
    if (authorizedUsers && message.from) {
      const authorizedIds = authorizedUsers.split(',').map(id => parseInt(id.trim()));
      if (!authorizedIds.includes(message.from.id)) {
        console.log(`📦 User ${message.from.id} not authorized for stock updates`);
        return new Response(JSON.stringify({ ok: true, message: 'User not authorized' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    console.log('📦 Processing stock update message...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse products from message
    const products = parseProductsFromMessage(message.text);
    console.log(`📦 Found ${products.length} products to process`);

    if (products.length === 0) {
      console.log('📦 No valid products found in message');
      return new Response(JSON.stringify({ ok: true, message: 'No products found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Process each product
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const product of products) {
      try {
        console.log(`📦 Processing product: ${product.extractedName} (qty: ${product.quantity})`);

        // Find matching product in database
        const { data: matchedProducts, error: searchError } = await supabase
          .from('products')
          .select('id, name_en, sku, stock_quantity')
          .or(`name_en.ilike.%${product.extractedName}%,sku.ilike.%${product.extractedName}%`)
          .eq('is_active', true)
          .limit(1);

        if (searchError) {
          console.error(`❌ Error searching for product ${product.extractedName}:`, searchError);
          results.push({ product: product.extractedName, status: 'error', error: searchError.message });
          failureCount++;
          continue;
        }

        if (!matchedProducts || matchedProducts.length === 0) {
          console.log(`⚠️ No match found for product: ${product.extractedName}`);
          results.push({ product: product.extractedName, status: 'not_found' });
          failureCount++;
          continue;
        }

        const matchedProduct = matchedProducts[0];
        const oldStock = matchedProduct.stock_quantity;
        const newStock = Math.max(0, oldStock - product.quantity); // Allow negative stock

        // Update stock quantity
        const { error: updateError } = await supabase
          .from('products')
          .update({ 
            stock_quantity: newStock,
            updated_at: new Date().toISOString()
          })
          .eq('id', matchedProduct.id);

        if (updateError) {
          console.error(`❌ Error updating stock for ${matchedProduct.name_en}:`, updateError);
          results.push({ 
            product: product.extractedName, 
            matched: matchedProduct.name_en,
            status: 'error', 
            error: updateError.message 
          });
          failureCount++;
          continue;
        }

        console.log(`✅ Updated ${matchedProduct.name_en}: ${oldStock} → ${newStock} (-${product.quantity})`);
        results.push({
          product: product.extractedName,
          matched: matchedProduct.name_en,
          status: 'updated',
          oldStock,
          newStock,
          quantity: product.quantity
        });
        successCount++;

      } catch (error) {
        console.error(`❌ Error processing product ${product.extractedName}:`, error);
        results.push({ 
          product: product.extractedName, 
          status: 'error', 
          error: error.message 
        });
        failureCount++;
      }
    }

    // Log the stock update
    try {
      await supabase
        .from('telegram_stock_updates')
        .insert({
          telegram_message_id: message.message_id,
          telegram_user_id: message.from?.id || 0,
          telegram_username: message.from?.username,
          telegram_user_first_name: message.from?.first_name,
          message_text: message.text,
          processing_status: successCount > 0 ? 'completed' : 'failed',
          products_found: products.length,
          products_updated: successCount,
          products_failed: failureCount,
          updated_products: results.filter(r => r.status === 'updated'),
          unmatched_products: results.filter(r => r.status === 'not_found').map(r => r.product),
          processing_time_ms: Date.now() - Date.now(), // Simplified for edge function
          processed_at: new Date().toISOString()
        });
    } catch (logError) {
      console.error('❌ Failed to log stock update:', logError);
    }

    // Send response message if configured
    const autoConfirm = Deno.env.get('TELEGRAM_STOCK_AUTO_CONFIRM') === 'true';
    if (autoConfirm) {
      await sendStockResponse(supabase, results, successCount, failureCount, message);
    }

    console.log(`✅ Stock update completed: ${successCount} updated, ${failureCount} failed`);

    return new Response(JSON.stringify({
      ok: true,
      result: {
        success: successCount > 0,
        productsFound: products.length,
        productsUpdated: successCount,
        productsFailed: failureCount,
        results
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Stock webhook error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})

// Helper function to parse products from message text
function parseProductsFromMessage(text: string): ParsedProduct[] {
  const products: ParsedProduct[] = [];
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  const productPatterns = [
    /^(\d+)\.?\s+(.+?)\s*[x*×]\s*(\d+)\s*=\s*([\d.,]+)/i,
    /^(.+?)\s*[x*×]\s*(\d+)\s*=\s*([\d.,]+)/i,
    /^(\d+)\s+(.+?)\s*[x*×]\s*(\d+)\s*=\s*([\d.,]+)/i,
  ];

  let lineNumber = 0;
  for (const line of lines) {
    lineNumber++;
    
    // Skip header lines
    if (line.toLowerCase().includes('order confirmation') || 
        line.toLowerCase().includes('total') ||
        line.toLowerCase().includes('customer')) {
      continue;
    }

    for (const pattern of productPatterns) {
      const match = line.match(pattern);
      if (match) {
        try {
          let productName: string;
          let quantity: number;
          let price: number | undefined;

          if (match.length === 5) {
            const [, prefix, name, qty, priceStr] = match;
            productName = name.trim();
            quantity = parseInt(qty);
            price = parseFloat(priceStr.replace(/,/g, ''));
          } else if (match.length === 4) {
            const [, name, qty, priceStr] = match;
            productName = name.trim();
            quantity = parseInt(qty);
            price = parseFloat(priceStr.replace(/,/g, ''));
          } else {
            continue;
          }

          if (productName && quantity > 0) {
            products.push({
              rawText: line,
              extractedName: productName.toLowerCase(),
              quantity,
              price,
              lineNumber
            });
            break;
          }
        } catch (error) {
          console.warn(`Failed to parse line ${lineNumber}: ${line}`, error);
        }
      }
    }
  }

  return products;
}

// Helper function to send response message
async function sendStockResponse(supabase: any, results: any[], successCount: number, failureCount: number, originalMessage: TelegramMessage) {
  try {
    const botToken = Deno.env.get('TELEGRAM_STOCK_BOT_TOKEN');
    const groupId = Deno.env.get('TELEGRAM_STOCK_GROUP_ID');
    const threadId = Deno.env.get('TELEGRAM_STOCK_THREAD_ID');

    if (!botToken || !groupId || !threadId) {
      console.warn('⚠️ Stock bot configuration incomplete');
      return;
    }

    let message = `📊 **Stock Update Results**\n\n`;
    
    if (successCount > 0) {
      message += `✅ Updated: ${successCount} products\n`;
      results.filter(r => r.status === 'updated').forEach(result => {
        message += `• ${result.matched}: ${result.oldStock} → ${result.newStock} (-${result.quantity})\n`;
      });
      message += '\n';
    }

    if (failureCount > 0) {
      message += `⚠️ Issues: ${failureCount} products\n`;
      results.filter(r => r.status !== 'updated').forEach(result => {
        message += `• ${result.product} - ${result.status}\n`;
      });
      message += '\n';
    }

    message += `⏰ Processed at: ${new Date().toLocaleString()}\n`;
    message += `👤 By: ${originalMessage.from?.username ? `@${originalMessage.from.username}` : originalMessage.from?.first_name || 'Unknown'}`;

    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: groupId,
        message_thread_id: parseInt(threadId),
        text: message,
        parse_mode: 'Markdown',
        reply_to_message_id: originalMessage.message_id
      })
    });

    if (response.ok) {
      console.log('✅ Stock response sent successfully');
    } else {
      console.error('❌ Failed to send stock response:', await response.text());
    }

  } catch (error) {
    console.error('❌ Error sending stock response:', error);
  }
}
