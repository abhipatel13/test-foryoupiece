import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * Clear (delete) all notifications for the authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🗑️ Clear All Notifications API called')

    // Get authenticated user (support Bearer token header or cookies)
    const supabase = await createClient()
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    const bearer = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined
    const { data: { user }, error: authError } = bearer
      ? await supabase.auth.getUser(bearer)
      : await supabase.auth.getUser()

    if (authError || !user) {
      console.log('❌ Clear All Notifications API: Authentication failed')
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const userId = user.id

    // Use service client to bypass RLS safely
    const serviceClient = createServiceRoleClient()
    if (!serviceClient) {
      console.log('❌ Clear All Notifications API: Service client creation failed')
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
    }

    // Delete all notifications for this user
    const { data: deletedRows, error: deleteError } = await serviceClient
      .from('notifications')
      .delete()
      .eq('user_id', userId)
      .select('id')

    if (deleteError) {
      console.error('❌ Error clearing notifications:', deleteError)
      return NextResponse.json({ success: false, error: 'Failed to clear notifications' }, { status: 500 })
    }

    const deletedCount = deletedRows?.length || 0
    console.log(`✅ Deleted ${deletedCount} notifications for user ${userId}`)

    return NextResponse.json({ success: true, deleted_count: deletedCount })
  } catch (error: any) {
    console.error('❌ Clear All Notifications API error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

