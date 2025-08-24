import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * Simple email queue processor for testing the new transactional outbox system
 * This processes pending emails from the email_outbox table
 */

function isTelegramSyntheticEmail(email?: string | null): boolean {
  if (!email) return false
  return /@telegram\.foryoupiece\.local$/i.test(email) || /^tg_\d+@/i.test(email)
}

interface PendingEmail {
  outbox_id: string
  order_id: string
  email_type: string
  payload: any
  attempts: number
}

interface OrderData {
  id: string
  order_number: string
  email: string
  total_amount: number
  created_at: string
  users: {
    first_name?: string
    last_name?: string
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

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Processing email queue...')

    const supabase = createServiceRoleClient()

    // Get pending emails
    const { data: pendingEmails, error: pendingError } = await supabase
      .rpc('get_pending_emails', { p_limit: 10 })

    if (pendingError) {
      throw new Error(`Failed to get pending emails: ${pendingError.message}`)
    }

    console.log(`📊 Found ${pendingEmails?.length || 0} pending emails`)

    if (!pendingEmails || pendingEmails.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending emails to process',
        processed: 0,
        timestamp: new Date().toISOString()
      })
    }

    let processedCount = 0
    const results = []

    // Process each email
    for (const email of pendingEmails as PendingEmail[]) {
      try {
        console.log(`📧 Processing email: ${email.email_type} for order ${email.order_id}`)

        // Mark as processing
        const { error: markError } = await supabase.rpc('mark_email_processing', {
          p_outbox_id: email.outbox_id
        })

        if (markError) {
          throw new Error(`Failed to mark as processing: ${markError.message}`)
        }

        // Idempotency guard: if an email for this order/type is already sent, skip sending
        const { data: dupCheck } = await supabase
          .from('email_logs')
          .select('id')
          .eq('email_type', email.email_type)
          .eq('status', 'sent')
          .contains('metadata', { order_id: email.order_id, channel: 'email' })
          .limit(1)

        if (dupCheck && dupCheck.length > 0) {
          await supabase.rpc('mark_email_sent', { p_outbox_id: email.outbox_id, p_provider_id: 'skipped_duplicate' })
          results.push({ outbox_id: email.outbox_id, order_id: email.order_id, status: 'skipped_duplicate' })
          continue
        }

        // Load order data
        const orderData = await loadOrderData(supabase, email.order_id)

        // Skip sending emails for Telegram-authenticated users
        const isTelegramUser = !!orderData?.users?.telegram_id || isTelegramSyntheticEmail(orderData?.email)
        if (isTelegramUser) {
          console.log('✳️ Skipping queued email for Telegram user')
          await logEmailDelivery(supabase, {
            outbox_id: email.outbox_id,
            order_id: email.order_id,
            recipient: orderData.email,
            subject: `Skipped: ${email.email_type}`,
            email_type: email.email_type,
            provider_id: 'skipped_telegram_user',
            status: 'sent',
            error_message: null
          })
          await supabase.rpc('mark_email_sent', { p_outbox_id: email.outbox_id, p_provider_id: 'skipped_telegram_user' })
          results.push({ outbox_id: email.outbox_id, order_id: email.order_id, status: 'skipped_telegram_user' })
          continue
        }

        // Generate email content
        const emailContent = generateEmailContent(email.email_type, orderData)

        // Send email via Resend
        const emailResult = await sendEmailViaResend(emailContent)

        // Log the email attempt
        await logEmailDelivery(supabase, {
          outbox_id: email.outbox_id,
          order_id: email.order_id,
          recipient: emailContent.to,
          subject: emailContent.subject,
          email_type: email.email_type,
          provider_id: emailResult.id,
          status: emailResult.success ? 'sent' : 'failed',
          error_message: emailResult.error
        })

        // Mark as sent or failed
        if (emailResult.success) {
          await supabase.rpc('mark_email_sent', {
            p_outbox_id: email.outbox_id,
            p_provider_id: emailResult.id
          })
          console.log(`✅ Email sent successfully: ${emailResult.id}`)
          processedCount++
          results.push({
            outbox_id: email.outbox_id,
            order_id: email.order_id,
            status: 'sent',
            provider_id: emailResult.id
          })
        } else {
          await supabase.rpc('mark_email_failed', {
            p_outbox_id: email.outbox_id,
            p_error_message: emailResult.error || 'Unknown error'
          })
          results.push({
            outbox_id: email.outbox_id,
            order_id: email.order_id,
            status: 'failed',
            error: emailResult.error
          })
          console.error(`❌ Email failed: ${emailResult.error}`)
        }

      } catch (error: any) {
        console.error(`❌ Failed to process email ${email.outbox_id}:`, error)
        
        // Mark as failed
        await supabase.rpc('mark_email_failed', {
          p_outbox_id: email.outbox_id,
          p_error_message: error.message
        })

        results.push({
          outbox_id: email.outbox_id,
          order_id: email.order_id,
          status: 'failed',
          error: error.message
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${processedCount} emails successfully`,
      processed: processedCount,
      total_pending: pendingEmails.length,
      results,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('❌ Email queue processing failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Email queue processing failed',
        details: error.message 
      },
      { status: 500 }
    )
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

function generateEmailContent(emailType: string, order: OrderData) {
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
    
    default:
      throw new Error(`Unknown email type: ${emailType}`)
  }
}

async function sendEmailViaResend(emailContent: any) {
  const resendApiKey = process.env.RESEND_API_KEY
  
  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY not configured')
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
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

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Email queue processor is active',
    usage: {
      method: 'POST',
      description: 'Process pending emails from the email_outbox table'
    },
    timestamp: new Date().toISOString()
  })
}
