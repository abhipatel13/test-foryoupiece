import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth/admin-middleware'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * Admin API: Mark incoming notifications as read for a user
 * POST /api/admin/communications/mark-read
 * Body: { userId: string }
 */
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    const body = await request.json().catch(() => ({}))
    const userId = body?.userId as string
    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Service configuration error' }, { status: 500 })
    }

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)
      .contains('metadata', { direction: 'incoming' })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('❌ Admin mark-read error:', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
})

