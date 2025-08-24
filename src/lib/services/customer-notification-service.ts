import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { renderOrderConfirmationEmailHtml } from '@/templates/email/order-confirmation'
import { renderOrderShippedEmailHtml } from '@/templates/email/order-shipped'
import { renderOrderCancelledEmailHtml } from '@/templates/email/order-cancelled'

// Customer Telegram via direct message using the same bot token
const TELEGRAM_API_BASE = 'https://api.telegram.org/bot'

type StatusEvent = 'shipped' | 'delivered' | 'cancelled'

type OrderWithRelations = any

/**
 * Send email via Supabase Edge Function with fallback to direct Resend
 * This uses the same email configuration as Supabase auth emails
 */
export async function sendEmailViaSupabase(params: {
  to: string | string[]
  subject: string
  html: string
  text?: string
  emailType?: string
  metadata?: Record<string, any>
}): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    console.log('📧 Attempting to send email via Supabase Edge Function...')
    const supabase = createServiceRoleClient()

    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
        emailType: params.emailType,
        metadata: params.metadata,
      }
    })

    if (error) {
      console.error('❌ Supabase email function error:', error)

      // If Edge Function fails, try fallback to direct Resend
      console.log('🔄 Attempting fallback to direct Resend API...')
      return await sendEmailViaResendFallback(params)
    }

    if (!data?.success) {
      console.error('❌ Email sending failed:', data)

      // If Edge Function returns failure, try fallback
      console.log('🔄 Attempting fallback to direct Resend API...')
      return await sendEmailViaResendFallback(params)
    }

    console.log('✅ Email sent via Supabase Edge Function:', data.id)
    return { success: true, id: data.id }
  } catch (error: any) {
    console.error('❌ Email function call error:', error)

    // If Edge Function call fails completely, try fallback
    console.log('🔄 Attempting fallback to direct Resend API...')
    return await sendEmailViaResendFallback(params)
  }
}

/**
 * Fallback email sending via direct Resend API
 */
async function sendEmailViaResendFallback(params: {
  to: string | string[]
  subject: string
  html: string
  text?: string
  emailType?: string
  metadata?: Record<string, any>
}): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const { sendEmailViaResend } = await import('@/lib/integrations/resend')

    const result = await sendEmailViaResend({
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      emailType: params.emailType,
      metadata: params.metadata,
    })

    if (result.success) {
      console.log('✅ Email sent via direct Resend fallback:', result.id)
      return { success: true, id: result.id }
    } else {
      console.error('❌ Direct Resend fallback failed:', result.error)
      return { success: false, error: result.error }
    }
  } catch (error: any) {
    console.error('❌ Resend fallback error:', error)
    return { success: false, error: error.message || 'Fallback email sending failed' }
  }
}

async function loadOrderWithRelations(orderId: string) {
  const supabase = createServiceRoleClient()
  const { data: order, error } = await supabase
    .from('orders')
    .select(`*, order_items(title, quantity, price, total), users!orders_user_id_fkey(first_name, last_name, telegram_id)`)
    .eq('id', orderId)
    .single()
  if (error) throw error
  return order as OrderWithRelations
}

function formatShippingAddress(addr: any): string {
  if (!addr) return ''
  const parts = [addr.address1 || addr.address_line_1, addr.address2 || addr.address_line_2, addr.city, addr.country, addr.postal_code].filter(Boolean)
  return parts.join(', ')
}

function getPaymentLink(): string {
  return 'https://link.payway.com.kh/ABAPAYKq337533G'
}

function getQrImageUrl(): string {
  return `${process.env.NEXT_PUBLIC_SITE_URL || ''}/93155.jpg`
}

async function trySendTelegramDM(userTelegramId: number | null | undefined, text: string): Promise<{ success: boolean; error?: string }>{
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const override = process.env.NODE_ENV !== 'production' ? process.env.DEV_TELEGRAM_OVERRIDE_CHAT_ID : undefined
  const chatId = override ? Number(override) : (userTelegramId as any)
  if (!botToken || !chatId) {
    return { success: false, error: 'Missing bot token or telegram chat id' }
  }
  try {
    const url = `${TELEGRAM_API_BASE}${botToken}/sendMessage`
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
    const ok = resp.ok
    if (!ok) {
      const t = await resp.text()
      return { success: false, error: t }
    }
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message || 'Unknown telegram error' }
  }
}

