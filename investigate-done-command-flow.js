#!/usr/bin/env node

/**
 * INVESTIGATE /done COMMAND EXECUTION FLOW
 * This script traces the exact execution path of the /done command
 */

require('dotenv').config({ path: '.env.local' });

async function investigateDoneCommandFlow() {
  console.log('🔍 INVESTIGATING /done COMMAND EXECUTION FLOW');
  console.log('='.repeat(80));
  
  try {
    const { createClient } = await import('@supabase/supabase-js');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Step 1: Check what the /done command actually processes
    console.log('📋 STEP 1: CHECKING WHAT /done COMMAND PROCESSES');
    console.log('-'.repeat(60));
    console.log('The /done command processes the LATEST PENDING order, not a specific order');
    console.log('');

    // Get the latest pending order (what /done actually processes)
    const { data: pendingOrders, error: pendingError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          title,
          quantity,
          price,
          total
        ),
        users!orders_user_id_fkey (
          first_name,
          last_name,
          email,
          phone
        )
      `)
      .eq('payment_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);

    if (pendingError) {
      console.error('❌ Error getting pending orders:', pendingError);
      return;
    }

    console.log(`📊 Found ${pendingOrders.length} pending orders:`);
    pendingOrders.forEach((order, i) => {
      console.log(`   ${i + 1}. ${order.order_number} - ${new Date(order.created_at).toLocaleString()}`);
      console.log(`      Email: ${order.email}`);
      console.log(`      User Profile: ${order.users ? `${order.users.first_name} ${order.users.last_name}` : 'Missing'}`);
      console.log(`      Shipping Address: ${order.shipping_address ? 'Present' : 'Missing'}`);
      console.log('');
    });

    if (pendingOrders.length === 0) {
      console.log('❌ No pending orders found. The /done command has nothing to process.');
      return;
    }

    const latestPending = pendingOrders[0];
    console.log(`🎯 LATEST PENDING ORDER (what /done processes): ${latestPending.order_number}`);
    console.log('');

    // Step 2: Simulate the exact /done command execution
    console.log('🧪 STEP 2: SIMULATING EXACT /done COMMAND EXECUTION');
    console.log('-'.repeat(60));

    // This is the exact logic from TelegramCallbackHandler.handleTextMessage for /done
    console.log('🔸 Applying /done command logic:');
    
    // Get the latest pending order
    const { data: orderForDone, error: doneError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          title,
          quantity,
          price,
          total
        ),
        users!orders_user_id_fkey (
          first_name,
          last_name,
          email,
          phone
        )
      `)
      .eq('payment_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (doneError || !orderForDone) {
      console.error('❌ Error getting order for /done:', doneError);
      return;
    }

    console.log(`   Processing order: ${orderForDone.order_number}`);
    console.log('');

    // Step 3: Apply the exact formatting logic that would be used
    console.log('🔸 Applying TelegramNotificationService.formatConfirmationMessage logic:');
    
    // DIRECT IMPLEMENTATION - SAME AS NOTIFICATION SERVICE
    let customerName = 'Not provided';
    if (orderForDone.users?.first_name || orderForDone.users?.last_name) {
      customerName = `${orderForDone.users.first_name || ''} ${orderForDone.users.last_name || ''}`.trim();
      console.log(`   ✅ Customer name from user profile: "${customerName}"`);
    } else if (orderForDone.shipping_address?.firstName || orderForDone.shipping_address?.lastName) {
      customerName = `${orderForDone.shipping_address.firstName || ''} ${orderForDone.shipping_address.lastName || ''}`.trim();
      console.log(`   ✅ Customer name from shipping address: "${customerName}"`);
    } else if (orderForDone.email) {
      customerName = orderForDone.email.split('@')[0];
      console.log(`   ✅ Customer name from email: "${customerName}"`);
    } else {
      console.log(`   ❌ No customer name source found: "${customerName}"`);
    }

    const customerEmail = orderForDone.email || 'Not provided';
    const customerPhone = orderForDone.phone || 'Not provided';
    const abaBank = orderForDone.shipping_address?.abaBankName || 'Not provided';

    // Format shipping address
    let shippingAddress = 'Not provided';
    if (orderForDone.shipping_address) {
      const parts = [];
      if (orderForDone.shipping_address.address1) parts.push(orderForDone.shipping_address.address1);
      if (orderForDone.shipping_address.address2) parts.push(orderForDone.shipping_address.address2);
      if (orderForDone.shipping_address.city) parts.push(orderForDone.shipping_address.city);
      if (orderForDone.shipping_address.country) parts.push(orderForDone.shipping_address.country);
      if (parts.length > 0) {
        shippingAddress = parts.join(', ');
      }
    }

    console.log(`   Email: "${customerEmail}"`);
    console.log(`   Phone: "${customerPhone}"`);
    console.log(`   ABA Bank: "${abaBank}"`);
    console.log(`   Shipping Address: "${shippingAddress}"`);
    console.log('');

    // Step 4: Generate the actual confirmation message
    console.log('📱 STEP 3: GENERATING ACTUAL CONFIRMATION MESSAGE');
    console.log('-'.repeat(60));

    // Format order items
    let orderItemsText = '• No items found';
    if (orderForDone.order_items && orderForDone.order_items.length > 0) {
      orderItemsText = orderForDone.order_items.map((item) => {
        const title = item.title || 'Unknown Item';
        const quantity = item.quantity || 1;
        const price = parseFloat(item.price || '0');
        const total = parseFloat(item.total || '0');
        return `• ${title}\n  Qty: ${quantity} × $${price.toFixed(2)} = $${total.toFixed(2)}`;
      }).join('\n');
    }

    // Calculate discount and points
    const discountAmount = parseFloat(orderForDone.discount_amount || '0') + parseFloat(orderForDone.coupon_discount_amount || '0');
    const pointsUsed = orderForDone.points_used || 0;
    const pointsValue = pointsUsed / 1000;

    const confirmationMessage = `
🛒 NEW ORDER RECEIVED - PAID✅✅

📋 Order Number: ${orderForDone.order_number}

👤 CUSTOMER INFORMATION
• Name: ${customerName}
• Email: ${customerEmail}
• Phone: ${customerPhone}
• ABA Bank Name: ${abaBank}

📍 SHIPPING ADDRESS
${shippingAddress}

💰 ORDER SUMMARY
• Subtotal: $${parseFloat(orderForDone.subtotal || '0').toFixed(2)}
• Shipping: $${parseFloat(orderForDone.shipping_cost || '0').toFixed(2)}
${discountAmount > 0 ? `• Discount: -$${discountAmount.toFixed(2)}\n` : ''}${pointsUsed > 0 ? `• Points Used: ${pointsUsed} points (-$${pointsValue.toFixed(2)})\n` : ''}• Total Amount: $${parseFloat(orderForDone.total_amount || '0').toFixed(2)}
• Payment Method: ${orderForDone.payment_method || 'qr_code'}

📦 ORDER ITEMS
${orderItemsText}

👤 Processed by: Test User
📅 Processed at: ${new Date().toLocaleString()}
    `.trim();

    console.log('🎯 ACTUAL CONFIRMATION MESSAGE THAT WOULD BE SENT:');
    console.log('='.repeat(70));
    console.log(confirmationMessage);
    console.log('='.repeat(70));
    console.log('');

    // Step 5: Check for issues
    console.log('🚨 STEP 4: ISSUE DETECTION');
    console.log('-'.repeat(60));

    const hasNotProvided = confirmationMessage.includes('Not provided');
    const hasCorrectData = customerName !== 'Not provided' && 
                          customerPhone !== 'Not provided' && 
                          abaBank !== 'Not provided' && 
                          shippingAddress !== 'Not provided';

    if (hasNotProvided) {
      console.log('⚠️  ISSUE DETECTED: Message contains "Not provided" values');
      console.log('');
      console.log('🔍 Analysis:');
      if (customerName === 'Not provided') console.log('   ❌ Customer name is missing');
      if (customerPhone === 'Not provided') console.log('   ❌ Customer phone is missing');
      if (abaBank === 'Not provided') console.log('   ❌ ABA Bank name is missing');
      if (shippingAddress === 'Not provided') console.log('   ❌ Shipping address is missing');
      console.log('');
      console.log('🎯 ROOT CAUSE:');
      console.log('   The latest PENDING order has incomplete data.');
      console.log('   This is different from the VERIFIED order shown in your screenshot.');
    } else if (hasCorrectData) {
      console.log('✅ SUCCESS: All customer data is present and correct');
    }

    console.log('');
    console.log('🎯 CRITICAL INSIGHT:');
    console.log('   The /done command processes the LATEST PENDING order, not the specific order from your screenshot.');
    console.log('   Your screenshot shows a VERIFIED order with complete data.');
    console.log('   But /done processes PENDING orders, which may have different or incomplete data.');

  } catch (error) {
    console.error('❌ Error investigating /done command flow:', error);
  }
}

// Run the investigation
investigateDoneCommandFlow().catch(console.error);
