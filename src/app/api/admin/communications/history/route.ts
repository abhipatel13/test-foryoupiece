import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth/admin-middleware'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * Admin API: Get recent communication history for a user
 * GET /api/admin/communications/history?userId=UUID&limit=20
 */
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const limit = Math.max(1, Math.min(parseInt(searchParams.get('limit') || '20'), 100))

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 })
    }

    const serviceClient = createServiceRoleClient()
    if (!serviceClient) {
      return NextResponse.json({ success: false, error: 'Service configuration error' }, { status: 500 })
    }

    // Fetch recent notifications for this user; prefer Telegram channel if available
    const { data, error } = await serviceClient
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Optionally filter to telegram-related items first in the response
    const sorted = (data || []).sort((a: any, b: any) => {
      const aIsTg = (a.metadata?.channel || '').toLowerCase() === 'telegram'
      const bIsTg = (b.metadata?.channel || '').toLowerCase() === 'telegram'
      if (aIsTg === bIsTg) return 0
      return aIsTg ? -1 : 1
    })

    return NextResponse.json({ success: true, notifications: sorted })
  } catch (err) {
    console.error('❌ Admin history fetch error:', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
})

