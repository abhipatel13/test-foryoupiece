import { createServiceRoleClient } from '@/lib/supabase/service-role';

interface TelegramCallbackQuery {
  id: string;
  from: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
  };
  message: {
    message_id: number;
    chat: {
      id: number;
    };
    text: string;
  };
  data: string;
}

interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
  };
  message_thread_id?: number;
  text: string;
  date: number;
  reply_to_message?: {
    message_id: number;
    text: string;
  };
}

interface TelegramUpdate {
  callback_query?: TelegramCallbackQuery;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
}

export class TelegramCallbackHandler {
  private botToken: string;

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    if (!this.botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is not configured');
    }
  }

  /**
   * Check if user is authorized to process orders
   */
  private isAuthorizedUser(userId: number, username?: string): boolean {
    // For now, we'll allow any user in the notification group to process orders
    // In production, you might want to maintain a whitelist of authorized users
    const authorizedUserIds = process.env.TELEGRAM_AUTHORIZED_USERS?.split(',').map(id => parseInt(id.trim())) || [];

    if (authorizedUserIds.length > 0) {
      const isAuthorized = authorizedUserIds.includes(userId);
      console.log(`📱 User ${userId} (${username || 'unknown'}) authorization check: ${isAuthorized ? 'ALLOWED' : 'DENIED'}`);
      return isAuthorized;
    }

    // If no specific users are configured, allow any user (less secure but more flexible)
    console.log(`📱 User ${userId} (${username || 'unknown'}) processing order - no authorization restrictions configured`);
    return true;
  }

  /**
   * Handle incoming Telegram text messages
   */
  async handleTextMessage(message: TelegramMessage): Promise<boolean> {
    try {
      console.log(`📱 Handling Telegram text message: "${message.text}" from user ${message.from.id}`);

      // Check for login start command
      if (message.text?.startsWith('/start login-')) {
        return await this.handleLoginStart(message);
      }

      // Check if message is from the notification group and thread
      const notificationGroupId = process.env.TELEGRAM_NOTIFICATION_GROUP_ID;
      const notificationThreadId = process.env.TELEGRAM_NOTIFICATION_THREAD_ID;

      if (!notificationGroupId || !notificationThreadId) {
        console.error('❌ Telegram notification group configuration missing');
        return false;
      }

      // Verify message is from correct group and thread
      if (message.chat.id.toString() !== notificationGroupId) {
        console.log(`📱 Message not from notification group (${message.chat.id} !== ${notificationGroupId}), ignoring`);
        return true; // Not an error, just not relevant
      }

      if (message.message_thread_id?.toString() !== notificationThreadId) {
        console.log(`📱 Message not from notification thread (${message.message_thread_id} !== ${notificationThreadId}), ignoring`);
        return true; // Not an error, just not relevant
      }

      // Check if message contains an order ID pattern (Direct Order ID Detection)
      const messageText = message.text.trim();
      const orderIdMatch = messageText.match(/\b(FYP-\d{8}-\d+-[A-Z0-9]+)\b/i);

      if (!orderIdMatch) {
        console.log(`📱 Message does not contain order ID pattern: "${message.text}", ignoring`);
        return true; // Not an error, just not an order confirmation
      }

      const orderId = orderIdMatch[1].toUpperCase(); // Normalize to uppercase
      console.log(`📱 Detected order ID for confirmation: ${orderId}`);

      // Security check: Validate user authorization
      if (!this.isAuthorizedUser(message.from.id, message.from.username)) {
        console.error(`❌ Unauthorized user ${message.from.id} attempted to confirm arrival`);
        await this.sendReplyMessage(message.chat.id, message.message_id, '🚫 You are not authorized to confirm arrivals');
        return false;
      }

      // Look up the order by ID
      console.log(`🎯 Looking up order ID: ${orderId}`);
      const pendingOrder = await this.findOrderByNumber(orderId);

      if (!pendingOrder) {
        console.log(`❌ Order ${orderId} not found or not in pending state`);
        await this.sendReplyMessage(message.chat.id, message.message_id,
          `❌ Order ${orderId} not found or not ready for confirmation. Please check the order number.`);
        return false;
      }

      console.log(`🎯 Processing confirmation for order: ${pendingOrder.order_number}`);

      // Process the arrival confirmation
      const processedBy = this.formatUserName(message.from);
      const success = await this.processArrivalConfirmation(pendingOrder, processedBy);

      if (success) {
        await this.sendReplyMessage(message.chat.id, message.message_id,
          `✅ Order ${pendingOrder.order_number} confirmed and completed!`);
        console.log(`✅ Successfully processed confirmation for order ${pendingOrder.order_number}`);
        return true;
      } else {
        await this.sendReplyMessage(message.chat.id, message.message_id,
          `❌ Failed to process confirmation for order ${pendingOrder.order_number}`);
        console.error(`❌ Failed to process confirmation for order ${pendingOrder.order_number}`);
        return false;
      }

    } catch (error) {
      console.error('❌ Error handling text message:', error);
      return false;
    }
  }

  /**
   * Handle Telegram login start command
   */
  async handleLoginStart(message: TelegramMessage): Promise<boolean> {
    try {
      const text = message.text || '';
      const nonce = text.replace('/start login-', '');

      if (!nonce || nonce.length !== 32) {
        console.error('❌ Invalid login nonce format:', nonce);
        await this.sendMessage(message.chat.id, '❌ Invalid login request. Please try again from the website.');
        return false;
      }

      console.log('🔐 Processing login request for nonce:', nonce.substring(0, 8) + '...');

      // Import nonce store dynamically to avoid circular dependency
      let nonceStore: Map<string, any>;
      try {
        const startModule = await import('../../app/api/auth/telegram/start/route');
        nonceStore = startModule.nonceStore;
      } catch (error) {
        console.error('❌ Failed to import nonce store:', error);
        await this.sendMessage(message.chat.id, '❌ Authentication system error. Please try again later.');
        return false;
      }

      // Check if nonce exists and is valid
      const nonceData = nonceStore.get(nonce);
      if (!nonceData) {
        console.error('❌ Invalid or expired nonce:', nonce);
        await this.sendMessage(message.chat.id, '❌ Login request expired or invalid. Please try again from the website.');
        return false;
      }

      // Check if nonce has expired (10 minutes)
      const now = Date.now();
      const expiredTime = 10 * 60 * 1000;

      if (now - nonceData.created > expiredTime) {
        nonceStore.delete(nonce);
        console.error('❌ Nonce expired:', nonce);
        await this.sendMessage(message.chat.id, '❌ Login request expired. Please try again from the website.');
        return false;
      }

      // Mark nonce as verified with user data
      nonceData.verified = true;
      nonceData.telegramData = {
        id: message.from.id,
        username: message.from.username,
        first_name: message.from.first_name,
        last_name: message.from.last_name
      };

      console.log('✅ Login nonce verified for user:', message.from.id);

      // Send success message
      const userName = message.from.first_name || message.from.username || 'User';
      await this.sendMessage(message.chat.id,
        `✅ Login successful, ${userName}! You can now return to the website.`);

      return true;

    } catch (error) {
      console.error('❌ Error handling login start:', error);
      await this.sendMessage(message.chat.id, '❌ Authentication error. Please try again later.');
      return false;
    }
  }

  /**
   * Handle incoming Telegram callback queries
   */
  async handleCallback(callbackQuery: TelegramCallbackQuery): Promise<boolean> {
    try {
      console.log(`📱 Handling Telegram callback: ${callbackQuery.data} from user ${callbackQuery.from.id}`);

      // Security check: Validate user authorization
      if (!this.isAuthorizedUser(callbackQuery.from.id, callbackQuery.from.username)) {
        console.error(`❌ Unauthorized user ${callbackQuery.from.id} attempted to process order`);
        await this.answerCallbackQuery(callbackQuery.id, '🚫 You are not authorized to process orders');
        return false;
      }

      // Parse callback data
      const [action, orderId] = callbackQuery.data.split('_');

      if (!orderId || !['confirm', 'cancel'].includes(action)) {
        console.error('❌ Invalid callback data format:', callbackQuery.data);
        await this.answerCallbackQuery(callbackQuery.id, 'Invalid action');
        return false;
      }

      // Validate order ID format (UUID)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(orderId)) {
        console.error('❌ Invalid order ID format:', orderId);
        await this.answerCallbackQuery(callbackQuery.id, 'Invalid order ID');
        return false;
      }

      // Get order details
      const order = await this.getOrderDetails(orderId);
      if (!order) {
        console.error('❌ Order not found:', orderId);
        await this.answerCallbackQuery(callbackQuery.id, 'Order not found');
        return false;
      }

      // Check if order is already processed
      if (order.telegram_status !== 'pending') {
        console.log(`⚠️ Order ${orderId} already processed with status: ${order.telegram_status}`);
        await this.answerCallbackQuery(callbackQuery.id, 'Order already processed');
        return false;
      }

      // Process the action
      const processedBy = this.formatUserName(callbackQuery.from);
      const actionType = action === 'confirm' ? 'confirmed' : 'cancelled';

      // Update order status
      const updateSuccess = await this.updateOrderStatus(
        orderId,
        actionType,
        processedBy
      );

      if (!updateSuccess) {
        await this.answerCallbackQuery(callbackQuery.id, 'Failed to update order');
        return false;
      }

      // Send confirmation message
      await this.sendConfirmationMessage(
        order,
        actionType,
        processedBy
      );

      // Update the original message to show it's been processed
      await this.updateOriginalMessage(callbackQuery, actionType, processedBy);

      // Answer the callback query
      const successMessage = actionType === 'confirmed' 
        ? '✅ Order confirmed successfully!' 
        : '❌ Order cancelled successfully!';
      
      await this.answerCallbackQuery(callbackQuery.id, successMessage);

      console.log(`✅ Order ${orderId} ${actionType} by ${processedBy}`);
      return true;

    } catch (error) {
      console.error('❌ Error handling Telegram callback:', error);
      await this.answerCallbackQuery(callbackQuery.id, 'An error occurred');
      return false;
    }
  }

  /**
   * Get order details from database
   */
  private async getOrderDetails(orderId: string): Promise<any> {
    try {
      const supabase = createServiceRoleClient();

      // Get order with all related data in a single query
      const { data: order, error: orderError } = await supabase
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
        .eq('id', orderId)
        .single();

      if (orderError) {
        console.error('❌ Error fetching order:', orderError);
        return null;
      }

      if (!order) {
        console.error('❌ Order not found:', orderId);
        return null;
      }

      console.log('✅ Order details retrieved successfully:', {
        orderNumber: order.order_number,
        hasUserData: !!order.users,
        hasOrderItems: !!(order.order_items && order.order_items.length > 0),
        shippingAddressType: typeof order.shipping_address,
        fixVersion: 'v2.0-na-fix' // Added to track deployment version
      });

      return order;
    } catch (error) {
      console.error('❌ Error in getOrderDetails:', error);
      return null;
    }
  }

  /**
   * Update order status in database
   */
  private async updateOrderStatus(orderId: string, status: 'confirmed' | 'cancelled', processedBy: string): Promise<boolean> {
    try {
      const supabase = createServiceRoleClient();

      // Use correct enum values for payment_status and fulfillment_status
      const newPaymentStatus = status === 'confirmed' ? 'verified' : 'failed';
      const newFulfillmentStatus = status === 'confirmed' ? 'delivered' : 'cancelled';

      console.log(`🔄 Updating order ${orderId} status:`, {
        payment_status: newPaymentStatus,
        fulfillment_status: newFulfillmentStatus,
        telegram_status: status,
        processed_by: processedBy
      });

      // Update order status directly instead of using the problematic RPC function
      const { data, error } = await supabase
        .from('orders')
        .update({
          payment_status: newPaymentStatus,
          fulfillment_status: newFulfillmentStatus,
          processed_by: processedBy,
          processed_at: new Date().toISOString(),
          telegram_status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) {
        console.error('❌ Failed to update order status:', error);
        return false;
      }

      console.log(`✅ Order ${orderId} status updated to ${status}`);
      return true;
    } catch (error) {
      console.error('❌ Error updating order status:', error);
      return false;
    }
  }

  /**
   * Send confirmation message to the confirmation group
   */
  private async sendConfirmationMessage(order: any, action: 'confirmed' | 'cancelled', processedBy: string): Promise<boolean> {
    try {
      console.log(`📱 Sending confirmation message for order ${order.order_number}: ${action}`);

      const message = this.formatConfirmationMessage(order, action, processedBy);
      const confirmationGroupId = process.env.TELEGRAM_CONFIRMATION_GROUP_ID || '';
      const confirmationThreadId = process.env.TELEGRAM_CONFIRMATION_THREAD_ID || '';

      const response = await this.sendMessageWithParams({
        chat_id: confirmationGroupId,
        message_thread_id: confirmationThreadId,
        text: message,
        parse_mode: 'HTML'
      });

      if (response.ok) {
        console.log(`✅ Confirmation message sent successfully for order ${order.order_number}`);
        return true;
      } else {
        console.error('❌ Failed to send confirmation message:', response.description);
        return false;
      }
    } catch (error) {
      console.error('❌ Error sending confirmation message:', error);
      return false;
    }
  }

  /**
   * Format confirmation message for Telegram
   */
  private formatConfirmationMessage(order: any, action: 'confirmed' | 'cancelled', processedBy: string): string {
    // Only show detailed format for confirmed orders
    if (action === 'confirmed') {
      return this.formatDetailedConfirmationMessage(order, processedBy);
    }

    // Simple format for cancelled orders
    const emoji = '❌';
    const actionText = 'CANCELLED';

    return `
${emoji} <b>ORDER ${actionText}</b>

📋 <b>Order:</b> ${order.order_number}
💰 <b>Total:</b> $${order.total_amount.toFixed(2)}
👤 <b>Processed by:</b> ${processedBy}
📅 <b>Processed at:</b> ${new Date().toLocaleString()}

🚫 Order has been cancelled.
    `.trim();
  }

  /**
   * Format detailed confirmation message for confirmed orders
   */
  private formatDetailedConfirmationMessage(order: any, processedBy: string): string {
    // DIRECT IMPLEMENTATION - NO HELPER METHODS TO AVOID ISSUES

    // Get customer name directly
    let customerName = 'Not provided';
    if (order.users?.first_name || order.users?.last_name) {
      customerName = `${order.users.first_name || ''} ${order.users.last_name || ''}`.trim();
    } else if (order.shipping_address?.firstName || order.shipping_address?.lastName) {
      customerName = `${order.shipping_address.firstName || ''} ${order.shipping_address.lastName || ''}`.trim();
    } else if (order.email) {
      customerName = order.email.split('@')[0];
    }

    // Get customer info directly
    const customerEmail = order.email || 'Not provided';
    const customerPhone = order.phone || 'Not provided';

    // Get ABA Bank Name directly
    const abaBank = order.shipping_address?.abaBankName || 'Not provided';

    // Format shipping address directly
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

    // Format order items directly
    let orderItemsText = '• No items found';
    if (order.order_items && order.order_items.length > 0) {
      orderItemsText = order.order_items.map((item: any) => {
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

👤 Processed by: ${processedBy}
📅 Processed at: ${new Date().toLocaleString()}
    `.trim();
  }

  /**
   * Get customer name from order data
   */
  private getCustomerName(order: any): string {
    // Try to get name from user profile first (joined data)
    if (order.users) {
      const firstName = order.users.first_name || '';
      const lastName = order.users.last_name || '';
      if (firstName || lastName) {
        return `${firstName} ${lastName}`.trim();
      }
    }

    // Try to get name from profiles (if using old structure)
    if (order.profiles) {
      const firstName = order.profiles.first_name || '';
      const lastName = order.profiles.last_name || '';
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

      // Fallback to other name fields
      const name = order.shipping_address.name || order.shipping_address.full_name;
      if (name) return name;
    }

    // Fallback to email username
    if (order.email) {
      return order.email.split('@')[0];
    }

    return 'Not provided';
  }

  /**
   * Get ABA Bank Name from order data
   */
  private getABABankName(order: any): string {
    // Try to get from shipping address first
    if (order.shipping_address && typeof order.shipping_address === 'object') {
      const abaBank = order.shipping_address.abaBankName ||
                     order.shipping_address.aba_bank_name ||
                     order.shipping_address.bank_name;
      if (abaBank) return abaBank;
    }

    // Try to get from billing address
    if (order.billing_address && typeof order.billing_address === 'object') {
      const abaBank = order.billing_address.abaBankName ||
                     order.billing_address.aba_bank_name ||
                     order.billing_address.bank_name;
      if (abaBank) return abaBank;
    }

    return 'Not provided';
  }

  /**
   * Format shipping address
   */
  private formatShippingAddress(shippingAddress: any): string {
    if (!shippingAddress || typeof shippingAddress !== 'object') {
      return 'Not provided';
    }

    const parts = [];

    // Try new field names first (address1, address2)
    if (shippingAddress.address1) parts.push(shippingAddress.address1);
    if (shippingAddress.address2) parts.push(shippingAddress.address2);

    // Try old field names as fallback (address_line_1, address_line_2)
    if (!shippingAddress.address1 && shippingAddress.address_line_1) {
      parts.push(shippingAddress.address_line_1);
    }
    if (!shippingAddress.address2 && shippingAddress.address_line_2) {
      parts.push(shippingAddress.address_line_2);
    }

    if (shippingAddress.city) parts.push(shippingAddress.city);
    if (shippingAddress.state) parts.push(shippingAddress.state);
    if (shippingAddress.country) parts.push(shippingAddress.country);

    return parts.length > 0 ? parts.join(', ') : 'Not provided';
  }

  /**
   * Format order items list
   */
  private formatOrderItems(orderItems: any[]): string {
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

  /**
   * Format user name from Telegram user data
   */
  private formatUserName(user: TelegramCallbackQuery['from']): string {
    const parts = [user.first_name];
    if (user.last_name) parts.push(user.last_name);
    if (user.username) parts.push(`(@${user.username})`);
    return parts.join(' ');
  }

  /**
   * Update the original message to show it's been processed
   */
  private async updateOriginalMessage(
    callbackQuery: TelegramCallbackQuery, 
    action: 'confirmed' | 'cancelled', 
    processedBy: string
  ): Promise<void> {
    try {
      const emoji = action === 'confirmed' ? '✅' : '❌';
      const actionText = action === 'confirmed' ? 'CONFIRMED' : 'CANCELLED';
      
      const updatedText = `${callbackQuery.message.text}

${emoji} <b>ORDER ${actionText}</b>
👤 <b>Processed by:</b> ${processedBy}
📅 <b>Processed at:</b> ${new Date().toLocaleString()}`;

      await this.editMessage({
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        text: updatedText,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [] // Remove buttons
        }
      });

    } catch (error) {
      console.error('❌ Error updating original message:', error);
    }
  }

  /**
   * Answer callback query
   */
  private async answerCallbackQuery(callbackQueryId: string, text: string): Promise<void> {
    try {
      const url = `https://api.telegram.org/bot${this.botToken}/answerCallbackQuery`;
      
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text: text,
          show_alert: false
        }),
      });
    } catch (error) {
      console.error('❌ Error answering callback query:', error);
    }
  }

  /**
   * Send simple message to a chat
   */
  private async sendMessage(chatId: number, text: string): Promise<any> {
    return this.sendMessageWithParams({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    });
  }

  /**
   * Send message to Telegram with full parameters
   */
  private async sendMessageWithParams(params: any): Promise<any> {
    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      return await response.json();
    } catch (error) {
      console.error('❌ Error sending message:', error);
      return { ok: false, description: 'Network error' };
    }
  }

  /**
   * Edit message
   */
  private async editMessage(params: any): Promise<void> {
    try {
      const url = `https://api.telegram.org/bot${this.botToken}/editMessageText`;

      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });
    } catch (error) {
      console.error('❌ Error editing message:', error);
    }
  }

  /**
   * Send a reply message to a specific message
   */
  private async sendReplyMessage(chatId: number, replyToMessageId: number, text: string): Promise<boolean> {
    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_thread_id: process.env.TELEGRAM_NOTIFICATION_THREAD_ID,
          text: text,
          reply_to_message_id: replyToMessageId,
          parse_mode: 'HTML'
        })
      });

      const result = await response.json();
      return result.ok;
    } catch (error) {
      console.error('❌ Error sending reply message:', error);
      return false;
    }
  }




  /**
   * Process arrival confirmation and update order status
   */
  private async processArrivalConfirmation(order: any, processedBy: string): Promise<boolean> {
    try {
      console.log(`🔄 Processing arrival confirmation for order ${order.order_number}`);

      const supabase = createServiceRoleClient();

      // Use the new database function to handle arrival confirmation workflow
      const { data, error } = await supabase.rpc('confirm_order_arrival', {
        p_order_id: order.id,
        p_confirmed_by: processedBy
      });

      if (error) {
        console.error(`❌ Failed to confirm arrival for order ${order.order_number}:`, error);
        return false;
      }

      console.log(`✅ Order ${order.order_number} arrival confirmed successfully`);

      // Send delivery notification to the second group
      const { telegramNotificationService } = await import('@/lib/telegram/notification-service');
      const deliveryNotificationSent = await telegramNotificationService.sendConfirmationMessage(
        order,
        'confirmed',
        processedBy
      );

      if (deliveryNotificationSent) {
        // Mark delivery notification as sent in database
        const { error: notificationError } = await supabase.rpc('mark_delivery_notification_sent', {
          p_order_id: order.id
        });

        if (notificationError) {
          console.error(`❌ Failed to mark delivery notification as sent for ${order.order_number}:`, notificationError);
        } else {
          console.log(`✅ Delivery notification sent and marked for order ${order.order_number}`);
        }
      } else {
        console.error(`❌ Failed to send delivery notification for order ${order.order_number}`);
        // Don't return false here as the order was already updated successfully
      }

      console.log(`✅ Arrival confirmation processed successfully for order ${order.order_number}`);
      return true;
    } catch (error) {
      console.error('❌ Error processing arrival confirmation:', error);
      return false;
    }
  }





  /**
   * Find order by order number
   */
  private async findOrderByNumber(orderNumber: string): Promise<any> {
    try {
      const supabase = createServiceRoleClient();

      // Use the same complete query as other methods to ensure all data is available
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
        .eq('telegram_workflow_state', 'notification_sent')
        .not('telegram_message_id', 'is', null)
        .single();

      if (error) {
        // Handle the specific case where no rows are returned (PGRST116)
        if (error.code === 'PGRST116') {
          console.log(`📱 Order ${orderNumber} not found or not in notification_sent state`);
          return null;
        }
        console.error(`❌ Error finding order ${orderNumber}:`, error);
        return null;
      }

      if (!order) {
        console.log(`📱 Order ${orderNumber} not found or not in notification_sent state`);
        return null;
      }

      console.log(`📱 Found order ${order.order_number} by order number`);
      return order;
    } catch (error) {
      console.error(`❌ Error finding order by number ${orderNumber}:`, error);
      return null;
    }
  }
}

// Export singleton instance
export const telegramCallbackHandler = new TelegramCallbackHandler();

/**
 * Main handler function for Telegram updates
 */
export async function handleTelegramUpdate(update: TelegramUpdate): Promise<boolean> {
  if (update.callback_query) {
    return await telegramCallbackHandler.handleCallback(update.callback_query);
  }

  if (update.message) {
    return await telegramCallbackHandler.handleTextMessage(update.message);
  }

  if (update.edited_message) {
    return await telegramCallbackHandler.handleTextMessage(update.edited_message);
  }

  console.log('📱 Received Telegram update without callback query or message');
  return true;
}
