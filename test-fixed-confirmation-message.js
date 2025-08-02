#!/usr/bin/env node

/**
 * Test Fixed Confirmation Message
 * This script tests the fixed confirmation message format
 */

require('dotenv').config({ path: '.env.local' });

/**
 * Test the fixed confirmation message format
 */
async function testFixedConfirmationMessage() {
  console.log('🧪 Testing fixed confirmation message format...');
  
  try {
    const { createClient } = await import('@supabase/supabase-js');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get the latest order with all related data
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

    // Test customer name extraction
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

    // Test ABA Bank Name extraction
    function getABABankName(order) {
      if (order.shipping_address && typeof order.shipping_address === 'object') {
        const abaBank = order.shipping_address.abaBankName || 
                       order.shipping_address.aba_bank_name || 
                       order.shipping_address.bank_name;
        if (abaBank) return abaBank;
      }
      return 'Not provided';
    }

    // Test shipping address formatting
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

    // Test order items formatting
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

    // Generate the confirmation message
    const customerName = getCustomerName(order);
    const customerEmail = order.email || 'Not provided';
    const customerPhone = order.phone || 'Not provided';
    const abaBank = getABABankName(order);
    const shippingAddress = formatShippingAddress(order.shipping_address);
    const orderItemsText = formatOrderItems(order.order_items || []);

    // Calculate discount and points
    const discountAmount = parseFloat(order.discount_amount || '0') + parseFloat(order.coupon_discount_amount || '0');
    const pointsUsed = order.points_used || 0;
    const pointsValue = pointsUsed / 1000; // 1000 points = $1

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
    `.trim();

    console.log('🎯 GENERATED CONFIRMATION MESSAGE:');
    console.log('='.repeat(60));
    console.log(confirmationMessage);
    console.log('='.repeat(60));
    console.log('');

    console.log('✅ Test completed! The message should now show real customer data instead of N/A values.');

  } catch (error) {
    console.error('❌ Error testing confirmation message:', error);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🤖 Fixed Confirmation Message Test');
  console.log('='.repeat(50));
  console.log('');

  await testFixedConfirmationMessage();
}

// Run the test
main().catch(console.error);
