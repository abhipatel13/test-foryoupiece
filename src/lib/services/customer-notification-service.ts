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

function isTelegramSyntheticEmail(email?: string | null): boolean {
  if (!email) return false
  return /@telegram\.foryoupiece\.local$/i.test(email) || /^tg_\d+@/i.test(email)
}


// --- Telegram DM helpers ---
function escapeHtml(s: string): string {
  if (!s) return ''
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
}

function formatItems(items: any[], maxLines: number = 10): string {
  if (!Array.isArray(items) || items.length === 0) return '—'
  const lines: string[] = []
  for (let i = 0; i < items.length && lines.length < maxLines; i++) {
    const it = items[i]
    const title = escapeHtml(it?.title || 'Item')
    const qty = Number(it?.quantity || 0)
    const price = Number(it?.price || 0)
    const total = Number(it?.total || qty * price)
    lines.push(`• ${title} ×${qty} — $${price.toFixed(2)} (=$${total.toFixed(2)})`)
  }
  if (items.length > maxLines) lines.push(`…and ${items.length - maxLines} more item(s)`)
  return lines.join('\n')
}

function trimAddress(addr: string, maxLen: number = 200): string {
  if (!addr) return ''
  const a = addr.trim()
  return a.length <= maxLen ? a : a.slice(0, maxLen - 1) + '…'
}

function limitMessage(text: string, maxLen: number = 3900): string {
  if (!text) return ''
  return text.length <= maxLen ? text : text.slice(0, maxLen - 1) + '…'
}

type TelegramDMResult = {
  success: boolean
  error?: string
  debug?: {
    bot_id?: string
    bot_username?: string
    chat_verified?: boolean
    telegram_api_desc?: string
    chat_id?: number
  }
}

