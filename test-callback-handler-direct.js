#!/usr/bin/env node

/**
 * Test Callback Handler Direct
 * This script directly tests the callback handler to see the exact confirmation message
 */

require('dotenv').config({ path: '.env.local' });

async function testCallbackHandlerDirect() {
  console.log('🧪 Testing callback handler directly...');
  
  try {
    const { createClient } = await import('@supabase/supabase-js');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get the latest pending order
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
      .eq('payment_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('❌ Database error:', error);
      return;
    }

    if (!orders || orders.length === 0) {
      console.log('❌ No pending orders found');
      return;
    }

    const order = orders[0];
    console.log(`✅ Testing with pending order: ${order.order_number}`);
    console.log('');

    // Test the exact same logic as the callback handler
    function formatDetailedConfirmationMessage(order, processedBy) {
      // Get customer name
      let customerName = 'Not provided';
      if (order.users) {
        const firstName = order.users.first_name || '';
        const lastName = order.users.last_name || '';
        if (firstName || lastName) {
          customerName = `${firstName} ${lastName}`.trim();
        }
      }
      if (customerName === 'Not provided' && order.shipping_address?.firstName) {
        const firstName = order.shipping_address.firstName || '';
        const lastName = order.shipping_address.lastName || '';
        if (firstName || lastName) {
          customerName = `${firstName} ${lastName}`.trim();
        }
      }
      if (customerName === 'Not provided' && order.email) {
        customerName = order.email.split('@')[0];
      }

      // Get customer info
      const customerEmail = order.email || 'Not provided';
      const customerPhone = order.phone || 'Not provided';
      
      // Get ABA Bank Name
      let abaBank = 'Not provided';
      if (order.shipping_address?.abaBankName) {
        abaBank = order.shipping_address.abaBankName;
      }

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
        orderItemsText = order.order_items.map(item => {
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

      return `
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
      `.trim();
    }

    // Generate the message
    const message = formatDetailedConfirmationMessage(order, 'Test User');

    console.log('🎯 EXACT CONFIRMATION MESSAGE THAT WOULD BE SENT:');
    console.log('='.repeat(70));
    console.log(message);
    console.log('='.repeat(70));
    console.log('');

    // Check for issues
    if (message.includes('N/A')) {
      console.log('❌ ERROR: Message contains "N/A" values!');
    } else {
      console.log('✅ SUCCESS: No "N/A" values found!');
    }

    console.log('');
    console.log('🔍 DEBUG INFO:');
    console.log(`   Order ID: ${order.id}`);
    console.log(`   User Profile: ${order.users ? 'Found' : 'Missing'}`);
    console.log(`   Shipping Address: ${order.shipping_address ? 'Found' : 'Missing'}`);
    console.log(`   Order Items: ${order.order_items?.length || 0} items`);

  } catch (error) {
    console.error('❌ Error testing callback handler:', error);
  }
}

// Run the test
testCallbackHandlerDirect().catch(console.error);
