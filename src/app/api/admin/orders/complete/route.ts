import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { withAdminAuth } from '@/lib/auth/admin-middleware'

// Explicitly disable shared caching for admin order APIs (defense-in-depth)
const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0, private',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Vary': 'Cookie, Authorization, Accept-Encoding',
} as const;


/**
 * Complete Order API - Streamlined single-click completion
 * POST /api/admin/orders/complete
 */
export const POST = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('📦 Order completion API called');

    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({
        success: false,
        error: 'Missing order ID'
      }, { status: 400, headers: noStoreHeaders });
    }

    console.log('📦 Completing order:', orderId);

    // Use service role client for admin operations
    const supabase = createServiceRoleClient();

    if (!supabase) {
      console.error('❌ Service role client not available');
      return NextResponse.json({
        success: false,
        error: 'Service unavailable'
      }, { status: 500, headers: noStoreHeaders });
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
      }, { status: 404, headers: noStoreHeaders });
    }

    console.log('📦 Current order status:', {
      paymentStatus: order.payment_status,
      fulfillmentStatus: order.fulfillment_status
    });

    // Update order status directly
    console.log('🔧 Attempting order completion with direct update...');

    let updatedOrder;
    try {
      // Update order status directly
      console.log('🔧 Updating order status directly in database');
      const { data, error: updateError } = await supabase
        .from('orders')
        .update({
          payment_status: 'verified',
          fulfillment_status: 'delivered',
          payment_verified_at: new Date().toISOString(),
          delivered_at: new Date().toISOString(),
          processed_by: `Admin: ${adminUser.email}`,
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Direct update error:', updateError);
        throw updateError;
      }

      updatedOrder = data;
      console.log('✅ Order updated successfully in database using direct update');
    } catch (error: any) {
      console.error('❌ Error completing order:', error);
      return NextResponse.json({
        success: false,
        error: `Failed to complete order: ${error.message}`
      }, { status: 500, headers: noStoreHeaders });
    }

    console.log('✅ Order completed successfully:', updatedOrder?.id || orderId);
    console.log('📊 Final order status:', {
      paymentStatus: updatedOrder?.payment_status,
      fulfillmentStatus: updatedOrder?.fulfillment_status
    });

    // Award points for completed order (if payment was just verified)
    // Check if this order hasn't already awarded points (payment_status was not 'verified' before)
    if (order.payment_status !== 'verified' && updatedOrder?.payment_status === 'verified') {
      try {
        console.log('💰 Awarding points for completed order');
        console.log(`📊 Order total: $${order.total_amount}, User: ${order.user_id}`);

        // Calculate points earned using correct formula: 10 points per $1 (1% cashback, 1000 points = $1)
        const pointsToAward = Math.floor(order.total_amount * 10);

        if (pointsToAward > 0) {
          console.log(`🎯 Calculating points: $${order.total_amount} × 10 = ${pointsToAward} points`);

          // Insert point transaction
          const { data: transaction, error: transactionError } = await supabase
            .from('point_transactions')
            .insert({
              user_id: order.user_id,
              points: pointsToAward,
              transaction_type: 'earned',
              reference_type: 'order',
              reference_id: order.id,
              description: `Points earned from order #${order.order_number}`
            })
            .select()
            .single();

          if (transactionError) {
            console.error('❌ Failed to create points transaction:', transactionError);
            throw transactionError;
          }

          // Update user's points balance and total earned using RPC function
          const { error: updateError } = await supabase.rpc('update_user_points', {
            p_user_id: order.user_id,
            p_points: pointsToAward
          });

          if (updateError) {
            console.error('❌ Failed to update user points balance:', updateError);
            // Rollback the transaction
            await supabase
              .from('point_transactions')
              .delete()
              .eq('id', transaction.id);
            throw updateError;
          }

          console.log(`✅ Successfully awarded ${pointsToAward} points to user ${order.user_id}`);
          console.log(`💰 Points transaction ID: ${transaction.id}`);
        } else {
          console.log('⚠️ No points to award (order total is $0 or negative)');
        }
      } catch (pointsError) {
        console.error('❌ Failed to award points:', pointsError);
        // Don't fail the order completion for points errors, but log it clearly
        console.error('⚠️ CRITICAL: Points were not awarded for this order. Manual intervention may be required.');
      }
    } else if (order.payment_status === 'verified') {
      console.log('ℹ️ Order payment was already verified, skipping points award to prevent double-awarding');
    } else {
      console.log('ℹ️ Order payment status not verified after update, no points awarded');
    }

    // Send order shipped/completed email notification
    try {
      console.log('📧 Sending order completed email notification...');

      // Get order details for email
      const { data: orderDetails, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (*)
          ),
          users!orders_user_id_fkey (*)
        `)
        .eq('id', orderId)
        .single();

      if (orderError) {
        console.error('❌ Failed to fetch order details for email:', orderError);
      } else if (orderDetails) {
        // Import the customer notification service
        const { sendCustomerNotification } = await import('@/lib/services/customer-notification-service');

        // Send order completed email
        await sendCustomerNotification({
          type: 'order_shipped',
          orderId: orderDetails.id,
          orderNumber: orderDetails.order_number,
          customerEmail: orderDetails.users?.email || orderDetails.customer_email,
          customerName: `${orderDetails.users?.first_name || orderDetails.first_name} ${orderDetails.users?.last_name || orderDetails.last_name}`,
          orderTotal: orderDetails.total_amount,
          orderItems: orderDetails.order_items || [],
          shippingAddress: {
            line1: orderDetails.address_line_1,
            line2: orderDetails.address_line_2,
            city: 'Phnom Penh',
            country: 'Cambodia'
          }
        });

        console.log('✅ Order completed email notification sent successfully');
      }
    } catch (emailError) {
      console.error('❌ Failed to send order completed email:', emailError);
      // Don't fail the order completion if email fails
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder
    }, { headers: noStoreHeaders });

  } catch (error) {
    console.error('❌ Order completion API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500, headers: noStoreHeaders });
  }
});