async function alreadySent(orderId: string, typeKey: string, channel: 'email'|'telegram'): Promise<boolean> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('email_logs')
    .select('id')
    .eq('email_type', typeKey)
    .eq('status', 'sent')
    .contains('metadata', { order_id: orderId, channel })
    .limit(1)
  return !!(data && data.length > 0)
}

async function logDelivery(orderId: string, recipient: string, subject: string, typeKey: string, channel: 'email'|'telegram', error_message?: string) {
  const supabase = createServiceRoleClient()
  await supabase.from('email_logs').insert({
    recipient,
    subject,
    email_type: typeKey,
    status: error_message ? 'failed' : 'sent',
    error_message: error_message || null,
    metadata: { order_id: orderId, channel },
    created_at: new Date().toISOString(),
  })
}

export class CustomerNotificationService {
  async sendOrderConfirmation(orderId: string): Promise<void> {
    console.log(`📧 Starting order confirmation for order: ${orderId}`)

    const order = await loadOrderWithRelations(orderId)
    const user = order.users || {}
    const shippingAddressStr = formatShippingAddress(order.shipping_address)
    const customerName = [user.first_name, user.last_name].filter(Boolean).join(' ') || ''

    console.log(`📧 Order confirmation details: ${order.order_number} → ${order.email}`)

    // Idempotency (email)
    if (await alreadySent(orderId, 'order_confirmation', 'email')) {
      console.log(`📧 Order confirmation already sent for order: ${orderId}`)
      return
    }

    // Email
    const emailHtml = renderOrderConfirmationEmailHtml({
      orderNumber: order.order_number,
      createdAt: order.created_at,
      email: order.email,
      customerName,
      phone: order.phone,
      shippingAddress: shippingAddressStr,
      items: (order.order_items || []).map((it: any) => ({ title: it.title, quantity: it.quantity, price: it.price, total: it.total })),
      subtotal: Number(order.subtotal || 0),
      shipping: Number(order.shipping_cost || 0),
      discount: Number(order.discount_amount || 0),
      couponDiscount: Number(order.coupon_discount_amount || 0),
      pointsUsed: Number(order.points_used || 0),
      total: Number(order.total_amount || 0),
      paymentLink: getPaymentLink(),
      qrImageUrl: getQrImageUrl(),
    })

    console.log(`📧 Attempting to send order confirmation email...`)
    const emailResult = await sendEmailViaSupabase({
      to: order.email,
      subject: `Thank you for your purchase! Order ${order.order_number}`,
      html: emailHtml,
      emailType: 'order_confirmation',
      metadata: { order_id: orderId, channel: 'email' },
    })

    console.log(`📧 Email result:`, { success: emailResult.success, error: emailResult.error })

    // Log delivery with proper success/failure status
    await logDelivery(
      orderId,
      order.email,
      `Thank you for your purchase! Order ${order.order_number}`,
      'order_confirmation',
      'email',
      emailResult.success ? undefined : emailResult.error
    )

    // If email failed, throw an error to trigger proper error handling
    if (!emailResult.success) {
      const errorMessage = `Order confirmation email failed for order ${orderId}: ${emailResult.error}`
      console.error(`❌ ${errorMessage}`)
      throw new Error(errorMessage)
    }

    console.log(`✅ Order confirmation email sent successfully for order: ${orderId}`)

    // Telegram (best-effort)
    const telegramId = user.telegram_id
    if (telegramId || process.env.DEV_TELEGRAM_OVERRIDE_CHAT_ID) {
      if (!(await alreadySent(orderId, 'order_confirmation', 'telegram'))) {
        const msg = [
          `Thank you for your purchase!`,
          `Order: <b>${order.order_number}</b>`,
          `Total: <b>$${Number(order.total_amount || 0).toFixed(2)}</b>`,
          `Payment: ${getPaymentLink()}`,
        ].join('\n')
        const sent = await trySendTelegramDM(telegramId, msg)
        if (sent.success) {
          await logDelivery(orderId, `telegram:${telegramId || process.env.DEV_TELEGRAM_OVERRIDE_CHAT_ID}`, `Order ${order.order_number} confirmation`, 'order_confirmation', 'telegram')
        } else {
          await logDelivery(orderId, `telegram:${telegramId || process.env.DEV_TELEGRAM_OVERRIDE_CHAT_ID}`, `Order ${order.order_number} confirmation`, 'order_confirmation', 'telegram', sent.error)
          console.warn('⚠️ Telegram DM failed for order confirmation:', sent.error)
        }
      }
    }
  }

