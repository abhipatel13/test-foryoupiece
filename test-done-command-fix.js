#!/usr/bin/env node

/**
 * COMPREHENSIVE TEST FOR /done COMMAND FIX
 * This script tests the exact fix applied to the findPendingOrderFromThread method
 */

require('dotenv').config({ path: '.env.local' });

async function testDoneCommandFix() {
  console.log('🧪 COMPREHENSIVE TEST FOR /done COMMAND FIX');
  console.log('='.repeat(80));
  
  try {
    const { createClient } = await import('@supabase/supabase-js');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Step 1: Test the FIXED query (same as what /done command now uses)
    console.log('📋 STEP 1: TESTING FIXED QUERY (COMPLETE DATA RETRIEVAL)');
    console.log('-'.repeat(60));

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
      console.log('💡 To test the fix:');
      console.log('   1. Place a new order');
      console.log('   2. Wait for Telegram notification (sets telegram_workflow_state to "notification_sent")');
      console.log('   3. Run this test again');
      console.log('   4. Then test /done command in Telegram');
      return;
    }

    const order = orders[0];
    console.log(`✅ Found order for /done testing: ${order.order_number}`);
    console.log('');

    // Step 2: Data completeness verification
    console.log('📊 STEP 2: DATA COMPLETENESS VERIFICATION');
    console.log('-'.repeat(60));

    console.log('🔹 Basic Order Fields:');
    console.log(`   order_number: "${order.order_number}"`);
    console.log(`   email: "${order.email}"`);
    console.log(`   phone: "${order.phone}"`);
    console.log(`   user_id: "${order.user_id}"`);
    console.log(`   payment_status: "${order.payment_status}"`);
    console.log('');

    console.log('🔹 User Profile Data (users table join):');
    if (order.users) {
      console.log(`   ✅ User profile exists:`);
      console.log(`      first_name: "${order.users.first_name}"`);
      console.log(`      last_name: "${order.users.last_name}"`);
      console.log(`      email: "${order.users.email}"`);
      console.log(`      phone: "${order.users.phone}"`);
    } else {
      console.log(`   ❌ No user profile data`);
    }
    console.log('');

    console.log('🔹 Shipping Address Data:');
    if (order.shipping_address) {
      console.log(`   ✅ Shipping address exists:`);
      console.log(`   Raw JSON:`, JSON.stringify(order.shipping_address, null, 4));
    } else {
      console.log(`   ❌ No shipping address data`);
    }
    console.log('');

    // Step 3: Apply the EXACT formatting logic from the fixed method
    console.log('🧪 STEP 3: APPLYING FIXED FORMATTING LOGIC');
    console.log('-'.repeat(60));

    // This is the EXACT logic from formatDetailedConfirmationMessage
    let customerName = 'Not provided';
    if (order.users?.first_name || order.users?.last_name) {
      customerName = `${order.users.first_name || ''} ${order.users.last_name || ''}`.trim();
      console.log(`   ✅ Customer name from user profile: "${customerName}"`);
    } else if (order.shipping_address?.firstName || order.shipping_address?.lastName) {
      customerName = `${order.shipping_address.firstName || ''} ${order.shipping_address.lastName || ''}`.trim();
      console.log(`   ✅ Customer name from shipping address: "${customerName}"`);
    } else if (order.email) {
      customerName = order.email.split('@')[0];
      console.log(`   ✅ Customer name from email: "${customerName}"`);
    } else {
      console.log(`   ❌ No customer name source found: "${customerName}"`);
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

    console.log(`   Email: "${customerEmail}"`);
    console.log(`   Phone: "${customerPhone}"`);
    console.log(`   ABA Bank: "${abaBank}"`);
    console.log(`   Shipping Address: "${shippingAddress}"`);
    console.log('');

    // Step 4: Generate the actual confirmation message that /done would send
    console.log('📱 STEP 4: GENERATING ACTUAL /done CONFIRMATION MESSAGE');
    console.log('-'.repeat(60));

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

👤 Processed by: Test User (@testuser)
📅 Processed at: ${new Date().toLocaleString()}
    `.trim();

    console.log('🎯 ACTUAL /done CONFIRMATION MESSAGE:');
    console.log('='.repeat(70));
    console.log(confirmationMessage);
    console.log('='.repeat(70));
    console.log('');

    // Step 5: Validation and success criteria
    console.log('✅ STEP 5: VALIDATION AND SUCCESS CRITERIA');
    console.log('-'.repeat(60));

    const hasNotProvided = confirmationMessage.includes('Not provided');
    const hasCorrectData = customerName !== 'Not provided' && 
                          customerPhone !== 'Not provided' && 
                          abaBank !== 'Not provided' && 
                          shippingAddress !== 'Not provided';

    if (hasNotProvided) {
      console.log('⚠️  ISSUE DETECTED: Message still contains "Not provided" values');
      console.log('');
      console.log('🔍 Analysis:');
      if (customerName === 'Not provided') console.log('   ❌ Customer name is still missing');
      if (customerPhone === 'Not provided') console.log('   ❌ Customer phone is still missing');
      if (abaBank === 'Not provided') console.log('   ❌ ABA Bank name is still missing');
      if (shippingAddress === 'Not provided') console.log('   ❌ Shipping address is still missing');
      console.log('');
      console.log('🎯 NEXT STEPS:');
      console.log('   1. Check if the order actually has complete customer data in the database');
      console.log('   2. Verify the shipping_address JSON structure');
      console.log('   3. Ensure the user profile is properly linked');
    } else if (hasCorrectData) {
      console.log('🎉 SUCCESS: All customer data is present and correct!');
      console.log('');
      console.log('✅ FIX VERIFICATION:');
      console.log('   ✅ Customer name is displayed correctly');
      console.log('   ✅ Customer phone is displayed correctly');
      console.log('   ✅ ABA Bank name is displayed correctly');
      console.log('   ✅ Shipping address is displayed correctly');
      console.log('   ✅ No "Not provided" values in critical fields');
      console.log('');
      console.log('🚀 READY FOR PRODUCTION TESTING:');
      console.log('   1. Deploy the fix to production');
      console.log('   2. Test /done command in Telegram');
      console.log('   3. Verify the confirmation message shows complete customer data');
    }

    console.log('');
    console.log('📋 SUMMARY:');
    console.log(`   Order: ${order.order_number}`);
    console.log(`   Customer Name: ${customerName}`);
    console.log(`   Customer Phone: ${customerPhone}`);
    console.log(`   ABA Bank: ${abaBank}`);
    console.log(`   Has Complete Data: ${hasCorrectData ? '✅ YES' : '❌ NO'}`);
    console.log(`   Fix Version: v3.0-complete-query-fix`);

  } catch (error) {
    console.error('❌ Error testing /done command fix:', error);
  }
}

// Run the test
testDoneCommandFix().catch(console.error);
