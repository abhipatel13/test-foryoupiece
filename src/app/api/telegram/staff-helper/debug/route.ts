import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest) {
  try {
    const token = (
      process.env.TELEGRAM_STAFF_HELPER_BOT_TOKEN ||
      process.env.TELEGRAM_QUERIESBOT_TOKEN ||
      process.env.TELEGRAM_QUERIES_BOT_TOKEN ||
      process.env.TELEGRAM_BOT_TOKEN ||
      ''
    ).trim()

    if (!token) {
      return NextResponse.json({ ok: false, error: 'Missing bot token' }, { status: 500 })
    }

    async function safeGet(path: string) {
      const url = `https://api.telegram.org/bot${token}${path}`
      const res = await fetch(url)
      const data = await res.json().catch(() => ({}))
      return data
    }

    const getMe = await safeGet('/getMe')
    const webhookInfo = await safeGet('/getWebhookInfo')

    const summary = {
      getMe: getMe?.ok ? {
        ok: true,
        id: String(getMe.result.id),
        username: getMe.result.username,
        can_join_groups: !!getMe.result.can_join_groups,
        can_read_all_group_messages: !!getMe.result.can_read_all_group_messages,
      } : { ok: false, error: getMe?.description || 'getMe failed' },
      webhook: webhookInfo?.ok ? {
        ok: true,
        url: webhookInfo.result.url,
        pending_update_count: webhookInfo.result.pending_update_count,
        last_error_date: webhookInfo.result.last_error_date,
        last_error_message: webhookInfo.result.last_error_message,
        max_connections: webhookInfo.result.max_connections,
        ip_address: webhookInfo.result.ip_address,
      } : { ok: false, error: webhookInfo?.description || 'getWebhookInfo failed' }
    }

    return NextResponse.json({ ok: true, summary, ts: new Date().toISOString() })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'unknown' }, { status: 500 })
  }
}