  async sendOrderStatusUpdate(orderId: string, event: StatusEvent): Promise<void> {
    const order = await loadOrderWithRelations(orderId)
    const user = order.users || {}

    if (event === 'shipped') {
      const shippingAddressStr = formatShippingAddress(order.shipping_address)
      const customerName = [user.first_name, user.last_name].filter(Boolean).join(' ') || ''

      const emailHtml = renderOrderShippedEmailHtml({
        orderNumber: order.order_number,
        createdAt: order.created_at,
        email: order.email,
        customerName,
        phone: order.phone,
        shippingAddress: shippingAddressStr,
        items: (order.order_items || []).map((it: any) => ({
          title: it.title,
          quantity: it.quantity,
          price: it.price,
          total: it.total
        })),
        subtotal: Number(order.subtotal || 0),
        shipping: Number(order.shipping_cost || 0),
        discount: Number(order.discount_amount || 0),
        couponDiscount: Number(order.coupon_discount_amount || 0),
        pointsUsed: Number(order.points_used || 0),
        total: Number(order.total_amount || 0),
        trackingNumber: order.tracking_number || undefined,
        trackingUrl: order.tracking_number ? `https://track.aftership.com/${encodeURIComponent(order.tracking_number)}` : undefined,
      })

      if (!(await alreadySent(orderId, 'status_shipped', 'email'))) {
        const emailResult = await sendEmailViaSupabase({ to: order.email, subject: `Your order is on the way! (${order.order_number})`, html: emailHtml, emailType: 'status_shipped', metadata: { order_id: orderId, channel: 'email' } })
        await logDelivery(orderId, order.email, `Your order is on the way! (${order.order_number})`, 'status_shipped', 'email', emailResult.success ? undefined : emailResult.error)
      }

      const telegramId = user.telegram_id
      if ((telegramId || process.env.DEV_TELEGRAM_OVERRIDE_CHAT_ID) && !(await alreadySent(orderId, 'status_shipped', 'telegram'))) {
        const line = order.tracking_number ? `Tracking: <b>${order.tracking_number}</b>` : 'Tracking will be provided soon.'
        const msg = `Your order is on the way!\nOrder: <b>${order.order_number}</b>\n${line}`
        const sent = await trySendTelegramDM(telegramId, msg)
        if (sent.success) await logDelivery(orderId, `telegram:${telegramId || process.env.DEV_TELEGRAM_OVERRIDE_CHAT_ID}`, `Order ${order.order_number} shipped`, 'status_shipped', 'telegram')
        else await logDelivery(orderId, `telegram:${telegramId || process.env.DEV_TELEGRAM_OVERRIDE_CHAT_ID}`, `Order ${order.order_number} shipped`, 'status_shipped', 'telegram', sent.error)
      }
    }

    if (event === 'cancelled') {
      const shippingAddressStr = formatShippingAddress(order.shipping_address)
      const customerName = [user.first_name, user.last_name].filter(Boolean).join(' ') || ''

      const emailHtml = renderOrderCancelledEmailHtml({
        orderNumber: order.order_number,
        createdAt: order.created_at,
        email: order.email,
        customerName,
        phone: order.phone,
        shippingAddress: shippingAddressStr,
        items: (order.order_items || []).map((it: any) => ({
          title: it.title,
          quantity: it.quantity,
          price: it.price,
          total: it.total
        })),
        subtotal: Number(order.subtotal || 0),
        shipping: Number(order.shipping_cost || 0),
        discount: Number(order.discount_amount || 0),
        couponDiscount: Number(order.coupon_discount_amount || 0),
        pointsUsed: Number(order.points_used || 0),
        total: Number(order.total_amount || 0),
        cancelReason: order.cancelled_reason || undefined,
      })

      if (!(await alreadySent(orderId, 'status_cancelled', 'email'))) {
        const emailResult = await sendEmailViaSupabase({ to: order.email, subject: `Order Cancelled (${order.order_number})`, html: emailHtml, emailType: 'status_cancelled', metadata: { order_id: orderId, channel: 'email' } })
        await logDelivery(orderId, order.email, `Order Cancelled (${order.order_number})`, 'status_cancelled', 'email', emailResult.success ? undefined : emailResult.error)
      }

      const telegramId = user.telegram_id
      if ((telegramId || process.env.DEV_TELEGRAM_OVERRIDE_CHAT_ID) && !(await alreadySent(orderId, 'status_cancelled', 'telegram'))) {
        const reason = order.cancelled_reason && order.cancelled_reason.trim().length > 0
          ? order.cancelled_reason
          : 'Possible reasons: Payment not received, Out of stock, Customer request, Other.'
        const msg = `Your order has been cancelled.\nOrder: <b>${order.order_number}</b>\nReason: ${reason}`
        const sent = await trySendTelegramDM(telegramId, msg)
        if (sent.success) await logDelivery(orderId, `telegram:${telegramId || process.env.DEV_TELEGRAM_OVERRIDE_CHAT_ID}`, `Order ${order.order_number} cancelled`, 'status_cancelled', 'telegram')
        else await logDelivery(orderId, `telegram:${telegramId || process.env.DEV_TELEGRAM_OVERRIDE_CHAT_ID}`, `Order ${order.order_number} cancelled`, 'status_cancelled', 'telegram', sent.error)
      }
    }

    if (event === 'delivered') {
      if (!(await alreadySent(orderId, 'status_delivered', 'email'))) {
        const emailResult = await sendEmailViaSupabase({ to: order.email, subject: `Delivered: Order ${order.order_number}`, html: `<p>Your order ${order.order_number} was delivered. Thank you!</p>`, emailType: 'status_delivered', metadata: { order_id: orderId, channel: 'email' } })
        await logDelivery(orderId, order.email, `Delivered: Order ${order.order_number}`, 'status_delivered', 'email', emailResult.success ? undefined : emailResult.error)
      }
      const telegramId = user.telegram_id
      if ((telegramId || process.env.DEV_TELEGRAM_OVERRIDE_CHAT_ID) && !(await alreadySent(orderId, 'status_delivered', 'telegram'))) {
        const msg = `Delivered: <b>${order.order_number}</b>\nThank you for shopping with us!`
        const sent = await trySendTelegramDM(telegramId, msg)
        if (sent.success) await logDelivery(orderId, `telegram:${telegramId || process.env.DEV_TELEGRAM_OVERRIDE_CHAT_ID}`, `Order ${order.order_number} delivered`, 'status_delivered', 'telegram')
        else await logDelivery(orderId, `telegram:${telegramId || process.env.DEV_TELEGRAM_OVERRIDE_CHAT_ID}`, `Order ${order.order_number} delivered`, 'status_delivered', 'telegram', sent.error)
      }
    }
  }
}

export const customerNotificationService = new CustomerNotificationService()

/**
 * Wrapper function for sending customer notifications
 * This provides a unified interface for different notification types
 */
export async function sendCustomerNotification(params: {
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
}): Promise<void> {
  const { type, orderId } = params

  try {
    console.log(`📧 Sending ${type} notification for order ${orderId}`)

    switch (type) {
      case 'order_confirmation':
        await customerNotificationService.sendOrderConfirmation(orderId)
        break

      case 'order_shipped':
        await customerNotificationService.sendOrderStatusUpdate(orderId, 'shipped')
        break

      case 'order_cancelled':
        await customerNotificationService.sendOrderStatusUpdate(orderId, 'cancelled')
        break

      default:
        console.error(`❌ Unknown notification type: ${type}`)
        throw new Error(`Unknown notification type: ${type}`)
    }

    console.log(`✅ ${type} notification sent successfully for order ${orderId}`)
  } catch (error) {
    console.error(`❌ Failed to send ${type} notification for order ${orderId}:`, error)
    throw error
  }
}

