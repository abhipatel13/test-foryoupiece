import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

function getBotToken(): string | null {
  const token = (
    process.env.TELEGRAM_STAFF_HELPER_BOT_TOKEN ||
    process.env.TELEGRAM_QUERIESBOT_TOKEN ||
    process.env.TELEGRAM_QUERIES_BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN ||
    ''
  ).trim()
  return token || null
}

function getWebhookSecret(): string | null {
  const s = (process.env.TELEGRAM_WEBHOOK_SECRET || 'foryoupiece-webhook-secret').trim()
  return s || null
}

async function tgGet(path: string) {
  const token = getBotToken()
  if (!token) return { ok: false, error: 'Missing bot token' }
  const res = await fetch(`https://api.telegram.org/bot${token}${path}`)
  const data = await res.json().catch(() => ({}))
  return data
}

async function tgPost(path: string, body: any) {
  const token = getBotToken()
  if (!token) return { ok: false, error: 'Missing bot token' }
  const res = await fetch(`https://api.telegram.org/bot${token}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const data = await res.json().catch(() => ({}))
  return data
}

function authorized(req: NextRequest) {
  const provided = (req.headers.get('x-telegram-bot-api-secret-token') || '').trim()
  const secret = getWebhookSecret()
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
    const info = await tgGet('/getWebhookInfo')
    return NextResponse.json({ ok: true, info })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'unknown' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const url = new URL(request.url)
    const op = (url.searchParams.get('op') || 'set').toLowerCase()

    if (op === 'delete') {
      const res = await tgGet('/deleteWebhook')
      return NextResponse.json({ ok: true, result: res })
    }

    if (op === 'get') {
      const info = await tgGet('/getWebhookInfo')
      return NextResponse.json({ ok: true, info })
    }

    // op === 'set'
    const body = await request.json().catch(() => ({}))
    let webhookUrl: string | null = (body?.url || '').trim() || null
    if (!webhookUrl) {
      // default to the current origin
      const origin = url.origin
      webhookUrl = `${origin}/api/telegram/staff-helper`
    }

    const secret = getWebhookSecret()
    if (!secret) return NextResponse.json({ ok: false, error: 'Missing webhook secret env' }, { status: 500 })

    const setRes = await tgPost('/setWebhook', {
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ['message', 'edited_message'],
      drop_pending_updates: false
    })

    return NextResponse.json({ ok: true, result: setRes })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'unknown' }, { status: 500 })
  }
}

