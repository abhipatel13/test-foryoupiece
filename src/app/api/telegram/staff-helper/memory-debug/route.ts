import { NextRequest, NextResponse } from 'next/server'
import { validateWebhook } from '@/lib/telegram/staff-helper'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

const MEM_TABLE = 'telegram_thread_memory'

export async function POST(request: NextRequest) {
  const bodyText = await request.text()
  if (!validateWebhook(request.headers, bodyText)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = bodyText ? JSON.parse(bodyText) : {}
    const thread_key: string | undefined = body.thread_key || (body.chat_id && body.thread_id ? `${body.chat_id}:${body.thread_id}` : undefined)
    if (!thread_key) return NextResponse.json({ ok: true, data: null })

    const client = createServiceRoleClient() as any
    const { data, error } = await client
      .from(MEM_TABLE)
      .select('*')
      .eq('thread_key', thread_key)
      .single()
    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ ok: false, error: error.message }, { status: 200 })
    }
    return NextResponse.json({ ok: true, data })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'unknown' }, { status: 200 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'memory-debug-active' })
}

