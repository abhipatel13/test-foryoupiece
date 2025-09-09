import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth/admin-middleware'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * Admin: List all active categories with IDs
 * GET /api/admin/categories
 */
export const GET = withAdminAuth(async (_request: NextRequest) => {
  try {
    const supabase = createServiceRoleClient()
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Service configuration error' }, { status: 500 })
    }

    const { data, error } = await supabase
      .from('categories')
      .select('id, name_en, slug, is_active, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: data || [] })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to load categories' }, { status: 500 })
  }
})

