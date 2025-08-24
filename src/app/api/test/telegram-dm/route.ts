import { NextRequest, NextResponse } from 'next/server'

/**
 * Test endpoint to verify Telegram DM sending via override chat ID
 * GET /api/test/telegram-dm?text=Hello
 * Requires: ENABLE_TEST_APIS=true and DEV_TELEGRAM_OVERRIDE_CHAT_ID=<numeric chat id>
 */
export async function GET(request: NextRequest) {
  try {
    if (process.env.ENABLE_TEST_APIS !== 'true') {
      return NextResponse.json({ success: false, error: 'Test endpoints are disabled' }, { status: 403 })
    }

    const overrideRaw = process.env.DEV_TELEGRAM_OVERRIDE_CHAT_ID
    const botToken = process.env.TELEGRAM_AUTH_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN

    if (!botToken) {
      return NextResponse.json({ success: false, error: 'Missing TELEGRAM_AUTH_BOT_TOKEN/TELEGRAM_BOT_TOKEN' }, { status: 500 })
    }

    if (!overrideRaw) {
      return NextResponse.json({ success: false, error: 'DEV_TELEGRAM_OVERRIDE_CHAT_ID not set' }, { status: 400 })
    }

    const chatId = Number(overrideRaw)
    if (!Number.isFinite(chatId)) {
      return NextResponse.json({ success: false, error: 'DEV_TELEGRAM_OVERRIDE_CHAT_ID must be a numeric Telegram chat id' }, { status: 400 })
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`
    const { searchParams } = new URL(request.url)
    const textParam = searchParams.get('text') || 'Test message from /api/test/telegram-dm'
    const text = `${textParam} • ${new Date().toISOString()}`

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    })

    const data = await resp.json().catch(() => null)

    if (!resp.ok || !data?.ok) {
      return NextResponse.json({ success: false, status: resp.status, telegram: data }, { status: 502 })
    }

    return NextResponse.json({ success: true, telegram: { ok: data.ok, message_id: data.result?.message_id } })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Unknown error' }, { status: 500 })
  }
}

