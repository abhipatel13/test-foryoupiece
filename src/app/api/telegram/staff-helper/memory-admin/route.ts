import { NextRequest, NextResponse } from 'next/server'
import { validateWebhook } from '@/lib/telegram/staff-helper'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

const MEM_TABLE = 'telegram_thread_memory'

type ActionBody = {
  action: 'reset' | 'insertMany' | 'backdate'
  chat_id?: number
  thread_id?: number
  count?: number
  minutes?: number
}

function key(chat_id?: number, thread_id?: number) {
  if (!chat_id || !thread_id) return null
  return `${chat_id}:${thread_id}`
}

export async function POST(request: NextRequest) {
  const bodyText = await request.text()
  if (!validateWebhook(request.headers, bodyText)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body: ActionBody = bodyText ? JSON.parse(bodyText) : ({} as any)
    const k = key(body.chat_id, body.thread_id)
    if (!k) return NextResponse.json({ ok: false, error: 'missing key' }, { status: 200 })

    const client = createServiceRoleClient() as any

    if (body.action === 'reset') {
      const { error } = await client.from(MEM_TABLE).delete().eq('thread_key', k)
      if (error) return NextResponse.json({ ok: false, error: error.message })
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'insertMany') {
      const count = Math.max(1, Math.min(30, body.count || 12))
      const turns = Array.from({ length: count }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        text: `dbg-${i + 1}`,
        at: Date.now()
      }))
      const { error } = await client
        .from(MEM_TABLE)
        .upsert({ thread_key: k, turns, updated_at: new Date().toISOString() }, { onConflict: 'thread_key' })
      if (error) return NextResponse.json({ ok: false, error: error.message })
      return NextResponse.json({ ok: true, count })
    }

    if (body.action === 'backdate') {
      const minutes = Math.max(1, Math.min(120, body.minutes || 6))
      const { data, error } = await client.from(MEM_TABLE).select('*').eq('thread_key', k).single()
      if (error && error.code !== 'PGRST116') return NextResponse.json({ ok: false, error: error.message })
      const turns = (data?.turns || []).map((t: any) => ({ ...t, at: Date.now() - minutes * 60 * 1000 }))
      const updated_at = new Date(Date.now() - minutes * 60 * 1000).toISOString()
      const { error: upErr } = await client
        .from(MEM_TABLE)
        .upsert({ thread_key: k, turns, updated_at }, { onConflict: 'thread_key' })
      if (upErr) return NextResponse.json({ ok: false, error: upErr.message })
      return NextResponse.json({ ok: true, minutes })
    }

    return NextResponse.json({ ok: false, error: 'unknown action' })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'unknown' }, { status: 200 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'memory-admin-active' })
}

