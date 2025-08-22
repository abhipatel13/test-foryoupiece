import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth/admin-middleware'
import { eventsService } from '@/lib/services/events-service'

export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const url = new URL(request.url)
    const parts = url.pathname.split('/')
    const id = parts[parts.length - 1]

    const event = await eventsService.getById(id)
    if (!event) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: event })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to fetch event' }, { status: 500 })
  }
})

export const PATCH = withAdminAuth(async (request: NextRequest, { user }) => {
  try {
    const url = new URL(request.url)
    const parts = url.pathname.split('/')
    const id = parts[parts.length - 1]
    const body = await request.json()

    const updated = await eventsService.update(id, { ...body, updated_by: user?.id })
    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to update event' }, { status: 500 })
  }
})



export const DELETE = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    const url = new URL(request.url)
    const parts = url.pathname.split('/')
    const id = parts[parts.length - 1]

    // Follow product soft deletion pattern if available: mark is_active=false only
    // promotional_events table currently does not have soft deletion columns;
    // we will perform hard delete but log via RPC if available in future.
    const client = (await import('@/lib/supabase/service-role')).createServiceRoleClient()
    if (!client) {
      return NextResponse.json({ success: false, error: 'Service client unavailable' }, { status: 500 })
    }

    const { error } = await client
      .from('promotional_events')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Failed to delete event', error)
      return NextResponse.json({ success: false, error: 'Failed to delete event' }, { status: 500 })
    }

    // TODO: if we later add log_admin_action for events, call it here.

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to delete event' }, { status: 500 })
  }
})
