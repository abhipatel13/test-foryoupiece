import { NextRequest, NextResponse } from 'next/server'
import { sendTelegramMessage } from '@/lib/telegram/staff-helper'

export const runtime = 'nodejs'

function getIds() {
  const ADMIN_GROUP_ID = (
    process.env.STAFF_HELPER_ADMIN_GROUP_ID ||
    process.env.ADMIN_GROUP_ID ||
    ''
  ).trim()
  const ADMIN_THREAD_ID = (
    process.env.STAFF_HELPER_ADMIN_THREAD_ID ||
    process.env.ADMIN_THREAD_ID ||
    '1519'
  ).trim()
  const TEAM_GROUP_ID = (
    process.env.STAFF_HELPER_TEAM_GROUP_ID ||
    process.env.TEAM_GROUP_ID ||
    ''
  ).trim()
  const TEAM_THREAD_ID = (
    process.env.STAFF_HELPER_TEAM_THREAD_ID ||
    process.env.TEAM_THREAD_ID ||
    '1521'
  ).trim()
  return { ADMIN_GROUP_ID, ADMIN_THREAD_ID, TEAM_GROUP_ID, TEAM_THREAD_ID }
}

function authorized(req: NextRequest) {
  const provided = (req.headers.get('x-telegram-bot-api-secret-token') || '').trim()
  const secret = (process.env.TELEGRAM_WEBHOOK_SECRET || 'foryoupiece-webhook-secret').trim()
  const isProd = process.env.NODE_ENV === 'production'
  const devAlt = process.env.DEV_TELEGRAM_WEBHOOK_SECRET || 'foryoupiece-secure-webhook-2025'
  const ok = (!!secret && provided === secret) || (!isProd && provided === devAlt)
  return ok
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { target = 'admin', text = 'Staff Helper ping' } = await request.json().catch(() => ({}))
    const ids = getIds()

    const toAdmin = String(target).toLowerCase() !== 'team'
    const chatId = toAdmin ? ids.ADMIN_GROUP_ID : ids.TEAM_GROUP_ID
    const threadId = Number(toAdmin ? ids.ADMIN_THREAD_ID : ids.TEAM_THREAD_ID)

    if (!chatId) return NextResponse.json({ ok: false, error: 'Missing group id envs' }, { status: 500 })

    const res = await sendTelegramMessage({ chat_id: chatId, message_thread_id: threadId, text })
    return NextResponse.json({ ok: res.ok, result: res })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'unknown' }, { status: 500 })
  }
}

