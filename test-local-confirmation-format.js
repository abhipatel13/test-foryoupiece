#!/usr/bin/env node

/**
 * Test Local Confirmation Format
 * This script tests the confirmation message format locally using the same code as production
 */

require('dotenv').config({ path: '.env.local' });

/**
 * Simulate the callback handler's formatDetailedConfirmationMessage method
 */
function formatDetailedConfirmationMessage(order, processedBy) {
  // Extract customer information using the same logic as the callback handler
  function getCustomerName(order) {
    // Try to get name from user profile first (joined data)
    if (order.users) {
      const firstName = order.users.first_name || '';
      const lastName = order.users.last_name || '';
      if (firstName || lastName) {
        return `${firstName} ${lastName}`.trim();
      }
    }

    // Try to get name from shipping address
    if (order.shipping_address && typeof order.shipping_address === 'object') {
      const firstName = order.shipping_address.firstName || '';
      const lastName = order.shipping_address.lastName || '';
      if (firstName || lastName) {
        return `${firstName} ${lastName}`.trim();
      }
    }

    // Fallback to email username
    if (order.email) {
      return order.email.split('@')[0];
    }

    return 'Not provided';
  }

  function getABABankName(order) {
    if (order.shipping_address && typeof order.shipping_address === 'object') {
      const abaBank = order.shipping_address.abaBankName || 
                     order.shipping_address.aba_bank_name || 
                     order.shipping_address.bank_name;
      if (abaBank) return abaBank;
    }
    return 'Not provided';
  }

  function formatShippingAddress(shippingAddress) {
    if (!shippingAddress || typeof shippingAddress !== 'object') {
      return 'Not provided';
    }

    const parts = [];

    // Try new field names first (address1, address2)
    if (shippingAddress.address1) parts.push(shippingAddress.address1);
    if (shippingAddress.address2) parts.push(shippingAddress.address2);
    
    if (shippingAddress.city) parts.push(shippingAddress.city);
    if (shippingAddress.state) parts.push(shippingAddress.state);
    if (shippingAddress.country) parts.push(shippingAddress.country);

    return parts.length > 0 ? parts.join(', ') : 'Not provided';
  }

  function formatOrderItems(orderItems) {
    if (!orderItems || orderItems.length === 0) {
      return '• No items found';
    }

    return orderItems.map(item => {
      const title = item.title || 'Unknown Item';
      const quantity = item.quantity || 1;
      const price = parseFloat(item.price || '0');
      const total = parseFloat(item.total || '0');

      return `• ${title}\n  Qty: ${quantity} × $${price.toFixed(2)} = $${total.toFixed(2)}`;
    }).join('\n');
  }

  // Extract customer information
  const customerName = getCustomerName(order);
  const customerEmail = order.email || 'Not provided';
  const customerPhone = order.phone || 'Not provided';
  const abaBank = getABABankName(order);

  // Extract shipping address
  const shippingAddress = formatShippingAddress(order.shipping_address);

  // Format order items
  const orderItemsText = formatOrderItems(order.order_items || []);

  // Calculate discount and points
  const discountAmount = parseFloat(order.discount_amount || '0') + parseFloat(order.coupon_discount_amount || '0');
  const pointsUsed = order.points_used || 0;
  const pointsValue = pointsUsed / 1000; // 1000 points = $1

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

/**
 * Test the confirmation message format with real order data
 */
async function testConfirmationFormat() {
  console.log('🧪 Testing local confirmation message format...');
  
  try {
    const { createClient } = await import('@supabase/supabase-js');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get the latest order with all related data (same query as callback handler)
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
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('❌ Database error:', error);
      return;
    }

    if (!order) {
      console.log('❌ No orders found');
      return;
    }

    console.log(`✅ Testing with order: ${order.order_number}`);
    console.log('');

    // Generate the confirmation message using the same logic as production
    const confirmationMessage = formatDetailedConfirmationMessage(order, 'Test User');

    console.log('🎯 GENERATED CONFIRMATION MESSAGE (Same as Production):');
    console.log('='.repeat(70));
    console.log(confirmationMessage);
    console.log('='.repeat(70));
    console.log('');

    // Check for N/A values
    const hasNAValues = confirmationMessage.includes('N/A');
    const hasNotProvided = confirmationMessage.includes('Not provided');

    if (hasNAValues) {
      console.log('❌ WARNING: Message still contains "N/A" values!');
    } else if (hasNotProvided) {
      console.log('⚠️  Message contains "Not provided" values (this is expected for missing data)');
    } else {
      console.log('✅ SUCCESS: No "N/A" values found in the message!');
    }

    console.log('');
    console.log('🔍 Data Analysis:');
    console.log(`   • Customer Name Source: ${order.users ? 'User Profile' : 'Shipping Address'}`);
    console.log(`   • Phone Source: ${order.phone ? 'Order Record' : 'Not Available'}`);
    console.log(`   • ABA Bank Source: ${order.shipping_address?.abaBankName ? 'Shipping Address' : 'Not Available'}`);
    console.log(`   • Address Source: ${order.shipping_address?.address1 ? 'Shipping Address' : 'Not Available'}`);

  } catch (error) {
    console.error('❌ Error testing confirmation format:', error);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🤖 Local Confirmation Format Test');
  console.log('='.repeat(50));
  console.log('');

  await testConfirmationFormat();
}

// Run the test
main().catch(console.error);
