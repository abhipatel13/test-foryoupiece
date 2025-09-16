import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * Mark a specific notification as read
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🔔 Mark Notification Read API called for ID:', params.id)

    // Get authenticated user (support Bearer token header or cookies)
    const supabase = await createClient()
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    const bearer = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined
    const { data: { user }, error: authError } = bearer
      ? await supabase.auth.getUser(bearer)
      : await supabase.auth.getUser()

    if (authError || !user) {
      console.log('❌ Mark Notification Read API: Authentication failed')
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const userId = user.id
    const notificationId = params.id

    if (!notificationId) {
      return NextResponse.json({
        success: false,
        error: 'Notification ID is required'
      }, { status: 400 })
    }

    // Use service client for better performance
    const serviceClient = createServiceRoleClient()
    if (!serviceClient) {
      console.log('❌ Mark Notification Read API: Service client creation failed')
      return NextResponse.json(
        { error: 'Service unavailable' },
        { status: 503 }
      )
    }

    // Mark notification as read (only if it belongs to the user)
    const { data: updatedNotification, error: updateError } = await serviceClient
      .from('notifications')
      .update({ 
        read: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', notificationId)
      .eq('user_id', userId)
      .select()
      .single()

    if (updateError) {
      console.error('❌ Error marking notification as read:', updateError)
      
      if (updateError.code === 'PGRST116') {
        return NextResponse.json({
          success: false,
          error: 'Notification not found or access denied'
        }, { status: 404 })
      }

      return NextResponse.json({
        success: false,
        error: 'Failed to mark notification as read'
      }, { status: 500 })
    }

    console.log(`✅ Notification ${notificationId} marked as read for user ${userId}`)

    return NextResponse.json({
      success: true,
      notification: updatedNotification
    })

  } catch (error: any) {
    console.error('❌ Mark Notification Read API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
