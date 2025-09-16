import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'


export const dynamic = 'force-dynamic'

/**
 * Get user's notifications
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔔 User Notifications API called')

    // Get authenticated user (support Bearer token header or cookies)
    const supabase = await createClient()
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    const bearer = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined
    const { data: { user }, error: authError } = bearer
      ? await supabase.auth.getUser(bearer)
      : await supabase.auth.getUser()

    if (authError || !user) {
      console.log('❌ User Notifications API: Authentication failed')
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const userId = user.id
    console.log('👤 User Notifications API: Fetching notifications for user:', userId)

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Use service client for better performance
    const serviceClient = createServiceRoleClient()
    if (!serviceClient) {
      console.log('❌ User Notifications API: Service client creation failed')
      return NextResponse.json(
        { error: 'Service unavailable' },
        { status: 503 }
      )
    }

    // Fetch notifications and counts in parallel
    const [notificationsResult, unreadCountResult, totalCountResult] = await Promise.all([
      // Page of notifications
      serviceClient
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),

      // Unread count
      serviceClient
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false),

      // Total count for pagination
      serviceClient
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
    ])

    if (notificationsResult.error) {
      console.error('❌ Error fetching notifications:', notificationsResult.error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch notifications'
      }, { status: 500 })
    }

    if (unreadCountResult.error) {
      console.error('❌ Error fetching unread count:', unreadCountResult.error)
      // Don't fail the request, just log the error
    }

    const notifications = notificationsResult.data || []
    const unreadCount = unreadCountResult.count || 0
    const totalCount = totalCountResult.count || 0

    console.log(`✅ User Notifications API: Found ${notifications.length}/${totalCount} notifications for user ${userId}`)

    return NextResponse.json({
      success: true,
      notifications,
      unread_count: unreadCount,
      metadata: {
        total_notifications: totalCount,
        limit,
        offset,
        generated_at: new Date().toISOString()
      }
    })

  } catch (error: any) {
    console.error('❌ User Notifications API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
