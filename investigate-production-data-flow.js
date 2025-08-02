#!/usr/bin/env node

/**
 * COMPREHENSIVE PRODUCTION DATA FLOW INVESTIGATION
 * This script investigates the exact data flow that causes incorrect Telegram messages
 */

require('dotenv').config({ path: '.env.local' });

async function investigateProductionDataFlow() {
  console.log('🔍 COMPREHENSIVE PRODUCTION DATA FLOW INVESTIGATION');
  console.log('='.repeat(80));
  
  try {
    const { createClient } = await import('@supabase/supabase-js');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Step 1: Find the exact order from the screenshot
    const orderNumber = 'FYP-20250802-1754125915013-0RYBYC';
    
    console.log(`🎯 INVESTIGATING ORDER: ${orderNumber}`);
    console.log('This is the order shown in your screenshot with complete customer data');
    console.log('');

    // Step 2: Query the order EXACTLY as the /done command does
    console.log('📋 STEP 1: QUERYING ORDER WITH EXACT /done COMMAND LOGIC');
    console.log('-'.repeat(60));

    const { data: order, error } = await supabase
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
      .eq('order_number', orderNumber)
      .single();

    if (error) {
      console.error('❌ Database error:', error);
      
      // Try to find similar orders
      console.log('\n🔍 Searching for similar order numbers...');
      const { data: similarOrders } = await supabase
        .from('orders')
        .select('order_number, created_at, payment_status, email')
        .ilike('order_number', '%1754125915013%')
        .order('created_at', { ascending: false });

      if (similarOrders && similarOrders.length > 0) {
        console.log('📋 Found similar orders:');
        similarOrders.forEach((o, i) => {
          console.log(`   ${i + 1}. ${o.order_number} - ${o.payment_status} - ${o.email}`);
        });
      }
      return;
    }

    if (!order) {
      console.log('❌ Order not found');
      return;
    }

    console.log(`✅ Order found: ${order.order_number}`);
    console.log('');

    // Step 3: Analyze the raw data structure
    console.log('📊 STEP 2: RAW DATA STRUCTURE ANALYSIS');
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
      console.log(`      first_name: "${order.users.first_name}" (type: ${typeof order.users.first_name})`);
      console.log(`      last_name: "${order.users.last_name}" (type: ${typeof order.users.last_name})`);
      console.log(`      email: "${order.users.email}"`);
      console.log(`      phone: "${order.users.phone}"`);
    } else {
      console.log(`   ❌ No user profile data (users is ${order.users})`);
    }
    console.log('');

    console.log('🔹 Shipping Address Data:');
    if (order.shipping_address) {
      console.log(`   ✅ Shipping address exists (type: ${typeof order.shipping_address}):`);
      console.log(`   Raw JSON:`, JSON.stringify(order.shipping_address, null, 4));
      
      if (typeof order.shipping_address === 'object') {
        console.log(`   Parsed fields:`);
        console.log(`      firstName: "${order.shipping_address.firstName}" (type: ${typeof order.shipping_address.firstName})`);
        console.log(`      lastName: "${order.shipping_address.lastName}" (type: ${typeof order.shipping_address.lastName})`);
        console.log(`      address1: "${order.shipping_address.address1}"`);
        console.log(`      address2: "${order.shipping_address.address2}"`);
        console.log(`      city: "${order.shipping_address.city}"`);
        console.log(`      country: "${order.shipping_address.country}"`);
        console.log(`      abaBankName: "${order.shipping_address.abaBankName}"`);
      }
    } else {
      console.log(`   ❌ No shipping address data (shipping_address is ${order.shipping_address})`);
    }
    console.log('');

    console.log('🔹 Order Items Data:');
    if (order.order_items && order.order_items.length > 0) {
      console.log(`   ✅ ${order.order_items.length} order items:`);
      order.order_items.forEach((item, i) => {
        console.log(`      ${i + 1}. "${item.title}" - Qty: ${item.quantity} × $${item.price} = $${item.total}`);
      });
    } else {
      console.log(`   ❌ No order items (order_items is ${order.order_items})`);
    }
    console.log('');

    // Step 4: Apply the EXACT formatting logic from both services
    console.log('🧪 STEP 3: APPLYING EXACT FORMATTING LOGIC');
    console.log('-'.repeat(60));

    // Test TelegramCallbackHandler logic
    console.log('🔸 Testing TelegramCallbackHandler.formatDetailedConfirmationMessage logic:');
    let customerName1 = 'Not provided';
    if (order.users?.first_name || order.users?.last_name) {
      customerName1 = `${order.users.first_name || ''} ${order.users.last_name || ''}`.trim();
      console.log(`   ✅ From user profile: "${customerName1}"`);
    } else if (order.shipping_address?.firstName || order.shipping_address?.lastName) {
      customerName1 = `${order.shipping_address.firstName || ''} ${order.shipping_address.lastName || ''}`.trim();
      console.log(`   ✅ From shipping address: "${customerName1}"`);
    } else if (order.email) {
      customerName1 = order.email.split('@')[0];
      console.log(`   ✅ From email: "${customerName1}"`);
    } else {
      console.log(`   ❌ No name source found: "${customerName1}"`);
    }

    const customerEmail1 = order.email || 'Not provided';
    const customerPhone1 = order.phone || 'Not provided';
    const abaBank1 = order.shipping_address?.abaBankName || 'Not provided';

    console.log(`   Email: "${customerEmail1}"`);
    console.log(`   Phone: "${customerPhone1}"`);
    console.log(`   ABA Bank: "${abaBank1}"`);
    console.log('');

    // Test TelegramNotificationService logic
    console.log('🔸 Testing TelegramNotificationService.formatConfirmationMessage logic:');
    let customerName2 = 'Not provided';
    if (order.users?.first_name || order.users?.last_name) {
      customerName2 = `${order.users.first_name || ''} ${order.users.last_name || ''}`.trim();
      console.log(`   ✅ From user profile: "${customerName2}"`);
    } else if (order.shipping_address?.firstName || order.shipping_address?.lastName) {
      customerName2 = `${order.shipping_address.firstName || ''} ${order.shipping_address.lastName || ''}`.trim();
      console.log(`   ✅ From shipping address: "${customerName2}"`);
    } else if (order.email) {
      customerName2 = order.email.split('@')[0];
      console.log(`   ✅ From email: "${customerName2}"`);
    } else {
      console.log(`   ❌ No name source found: "${customerName2}"`);
    }

    const customerEmail2 = order.email || 'Not provided';
    const customerPhone2 = order.phone || 'Not provided';
    const abaBank2 = order.shipping_address?.abaBankName || 'Not provided';

    console.log(`   Email: "${customerEmail2}"`);
    console.log(`   Phone: "${customerPhone2}"`);
    console.log(`   ABA Bank: "${abaBank2}"`);
    console.log('');

    // Step 5: Compare with expected data from screenshot
    console.log('🎯 STEP 4: COMPARISON WITH EXPECTED DATA FROM SCREENSHOT');
    console.log('-'.repeat(60));
    
    const expectedData = {
      name: 'akito Aoyama',
      email: 'akito12350@gmail.com',
      phone: '1212512',
      abaBank: 'Akito AA oayma',
      address: '123 New Updated Address Street, Phnom Penh, Cambodia'
    };

    const actualData = {
      name: customerName1,
      email: customerEmail1,
      phone: customerPhone1,
      abaBank: abaBank1
    };

    console.log('📊 Expected vs Actual:');
    console.log(`   Name: Expected="${expectedData.name}" | Actual="${actualData.name}" | Match=${expectedData.name === actualData.name ? '✅' : '❌'}`);
    console.log(`   Email: Expected="${expectedData.email}" | Actual="${actualData.email}" | Match=${expectedData.email === actualData.email ? '✅' : '❌'}`);
    console.log(`   Phone: Expected="${expectedData.phone}" | Actual="${actualData.phone}" | Match=${expectedData.phone === actualData.phone ? '✅' : '❌'}`);
    console.log(`   ABA Bank: Expected="${expectedData.abaBank}" | Actual="${actualData.abaBank}" | Match=${expectedData.abaBank === actualData.abaBank ? '✅' : '❌'}`);
    console.log('');

    // Step 6: Identify discrepancies
    console.log('🚨 STEP 5: DISCREPANCY ANALYSIS');
    console.log('-'.repeat(60));

    const discrepancies = [];
    if (expectedData.name !== actualData.name) discrepancies.push(`Name: Expected "${expectedData.name}" but got "${actualData.name}"`);
    if (expectedData.email !== actualData.email) discrepancies.push(`Email: Expected "${expectedData.email}" but got "${actualData.email}"`);
    if (expectedData.phone !== actualData.phone) discrepancies.push(`Phone: Expected "${expectedData.phone}" but got "${actualData.phone}"`);
    if (expectedData.abaBank !== actualData.abaBank) discrepancies.push(`ABA Bank: Expected "${expectedData.abaBank}" but got "${actualData.abaBank}"`);

    if (discrepancies.length > 0) {
      console.log('❌ CRITICAL DISCREPANCIES FOUND:');
      discrepancies.forEach((d, i) => {
        console.log(`   ${i + 1}. ${d}`);
      });
      console.log('');
      console.log('🔍 ROOT CAUSE ANALYSIS:');
      console.log('   The database contains different data than what was shown in the order form.');
      console.log('   This suggests either:');
      console.log('   1. The order was modified after creation');
      console.log('   2. The data is stored in a different format than expected');
      console.log('   3. There are multiple data sources that are not synchronized');
    } else {
      console.log('✅ No discrepancies found - data matches expected values');
    }

  } catch (error) {
    console.error('❌ Error in production data flow investigation:', error);
  }
}

// Run the investigation
investigateProductionDataFlow().catch(console.error);
