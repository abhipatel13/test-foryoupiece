import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth/admin-middleware'
import { eventsService } from '@/lib/services/events-service'

export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const url = new URL(request.url)
    const params = url.searchParams

    const page = parseInt(params.get('page') || '1')
    const limit = parseInt(params.get('limit') || '20')
    const type = (params.get('type') || 'all') as any
    const active = (params.get('active') || 'all') as any
    const search = params.get('search') || undefined
    const sortField = (params.get('sortField') || 'created_at') as any
    const sortDirection = (params.get('sortDirection') || 'desc') as any

    const result = await eventsService.list({ page, limit, type, active, search, sortField, sortDirection })

    return NextResponse.json({ success: true, data: result.events, pagination: {
      page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages
    }})
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to fetch events' }, { status: 500 })
  }
})

export const POST = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    const body = await request.json()

    // Basic validation for free_shipping event type
    if (!body?.event_type || !body?.title || !body?.starts_at) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    const created = await eventsService.create({
      event_type: body.event_type,
      title: body.title,
      description: body.description,
      starts_at: body.starts_at,
      ends_at: body.ends_at,
      is_active: Boolean(body.is_active),
      metadata: body.metadata || {},
      created_by: user?.id
    })

    return NextResponse.json({ success: true, data: created })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to create event' }, { status: 500 })
  }
})

