import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { customerNotificationService } from '@/lib/services/customer-notification-service'

/**
 * POST /api/admin/orders/[id]/status
 * Body: { payment_status?: 'pending'|'verified'|'failed'|'refunded', fulfillment_status?: 'pending'|'processing'|'shipped'|'delivered'|'cancelled', cancelled_reason?: string }
 * - Centralizes order status updates and triggers customer notifications accordingly
 * - Requires server-side permissioning (add admin protection in upstream middleware if available)
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const orderId = params.id
  const supabase = createServiceRoleClient()

  try {
    const body = await request.json()
    const { payment_status, fulfillment_status, cancelled_reason } = body || {}

    if (!payment_status && !fulfillment_status && !cancelled_reason) {
      return NextResponse.json({ success: false, error: 'No updates provided' }, { status: 400 })
    }

    const updates: any = { updated_at: new Date().toISOString() }
    if (payment_status) updates.payment_status = payment_status
    if (fulfillment_status) updates.fulfillment_status = fulfillment_status
    if (cancelled_reason) updates.cancelled_reason = cancelled_reason

    const { data, error } = await supabase.from('orders').update(updates).eq('id', orderId).select().single()
    if (error) {
      console.error('❌ Order status update failed:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Trigger customer notifications based on fulfillment status
    try {
      if (fulfillment_status === 'shipped') {
        await customerNotificationService.sendOrderStatusUpdate(orderId, 'shipped')
      } else if (fulfillment_status === 'delivered') {
        await customerNotificationService.sendOrderStatusUpdate(orderId, 'delivered')
      } else if (fulfillment_status === 'cancelled') {
        await customerNotificationService.sendOrderStatusUpdate(orderId, 'cancelled')
      }
    } catch (notifyErr: any) {
      console.warn('⚠️ Customer status notification failed:', notifyErr?.message || notifyErr)
    }

    return NextResponse.json({ success: true, order: data })
  } catch (e: any) {
    console.error('❌ Status update API error:', e)
    return NextResponse.json({ success: false, error: e?.message || 'Unknown error' }, { status: 500 })
  }
}

