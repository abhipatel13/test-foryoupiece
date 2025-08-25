import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth/admin-middleware'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * Admin API: Get recent orders for a specific user
 * GET /api/admin/communications/recent-orders?userId=UUID&limit=5
 */
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const limit = Math.max(1, Math.min(parseInt(searchParams.get('limit') || '5'), 20))

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Service configuration error' }, { status: 500 })
    }

    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        total_amount,
        created_at,
        payment_status,
        fulfillment_status,
        order_items (quantity, title, total)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Shape into lightweight summaries
    const orders = (data || []).map((o: any) => {
      const itemCount = Array.isArray(o.order_items)
        ? o.order_items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0)
        : 0
      return {
        id: o.id,
        order_number: o.order_number,
        total_amount: Number(o.total_amount) || 0,
        created_at: o.created_at,
        payment_status: o.payment_status,
        fulfillment_status: o.fulfillment_status,
        item_count: itemCount,
      }
    })

    return NextResponse.json({ success: true, orders })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Internal error' }, { status: 500 })
  }
})

