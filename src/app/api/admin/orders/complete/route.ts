import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * Complete Order API - Streamlined single-click completion
 * POST /api/admin/orders/complete
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📦 Order completion API called');

    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({
        success: false,
        error: 'Missing order ID'
      }, { status: 400 });
    }

    console.log('📦 Completing order:', orderId);

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

    console.log('📦 Current order status:', {
      paymentStatus: order.payment_status,
      fulfillmentStatus: order.fulfillment_status
    });

    // Streamlined completion: verify payment + mark as shipped (on the way)
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        payment_status: 'verified',
        fulfillment_status: 'shipped',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error completing order:', updateError);
      return NextResponse.json({
        success: false,
        error: updateError.message
      }, { status: 500 });
    }

    console.log('✅ Order completed successfully:', updatedOrder.id);

    // Award points for completed order (if payment was just verified)
    if (order.payment_status !== 'verified') {
      try {
        console.log('💰 Awarding points for completed order');
        
        // Calculate points earned (10 points per $1)
        const pointsToAward = Math.floor(order.total_amount * 10);
        
        if (pointsToAward > 0) {
          // Insert point transaction
          await supabase
            .from('point_transactions')
            .insert({
              user_id: order.user_id,
              points: pointsToAward,
              transaction_type: 'earned',
              reference_type: 'order',
              reference_id: order.id,
              description: `Points earned from order #${order.order_number}`
            });

          // Update user's points balance and total earned
          await supabase.rpc('update_user_points', {
            p_user_id: order.user_id,
            p_points: pointsToAward
          });

          console.log(`✅ Awarded ${pointsToAward} points to user ${order.user_id}`);
        }
      } catch (pointsError) {
        console.warn('⚠️ Failed to award points:', pointsError);
        // Don't fail the order completion for points errors
      }
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder
    });

  } catch (error) {
    console.error('❌ Order completion API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
