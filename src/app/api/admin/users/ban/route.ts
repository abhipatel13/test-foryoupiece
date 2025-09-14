import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth/admin-middleware'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export const runtime = 'nodejs'

export const POST = withAdminAuth(async (request: NextRequest, { user: adminUser }) => {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body.user_id !== 'string' || typeof body.banned !== 'boolean') {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 })
    }

    const { user_id, banned, reason } = body as { user_id: string; banned: boolean; reason?: string }

    const admin = createServiceRoleClient()
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 })
    }

    // Update user banned status
    const { data: updated, error: updateErr } = await admin
      .from('users')
      .update({ banned, banned_at: banned ? new Date().toISOString() : null })
      .eq('id', user_id)
      .select('id, banned, banned_at')
      .single()

    if (updateErr) {
      return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 })
    }

    // Insert audit log
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null
    const ua = request.headers.get('user-agent') || null
    await admin
      .from('user_ban_audit')
      .insert({
        user_id,
        admin_id: adminUser.id,
        action: banned ? 'ban' : 'unban',
        reason: reason || null,
        ip: ip || undefined,
        user_agent: ua || undefined
      })

    return NextResponse.json({ success: true, data: updated })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Unexpected error' }, { status: 500 })
  }
})

