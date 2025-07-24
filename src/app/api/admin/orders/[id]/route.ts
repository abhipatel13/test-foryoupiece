import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { withAdminAuth } from '@/lib/auth/admin-middleware';

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

    // Fetch order with all related data
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
        )
      `)
      .eq('id', orderId)
      .single();

    if (error) {
      console.error('❌ Error fetching order details:', error);
      
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          success: false,
          error: 'Order not found'
        }, { status: 404 });
      }
      
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    if (!order) {
      return NextResponse.json({
        success: false,
        error: 'Order not found'
      }, { status: 404 });
    }

    console.log('✅ Order details fetched successfully:', order.order_number);

    // Transform the data to match the expected format
    const transformedOrder = {
      ...order,
      customer_name: order.users?.first_name && order.users?.last_name
        ? `${order.users.first_name} ${order.users.last_name}`
        : null,
      customer_phone: order.users?.phone || null,
      user: order.users,
      // Transform order items to match expected format
      order_items: order.order_items?.map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.title,
        product_sku: item.sku,
        product_image_url: null, // We'll need to fetch this from products table if needed
        quantity: item.quantity,
        unit_price: parseFloat(item.price),
        total_price: parseFloat(item.total)
      })) || [],
      // Calculate subtotal from order items
      subtotal: order.order_items?.reduce((sum: number, item: any) => sum + parseFloat(item.total), 0) || 0,
      // Shipping cost calculation (assuming $1.50 base shipping)
      shipping_cost: order.shipping_cost || 1.50,
      // Tax amount (assuming no tax for now)
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

    // Determine which status field to update
    const updateField = statusType === 'payment' ? 'payment_status' : 'fulfillment_status';
    
    const updateData: any = { [updateField]: status };
    if (notes) {
      updateData.admin_notes = notes;
    }
    
    const { data, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating order:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    console.log('✅ Order updated successfully:', data);

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
