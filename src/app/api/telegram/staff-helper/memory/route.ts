import { NextRequest, NextResponse } from 'next/server'
import { getThreadMemoryByKey } from '@/lib/telegram/staff-helper'

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
    const threadKey = (searchParams.get('threadKey') || '').trim()
    if (!threadKey) {
      return NextResponse.json({ ok: false, error: 'Missing threadKey' }, { status: 400 })
    }

    const turns = await getThreadMemoryByKey(threadKey)
    const safeTurns = (turns || []).slice(-10).map(t => ({ role: t.role, text: String(t.text || '').slice(0, 300), at: t.at }))

    return NextResponse.json({ ok: true, data: { threadKey, turns: safeTurns } })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'unknown' }, { status: 500 })
  }
}

