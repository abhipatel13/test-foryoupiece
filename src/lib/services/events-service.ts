import { createServiceRoleClient } from '@/lib/supabase/service-role'

export type EventType = 'free_shipping' | 'percentage_discount' | 'product_discount' | 'sitewide_discount' | 'custom'

export interface PromotionalEvent {
  id: string
  event_type: EventType
  title: string
  description?: string | null
  starts_at: string
  ends_at?: string | null
  is_active: boolean
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

export interface ListEventsParams {
  page?: number
  limit?: number
  type?: EventType | 'all'
  active?: 'all' | 'active' | 'inactive' | 'currently_active'
  search?: string
  sortField?: 'starts_at' | 'ends_at' | 'created_at' | 'updated_at'
  sortDirection?: 'asc' | 'desc'
}

class EventsService {
  private getClient() {
    return createServiceRoleClient()
  }

  async list(params: ListEventsParams = {}) {
    const client = this.getClient()
    if (!client) throw new Error('Service client not available')

    const page = params.page ?? 1
    const limit = params.limit ?? 20
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = client
      .from('promotional_events')
      .select('*', { count: 'exact' })

    if (params.type && params.type !== 'all') {
      query = query.eq('event_type', params.type)
    }

    if (params.active && params.active !== 'all') {
      if (params.active === 'currently_active') {
        query = query.eq('is_active', true)
          .lte('starts_at', new Date().toISOString())
          .or('ends_at.is.null,ends_at.gte.' + new Date().toISOString())
      } else {
        const isActive = params.active === 'active'
        query = query.eq('is_active', isActive)
      }
    }

    if (params.search) {
      const s = params.search
      query = query.or(`title.ilike.%${s}%,description.ilike.%${s}%`)
    }

    const sortField = params.sortField ?? 'created_at'
    const sortDirection = params.sortDirection ?? 'desc'
    query = query.order(sortField, { ascending: sortDirection === 'asc' })

    const { data, error, count } = await query.range(from, to)

    if (error) throw error

    return {
      events: (data || []) as PromotionalEvent[],
      page,
      limit,
      total: count || 0,
      totalPages: Math.max(1, Math.ceil((count || 0) / limit))
    }
  }

  async getById(id: string): Promise<PromotionalEvent | null> {
    const client = this.getClient()
    if (!client) throw new Error('Service client not available')

    const { data, error } = await client
      .from('promotional_events')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return null
    return data as PromotionalEvent
  }

  async create(event: {
    event_type: EventType
    title: string
    description?: string
    starts_at: string
    ends_at?: string | null
    is_active?: boolean
    metadata?: Record<string, any>
    created_by?: string
  }): Promise<PromotionalEvent> {
    const client = this.getClient()
    if (!client) throw new Error('Service client not available')

    const payload = {
      event_type: event.event_type,
      title: event.title.trim(),
      description: event.description?.trim() || null,
      starts_at: event.starts_at,
      ends_at: event.ends_at || null,
      is_active: Boolean(event.is_active),
      metadata: event.metadata || {},
      created_by: event.created_by || null
    }

    const { data, error } = await client
      .from('promotional_events')
      .insert(payload)
      .select('*')
      .single()

    if (error) throw error
    return data as PromotionalEvent
  }

  async update(id: string, patch: Partial<{
    title: string
    description: string | null
    starts_at: string
    ends_at: string | null
    is_active: boolean
    metadata: Record<string, any>
    updated_by: string
  }>): Promise<PromotionalEvent> {
    const client = this.getClient()
    if (!client) throw new Error('Service client not available')

    const { data, error } = await client
      .from('promotional_events')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return data as PromotionalEvent
  }

  async getCurrentlyActive(): Promise<PromotionalEvent[]> {
    const client = this.getClient()
    if (!client) throw new Error('Service client not available')

    const nowIso = new Date().toISOString()
    const { data, error } = await client
      .from('promotional_events')
      .select('*')
      .eq('is_active', true)
      .lte('starts_at', nowIso)
      .or('ends_at.is.null,ends_at.gte.' + nowIso)

    if (error) throw error
    return (data || []) as PromotionalEvent[]
  }
}

export const eventsService = new EventsService()

