import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function isTelegramSyntheticEmail(email?: string | null): boolean {
  if (!email) return false
  return /@telegram\.foryoupiece\.local$/i.test(email) || /^tg_\d+@/i.test(email)
}

interface EmailMessage {
  outbox_id: string
  order_id: string
  email_type: string
  payload: Record<string, any>
  attempts: number
}

interface OrderData {
  id: string
  order_number: string
  email: string
  total_amount: number
  created_at: string
  shipping_address: any
  users: {
    first_name?: string
    last_name?: string
    telegram_id?: string
  }
  order_items: Array<{
    title: string
    quantity: number
    price: number
    total: number
  }>
  subtotal: number
  shipping_cost: number
  discount_amount: number
  coupon_discount_amount: number
  points_used: number
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔄 Email worker started')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!

    if (!supabaseUrl || !supabaseServiceKey || !resendApiKey) {
      throw new Error('Missing required environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Process messages from the queue
    const processedCount = await processEmailQueue(supabase, resendApiKey)

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('❌ Email worker error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

async function processEmailQueue(supabase: any, resendApiKey: string): Promise<number> {
  let processedCount = 0
  const maxBatchSize = 10
  const maxProcessingTime = 50000 // 50 seconds to avoid timeout

  const startTime = Date.now()

  while (Date.now() - startTime < maxProcessingTime) {
    try {
      // Pop messages from queue
      const { data: messages, error: queueError } = await supabase
        .schema('pgmq_public')
        .rpc('pop', { queue_name: 'emails' })

      if (queueError) {
        console.error('❌ Queue pop error:', queueError)
        break
      }

      if (!messages || messages.length === 0) {
        console.log('📭 No messages in queue')
        break
      }

      console.log(`📬 Processing ${messages.length} messages`)

      // Process each message
      for (const message of messages.slice(0, maxBatchSize)) {
        try {
          await processEmailMessage(supabase, resendApiKey, message)
          processedCount++

          // Archive the message after successful processing
          await supabase
            .schema('pgmq_public')
            .rpc('archive', { 
              queue_name: 'emails', 
              message_id: message.msg_id 
            })

        } catch (error) {
          console.error(`❌ Failed to process message ${message.msg_id}:`, error)
          
          // Mark as failed in outbox
          if (message.message?.outbox_id) {
            await supabase.rpc('mark_email_failed', {
              p_outbox_id: message.message.outbox_id,
              p_error_message: error.message
            })
          }
        }
      }

      // Rate limiting: Resend allows ~2 req/s
      if (processedCount > 0) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }

    } catch (error) {
      console.error('❌ Queue processing error:', error)
      break
    }
  }

  console.log(`✅ Processed ${processedCount} email messages`)
  return processedCount
}

async function processEmailMessage(supabase: any, resendApiKey: string, message: any): Promise<void> {
  const emailData: EmailMessage = message.message

  console.log(`📧 Processing email: ${emailData.email_type} for order ${emailData.order_id}`)

  // Mark as processing
  const { error: markError } = await supabase.rpc('mark_email_processing', {
    p_outbox_id: emailData.outbox_id
  })

  if (markError) {
    throw new Error(`Failed to mark as processing: ${markError.message}`)
  }

  // Load order data
  const orderData = await loadOrderData(supabase, emailData.order_id)

  // Skip sending for Telegram-authenticated users
  const isTelegramUser = !!orderData?.users?.telegram_id || isTelegramSyntheticEmail(orderData?.email)
  if (isTelegramUser) {
    console.log('✳️ Skipping worker email for Telegram user')
    await logEmailDelivery(supabase, {
      outbox_id: emailData.outbox_id,
      order_id: emailData.order_id,
      recipient: orderData.email,
      subject: `Skipped: ${emailData.email_type}`,
      email_type: emailData.email_type,
      provider_id: 'skipped_telegram_user',
      status: 'sent',
      error_message: null
    })
    await supabase.rpc('mark_email_sent', { p_outbox_id: emailData.outbox_id, p_provider_id: 'skipped_telegram_user' })
    return
  }

  // Generate email content based on type
  const emailContent = await generateEmailContent(emailData.email_type, orderData)

  // Send email via Resend
  const emailResult = await sendEmailViaResend(resendApiKey, emailContent)

  // Log the email attempt
  await logEmailDelivery(supabase, {
    outbox_id: emailData.outbox_id,
    order_id: emailData.order_id,
    recipient: emailContent.to,
    subject: emailContent.subject,
    email_type: emailData.email_type,
    provider_id: emailResult.id,
    status: emailResult.success ? 'sent' : 'failed',
    error_message: emailResult.error
  })

  // Mark as sent or failed
  if (emailResult.success) {
    await supabase.rpc('mark_email_sent', {
      p_outbox_id: emailData.outbox_id,
      p_provider_id: emailResult.id
    })
    console.log(`✅ Email sent successfully: ${emailResult.id}`)
  } else {
    await supabase.rpc('mark_email_failed', {
      p_outbox_id: emailData.outbox_id,
      p_error_message: emailResult.error || 'Unknown error'
    })
    throw new Error(`Email sending failed: ${emailResult.error}`)
  }
}

async function loadOrderData(supabase: any, orderId: string): Promise<OrderData> {
  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      *,
      users:users!orders_user_id_fkey (first_name, last_name, telegram_id),
      order_items (title, quantity, price, total)
    `)
    .eq('id', orderId)
    .single()

  if (error || !order) {
    throw new Error(`Failed to load order data: ${error?.message || 'Order not found'}`)
  }

  return order
}

async function generateEmailContent(emailType: string, order: OrderData) {
  const customerName = [order.users?.first_name, order.users?.last_name]
    .filter(Boolean)
    .join(' ') || 'Valued Customer'

  switch (emailType) {
    case 'order_confirmation':
      return {
        to: order.email,
        subject: `Thank you for your purchase! Order ${order.order_number}`,
        html: generateOrderConfirmationHtml(order, customerName)
      }
    
    case 'order_shipped':
      return {
        to: order.email,
        subject: `Your order ${order.order_number} has been shipped!`,
        html: generateOrderShippedHtml(order, customerName)
      }
    
    case 'order_cancelled':
      return {
        to: order.email,
        subject: `Order ${order.order_number} has been cancelled`,
        html: generateOrderCancelledHtml(order, customerName)
      }
    
    default:
      throw new Error(`Unknown email type: ${emailType}`)
  }
}

async function sendEmailViaResend(apiKey: string, emailContent: any) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Foryoupiece <no-reply@foryoupiece.com>',
      to: emailContent.to,
      subject: emailContent.subject,
      html: emailContent.html,
    }),
  })

  const result = await response.json()

  return {
    success: response.ok,
    id: result.id,
    error: response.ok ? null : result.message || `HTTP ${response.status}`
  }
}

async function logEmailDelivery(supabase: any, params: {
  outbox_id: string
  order_id: string
  recipient: string
  subject: string
  email_type: string
  provider_id?: string
  status: string
  error_message?: string
}) {
  await supabase.from('email_logs').insert({
    outbox_id: params.outbox_id,
    recipient: params.recipient,
    subject: params.subject,
    email_type: params.email_type,
    status: params.status,
    error_message: params.error_message,
    provider: 'resend',
    provider_id: params.provider_id,
    metadata: { order_id: params.order_id, channel: 'email' }
  })
}

function generateOrderConfirmationHtml(order: OrderData, customerName: string): string {
  const items = order.order_items.map(item => 
    `<tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.title}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${item.price.toFixed(2)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${item.total.toFixed(2)}</td>
    </tr>`
  ).join('')

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333; text-align: center;">Thank you for your order!</h1>
      <p>Dear ${customerName},</p>
      <p>Your order <strong>${order.order_number}</strong> has been confirmed and is being processed.</p>
      
      <h2 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 10px;">Order Details</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background-color: #f5f5f5;">
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #333;">Item</th>
            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #333;">Qty</th>
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #333;">Price</th>
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #333;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${items}
        </tbody>
      </table>
      
      <div style="text-align: right; margin: 20px 0;">
        <p><strong>Subtotal: $${order.subtotal.toFixed(2)}</strong></p>
        <p><strong>Shipping: $${order.shipping_cost.toFixed(2)}</strong></p>
        ${order.discount_amount > 0 ? `<p><strong>Discount: -$${order.discount_amount.toFixed(2)}</strong></p>` : ''}
        ${order.points_used > 0 ? `<p><strong>Points Used: -$${(order.points_used / 1000).toFixed(2)}</strong></p>` : ''}
        <p style="font-size: 18px; color: #333;"><strong>Total: $${order.total_amount.toFixed(2)}</strong></p>
      </div>
      
      <div style="background-color: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 5px;">
        <h3 style="color: #333; margin-top: 0;">Payment Instructions</h3>
        <p>Please complete your payment using the QR code or payment link provided on the order confirmation page.</p>
        <p>Once payment is confirmed, we'll process and ship your order within 1-2 business days.</p>
      </div>
      
      <p>Thank you for choosing Foryoupiece!</p>
      <p style="color: #666; font-size: 12px;">If you have any questions, please contact us at support@foryoupiece.com</p>
    </div>
  `
}

function generateOrderShippedHtml(order: OrderData, customerName: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333; text-align: center;">Your order is on its way!</h1>
      <p>Dear ${customerName},</p>
      <p>Great news! Your order <strong>${order.order_number}</strong> has been shipped and is on its way to you.</p>
      <p>You should receive your items within 3-5 business days.</p>
      <p>Thank you for choosing Foryoupiece!</p>
    </div>
  `
}

function generateOrderCancelledHtml(order: OrderData, customerName: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333; text-align: center;">Order Cancelled</h1>
      <p>Dear ${customerName},</p>
      <p>Your order <strong>${order.order_number}</strong> has been cancelled.</p>
      <p>If you have any questions, please contact our support team.</p>
      <p>Thank you for your understanding.</p>
    </div>
  `
}
