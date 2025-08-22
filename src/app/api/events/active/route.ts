import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const type = url.searchParams.get('type') || 'all'

    const client = createServiceRoleClient()
    if (!client) {
      return NextResponse.json({ success: false, error: 'Service client unavailable' }, { status: 500 })
    }

    const nowIso = new Date().toISOString()

    let query = client
      .from('promotional_events')
      .select('id,event_type,title,description,starts_at,ends_at,is_active,metadata')
      .eq('is_active', true)
      .lte('starts_at', nowIso)
      .or('ends_at.is.null,ends_at.gte.' + nowIso)
      .order('starts_at', { ascending: false })

    if (type && type !== 'all') {
      query = query.eq('event_type', type)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ success: true, data: data || [] })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to fetch active events' }, { status: 500 })
  }
}

