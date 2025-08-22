import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth/admin-middleware'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * Admin API: Send direct Telegram message to a user
 * POST /api/admin/telegram/send-direct
 * Body: { userId?: string, email?: string, telegramUsername?: string, message: string }
 */
export const POST = withAdminAuth(async (request: NextRequest, { user: authUser, adminUser }) => {
  try {
    const body = await request.json().catch(() => ({}))
    const { userId, email, telegramUsername, message } = body as {
      userId?: string
      email?: string
      telegramUsername?: string
      message?: string
    }

    if (!message || !message.trim()) {
      return NextResponse.json({ success: false, error: 'Message content is required' }, { status: 400 })
    }

    if (!userId && !email && !telegramUsername) {
      return NextResponse.json({ success: false, error: 'Provide userId, email, or telegramUsername' }, { status: 400 })
    }

    const serviceClient = createServiceRoleClient()
    if (!serviceClient) {
      return NextResponse.json({ success: false, error: 'Service configuration error' }, { status: 500 })
    }

    // Resolve target user
    let targetUser: any | null = null
    if (userId) {
      const { data } = await serviceClient
        .from('users')
        .select('id, email, telegram_id, telegram_username, first_name, last_name')
        .eq('id', userId)
        .maybeSingle()
      targetUser = data
    } else if (email) {
      const { data } = await serviceClient
        .from('users')
        .select('id, email, telegram_id, telegram_username, first_name, last_name')
        .eq('email', email)
        .maybeSingle()
      targetUser = data
    } else if (telegramUsername) {
      const normalized = telegramUsername.replace(/^@/, '')
      const { data } = await serviceClient
        .from('users')
        .select('id, email, telegram_id, telegram_username, first_name, last_name')
        .eq('telegram_username', normalized)
        .maybeSingle()
      targetUser = data
    }

    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    if (!targetUser.telegram_id) {
      return NextResponse.json({ success: false, error: 'User is not connected to Telegram' }, { status: 400 })
    }

    // Use the Authentication bot for direct customer DM (must have prior user chat)
    const botToken = process.env.TELEGRAM_AUTH_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      return NextResponse.json({ success: false, error: 'Authentication Telegram bot is not configured' }, { status: 500 })
    }

    // Verify chat exists and user has initiated chat with the bot
    const getMeResp = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
    const getMeJson = await getMeResp.json().catch(() => null)
    const botInfo = getMeJson?.ok ? { id: getMeJson.result.id, username: getMeJson.result.username } : null

    const getChatResp = await fetch(`https://api.telegram.org/bot${botToken}/getChat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: Number(targetUser.telegram_id) })
    })
    const getChatJson = await getChatResp.json().catch(() => null)
    const chatVerified = !!getChatJson?.ok

    if (!chatVerified) {
      // Provide a helpful message and a deep link the admin can share to prompt the user
      const botUsername = botInfo?.username || 'Authenticationfypbot'
      const deepLink = `https://t.me/${botUsername}?start=start`

      const { error: undeliverableErr } = await serviceClient.from('notifications').insert({
        user_id: targetUser.id,
        title: 'Telegram DM not deliverable',
        message: 'User must start a chat with the authentication bot before receiving direct messages.',
        type: 'warning',
        metadata: {
          channel: 'telegram',
          status: 'undeliverable',
          direction: 'outgoing',
          telegram_username: targetUser.telegram_username || null,
          telegram_id: targetUser.telegram_id,
          error: getChatJson?.description || 'Chat not found',
          bot_username: botUsername,
          bot_id: botInfo?.id || null,
          sent_by: adminUser?.email || authUser?.email || 'admin',
        }
      })
      if (undeliverableErr) {
        console.error('❌ Failed to persist undeliverable notification:', undeliverableErr)
      }

      return NextResponse.json({
        success: false,
        error: 'User must start a chat with the authentication bot first',
        suggestion: {
          action: 'Ask the customer to open the link and press Start',
          deepLink
        }
      }, { status: 409 })
    }

    // Compose final text (keep simple; admins control content)
    const text = message.trim()

    // Send message via Telegram Bot API
    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`

    const tgResponse = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: Number(targetUser.telegram_id),
        text,
        parse_mode: 'HTML'
      })
    })

    const tgResult = await tgResponse.json()

    if (!tgResult?.ok) {
      // Log failed attempt into notifications with metadata
      const { error: failInsertErr } = await serviceClient.from('notifications').insert({
        user_id: targetUser.id,
        title: 'Telegram message delivery failed',
        message: text.substring(0, 500),
        type: 'error',
        metadata: {
          channel: 'telegram',
          status: 'failed',
          direction: 'outgoing',
          telegram_username: targetUser.telegram_username || null,
          telegram_id: targetUser.telegram_id,
          error: tgResult?.description || 'Unknown error',
          bot_username: botInfo?.username || null,
          bot_id: botInfo?.id || null,
          sent_by: adminUser?.email || authUser?.email || 'admin',
        }
      })
      if (failInsertErr) {
        console.error('❌ Failed to persist failed message notification:', failInsertErr)
      }

      return NextResponse.json({
        success: false,
        error: tgResult?.description || 'Failed to send Telegram message'
      }, { status: 502 })
    }

    // Store success notification for simple history
    const { error: sentInsertErr } = await serviceClient.from('notifications').insert({
      user_id: targetUser.id,
      title: 'Message from ForYouPiece',
      message: text.substring(0, 1000),
      type: 'info',
      metadata: {
        channel: 'telegram',
        status: 'sent',
        direction: 'outgoing',
        telegram_username: targetUser.telegram_username || null,
        telegram_id: targetUser.telegram_id,
        telegram_message_id: tgResult?.result?.message_id,
        bot_username: botInfo?.username || null,
        bot_id: botInfo?.id || null,
        chat_verified: true,
        sent_by: adminUser?.email || authUser?.email || 'admin',
      }
    })
    if (sentInsertErr) {
      console.error('❌ Failed to persist sent message notification:', sentInsertErr)
    }

    return NextResponse.json({
      success: true,
      result: {
        telegram_message_id: tgResult?.result?.message_id,
        chatVerified: true,
        bot: botInfo,
        user: {
          id: targetUser.id,
          email: targetUser.email,
          telegram_username: targetUser.telegram_username,
          telegram_id: targetUser.telegram_id,
        }
      }
    })
  } catch (error) {
    console.error('❌ Error sending direct Telegram message:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
})

