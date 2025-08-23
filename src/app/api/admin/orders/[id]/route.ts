import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { withAdminAuth } from '@/lib/auth/admin-middleware'
import {
  handleDatabaseError,
  handleGenericError
} from '@/lib/security/error-sanitizer';

/**
 * Get specific order details for admin
 * GET /api/admin/orders/[id]
 */
export const GET = withAdminAuth(async (
  request: NextRequest,
  { user, adminUser },
  { params }: { params: { id: string } }
) => {
  try {
    const orderId = params.id;
    console.log('📋 Admin Order Details API called for ID:', orderId);

    if (!orderId) {
      return NextResponse.json({
        success: false,
        error: 'Order ID is required'
      }, { status: 400 });
    }

    // Use service role client to bypass RLS
    const supabase = createServiceRoleClient();
    
    if (!supabase) {
      console.error('❌ Failed to create service role client');
      return NextResponse.json({
        success: false,
        error: 'Service configuration error'
      }, { status: 500 });
    }

    console.log('🔧 Service role client created successfully');

    // Fetch order with all related data including product images
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        users!orders_user_id_fkey(
          first_name,
          last_name,
          email,
          phone,
          telegram_username
        ),
        order_items(
          id,
          product_id,
          variant_id,
          sku,
          title,
          variant_title,
          quantity,
          price,
          total
        ),
        coupons(
          id,
          code,
          discount_type,
          discount_value
        )
      `)
      .eq('id', orderId)
      .single();

    if (error) {
      return handleDatabaseError(error, {
        operation: 'fetch_order',
        orderId,
        userId: user.id
      }, 'order fetch');
    }

    if (!order) {
      return NextResponse.json({
        success: false,
        error: 'Order not found'
      }, { status: 404 });
    }

    console.log('✅ Order details fetched successfully:', order.order_number);

    // Extract ABA Bank Name from notes (similar to Telegram notification logic)
    const notes = order.notes || '';
    const abaBankNameMatch = notes.match(/ABA Bank Name:\s*([^.]+)\.?/i);
    const abaBankName = abaBankNameMatch ? abaBankNameMatch[1].trim() : null;

    // Extract special notes (everything except ABA bank name)
    const specialNotes = notes.replace(/ABA Bank Name:\s*[^.]+\.?\s*/i, '').trim();

    // Parse shipping address from JSON field
    const shippingAddress = order.shipping_address ?
      (typeof order.shipping_address === 'string' ?
        JSON.parse(order.shipping_address) :
        order.shipping_address) : null;

    // Parse billing address from JSON field
    const billingAddress = order.billing_address ?
      (typeof order.billing_address === 'string' ?
        JSON.parse(order.billing_address) :
        order.billing_address) : null;

    // Check for ABA bank name in shipping address (newer format)
    let finalAbaBankName = abaBankName;
    if (!finalAbaBankName && shippingAddress?.abaBankName) {
      finalAbaBankName = shippingAddress.abaBankName;
    }
    if (!finalAbaBankName && shippingAddress?.aba_bank_name) {
      finalAbaBankName = shippingAddress.aba_bank_name;
    }

    // Get customer name from shipping address first, then fall back to user profile
    let customerName = '';
    if (shippingAddress?.firstName && shippingAddress?.lastName) {
      customerName = `${shippingAddress.firstName} ${shippingAddress.lastName}`.trim();
    } else if (shippingAddress?.first_name && shippingAddress?.last_name) {
      customerName = `${shippingAddress.first_name} ${shippingAddress.last_name}`.trim();
    } else if (order.users?.first_name || order.users?.last_name) {
      customerName = `${order.users.first_name || ''} ${order.users.last_name || ''}`.trim();
    }

    // Transform the data to match the expected format
    const transformedOrder = {
      ...order,
      customer_name: customerName || null,
      customer_phone: order.phone || order.users?.phone || null,
      aba_bank_name: finalAbaBankName,
      special_notes: specialNotes,
      shipping_address: shippingAddress,
      billing_address: billingAddress,
      user: order.users,
      coupon_info: order.coupons,
      // Transform order items to match expected format
      order_items: order.order_items?.map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.title,
        product_sku: item.sku,
        product_image_url: null, // We'll fetch this separately if needed
        quantity: item.quantity,
        unit_price: parseFloat(item.price),
        total_price: parseFloat(item.total),
        variant_title: item.variant_title
      })) || [],
      // Calculate subtotal from order items
      subtotal: order.order_items?.reduce((sum: number, item: any) => sum + parseFloat(item.total), 0) || 0,
      // Shipping cost calculation
      shipping_cost: order.shipping_cost || 1.50,
      // Tax amount
      tax_amount: order.tax_amount || 0
    };

    return NextResponse.json({
      success: true,
      order: transformedOrder
    });

  } catch (error) {
    console.error('❌ Admin Order Details API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});

/**
 * Update specific order details (Admin)
 * PATCH /api/admin/orders/[id]
 */
export const PATCH = withAdminAuth(async (
  request: NextRequest,
  { user, adminUser },
  { params }: { params: { id: string } }
) => {
  try {
    const orderId = params.id;
    console.log('📝 Admin Order Update API called for ID:', orderId);
    
    const body = await request.json();
    const { status, statusType, notes } = body;

    if (!orderId) {
      return NextResponse.json({
        success: false,
        error: 'Order ID is required'
      }, { status: 400 });
    }

    if (!status || !statusType) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: status, statusType'
      }, { status: 400 });
    }

    console.log('📝 Updating order:', { orderId, status, statusType, notes });

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
      .select('payment_status, fulfillment_status, admin_notes')
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
        processed_by_user: `Admin: ${user.email}`
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

    // Update admin notes separately if provided (this doesn't trigger the problematic trigger)
    if (notes) {
      const { error: notesError } = await supabase
        .from('orders')
        .update({ admin_notes: notes })
        .eq('id', orderId);

      if (notesError) {
        console.warn('⚠️ Failed to update admin notes:', notesError);
        // Don't fail the entire request for notes update failure
      }
    }

    // Fetch the updated order data
    const { data, error } = await supabase
      .from('orders')
      .select()
      .eq('id', orderId)
      .single();

    if (error) {
      console.error('❌ Error updating order:', error);
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
