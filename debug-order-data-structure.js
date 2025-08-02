#!/usr/bin/env node

/**
 * Debug Order Data Structure
 * This script examines the actual structure of order data to fix the confirmation message
 */

require('dotenv').config({ path: '.env.local' });

/**
 * Debug the latest order data structure
 */
async function debugOrderStructure() {
  console.log('🔍 Debugging order data structure...');
  
  try {
    const { createClient } = await import('@supabase/supabase-js');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get the latest order with all related data
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
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('❌ Database error:', error);
      return;
    }

    if (!orders || orders.length === 0) {
      console.log('❌ No orders found');
      return;
    }

    const order = orders[0];
    console.log(`✅ Found latest order: ${order.order_number}`);
    console.log('');

    console.log('📋 ORDER DATA STRUCTURE:');
    console.log('='.repeat(60));
    
    console.log('🔹 Basic Order Info:');
    console.log(`   Order Number: ${order.order_number}`);
    console.log(`   Email: ${order.email}`);
    console.log(`   Phone: ${order.phone}`);
    console.log(`   Total: $${order.total_amount}`);
    console.log('');

    console.log('🔹 User Profile Data:');
    if (order.users) {
      console.log(`   First Name: ${order.users.first_name}`);
      console.log(`   Last Name: ${order.users.last_name}`);
      console.log(`   Email: ${order.users.email}`);
      console.log(`   Phone: ${order.users.phone}`);
    } else {
      console.log('   No user profile data found');
    }
    console.log('');

    console.log('🔹 Shipping Address (Raw JSON):');
    console.log('   Type:', typeof order.shipping_address);
    console.log('   Value:', JSON.stringify(order.shipping_address, null, 2));
    console.log('');

    console.log('🔹 Parsed Shipping Address:');
    if (order.shipping_address) {
      const addr = order.shipping_address;
      console.log(`   firstName: ${addr.firstName}`);
      console.log(`   lastName: ${addr.lastName}`);
      console.log(`   address1: ${addr.address1}`);
      console.log(`   address2: ${addr.address2}`);
      console.log(`   city: ${addr.city}`);
      console.log(`   country: ${addr.country}`);
      console.log(`   abaBankName: ${addr.abaBankName}`);
    }
    console.log('');

    console.log('🔹 Order Items:');
    if (order.order_items && order.order_items.length > 0) {
      order.order_items.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.title}`);
        console.log(`      Qty: ${item.quantity} × $${item.price} = $${item.total}`);
      });
    } else {
      console.log('   No order items found');
    }
    console.log('');

    console.log('🔹 Test Customer Name Extraction:');
    let customerName = '';
    
    // Method 1: From user profile
    if (order.users?.first_name || order.users?.last_name) {
      customerName = `${order.users.first_name || ''} ${order.users.last_name || ''}`.trim();
      console.log(`   From user profile: "${customerName}"`);
    }
    
    // Method 2: From shipping address
    if (order.shipping_address?.firstName || order.shipping_address?.lastName) {
      const shippingName = `${order.shipping_address.firstName || ''} ${order.shipping_address.lastName || ''}`.trim();
      console.log(`   From shipping address: "${shippingName}"`);
      if (!customerName) customerName = shippingName;
    }
    
    // Method 3: From email
    if (!customerName && order.email) {
      customerName = order.email.split('@')[0];
      console.log(`   From email: "${customerName}"`);
    }
    
    console.log(`   Final customer name: "${customerName}"`);
    console.log('');

    console.log('🔹 Test ABA Bank Name Extraction:');
    let abaBankName = 'Not provided';
    if (order.shipping_address?.abaBankName) {
      abaBankName = order.shipping_address.abaBankName;
      console.log(`   From shipping address: "${abaBankName}"`);
    } else {
      console.log('   ABA Bank Name not found in shipping address');
    }
    console.log('');

    console.log('🔹 Test Address Formatting:');
    if (order.shipping_address) {
      const addr = order.shipping_address;
      const parts = [];
      
      if (addr.address1) parts.push(addr.address1);
      if (addr.address2) parts.push(addr.address2);
      if (addr.city) parts.push(addr.city);
      if (addr.country) parts.push(addr.country);
      
      const fullAddress = parts.length > 0 ? parts.join(', ') : 'Not provided';
      console.log(`   Formatted address: "${fullAddress}"`);
    }

  } catch (error) {
    console.error('❌ Error debugging order structure:', error);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🤖 Order Data Structure Debug Tool');
  console.log('='.repeat(50));
  console.log('');

  await debugOrderStructure();
}

// Run the debug
main().catch(console.error);
