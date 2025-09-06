import { NextRequest, NextResponse } from 'next/server'
import { handleStaffHelperUpdate, validateWebhook } from '@/lib/telegram/staff-helper'

/**
 * Staff Helper Telegram Webhook
 * POST /api/telegram/staff-helper
 * - Only handles messages from two specific group threads
 * - Ignores DMs and unrelated threads
 * - Uses TELEGRAM_WEBHOOK_SECRET to validate incoming requests (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const bodyText = await request.text()

    if (!validateWebhook(request.headers, bodyText)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = JSON.parse(bodyText)

    const result = await handleStaffHelperUpdate({ body, requestUrl: request.url })

    return NextResponse.json({ ok: true, handled: result.handled, reason: result.reason })
  } catch (e: any) {
    console.error('Staff helper webhook error', { message: e?.message })
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}

/**
 * Lightweight health check (no secrets exposed)
 */
export async function GET(_request: NextRequest) {
  return NextResponse.json({ status: 'active', ts: new Date().toISOString() })
}

