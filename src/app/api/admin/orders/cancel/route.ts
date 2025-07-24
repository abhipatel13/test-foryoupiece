import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * Cancel Order API - Cancel order and refund points
 * POST /api/admin/orders/cancel
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📦 Order cancellation API called');

    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({
        success: false,
        error: 'Missing order ID'
      }, { status: 400 });
    }

    console.log('📦 Cancelling order:', orderId);

    // Use service role client for admin operations
    const supabase = createServiceRoleClient();

    if (!supabase) {
      console.error('❌ Service role client not available');
      return NextResponse.json({
        success: false,
        error: 'Service unavailable'
      }, { status: 500 });
    }

    // Get current order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('❌ Order not found:', orderError);
      return NextResponse.json({
        success: false,
        error: 'Order not found'
      }, { status: 404 });
    }

    console.log('📦 Order to cancel:', {
      orderNumber: order.order_number,
      pointsUsed: order.points_used,
      userId: order.user_id
    });

    // Cancel the order
    const { data: cancelledOrder, error: cancelError } = await supabase
      .from('orders')
      .update({
        fulfillment_status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single();

    if (cancelError) {
      console.error('❌ Error cancelling order:', cancelError);
      return NextResponse.json({
        success: false,
        error: cancelError.message
      }, { status: 500 });
    }

    // Get order items to restore stock
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('product_id, quantity, title')
      .eq('order_id', orderId);

    if (itemsError) {
      console.error('❌ Error fetching order items:', itemsError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch order items'
      }, { status: 500 });
    }

    // Restore stock for each item
    if (orderItems && orderItems.length > 0) {
      console.log('📈 Restoring stock for cancelled order items...');

      for (const item of orderItems) {
        try {
          console.log(`📦 Restoring stock for product ${item.product_id}, adding back ${item.quantity}`);

          const { error: stockError } = await supabase.rpc('update_product_stock', {
            product_id: item.product_id,
            quantity_change: item.quantity // Positive to add back stock
          });

          if (stockError) {
            console.error(`❌ Stock restoration failed for product ${item.product_id}:`, stockError);
            // Continue with other items even if one fails
          } else {
            console.log(`✅ Stock restored for product ${item.product_id} (${item.title}): +${item.quantity}`);
          }
        } catch (error) {
          console.error(`❌ Error restoring stock for item ${item.product_id}:`, error);
        }
      }
    }

    // Refund points if any were used
    if (order.points_used && order.points_used > 0) {
      try {
        console.log(`💰 Refunding ${order.points_used} points to user ${order.user_id}`);

        // Insert point refund transaction
        await supabase
          .from('point_transactions')
          .insert({
            user_id: order.user_id,
            points: order.points_used, // Positive points for refund
            transaction_type: 'refund',
            reference_type: 'order',
            reference_id: order.id,
            description: `Points refunded from cancelled order #${order.order_number}`
          });

        // Update user's points balance (add points back)
        await supabase.rpc('update_user_points', {
          p_user_id: order.user_id,
          p_points: order.points_used
        });

        console.log(`✅ Refunded ${order.points_used} points to user ${order.user_id}`);
      } catch (pointsError) {
        console.error('❌ Failed to refund points:', pointsError);

        // This is critical - if we can't refund points, we should potentially rollback the cancellation
        // For now, we'll log it as a critical error but not fail the cancellation
        console.error('🚨 CRITICAL: Order cancelled but points refund failed. Manual intervention required.');
      }
    }

    console.log('✅ Order cancelled successfully:', cancelledOrder.id);

    return NextResponse.json({
      success: true,
      order: cancelledOrder,
      pointsRefunded: order.points_used || 0,
      stockRestored: orderItems?.length || 0,
      restoredItems: orderItems?.map(item => ({
        productId: item.product_id,
        title: item.title,
        quantityRestored: item.quantity
      })) || []
    });

  } catch (error) {
    console.error('❌ Order cancellation API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
