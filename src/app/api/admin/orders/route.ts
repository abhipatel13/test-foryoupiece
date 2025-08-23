import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { withAdminAuth } from '@/lib/auth/admin-middleware';

/**
 * Get all orders for admin dashboard
 * GET /api/admin/orders
 */
export const GET = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('📋 Admin Orders API called');
    
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    console.log('📊 Query params:', { status, search, limit, offset });

    // Use service role client to bypass RLS
    const supabase = createServiceRoleClient();
    
    if (!supabase) {
      console.error('❌ Failed to create service role client');
      return NextResponse.json({
        success: false,
        error: 'Service configuration error',
        orders: []
      }, { status: 500 });
    }

    console.log('🔧 Service role client created successfully');

    let query = supabase
      .from('orders')
      .select(`
        *,
        users!orders_user_id_fkey(first_name, last_name, email),
        order_items(*)
      `);

    // Apply status filter
    if (status && status !== 'all') {
      if (['on_hold', 'processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
        query = query.eq('fulfillment_status', status);
        console.log('🔍 Filtering by fulfillment_status:', status);
      } else {
        query = query.eq('payment_status', status);
        console.log('🔍 Filtering by payment_status:', status);
      }
    }

    // Apply search filter
    if (search) {
      query = query.or(`order_number.ilike.%${search}%,customer_email.ilike.%${search}%`);
      console.log('🔍 Searching for:', search);
    }

    // Apply ordering and pagination
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    console.log('📋 Executing orders query...');
    const { data: orders, error } = await query;

    if (error) {
      console.error('❌ Error fetching orders:', error);
      return NextResponse.json({
        success: false,
        error: error.message,
        orders: []
      }, { status: 500 });
    }

    console.log('✅ Orders fetched successfully:', orders?.length || 0, 'orders');

    return NextResponse.json({
      success: true,
      orders: orders || [],
      total: orders?.length || 0
    });

  } catch (error) {
    console.error('❌ Admin Orders API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      orders: []
    }, { status: 500 });
  }
});

/**
 * Update order status (Admin)
 * PATCH /api/admin/orders
 */
export const PATCH = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('📝 Admin Order Update API called');
    
    const body = await request.json();
    const { orderId, status, statusType } = body;

    if (!orderId || !status || !statusType) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: orderId, status, statusType'
      }, { status: 400 });
    }

    console.log('📝 Updating order:', { orderId, status, statusType });

    // Use service role client to bypass RLS
    const supabase = createServiceRoleClient();
    
    if (!supabase) {
      console.error('❌ Failed to create service role client');
      return NextResponse.json({
        success: false,
        error: 'Service configuration error'
      }, { status: 500 });
    }

    // Get current order to preserve other status field
    const { data: currentOrder, error: fetchError } = await supabase
      .from('orders')
      .select('payment_status, fulfillment_status')
      .eq('id', orderId)
      .single();

    if (fetchError) {
      console.error('❌ Error fetching current order:', fetchError);
      return NextResponse.json({
        success: false,
        error: fetchError.message
      }, { status: 500 });
    }

    // Use Telegram-aware RPC function to safely update order status
    console.log('🔧 Using Telegram-aware RPC function to update order status');
    const newPaymentStatus = statusType === 'payment' ? status : currentOrder.payment_status;
    const newFulfillmentStatus = statusType === 'fulfillment' ? status : currentOrder.fulfillment_status;

    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('update_order_status_with_telegram', {
        order_id: orderId,
        new_payment_status: newPaymentStatus,
        new_fulfillment_status: newFulfillmentStatus,
        processed_by_user: `Admin: ${adminUser.email}`
      });

    if (rpcError) {
      console.error('❌ RPC function error:', rpcError);
      return NextResponse.json({
        success: false,
        error: rpcError.message
      }, { status: 500 });
    }

    if (!rpcResult) {
      console.error('❌ RPC function returned false - update failed');
      return NextResponse.json({
        success: false,
        error: 'Failed to update order status'
      }, { status: 500 });
    }

    // Fetch the updated order data
    const { data, error } = await supabase
      .from('orders')
      .select()
      .eq('id', orderId)
      .single();

    if (error) {
      console.error('❌ Error fetching updated order:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    console.log('✅ Order updated successfully:', data);

    // Send email notification for status changes
    try {
      // Check if this is a significant status change that requires email notification
      const shouldSendEmail = (
        (statusType === 'fulfillment' && status === 'shipped') ||
        (statusType === 'fulfillment' && status === 'delivered') ||
        (statusType === 'fulfillment' && status === 'cancelled')
      );

      if (shouldSendEmail) {
        console.log(`📧 Sending ${status} email notification for order ${orderId}...`);

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

          // Determine notification type based on status
          let notificationType: 'order_shipped' | 'order_cancelled';
          if (status === 'shipped') {
            notificationType = 'order_shipped';
          } else if (status === 'cancelled') {
            notificationType = 'order_cancelled';
          } else {
            // For delivered status, we don't have a specific notification type yet
            // Skip email notification for now
            console.log(`📧 Skipping email notification for ${status} status - no notification type defined`);
            return NextResponse.json({
              success: true,
              order: data
            });
          }

          // Send email notification
          await sendCustomerNotification({
            type: notificationType,
            orderId: orderDetails.id,
            orderNumber: orderDetails.order_number,
            customerEmail: orderDetails.users?.email || orderDetails.email,
            customerName: `${orderDetails.users?.first_name || orderDetails.first_name || ''} ${orderDetails.users?.last_name || orderDetails.last_name || ''}`.trim(),
            orderTotal: orderDetails.total_amount,
            orderItems: orderDetails.order_items || [],
            shippingAddress: orderDetails.shipping_address,
            pointsRefunded: status === 'cancelled' ? orderDetails.points_used || 0 : undefined,
            cancellationReason: status === 'cancelled' ? 'Cancelled by admin' : undefined
          });

          console.log(`✅ ${status} email notification sent successfully for order ${orderId}`);
        }
      }
    } catch (emailError) {
      console.error(`❌ Failed to send ${status} email notification:`, emailError);
      // Don't fail the order update if email fails
    }

    return NextResponse.json({
      success: true,
      order: data
    });

  } catch (error) {
    console.error('❌ Admin Order Update API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});
