import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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

    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'Service unavailable'
      }, { status: 500 })
    }

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 })
    }

    const body = await request.json();
    const { orderData, orderItems } = body;

    if (!orderData || !orderItems) {
      return NextResponse.json({
        success: false,
        error: 'Missing order data or items'
      }, { status: 400 });
    }

    // Bind order to authenticated user
    orderData.user_id = user.id;

    console.log('📦 Creating order with data:', {
      userId: orderData.user_id,
      pointsUsed: orderData.points_used,
      totalAmount: orderData.total_amount,
      itemCount: orderItems.length
    });



    // Process points redemption if applicable (server-side only)
    if (orderData.points_used && orderData.points_used > 0) {
      console.log(`💰 Processing points redemption: ${orderData.points_used} points`);

      try {
        // Use RPC function directly with authenticated server client
        const { data: redemptionSuccess, error: redemptionError } = await supabase.rpc('redeem_user_points', {
          p_user_id: orderData.user_id,
          p_points: orderData.points_used,
          p_description: 'Points redeemed for order',
          p_reference_id: null // Will be updated after order creation
        });

        if (redemptionError || !redemptionSuccess) {
          console.error('❌ Points redemption failed:', redemptionError);
          return NextResponse.json({
            success: false,
            error: redemptionError?.message || 'Failed to redeem points'
          }, { status: 400 });
        }

        console.log('✅ Points redemption successful');
      } catch (error: any) {
        console.error('❌ Points redemption error:', error);
        return NextResponse.json({
          success: false,
          error: 'Points redemption failed: ' + error.message
        }, { status: 400 });
      }
    }

    // CRITICAL: Reserve stock atomically BEFORE creating order to prevent race conditions
    console.log('🔒 Attempting to reserve stock for order items...');

    try {
      // Prepare order items for stock reservation
      const stockReservationItems = orderItems.map((item: any) => ({
        product_id: item.product_id,
        quantity: item.quantity
      }));

      console.log('📦 Stock reservation request:', {
        itemCount: stockReservationItems.length,
        items: stockReservationItems.map((item: any) => ({
          product_id: item.product_id,
          quantity: item.quantity
        }))
      });

      // Atomically reserve stock using database function with row-level locking
      const { data: reservationResult, error: reservationError } = await supabase.rpc(
        'reserve_stock_for_order',
        { order_items: stockReservationItems }
      );

      if (reservationError) {
        console.error('❌ Stock reservation database error:', reservationError);
        return NextResponse.json({
          success: false,
          error: 'Failed to reserve stock: ' + reservationError.message
        }, { status: 500 });
      }

      if (!reservationResult.success) {
        console.error('❌ Stock reservation failed:', reservationResult);

        // Return detailed error information for insufficient stock
        const errorDetails = {
          message: reservationResult.error,
          failures: reservationResult.failures || [],
          failedItems: reservationResult.failed_reservations || 0,
          totalItems: reservationResult.total_items || 0
        };

        return NextResponse.json({
          success: false,
          error: 'Insufficient stock for one or more items',
          details: errorDetails
        }, { status: 400 });
      }

      console.log('✅ Stock reserved successfully:', {
        totalItems: reservationResult.total_items,
        totalQuantityReserved: reservationResult.total_quantity_reserved,
        reservationDetails: reservationResult.reservations
      });

    } catch (error: any) {
      console.error('❌ Stock reservation error:', error);
      return NextResponse.json({
        success: false,
        error: 'Stock reservation failed: ' + error.message
      }, { status: 500 });
    }

    // Process coupon application if applicable
    if (orderData.coupon_code && orderData.coupon_discount_amount > 0) {
      console.log(`🎫 Processing coupon application: ${orderData.coupon_code}`);

      try {
        // Import coupon service
        const { couponService } = await import('@/lib/services/coupon-service');

        // Apply coupon to order (this will be done after order creation)
        // For now, just validate the coupon
        const validationResult = await couponService.validateCoupon(
          orderData.coupon_code,
          orderData.user_id,
          orderData.subtotal + orderData.shipping_cost
        );

        if (!validationResult.isValid) {
          console.error('❌ Coupon validation failed:', validationResult.errorMessage);

          // Rollback stock reservation since order creation will fail
          console.log('🔄 Rolling back stock reservation due to coupon validation failure...');
          try {
            await supabase.rpc('rollback_stock_reservation', {
              order_items: orderItems.map((item: any) => ({
                product_id: item.product_id,
                quantity: item.quantity
              }))
            });
            console.log('✅ Stock reservation rolled back successfully');
          } catch (rollbackError: any) {
            console.error('🚨 CRITICAL: Failed to rollback stock reservation:', rollbackError);
          }

          return NextResponse.json({
            success: false,
            error: validationResult.errorMessage || 'Invalid coupon'
          }, { status: 400 });
        }

        console.log('✅ Coupon validation successful');
      } catch (error: any) {
        console.error('❌ Coupon validation error:', error);

        // Rollback stock reservation since order creation will fail
        console.log('🔄 Rolling back stock reservation due to coupon validation error...');
        try {
          await supabase.rpc('rollback_stock_reservation', {
            order_items: orderItems.map((item: any) => ({
              product_id: item.product_id,
              quantity: item.quantity
            }))
          });
          console.log('✅ Stock reservation rolled back successfully');
        } catch (rollbackError: any) {
          console.error('🚨 CRITICAL: Failed to rollback stock reservation:', rollbackError);
        }

        return NextResponse.json({
          success: false,
          error: 'Coupon validation failed: ' + error.message
        }, { status: 400 });
      }
    }

    // Create order with retry logic for duplicate key constraints
    let order;
    try {
      order = await createOrderWithRetry(supabase, orderData, 3);
    } catch (orderError: any) {
      console.error('❌ Order creation failed after all retries:', orderError);

      // CRITICAL: Rollback stock reservation since order creation failed
      console.log('🔄 Rolling back stock reservation due to order creation failure...');
      try {
        const rollbackResult = await supabase.rpc('rollback_stock_reservation', {
          order_items: orderItems.map((item: any) => ({
            product_id: item.product_id,
            quantity: item.quantity
          }))
        });

        if (rollbackResult.error) {
          console.error('🚨 CRITICAL: Stock rollback failed:', rollbackResult.error);
        } else {
          console.log('✅ Stock reservation rolled back successfully:', rollbackResult.data);
        }
      } catch (rollbackError: any) {
        console.error('🚨 CRITICAL: Failed to rollback stock reservation:', rollbackError);
        // This is a critical error that requires manual intervention
      }

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

      // CRITICAL: Rollback stock reservation since order items creation failed
      console.log('🔄 Rolling back stock reservation due to order items creation failure...');
      try {
        const rollbackResult = await supabase.rpc('rollback_stock_reservation', {
          order_items: orderItems.map((item: any) => ({
            product_id: item.product_id,
            quantity: item.quantity
          }))
        });

        if (rollbackResult.error) {
          console.error('🚨 CRITICAL: Stock rollback failed:', rollbackResult.error);
        } else {
          console.log('✅ Stock reservation rolled back successfully');
        }
      } catch (rollbackError: any) {
        console.error('🚨 CRITICAL: Failed to rollback stock reservation:', rollbackError);
      }

      // Also rollback points if they were redeemed
      if (pointsTransactionId && orderData.points_used > 0) {
        console.log('🔄 Attempting to refund points due to order items creation failure...');
        try {
          const pointsService = new PointsService(true);
          await pointsService.addPoints(
            orderData.user_id,
            orderData.points_used,
            'Points refunded due to order items creation failure',
            pointsTransactionId
          );
          console.log('✅ Points refunded successfully');
        } catch (refundError: any) {
          console.error('🚨 CRITICAL: Failed to refund points:', refundError);
        }
      }

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

    // NOTE: Stock has already been reserved atomically before order creation
    // No additional stock deduction needed - this prevents race conditions
    console.log('📦 Stock was already reserved during order validation - no additional deduction needed');

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

    // Apply coupon to order if applicable
    if (orderData.coupon_code && orderData.coupon_discount_amount > 0) {
      try {
        console.log(`🎫 Applying coupon ${orderData.coupon_code} to order ${order.id}`);

        const { couponService } = await import('@/lib/services/coupon-service');

        const applicationResult = await couponService.applyCouponToOrder(
          orderData.coupon_code,
          orderData.user_id,
          order.id,
          orderData.subtotal + orderData.shipping_cost
        );

        if (!applicationResult.success) {
          console.error('❌ Coupon application failed:', applicationResult.errorMessage);
          // Don't fail the order, but log the error
          console.warn('⚠️ Order created successfully but coupon application failed');
        } else {
          console.log('✅ Coupon applied successfully to order');
        }
      } catch (error: any) {
        console.error('❌ Coupon application error:', error);
        // Don't fail the order, but log the error
        console.warn('⚠️ Order created successfully but coupon application failed');
      }
    }

    // 📱 Send Telegram notification for new order (admin) + enqueue customer confirmation email
    try {
      console.log('📱 Triggering notifications for order:', order.order_number);

      // Admin/internal telegram notification service
      const { telegramNotificationService } = await import('@/lib/telegram/notification-service');

      // Get complete order data for admin telegram message
      const { data: orderWithDetails, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', order.id)
        .single();

      // Get order items separately
      let orderItems = [];
      if (orderWithDetails && !orderError) {
        const { data: items } = await supabase
          .from('order_items')
          .select('title, quantity, price, total')
          .eq('order_id', order.id);
        orderItems = items || [];
      }

      // Get user profile separately from users table
      let userProfile = null;
      if (orderWithDetails && orderWithDetails.user_id) {
        const { data: profile } = await supabase
          .from('users')
          .select('first_name, last_name, aba_bank_name, telegram_id')
          .eq('id', orderWithDetails.user_id)
          .single();
        userProfile = profile;
      }

      // Combine order data with profile and order items
      const completeOrderData = {
        ...orderWithDetails,
        order_items: orderItems,
        profiles: userProfile
      };

      if (completeOrderData && !orderError) {
        // Admin group notification (unchanged)
        const notificationSent = await telegramNotificationService.sendOrderNotification(completeOrderData);
        if (notificationSent) {
          console.log('✅ Telegram notification sent successfully to notification group');
          console.log('📱 Waiting for "/arrived" confirmation before sending delivery notification');
        } else {
          console.error('❌ Failed to send Telegram notification');
        }

        // Enhanced customer order confirmation with fallback (hybrid approach)
        try {
          console.log('📧 Processing customer order confirmation for order:', order.id);

          // First, try to enqueue using the new transactional outbox pattern
          try {
            const { error: enqueueError } = await supabase.rpc('enqueue_email_message', {
              p_order_id: order.id,
              p_email_type: 'order_confirmation',
              p_payload: {
                order_number: order.order_number,
                customer_email: order.email,
                enqueued_at: new Date().toISOString()
              }
            });

            if (enqueueError) {
              console.error('❌ Failed to enqueue email, falling back to direct send:', enqueueError);
              throw new Error(`Enqueue failed: ${enqueueError.message}`);
            } else {
              console.log('✅ Customer order confirmation email enqueued successfully');

              // Immediately process the queue for instant delivery (hybrid approach)
              try {
                const { customerNotificationService } = await import('@/lib/services/customer-notification-service');
                // In production serverless runtime, non-awaited async work can be aborted after response returns.
                // Await the immediate processing to ensure DMs/emails are dispatched reliably.
                await customerNotificationService.sendOrderConfirmation(order.id)
                console.log('✅ Immediate email processing completed')
              } catch (immediateErr: any) {
                console.warn('⚠️ Could not trigger immediate processing:', immediateErr?.message || immediateErr);
              }
            }
          } catch (enqueueErr: any) {
            console.error('❌ Enqueue failed, using direct fallback:', enqueueErr?.message || enqueueErr);

            // Fallback to the original direct method
            const { customerNotificationService } = await import('@/lib/services/customer-notification-service');
            customerNotificationService
              .sendOrderConfirmation(order.id)
              .then(() => console.log('✅ Fallback customer order confirmation dispatched'))
              .catch((e: any) => console.warn('⚠️ Fallback customer order confirmation failed:', e?.message || e));
          }
        } catch (overallErr: any) {
          console.error('❌ Overall customer notification error:', overallErr?.message || overallErr);
        }
      } else {
        console.error('❌ Failed to fetch order details for Telegram notification:', orderError);
      }
    } catch (telegramError) {
      console.error('❌ Error triggering notifications:', telegramError);
      // Don't fail the order creation if notifications fail
    }

    // 🔔 Enqueue Meta CAPI Purchase (non-blocking)
    try {
      const consentCookie = request.cookies.get('fyp_consent_marketing')?.value === 'true'
      if (consentCookie) {
        // Forward client hints and cookies to ensure fbp/fbc/ip/ua are available in the analytics route
        const fbp = request.cookies.get('_fbp')?.value
        const fbc = request.cookies.get('_fbc')?.value
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        const ua = request.headers.get('user-agent') || undefined

        await fetch(`/api/analytics/queue-purchase`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: order.id, consent: true, client: { fbp, fbc, ip, ua } })
        })
      } else {
        console.log('📉 Meta CAPI enqueue skipped (no marketing consent)')
      }
    } catch (err: any) {
      console.warn('⚠️ Meta CAPI enqueue error (non-fatal):', err?.message || err)
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

/**
 * Send ORDER CONFIRMATION message to stock group for automatic processing
 */
async function sendOrderConfirmationToStockGroup(order: any): Promise<void> {
  const stockBotToken = process.env.TELEGRAM_STOCK_BOT_TOKEN;
  const stockGroupId = process.env.TELEGRAM_STOCK_GROUP_ID;
  const stockThreadId = process.env.TELEGRAM_STOCK_THREAD_ID;

  if (!stockBotToken || !stockGroupId || !stockThreadId) {
    console.warn('⚠️ Stock bot configuration incomplete, skipping ORDER CONFIRMATION message');
    return;
  }

  try {
    // Format customer info
    const customerName = order.profiles?.first_name && order.profiles?.last_name
      ? `${order.profiles.first_name} ${order.profiles.last_name}`
      : order.profiles?.first_name || 'Unknown Customer';

    const phoneNumber = order.shipping_address?.phone || order.profiles?.phone || 'Not provided';

    // Format address
    const address = order.shipping_address;
    const addressLines = [];
    if (address?.address1) addressLines.push(address.address1);
    if (address?.address2) addressLines.push(address.address2);
    const addressComponents = [
      ...addressLines,
      address?.city,
      address?.country,
      address?.postal_code
    ].filter(component => component && component.trim() !== '');
    const fullAddress = addressComponents.length > 0 ? addressComponents.join(', ') : 'Not provided';

    // Format items in the exact format expected by the stock webhook
    const items = order.order_items?.map((item: any, index: number) => {
      return `${index + 1}. ${item.title} *${item.quantity} =${item.price}$`;
    }).join('\n') || 'No items found';

    // Calculate pricing
    const subtotal = order.subtotal || 0;
    const shippingFee = order.shipping_fee || 0;
    const discount = order.discount_amount || 0;
    const pointsUsed = order.points_used || 0;
    const pointsValue = pointsUsed / 1000; // Convert points to dollar value
    const totalAmount = order.total_amount || 0;

    // Create ORDER CONFIRMATION message in the exact format expected
    const orderConfirmationMessage = `🎀✨ ORDER CONFIRMATION ✨🎀

👤 Customer Info
Name: ${customerName}
Phone number: ${phoneNumber}
Address: ${fullAddress}

🛒 Items
Item name x Qty = Price
${items}

💰 Pricing Summary
• Delivery Fee: $ ${shippingFee.toFixed(0)}
• Total amount: $ ${totalAmount.toFixed(0)}
• Deposit: $
• Amount Due: $ ${totalAmount.toFixed(0)} ✅✅

📌 Important Notes
🚨 Final Sale : Orders are final and non-refundable. No cancellations, returns, or exchanges accepted.
🚚 Delivery : We will notify you once your items are ready for delivery.

🙏 Thank you for your purchase! 🤍`;

    console.log('📦 Sending ORDER CONFIRMATION message to stock group:', {
      groupId: stockGroupId,
      threadId: stockThreadId,
      orderNumber: order.order_number
    });

    // Add timeout guard to Telegram call to avoid serverless timeouts
    const tgController = new AbortController();
    const tgTimeout = setTimeout(() => tgController.abort(), 12000);
    const response = await fetch(`https://api.telegram.org/bot${stockBotToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: stockGroupId,
        message_thread_id: parseInt(stockThreadId),
        text: orderConfirmationMessage
      }),
      signal: tgController.signal,
    }).finally(() => clearTimeout(tgTimeout));

    if (response.ok) {
      const result = await response.json();
      console.log('✅ ORDER CONFIRMATION message sent to stock group successfully:', result.result?.message_id);
    } else {
      const error = await response.text();
      console.error('❌ Failed to send ORDER CONFIRMATION message to stock group:', error);
    }

  } catch (error) {
    console.error('❌ Error sending ORDER CONFIRMATION message to stock group:', error);
    throw error;
  }
}
