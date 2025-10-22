import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth/admin-middleware'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export const dynamic = 'force-dynamic'

/**
 * Admin API: Send notification to a specific user
 * POST /api/admin/users/send-notification
 */
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    console.log('🔔 Admin send notification API called')

    const body = await request.json().catch(() => ({}))
    const { userId, title, message, type } = body

    if (!userId || !title || !message) {
      return NextResponse.json({
        success: false,
        error: 'userId, title, and message are required'
      }, { status: 400 })
    }

    const serviceClient = createServiceRoleClient()
    if (!serviceClient) {
      return NextResponse.json({
        success: false,
        error: 'Service configuration error'
      }, { status: 500 })
    }

    // Create the notification
    const { data: notification, error } = await serviceClient
      .from('notifications')
      .insert({
        user_id: userId,
        title: title.trim(),
        message: message.trim(),
        type: type || 'info',
        read: false,
        metadata: {
          admin_sent: true,
          sent_at: new Date().toISOString()
        }
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Error creating admin notification:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to create notification'
      }, { status: 500 })
    }

    console.log(`✅ Admin notification sent to user ${userId}: ${notification.id}`)

    return NextResponse.json({
      success: true,
      notification,
      message: 'Notification sent successfully'
    })

  } catch (error: any) {
    console.error('❌ Admin send notification API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
})