async function trySendTelegramDM(userTelegramId: number | null | undefined, text: string): Promise<TelegramDMResult>{
  // Prefer the Authentication bot for customer DMs since users have already started a chat with it
  const botToken = process.env.TELEGRAM_AUTH_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  const overrideRaw = process.env.NODE_ENV !== 'production' ? process.env.DEV_TELEGRAM_OVERRIDE_CHAT_ID : undefined

  // Validate override chat id (must be a numeric Telegram chat id)
  let overrideChatId: number | undefined
  if (overrideRaw) {
    const n = Number(overrideRaw)
    if (!Number.isFinite(n)) {
      return { success: false, error: 'DEV_TELEGRAM_OVERRIDE_CHAT_ID must be a numeric Telegram chat id' }
    }
    overrideChatId = n
  }

  const chatId = overrideChatId ?? (userTelegramId as any)
  if (!botToken || !chatId) {
    return { success: false, error: 'Missing bot token or telegram chat id', debug: { chat_id: chatId } }
  }
  try {
    // Identify bot
    let bot_id: string | undefined
    let bot_username: string | undefined
    try {
      const meResp = await fetch(`${TELEGRAM_API_BASE}${botToken}/getMe`)
      const meJson = await meResp.json().catch(() => null)
      if (meJson?.ok) { bot_id = String(meJson.result.id); bot_username = meJson.result.username }
    } catch {}

    // Verify chat existence (best-effort; avoid failing if endpoint errors)
    let chat_verified: boolean | undefined
    let chat_desc: string | undefined
    try {
      const chatResp = await fetch(`${TELEGRAM_API_BASE}${botToken}/getChat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: Number(chatId) })
      })
      const chatJson = await chatResp.json().catch(() => null)
      chat_verified = !!chatJson?.ok
      if (!chat_verified) chat_desc = chatJson?.description
    } catch (e: any) {
      chat_verified = undefined
      chat_desc = e?.message
    }

    const url = `${TELEGRAM_API_BASE}${botToken}/sendMessage`
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
    if (!resp.ok) {
      // Include Telegram error JSON/text for easier debugging
      let errText = ''
      try { errText = await resp.text() } catch {}
      return { success: false, error: errText || `HTTP ${resp.status}` , debug: { bot_id, bot_username, chat_verified, telegram_api_desc: errText, chat_id: Number(chatId) } }
    }
    return { success: true, debug: { bot_id, bot_username, chat_verified, chat_id: Number(chatId) } }
  } catch (e: any) {
    return { success: false, error: e?.message || 'Unknown telegram error', debug: { chat_id: Number(chatId) } }
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

async function logDelivery(orderId: string, recipient: string, subject: string, typeKey: string, channel: 'email'|'telegram', error_message?: string, extraMetadata?: Record<string, any>) {
  const supabase = createServiceRoleClient()
  await supabase.from('email_logs').insert({
    recipient,
    subject,
    email_type: typeKey,
    status: error_message ? 'failed' : 'sent',
    error_message: error_message || null,
    metadata: { order_id: orderId, channel, ...(extraMetadata || {}) },
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

    // Determine if we should skip email for Telegram-authenticated users
    const isTelegramUser = !!user.telegram_id || isTelegramSyntheticEmail(order.email)

    if (isTelegramUser) {
      console.log('✳️ Skipping email for Telegram-authenticated user; will use Telegram DM only')
      await logDelivery(
        orderId,
        order.email,
        `Thank you for your purchase! Order ${order.order_number}`,
        'order_confirmation',
        'email',
        undefined,
        { skipped_reason: 'skipped_telegram_user' }
      )
    } else {
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
    }

    // Telegram (best-effort)
    const telegramId = user.telegram_id
    if (telegramId) {
      if (!(await alreadySent(orderId, 'order_confirmation', 'telegram'))) {
        const itemsBlock = formatItems(order.order_items || [], 10)
        const addr = trimAddress(shippingAddressStr)
        const msg = limitMessage([
          `Thank you for your purchase!`,
          `Order: <b>${order.order_number}</b>`,
          `Total: <b>$${Number(order.total_amount || 0).toFixed(2)}</b>`,
          `\n<b>Items</b>`,
          itemsBlock,
          addr ? `\n<b>Ship to</b>\n${escapeHtml(addr)}` : '',
          `\nPayment: ${getPaymentLink()}`,
        ].filter(Boolean).join('\n'))
        const sent = await trySendTelegramDM(telegramId, msg)
        const meta = { bot_id: sent.debug?.bot_id, bot_username: sent.debug?.bot_username, chat_verified: sent.debug?.chat_verified, telegram_api_desc: sent.debug?.telegram_api_desc }
        if (sent.success) {
          await logDelivery(orderId, `telegram:${telegramId}`, `Order ${order.order_number} confirmation`, 'order_confirmation', 'telegram', undefined, meta)
        } else {
          await logDelivery(orderId, `telegram:${telegramId}`, `Order ${order.order_number} confirmation`, 'order_confirmation', 'telegram', sent.error, meta)
          console.warn('⚠️ Telegram DM failed for order confirmation:', sent.error, meta)
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
        const isTelegramUser = !!user.telegram_id || isTelegramSyntheticEmail(order.email)
        if (isTelegramUser) {
          console.log('✳️ Skipping shipped email for Telegram user')
          await logDelivery(orderId, order.email, `Your order is on the way! (${order.order_number})`, 'status_shipped', 'email', undefined, { skipped_reason: 'skipped_telegram_user' })
        } else {
          const emailResult = await sendEmailViaSupabase({ to: order.email, subject: `Your order is on the way! (${order.order_number})`, html: emailHtml, emailType: 'status_shipped', metadata: { order_id: orderId, channel: 'email' } })
          await logDelivery(orderId, order.email, `Your order is on the way! (${order.order_number})`, 'status_shipped', 'email', emailResult.success ? undefined : emailResult.error)
        }
      }

      const telegramId = user.telegram_id
      if (telegramId && !(await alreadySent(orderId, 'status_shipped', 'telegram'))) {
        const itemsBlock = formatItems(order.order_items || [], 10)
        const addr = trimAddress(formatShippingAddress(order.shipping_address))
        const line = order.tracking_number ? `Tracking: <b>${order.tracking_number}</b>` : 'Tracking will be provided soon.'
        const msg = limitMessage([
          `Your order is on the way!`,
          `Order: <b>${order.order_number}</b>`,
          `${line}`,
          `\n<b>Items</b>`,
          itemsBlock,
          addr ? `\n<b>Ship to</b>\n${escapeHtml(addr)}` : '',
        ].filter(Boolean).join('\n'))
        const sent = await trySendTelegramDM(telegramId, msg)
        const meta = { bot_id: sent.debug?.bot_id, bot_username: sent.debug?.bot_username, chat_verified: sent.debug?.chat_verified, telegram_api_desc: sent.debug?.telegram_api_desc }
        if (sent.success) await logDelivery(orderId, `telegram:${telegramId}`, `Order ${order.order_number} shipped`, 'status_shipped', 'telegram', undefined, meta)
        else await logDelivery(orderId, `telegram:${telegramId}`, `Order ${order.order_number} shipped`, 'status_shipped', 'telegram', sent.error, meta)
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
        const isTelegramUser = !!user.telegram_id || isTelegramSyntheticEmail(order.email)
        if (isTelegramUser) {
          console.log('✳️ Skipping cancelled email for Telegram user')
          await logDelivery(orderId, order.email, `Order Cancelled (${order.order_number})`, 'status_cancelled', 'email', undefined, { skipped_reason: 'skipped_telegram_user' })
        } else {
          const emailResult = await sendEmailViaSupabase({ to: order.email, subject: `Order Cancelled (${order.order_number})`, html: emailHtml, emailType: 'status_cancelled', metadata: { order_id: orderId, channel: 'email' } })
          await logDelivery(orderId, order.email, `Order Cancelled (${order.order_number})`, 'status_cancelled', 'email', emailResult.success ? undefined : emailResult.error)
        }
      }

      const telegramId = user.telegram_id
      if (telegramId && !(await alreadySent(orderId, 'status_cancelled', 'telegram'))) {
        const reason = order.cancelled_reason && order.cancelled_reason.trim().length > 0
          ? order.cancelled_reason
          : 'Payment not received / Out of stock / Customer request.'
        const itemsBlock = formatItems(order.order_items || [], 10)
        const addr = trimAddress(formatShippingAddress(order.shipping_address))
        const msg = limitMessage([
          `Your order has been cancelled.`,
          `Order: <b>${order.order_number}</b>`,
          `Reason: ${escapeHtml(reason)}`,
          `\n<b>Items</b>`,
          itemsBlock,
          addr ? `\n<b>Ship to</b>\n${escapeHtml(addr)}` : '',
        ].filter(Boolean).join('\n'))
        const sent = await trySendTelegramDM(telegramId, msg)
        const meta = { bot_id: sent.debug?.bot_id, bot_username: sent.debug?.bot_username, chat_verified: sent.debug?.chat_verified, telegram_api_desc: sent.debug?.telegram_api_desc }
        if (sent.success) await logDelivery(orderId, `telegram:${telegramId}`, `Order ${order.order_number} cancelled`, 'status_cancelled', 'telegram', undefined, meta)
        else await logDelivery(orderId, `telegram:${telegramId}`, `Order ${order.order_number} cancelled`, 'status_cancelled', 'telegram', sent.error, meta)
      }
    }

    if (event === 'delivered') {
      if (!(await alreadySent(orderId, 'status_delivered', 'email'))) {
        const isTelegramUser = !!user.telegram_id || isTelegramSyntheticEmail(order.email)
        if (isTelegramUser) {
          console.log('✳️ Skipping delivered email for Telegram user')
          await logDelivery(orderId, order.email, `Delivered: Order ${order.order_number}`, 'status_delivered', 'email', undefined, { skipped_reason: 'skipped_telegram_user' })
        } else {
          const emailResult = await sendEmailViaSupabase({ to: order.email, subject: `Delivered: Order ${order.order_number}`, html: `<p>Your order ${order.order_number} was delivered. Thank you!</p>`, emailType: 'status_delivered', metadata: { order_id: orderId, channel: 'email' } })
          await logDelivery(orderId, order.email, `Delivered: Order ${order.order_number}`, 'status_delivered', 'email', emailResult.success ? undefined : emailResult.error)
        }
      }
      const telegramId = user.telegram_id
      if (telegramId && !(await alreadySent(orderId, 'status_delivered', 'telegram'))) {
        const itemsBlock = formatItems(order.order_items || [], 8)
        const msg = limitMessage([
          `Delivered: <b>${order.order_number}</b>`,
          `\n<b>Items</b>`,
          itemsBlock,
          `\nThank you for shopping with us!`
        ].join('\n'))
        const sent = await trySendTelegramDM(telegramId, msg)
        const meta = { bot_id: sent.debug?.bot_id, bot_username: sent.debug?.bot_username, chat_verified: sent.debug?.chat_verified, telegram_api_desc: sent.debug?.telegram_api_desc }
        if (sent.success) await logDelivery(orderId, `telegram:${telegramId}`, `Order ${order.order_number} delivered`, 'status_delivered', 'telegram', undefined, meta)
        else await logDelivery(orderId, `telegram:${telegramId}`, `Order ${order.order_number} delivered`, 'status_delivered', 'telegram', sent.error, meta)
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

