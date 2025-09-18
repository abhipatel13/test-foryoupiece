import { NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth/admin-middleware'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { sendPartialCancellationNotification } from '@/lib/services/customer-notification-service'

// POST /api/admin/orders/cancel-items
// Body: { orderId: string, items: [{ orderItemId: string, quantity: number }], keepStockOut?: boolean }
export const POST = withAdminAuth(async (_req, ctx) => {
  const req = _req
  const supabase = createServiceRoleClient()

  try {
    const body = await req.json()
    const orderId: string = body.orderId
    const items: Array<{ orderItemId: string; quantity: number }> = body.items || []
    const keepStockOut: boolean = !!body.keepStockOut

    if (!orderId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    // Load order + items
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select(`id, user_id, order_number, email, payment_status, fulfillment_status, subtotal, total_amount, points_used, shipping_cost, discount_amount`)
      .eq('id', orderId)
      .single()
    if (orderErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Allowed fulfillment statuses
    const allowedStatuses = new Set(['pending', 'on_hold', 'processing', 'shipped'])
    if (order.payment_status !== 'verified' || !allowedStatuses.has(order.fulfillment_status)) {
      return NextResponse.json({ error: 'Order not eligible for partial cancellation' }, { status: 400 })
    }

    const { data: orderItems, error: itemsErr } = await supabase
      .from('order_items')
      .select('id, product_id, variant_id, title, quantity, total, cancelled_quantity')
      .eq('order_id', orderId)
    if (itemsErr || !orderItems) {
      return NextResponse.json({ error: 'Failed to load order items' }, { status: 500 })
    }

    const itemMap = new Map(orderItems.map((it) => [it.id, it]))

    // Validate requested quantities and compute refund
    type CancelCalc = { id: string; title: string; requested: number; remaining: number; unitTotal: number; refund: number; product_id: string | null }
    const calcs: CancelCalc[] = []
    for (const i of items) {
      const row = itemMap.get(i.orderItemId)
      if (!row) return NextResponse.json({ error: `Invalid orderItemId ${i.orderItemId}` }, { status: 400 })
      const already = Number(row.cancelled_quantity || 0)
      const qty = Number(i.quantity)
      const remaining = Number(row.quantity) - already
      if (!Number.isFinite(qty) || qty <= 0) return NextResponse.json({ error: `Invalid quantity for ${i.orderItemId}` }, { status: 400 })
      if (qty > remaining) return NextResponse.json({ error: `Quantity exceeds remaining for ${row.title}` }, { status: 400 })
      const unitTotal = Number(row.total) / Number(row.quantity)
      const refund = unitTotal * qty
      calcs.push({ id: row.id, title: row.title, requested: qty, remaining, unitTotal, refund, product_id: row.product_id })
    }

    const totalRefund = Number(calcs.reduce((s, c) => s + c.refund, 0))

    // Update cancelled_quantity per item
    for (const c of calcs) {
      const newCancelled = (itemMap.get(c.id)!.cancelled_quantity || 0) + c.requested
      const { error: upErr } = await supabase
        .from('order_items')
        .update({ cancelled_quantity: newCancelled })
        .eq('id', c.id)
        .eq('order_id', orderId)
      if (upErr) return NextResponse.json({ error: `Failed to update item ${c.title}` }, { status: 500 })
    }

    // Restore stock if requested (best-effort)
    if (!keepStockOut) {
      for (const c of calcs) {
        if (c.product_id && c.requested > 0) {
          await supabase.rpc('update_product_stock', {
            p_product_id: c.product_id,
            p_quantity_change: c.requested, // add back
            p_reason: 'partial_cancellation'
          })
        }
      }
    }

    // Points refund calculation
    const { data: prevRefundRows } = await supabase
      .from('point_transactions')
      .select('points')
      .eq('reference_type', 'order')
      .eq('reference_id', orderId)
      .eq('transaction_type', 'refund')
    const alreadyRefundedPoints = Number((prevRefundRows || []).reduce((s, r: any) => s + Number(r.points || 0), 0))
    const remainingPointsCap = Math.max(0, Number(order.points_used || 0) - alreadyRefundedPoints)
    const pointsRefund = Math.min(remainingPointsCap, Math.round(totalRefund * 1000))

    if (pointsRefund > 0) {
      // credit back points and record transaction
      await supabase.from('point_transactions').insert({
        user_id: order.user_id,
        points: pointsRefund,
        transaction_type: 'refund',
        reference_type: 'order',
        reference_id: orderId,
        comment: 'Partial order cancellation refund'
      })
      await supabase.rpc('update_user_points', {
        p_user_id: order.user_id,
        p_points_delta: pointsRefund,
        p_reason: 'partial_cancellation_refund'
      })
    }

    // Recompute if fully cancelled
    const { data: updatedItems } = await supabase
      .from('order_items')
      .select('quantity, total, cancelled_quantity, title')
      .eq('order_id', orderId)
    const fullyCancelled = (updatedItems || []).every((it) => Number(it.cancelled_quantity || 0) >= Number(it.quantity || 0))

    // Update order totals
    const newTotalAmount = Math.max(0, Number(order.total_amount || 0) - totalRefund)
    const newSubtotal = Math.max(0, Number(order.subtotal || 0) - totalRefund)

    const orderUpdate: any = { total_amount: newTotalAmount, subtotal: newSubtotal }
    if (fullyCancelled) {
      orderUpdate.fulfillment_status = 'cancelled'
    }
    await supabase.from('orders').update(orderUpdate).eq('id', orderId)

    // Notify customer (email + Telegram DM)
    const cancelledItemsForMessage = calcs.map((c) => ({ title: c.title, quantity: c.requested, refund: Number(c.refund) }))
    await sendPartialCancellationNotification({
      orderId,
      cancelledItems: cancelledItemsForMessage,
      refundAmount: totalRefund,
      pointsRefund,
      newTotalAmount
    })

    // If fully cancelled, DO NOT send additional admin Telegram beyond the simplified approach in the full-cancel API.

    return NextResponse.json({
      ok: true,
      refund: { amount: totalRefund, points: pointsRefund },
      fullyCancelled,
      newTotals: { total_amount: newTotalAmount, subtotal: newSubtotal }
    })
  } catch (e: any) {
    console.error('partial-cancel error', e)
    return NextResponse.json({ error: 'Internal error', details: e?.message }, { status: 500 })
  }
})

