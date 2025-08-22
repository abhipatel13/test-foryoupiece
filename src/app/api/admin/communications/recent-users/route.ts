import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth/admin-middleware'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * Admin API: All Telegram users with recent conversation data
 * GET /api/admin/communications/recent-users?q=search&limit=20&offset=0
 *
 * Returns all users with Telegram accounts, prioritizing those with recent messages
 */
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20'), 1), 50)
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0)

    const supabase = createServiceRoleClient()
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Service configuration error' }, { status: 500 })
    }

    // Build user query for all Telegram users
    let userQuery = supabase
      .from('users')
      .select('id, first_name, last_name, email, telegram_username, telegram_id')
      .not('telegram_username', 'is', null) // Only users with Telegram accounts

    // Apply search filter if provided
    if (q.length >= 2) {
      const term = `%${q.toLowerCase()}%`
      userQuery = userQuery.or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term},telegram_username.ilike.${term}`)
    }

    const { data: allTelegramUsers, error: usersErr } = await userQuery.limit(500)

    if (usersErr) {
      return NextResponse.json({ success: false, error: usersErr.message }, { status: 500 })
    }

    if (!allTelegramUsers || allTelegramUsers.length === 0) {
      return NextResponse.json({ success: true, users: [], count: 0, hasMore: false })
    }

    // Get user IDs for notification lookup
    const userIds = allTelegramUsers.map(u => u.id)

    // Fetch recent notifications for these users
    const { data: notis, error: notisErr } = await supabase
      .from('notifications')
      .select('id, user_id, title, message, created_at, read, metadata')
      .in('user_id', userIds)
      .order('created_at', { ascending: false })
      .limit(1000) // Increased limit to get more comprehensive data

    if (notisErr) {
      return NextResponse.json({ success: false, error: notisErr.message }, { status: 500 })
    }

    // Create maps for efficient lookup
    const lastMessageMap = new Map<string, any>()
    const unreadCountMap = new Map<string, number>()

    // Process notifications to find last message and unread count per user
    for (const n of notis || []) {
      const uid = n.user_id

      // Track last message (first one due to DESC order)
      if (!lastMessageMap.has(uid)) {
        lastMessageMap.set(uid, {
          id: n.id,
          title: n.title,
          message: n.message,
          created_at: n.created_at,
          metadata: n.metadata,
        })
      }

      // Count unread incoming messages
      const isIncoming = n.metadata?.direction === 'incoming'
      const isUnread = n.read !== true
      if (isIncoming && isUnread) {
        unreadCountMap.set(uid, (unreadCountMap.get(uid) || 0) + 1)
      }
    }

    // Build result array with all Telegram users
    const allUsers = allTelegramUsers.map(user => {
      const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email?.split('@')[0] || 'Unknown User'
      const lastMessage = lastMessageMap.get(user.id)

      return {
        user: {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          telegram_username: user.telegram_username,
          display_name: name,
        },
        lastMessage: lastMessage || {
          id: 'no-message',
          title: 'No messages yet',
          message: 'Start a conversation with this user',
          created_at: user.created_at || new Date().toISOString(),
          metadata: { direction: 'none' },
        },
        unreadCount: unreadCountMap.get(user.id) || 0,
        hasMessages: !!lastMessage,
      }
    })

    // Sort: users with messages first (by last message date), then users without messages (by name)
    allUsers.sort((a, b) => {
      if (a.hasMessages && !b.hasMessages) return -1
      if (!a.hasMessages && b.hasMessages) return 1

      if (a.hasMessages && b.hasMessages) {
        return new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
      }

      return a.user.display_name.localeCompare(b.user.display_name)
    })

    // Apply pagination
    const sliced = allUsers.slice(offset, offset + limit)
    const hasMore = allUsers.length > offset + limit

    return NextResponse.json({
      success: true,
      users: sliced,
      count: allUsers.length,
      hasMore,
      totalTelegramUsers: allTelegramUsers.length
    })
  } catch (err) {
    console.error('❌ Admin recent users fetch error:', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
})

