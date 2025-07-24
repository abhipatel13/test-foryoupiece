import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/client';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { PointsService } from '@/lib/services/points-service';
import { Tables } from '@/lib/supabase/types';

/**
 * Generate a unique order number with timestamp and random suffix
 * Format: FYP-YYYYMMDD-{timestamp}-{random}
 */
function generateOrderNumber(): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `FYP-${dateStr}-${timestamp}-${randomSuffix}`;
}

/**
 * Create order with retry logic for duplicate key constraints
 */
async function createOrderWithRetry(supabase: any, orderData: any, maxRetries: number = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const orderNumber = generateOrderNumber();
      const finalOrderData = {
        ...orderData,
        order_number: orderNumber,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Remove temp fields that shouldn't be stored in the database
      delete finalOrderData.points_transaction_id;

      console.log(`📦 Attempting to create order (attempt ${attempt}/${maxRetries}) with order number: ${orderNumber}`);

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(finalOrderData)
        .select()
        .single();

      if (orderError) {
        console.error(`❌ Database error on attempt ${attempt}:`, {
          code: orderError.code,
          message: orderError.message,
          hint: orderError.hint,
          details: orderError.details
        });

        // Check if it's a duplicate key constraint error
        if (orderError.code === '23505' && attempt < maxRetries) {
          console.warn(`⚠️ Duplicate key constraint detected (attempt ${attempt}), retrying with new order number...`);
          console.warn(`🔍 Constraint details:`, orderError.message);
          // Exponential backoff: wait 100ms, 200ms, 300ms...
          await new Promise(resolve => setTimeout(resolve, 100 * attempt));
          continue;
        }

        // If it's not a duplicate key error or we've exhausted retries, throw the error
        throw orderError;
      }

      console.log('✅ Order created successfully:', order.id);
      return order;

    } catch (error: any) {
      if (attempt === maxRetries) {
        console.error(`❌ Order creation failed after ${maxRetries} attempts:`, error);
        throw error;
      }
    }
  }
}

/**
 * Health check for order creation API
 * GET /api/orders/create
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Order creation API is running',
    timestamp: new Date().toISOString()
  });
}

/**
 * Create Order API with Points Redemption
 * POST /api/orders/create
 */
