#!/usr/bin/env node

/**
 * Check Specific Order
 * Check the exact order from the screenshot
 */

require('dotenv').config({ path: '.env.local' });

async function checkSpecificOrder() {
  console.log('🔍 Checking specific order from screenshot...');
  
  try {
    const { createClient } = await import('@supabase/supabase-js');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get the specific order from the screenshot
    const orderNumber = 'FYP-20250802-1754124406946-7FWZFO';
    
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
      return;
    }

    if (!order) {
      console.log('❌ Order not found:', orderNumber);
      return;
    }

    console.log(`✅ Found order: ${order.order_number}`);
    console.log('');

    console.log('📋 RAW ORDER DATA:');
    console.log('='.repeat(50));
    console.log('Basic Info:');
    console.log(`  Email: ${order.email}`);
    console.log(`  Phone: ${order.phone}`);
    console.log(`  Total: $${order.total_amount}`);
    console.log('');

    console.log('User Profile:');
    if (order.users) {
      console.log(`  First Name: ${order.users.first_name}`);
      console.log(`  Last Name: ${order.users.last_name}`);
      console.log(`  Email: ${order.users.email}`);
      console.log(`  Phone: ${order.users.phone}`);
    } else {
      console.log('  No user profile data');
    }
    console.log('');

    console.log('Shipping Address:');
    if (order.shipping_address) {
      console.log('  Raw JSON:', JSON.stringify(order.shipping_address, null, 2));
    } else {
      console.log('  No shipping address data');
    }
    console.log('');

    console.log('Order Items:');
    if (order.order_items && order.order_items.length > 0) {
      order.order_items.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.title} - Qty: ${item.quantity} × $${item.price} = $${item.total}`);
      });
    } else {
      console.log('  No order items');
    }
    console.log('');

    // Now test the message generation with this specific order
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

    const message = formatDetailedConfirmationMessage(order, 'Test User');

    console.log('🎯 CONFIRMATION MESSAGE FOR THIS SPECIFIC ORDER:');
    console.log('='.repeat(70));
    console.log(message);
    console.log('='.repeat(70));

  } catch (error) {
    console.error('❌ Error checking specific order:', error);
  }
}

// Run the test
checkSpecificOrder().catch(console.error);
