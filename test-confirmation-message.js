#!/usr/bin/env node

/**
 * Test Confirmation Message Format
 * This script tests the new detailed confirmation message format
 */

require('dotenv').config({ path: '.env.local' });

/**
 * Test the confirmation message with the latest order
 */
async function testConfirmationMessage() {
  console.log('🧪 Testing confirmation message format...');
  
  try {
    const { createClient } = await import('@supabase/supabase-js');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get the latest order
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          title,
          quantity,
          price,
          total
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

    // Create a test confirmation message
    const testMessage = formatConfirmationMessage(order, 'confirmed', 'Test User (@testuser)');

    console.log('📱 Confirmation Message Preview:');
    console.log('='.repeat(60));
    console.log(testMessage);
    console.log('='.repeat(60));
    console.log('');
    console.log('✅ Message format test completed!');

  } catch (error) {
    console.error('❌ Error testing confirmation message:', error);
  }
}

/**
 * Format confirmation message (copy of the updated method for testing)
 */
function formatConfirmationMessage(order, action, processedBy) {
  const emoji = action === 'confirmed' ? '✅✅' : '❌';
  const actionText = action === 'confirmed' ? 'PAID' : 'CANCELLED';
  
  // Extract customer information
  const firstName = order.shipping_address?.firstName || 'N/A';
  const lastName = order.shipping_address?.lastName || 'N/A';
  const email = order.email || 'N/A';
  const phone = order.phone || 'N/A';
  const abaBankName = order.shipping_address?.abaBankName || 'N/A';
  
  // Extract shipping address
  const address1 = order.shipping_address?.address1 || order.shipping_address?.address_line_1 || 'N/A';
  const address2 = order.shipping_address?.address2 || order.shipping_address?.address_line_2 || '';
  const city = order.shipping_address?.city || '';
  const country = order.shipping_address?.country || '';
  
  // Build full address
  let fullAddress = address1;
  if (address2) fullAddress += `, ${address2}`;
  if (city) fullAddress += `, ${city}`;
  if (country) fullAddress += `, ${country}`;
  
  // Format order items
  let itemsText = '';
  if (order.order_items && order.order_items.length > 0) {
    itemsText = order.order_items.map(item => 
      `• ${item.title}\n  Qty: ${item.quantity} × $${item.price.toFixed(2)} = $${item.total.toFixed(2)}`
    ).join('\n\n');
  } else {
    itemsText = '• No items found';
  }
  
  return `
🛒 NEW ORDER RECEIVED - ${actionText}${emoji}

📋 Order Number: ${order.order_number}

👤 CUSTOMER INFORMATION
• Name: ${firstName} ${lastName}
• Email: ${email}
• Phone: ${phone}
• ABA Bank Name: ${abaBankName}

📍 SHIPPING ADDRESS
${fullAddress}

💰 ORDER SUMMARY
• Subtotal: $${(order.subtotal || 0).toFixed(2)}
• Shipping: $${(order.shipping_cost || 0).toFixed(2)}
• Total Amount: $${order.total_amount.toFixed(2)}
• Payment Method: ${order.payment_method || 'qr_code'}

📦 ORDER ITEMS
${itemsText}
  `.trim();
}

/**
 * Main function
 */
async function main() {
  console.log('🤖 Confirmation Message Test Tool');
  console.log('='.repeat(50));
  console.log('');

  await testConfirmationMessage();
}

// Run the test
main().catch(console.error);
