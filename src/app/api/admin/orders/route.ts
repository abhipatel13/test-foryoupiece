import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

/**
 * Get all orders for admin dashboard
 * GET /api/admin/orders
 */
export async function GET(request: NextRequest) {
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
}

/**
 * Update order status (Admin)
 * PATCH /api/admin/orders
 */
export async function PATCH(request: NextRequest) {
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

    // Determine which status field to update
    const updateField = statusType === 'payment' ? 'payment_status' : 'fulfillment_status';
    
    const { data, error } = await supabase
      .from('orders')
      .update({ [updateField]: status })
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
}
