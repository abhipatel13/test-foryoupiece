import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * Mark all notifications as read for the authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔔 Mark All Notifications Read API called')

    // Get authenticated user (support Bearer token header or cookies)
    const supabase = await createClient()
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    const bearer = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined
    const { data: { user }, error: authError } = bearer
      ? await supabase.auth.getUser(bearer)
      : await supabase.auth.getUser()

    if (authError || !user) {
      console.log('❌ Mark All Notifications Read API: Authentication failed')
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const userId = user.id

    // Use service client for better performance
    const serviceClient = createServiceRoleClient()
    if (!serviceClient) {
      console.log('❌ Mark All Notifications Read API: Service client creation failed')
      return NextResponse.json(
        { error: 'Service unavailable' },
        { status: 503 }
      )
    }

    // Mark all unread notifications as read for this user
    const { data: updatedNotifications, error: updateError } = await serviceClient
      .from('notifications')
      .update({ 
        read: true,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('read', false)
      .select('id')

    if (updateError) {
      console.error('❌ Error marking all notifications as read:', updateError)
      return NextResponse.json({
        success: false,
        error: 'Failed to mark all notifications as read'
      }, { status: 500 })
    }

    const updatedCount = updatedNotifications?.length || 0

    console.log(`✅ Marked ${updatedCount} notifications as read for user ${userId}`)

    return NextResponse.json({
      success: true,
      updated_count: updatedCount,
      message: `${updatedCount} notifications marked as read`
    })

  } catch (error: any) {
    console.error('❌ Mark All Notifications Read API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
