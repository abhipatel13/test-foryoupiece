import { NextRequest, NextResponse } from 'next/server'
import { getRecentUpdateLogs } from '@/lib/telegram/staff-helper'

export const runtime = 'nodejs'

function authorized(req: NextRequest) {
  const provided = (req.headers.get('x-telegram-bot-api-secret-token') || '').trim()
  const secret = (process.env.TELEGRAM_WEBHOOK_SECRET || 'foryoupiece-webhook-secret').trim()
  const isProd = process.env.NODE_ENV === 'production'
  const devAlt = process.env.DEV_TELEGRAM_WEBHOOK_SECRET || 'foryoupiece-secure-webhook-2025'
  const ok = (!!secret && provided === secret) || (!isProd && provided === devAlt)
  return ok
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.max(1, Math.min(50, Number(searchParams.get('limit') || 20)))
    const logs = getRecentUpdateLogs(limit)
      .slice() // copy
      .reverse() // newest first
      .map(l => ({
        ts: l.ts,
        chatId: l.chatId,
        threadId: l.threadId,
        intent: l.intent,
        allowed: l.allowed,
        reason: l.reason,
        replyPreview: l.replyPreview,
      }))

    return NextResponse.json({ ok: true, data: { logs } })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'unknown' }, { status: 500 })
  }
}

