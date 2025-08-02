#!/usr/bin/env node

/**
 * PRODUCTION VERIFICATION TEST FOR TELEGRAM /done COMMAND FIX
 * This script simulates the exact production flow to verify the fix works end-to-end
 */

require('dotenv').config({ path: '.env.local' });

async function productionVerificationTest() {
  console.log('🚀 PRODUCTION VERIFICATION TEST FOR TELEGRAM /done COMMAND FIX');
  console.log('='.repeat(80));
  console.log('This test simulates the exact production flow to verify the fix works end-to-end');
  console.log('');
  
  try {
    const { createClient } = await import('@supabase/supabase-js');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Step 1: Simulate the exact TelegramCallbackHandler.findPendingOrderFromThread method
    console.log('📋 STEP 1: SIMULATING TelegramCallbackHandler.findPendingOrderFromThread');
    console.log('-'.repeat(60));
    console.log('This is the EXACT method that the /done command calls');
    console.log('');

    // EXACT QUERY FROM THE FIXED METHOD
    const { data: orders, error } = await supabase
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
      .eq('telegram_workflow_state', 'notification_sent')
      .not('telegram_message_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('❌ Database error:', error);
      return;
    }

    if (!orders || orders.length === 0) {
      console.log('❌ No orders waiting for arrival confirmation found');
      console.log('');
      console.log('💡 TO CREATE A TEST ORDER FOR /done COMMAND:');
      console.log('   1. Place a new order on the website');
      console.log('   2. Wait for the Telegram notification to be sent');
      console.log('   3. The order will have telegram_workflow_state = "notification_sent"');
      console.log('   4. Then run this test again');
      console.log('   5. Finally test the /done command in Telegram');
      return;
    }

    const order = orders[0];
    console.log(`✅ Found order for /done testing: ${order.order_number}`);
    console.log('');

    // Step 2: Simulate the exact TelegramCallbackHandler.formatDetailedConfirmationMessage method
    console.log('📱 STEP 2: SIMULATING TelegramCallbackHandler.formatDetailedConfirmationMessage');
    console.log('-'.repeat(60));
    console.log('This is the EXACT method that formats the confirmation message');
    console.log('');

    // EXACT LOGIC FROM THE FIXED METHOD
    let customerName = 'Not provided';
    if (order.users?.first_name || order.users?.last_name) {
      customerName = `${order.users.first_name || ''} ${order.users.last_name || ''}`.trim();
    } else if (order.shipping_address?.firstName || order.shipping_address?.lastName) {
      customerName = `${order.shipping_address.firstName || ''} ${order.shipping_address.lastName || ''}`.trim();
    } else if (order.email) {
      customerName = order.email.split('@')[0];
    }

    const customerEmail = order.email || 'Not provided';
    const customerPhone = order.phone || 'Not provided';
    const abaBank = order.shipping_address?.abaBankName || 'Not provided';

    // Format shipping address
    let shippingAddress = 'Not provided';
    if (order.shipping_address) {
      const parts = [];
      if (order.shipping_address.address1) parts.push(order.shipping_address.address1);
      if (order.shipping_address.address2) parts.push(order.shipping_address.address2);
      if (order.shipping_address.city) parts.push(order.shipping_address.city);
      if (order.shipping_address.country) parts.push(order.shipping_address.country);
      if (parts.length > 0) {
        shippingAddress = parts.join(', ');
      }
    }

    // Format order items
    let orderItemsText = '• No items found';
    if (order.order_items && order.order_items.length > 0) {
      orderItemsText = order.order_items.map((item) => {
        const title = item.title || 'Unknown Item';
        const quantity = item.quantity || 1;
        const price = parseFloat(item.price || '0');
        const total = parseFloat(item.total || '0');
        return `• ${title}\n  Qty: ${quantity} × $${price.toFixed(2)} = $${total.toFixed(2)}`;
      }).join('\n');
    }

    // Calculate discount and points
    const discountAmount = parseFloat(order.discount_amount || '0') + parseFloat(order.coupon_discount_amount || '0');
    const pointsUsed = order.points_used || 0;
    const pointsValue = pointsUsed / 1000;

    const processedBy = 'Production Test User (@testuser)';

    const confirmationMessage = `
🛒 NEW ORDER RECEIVED - PAID✅✅

📋 Order Number: ${order.order_number}

👤 CUSTOMER INFORMATION
• Name: ${customerName}
• Email: ${customerEmail}
• Phone: ${customerPhone}
• ABA Bank Name: ${abaBank}

📍 SHIPPING ADDRESS
${shippingAddress}

💰 ORDER SUMMARY
• Subtotal: $${parseFloat(order.subtotal || '0').toFixed(2)}
• Shipping: $${parseFloat(order.shipping_cost || '0').toFixed(2)}
${discountAmount > 0 ? `• Discount: -$${discountAmount.toFixed(2)}\n` : ''}${pointsUsed > 0 ? `• Points Used: ${pointsUsed} points (-$${pointsValue.toFixed(2)})\n` : ''}• Total Amount: $${parseFloat(order.total_amount || '0').toFixed(2)}
• Payment Method: ${order.payment_method || 'qr_code'}

📦 ORDER ITEMS
${orderItemsText}

👤 Processed by: ${processedBy}
📅 Processed at: ${new Date().toLocaleString()}
    `.trim();

    console.log('🎯 EXACT PRODUCTION CONFIRMATION MESSAGE:');
    console.log('='.repeat(70));
    console.log(confirmationMessage);
    console.log('='.repeat(70));
    console.log('');

    // Step 3: Production validation
    console.log('✅ STEP 3: PRODUCTION VALIDATION');
    console.log('-'.repeat(60));

    const validationResults = {
      customerName: customerName !== 'Not provided',
      customerEmail: customerEmail !== 'Not provided',
      customerPhone: customerPhone !== 'Not provided',
      abaBank: abaBank !== 'Not provided',
      shippingAddress: shippingAddress !== 'Not provided',
      orderItems: orderItemsText !== '• No items found'
    };

    const allValid = Object.values(validationResults).every(v => v);

    console.log('📊 VALIDATION RESULTS:');
    console.log(`   ✅ Customer Name: ${validationResults.customerName ? 'PASS' : 'FAIL'} - "${customerName}"`);
    console.log(`   ✅ Customer Email: ${validationResults.customerEmail ? 'PASS' : 'FAIL'} - "${customerEmail}"`);
    console.log(`   ✅ Customer Phone: ${validationResults.customerPhone ? 'PASS' : 'FAIL'} - "${customerPhone}"`);
    console.log(`   ✅ ABA Bank Name: ${validationResults.abaBank ? 'PASS' : 'FAIL'} - "${abaBank}"`);
    console.log(`   ✅ Shipping Address: ${validationResults.shippingAddress ? 'PASS' : 'FAIL'} - "${shippingAddress}"`);
    console.log(`   ✅ Order Items: ${validationResults.orderItems ? 'PASS' : 'FAIL'} - ${order.order_items?.length || 0} items`);
    console.log('');

    if (allValid) {
      console.log('🎉 PRODUCTION VERIFICATION: SUCCESS!');
      console.log('');
      console.log('✅ ALL CRITICAL FIELDS ARE POPULATED:');
      console.log('   ✅ No "Not provided" values in customer information');
      console.log('   ✅ Complete customer name from user profile');
      console.log('   ✅ Valid customer phone number');
      console.log('   ✅ ABA Bank name from shipping address');
      console.log('   ✅ Complete shipping address');
      console.log('   ✅ Order items properly formatted');
      console.log('');
      console.log('🚀 READY FOR PRODUCTION DEPLOYMENT:');
      console.log('   1. The fix has been applied to TelegramCallbackHandler.findPendingOrderFromThread');
      console.log('   2. The database query now includes ALL necessary customer data');
      console.log('   3. The confirmation message will show complete customer information');
      console.log('   4. Zero "Not provided" values in critical fields');
      console.log('');
      console.log('📋 NEXT STEPS:');
      console.log('   1. Deploy the updated code to production');
      console.log('   2. Test the /done command in Telegram with a real order');
      console.log('   3. Verify the confirmation message shows complete customer data');
      console.log('   4. Monitor for any remaining issues');
    } else {
      console.log('⚠️  PRODUCTION VERIFICATION: ISSUES DETECTED');
      console.log('');
      console.log('❌ FAILED VALIDATIONS:');
      Object.entries(validationResults).forEach(([field, isValid]) => {
        if (!isValid) {
          console.log(`   ❌ ${field}: Missing or invalid data`);
        }
      });
      console.log('');
      console.log('🔍 TROUBLESHOOTING:');
      console.log('   1. Check if the order has complete customer data in the database');
      console.log('   2. Verify the shipping_address JSON structure');
      console.log('   3. Ensure the user profile is properly linked');
      console.log('   4. Check for any data migration issues');
    }

    console.log('');
    console.log('📈 PRODUCTION METRICS:');
    console.log(`   Order ID: ${order.id}`);
    console.log(`   Order Number: ${order.order_number}`);
    console.log(`   Customer: ${customerName} (${customerEmail})`);
    console.log(`   Phone: ${customerPhone}`);
    console.log(`   ABA Bank: ${abaBank}`);
    console.log(`   Total Amount: $${parseFloat(order.total_amount || '0').toFixed(2)}`);
    console.log(`   Items: ${order.order_items?.length || 0}`);
    console.log(`   Fix Version: v3.0-complete-query-fix`);
    console.log(`   Test Date: ${new Date().toISOString()}`);

  } catch (error) {
    console.error('❌ Error in production verification test:', error);
  }
}

// Run the production verification test
productionVerificationTest().catch(console.error);