export async function POST(request: NextRequest) {
  let pointsTransactionId: string | null = null;

  try {
    console.log('📦 Order creation API called');

    const body = await request.json();
    const { orderData, orderItems } = body;

    if (!orderData || !orderItems) {
      return NextResponse.json({
        success: false,
        error: 'Missing order data or items'
      }, { status: 400 });
    }

    console.log('📦 Creating order with data:', {
      userId: orderData.user_id,
      pointsUsed: orderData.points_used,
      totalAmount: orderData.total_amount,
      itemCount: orderItems.length
    });

    // Use service role client for order operations to bypass RLS
    const supabase = createServiceRoleClient();

    if (!supabase) {
      console.error('❌ Service role client not available');
      return NextResponse.json({
        success: false,
        error: 'Service unavailable'
      }, { status: 500 });
    }

    // Process points redemption if applicable (server-side only)
    if (orderData.points_used && orderData.points_used > 0) {
      console.log(`💰 Processing points redemption: ${orderData.points_used} points`);

      try {
        // Use enhanced points service for better validation and security
        const pointsService = new PointsService(true); // Enable service role for server-side operations
        const redemptionResult = await pointsService.redeemPoints(
          orderData.user_id,
          orderData.points_used,
          `Points redeemed for order`,
          undefined // Don't pass reference_id initially, will be updated after order creation
        );

        if (!redemptionResult.success) {
          console.error('❌ Points redemption failed:', redemptionResult.error);
          return NextResponse.json({
            success: false,
            error: redemptionResult.error || 'Failed to redeem points'
          }, { status: 400 });
        }

        console.log('✅ Points redemption successful');
        // Store transaction ID for later reference update and potential rollback
        pointsTransactionId = redemptionResult.transaction?.id || null;
        orderData.points_transaction_id = pointsTransactionId;
      } catch (error: any) {
        console.error('❌ Points redemption error:', error);
        return NextResponse.json({
          success: false,
          error: 'Points redemption failed: ' + error.message
        }, { status: 400 });
      }
    }

    // Create order with retry logic for duplicate key constraints
    let order;
    try {
      order = await createOrderWithRetry(supabase, orderData, 3);
    } catch (orderError: any) {
      console.error('❌ Order creation failed after all retries:', orderError);

      // If order creation fails and points were redeemed, refund them
      if (pointsTransactionId && orderData.points_used > 0) {
        console.log('🔄 Attempting to refund points due to order creation failure...');
        try {
          const pointsService = new PointsService(true);
          await pointsService.addPoints(
            orderData.user_id,
            orderData.points_used,
            'Points refunded due to order creation failure',
            pointsTransactionId
          );
          console.log('✅ Points refunded successfully');
        } catch (refundError: any) {
          console.error('🚨 CRITICAL: Failed to refund points after order creation failure:', refundError);
          // This is a critical error that requires manual intervention
        }
      }

      // Return appropriate error response
      if (orderError.code === '23505') {
        return NextResponse.json({
          success: false,
          error: 'Unable to create order due to system conflict. Please try again.',
          details: {
            code: orderError.code,
            message: orderError.message,
            hint: orderError.hint
          }
        }, { status: 409 });
      }

      // Return detailed error for other database errors
      return NextResponse.json({
        success: false,
        error: orderError.message || 'Failed to create order',
        details: {
          code: orderError.code,
          message: orderError.message,
          hint: orderError.hint
        }
      }, { status: 500 });
    }

    // Insert order items
    const itemsWithOrderId = orderItems.map((item: any) => ({
      ...item,
      order_id: order.id
    }));

    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsWithOrderId)
      .select();

    if (itemsError) {
      console.error('❌ Order items creation failed:', itemsError);
      return NextResponse.json({
        success: false,
        error: 'Failed to create order items: ' + (itemsError.message || 'Unknown error'),
        details: {
          code: itemsError.code,
          message: itemsError.message,
          hint: itemsError.hint
        }
      }, { status: 500 });
    }

    console.log('✅ Order items created successfully');

    // Update stock for each item
    for (const item of orderItems) {
      console.log(`📦 Updating stock for product ${item.product_id}, reducing by ${item.quantity}`);

      const { error: stockError } = await supabase.rpc('update_product_stock', {
        product_id: item.product_id,
        quantity_change: -item.quantity
      });

      if (stockError) {
        console.error(`❌ Stock update failed for product ${item.product_id}:`, stockError);
        // Continue with other items even if one fails
      } else {
        console.log(`✅ Stock updated for product ${item.product_id}`);
      }
    }

    // Update points reference with order ID if points were redeemed
    if (orderData.points_used > 0 && pointsTransactionId) {
      try {
        await supabase
          .from('point_transactions')
          .update({ reference_id: order.id })
          .eq('id', pointsTransactionId);

        console.log('✅ Points transaction reference updated with order ID');
      } catch (error) {
        console.warn('⚠️ Failed to update points transaction reference:', error);
        // Non-critical error, don't fail the order
      }
    }

    return NextResponse.json({
      success: true,
      order: {
        ...order,
        items
      }
    });

  } catch (error: any) {
    console.error('❌ Order creation API error:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
      details: error.details
    });

    // If there's an unexpected error and points were redeemed, attempt refund
    if (pointsTransactionId && orderData?.points_used > 0) {
      console.log('🔄 Attempting to refund points due to unexpected error...');
      try {
        const pointsService = new PointsService(true);
        await pointsService.addPoints(
          orderData.user_id,
          orderData.points_used,
          'Points refunded due to order processing error',
          pointsTransactionId
        );
        console.log('✅ Points refunded successfully');
      } catch (refundError: any) {
        console.error('🚨 CRITICAL: Failed to refund points after unexpected error:', refundError);
      }
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to create order',
      details: {
        code: error.code,
        message: error.message,
        hint: error.hint
      }
    }, { status: 500 });
  }
}
