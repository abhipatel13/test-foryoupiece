import { createServiceRoleClient } from '@/lib/supabase/service-role';

// Telegram API configuration
const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

interface TelegramConfig {
  botToken: string;
  notificationGroupId: string;
  notificationThreadId: string;
  confirmationGroupId: string;
  confirmationThreadId: string;
}

interface OrderData {
  id: string;
  order_number: string;
  total_amount: number;
  subtotal: number;
  shipping_cost: number;
  discount_amount: number;
  points_used: number;
  coupon_discount_amount?: number;
  payment_status: string;
  fulfillment_status: string;
  payment_method?: string;
  created_at: string;
  email: string;
  phone?: string;
  notes?: string;
  shipping_address?: {
    address_line_1?: string;
    address_line_2?: string;
    city?: string;
    country?: string;
    postal_code?: string;
    // New fields for customer information
    firstName?: string;
    lastName?: string;
    abaBankName?: string;
    address1?: string;
    address2?: string;
  };
  order_items?: Array<{
    title: string;
    quantity: number;
    price: number;
    total: number;
    sku?: string;
  }>;
  profiles?: {
    full_name?: string;
    first_name?: string;
    last_name?: string;
  };
}

interface TelegramMessage {
  message_id: number;
  chat: {
    id: number;
  };
}

interface TelegramResponse {
  ok: boolean;
  result?: TelegramMessage;
  description?: string;
}

export class TelegramNotificationService {
  private config: TelegramConfig;
  private readonly WEBHOOK_SECRET: string;

  constructor() {
    this.config = {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      notificationGroupId: process.env.TELEGRAM_NOTIFICATION_GROUP_ID || '',
      notificationThreadId: process.env.TELEGRAM_NOTIFICATION_THREAD_ID || '',
      confirmationGroupId: process.env.TELEGRAM_CONFIRMATION_GROUP_ID || '',
      confirmationThreadId: process.env.TELEGRAM_CONFIRMATION_THREAD_ID || '',
    };

    this.WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || 'foryoupiece-webhook-secret';

    // Validate required configuration
    this.validateConfiguration();
  }

  /**
   * Validate Telegram configuration
   */
  private validateConfiguration(): void {
    const requiredFields = [
      { field: 'botToken', name: 'TELEGRAM_BOT_TOKEN' },
      { field: 'notificationGroupId', name: 'TELEGRAM_NOTIFICATION_GROUP_ID' },
      { field: 'confirmationGroupId', name: 'TELEGRAM_CONFIRMATION_GROUP_ID' }
    ];

    for (const { field, name } of requiredFields) {
      if (!this.config[field as keyof TelegramConfig]) {
        throw new Error(`${name} is not configured`);
      }
    }

    // Validate bot token format
    if (!this.config.botToken.match(/^\d+:[A-Za-z0-9_-]+$/)) {
      throw new Error('Invalid TELEGRAM_BOT_TOKEN format');
    }

    // Validate group IDs are negative numbers (Telegram groups have negative IDs)
    if (!this.config.notificationGroupId.startsWith('-') || !this.config.confirmationGroupId.startsWith('-')) {
      throw new Error('Telegram group IDs must be negative numbers');
    }
  }

  /**
   * Validate webhook request authenticity
   */
  validateWebhookRequest(headers: Headers, body: string): boolean {
    try {
      const telegramSignature = headers.get('x-telegram-bot-api-secret-token');

      console.log('🔐 Webhook validation - Secret configured:', !!this.WEBHOOK_SECRET);
      console.log('🔐 Webhook validation - Signature received:', !!telegramSignature);

      // If webhook secret is configured, validate it
      if (this.WEBHOOK_SECRET && this.WEBHOOK_SECRET !== 'foryoupiece-webhook-secret') {
        if (!telegramSignature || telegramSignature !== this.WEBHOOK_SECRET) {
          console.error('❌ Invalid webhook signature');
          return false;
        }
      }

      console.log('✅ Webhook signature validation passed');
      return true;
    } catch (error) {
      console.error('❌ Error validating webhook request:', error);
      return false;
    }
  }

  /**
   * Check if user is authorized to process orders
   */
  isAuthorizedUser(userId: number, username?: string): boolean {
    // For now, we'll allow any user in the notification group to process orders
    // In production, you might want to maintain a whitelist of authorized users
    const authorizedUserIds = process.env.TELEGRAM_AUTHORIZED_USERS?.split(',').map(id => parseInt(id.trim())) || [];

    if (authorizedUserIds.length > 0) {
      return authorizedUserIds.includes(userId);
    }

    // If no specific users are configured, allow any user (less secure but more flexible)
    console.log(`📱 User ${userId} (${username || 'unknown'}) processing order - no authorization restrictions configured`);
    return true;
  }

  /**
   * Send order notification to the notification group
   */
  async sendOrderNotification(order: OrderData): Promise<boolean> {
    try {
      console.log(`📱 Sending Telegram notification for order ${order.order_number}`);

      const message = this.formatOrderMessage(order);

      const response = await this.sendMessage({
        chat_id: this.config.notificationGroupId,
        message_thread_id: this.config.notificationThreadId,
        text: message,
        parse_mode: 'HTML'
      });

      if (response.ok && response.result) {
        // Store message ID in database
        await this.storeTelegramNotification({
          order_id: order.id,
          message_id: response.result.message_id.toString(),
          group_id: this.config.notificationGroupId,
          thread_id: this.config.notificationThreadId,
          message_type: 'notification'
        });

        // Update order with Telegram message ID and workflow state
        const supabase = createServiceRoleClient();
        await supabase
          .from('orders')
          .update({
            telegram_message_id: response.result.message_id.toString(),
            telegram_status: 'pending',
            telegram_workflow_state: 'notification_sent'
          })
          .eq('id', order.id);

        console.log(`✅ Telegram notification sent successfully for order ${order.order_number}`);
        return true;
      } else {
        console.error('❌ Failed to send Telegram notification:', response.description);
        return false;
      }
    } catch (error) {
      console.error('❌ Error sending Telegram notification:', error);
      return false;
    }
  }

  /**
   * Send confirmation message to the confirmation group
   */
  async sendConfirmationMessage(order: OrderData, action: 'confirmed' | 'cancelled', processedBy: string): Promise<boolean> {
    try {
      console.log(`📱 Sending confirmation message for order ${order.order_number}: ${action}`);

      const message = this.formatConfirmationMessage(order, action, processedBy);

      const response = await this.sendMessage({
        chat_id: this.config.confirmationGroupId,
        message_thread_id: this.config.confirmationThreadId,
        text: message,
        parse_mode: 'HTML'
      });

      if (response.ok && response.result) {
        await this.storeTelegramNotification({
          order_id: order.id,
          message_id: response.result.message_id.toString(),
          group_id: this.config.confirmationGroupId,
          thread_id: this.config.confirmationThreadId,
          message_type: 'confirmation'
        });

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
   * Update order status in database
   */
  async updateOrderStatus(orderId: string, status: 'confirmed' | 'cancelled', processedBy: string): Promise<boolean> {
    try {
      const supabase = createServiceRoleClient();

      // Use correct enum values for payment_status and fulfillment_status
      const newPaymentStatus = status === 'confirmed' ? 'verified' : 'failed';
      const newFulfillmentStatus = status === 'confirmed' ? 'shipped' : 'cancelled';

      console.log(`🔄 Updating order ${orderId} status:`, {
        payment_status: newPaymentStatus,
        fulfillment_status: newFulfillmentStatus,
        telegram_status: status,
        processed_by: processedBy
      });

      // Update order status directly instead of using RPC function
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

      console.log(`✅ Order ${orderId} status updated to ${status} (payment: ${newPaymentStatus}, fulfillment: ${newFulfillmentStatus})`);
      return true;
    } catch (error) {
      console.error('❌ Error updating order status:', error);
      return false;
    }
  }

  /**
   * Format order message for Telegram
   */
  private formatOrderMessage(order: OrderData): string {
    // Get customer name from shipping address first, then fall back to user profile
    let customerName = '';
    if (order.shipping_address?.firstName && order.shipping_address?.lastName) {
      customerName = `${order.shipping_address.firstName} ${order.shipping_address.lastName}`.trim();
    } else if (order.profiles?.first_name || order.profiles?.last_name) {
      customerName = `${order.profiles.first_name || ''} ${order.profiles.last_name || ''}`.trim();
    } else if (order.profiles?.full_name) {
      customerName = order.profiles.full_name;
    }

    // Get ABA bank name from shipping address first, then fall back to notes
    let abaBankName = '';
    if (order.shipping_address?.abaBankName) {
      abaBankName = order.shipping_address.abaBankName;
    } else {
      // Extract ABA bank name from notes if present (legacy fallback)
      const notes = order.notes || '';
      const abaBankMatch = notes.match(/ABA Bank Name:\s*([^.]+)/i);
      if (abaBankMatch) {
        abaBankName = abaBankMatch[1].trim();
      }
    }

    // Extract special notes (everything except ABA bank name)
    const notes = order.notes || '';
    const specialNotes = notes.replace(/ABA Bank Name:\s*[^.]+\.?\s*/i, '').trim();

    // Format shipping address
    const address = order.shipping_address;
    const addressLines = [];

    // Use address1/address2 if available, otherwise fall back to address_line_1/address_line_2
    if (address?.address1) addressLines.push(address.address1);
    else if (address?.address_line_1) addressLines.push(address.address_line_1);

    if (address?.address2) addressLines.push(address.address2);
    else if (address?.address_line_2) addressLines.push(address.address_line_2);

    // Only include non-empty address components
    const addressComponents = [
      ...addressLines,
      address?.city,
      address?.country,
      address?.postal_code
    ].filter(component => component && component.trim() !== '');

    const fullAddress = addressComponents.length > 0 ? addressComponents.join(', ') : '';

    // Format order items with more details
    const items = order.order_items?.map(item => {
      const sku = item.sku ? ` (${item.sku})` : '';
      return `• ${item.title}${sku}\n  Qty: ${item.quantity} × $${item.price.toFixed(2)} = $${item.total.toFixed(2)}`;
    }).join('\n') || 'No items found';

    // Format discount information
    const discountInfo = [];
    if (order.discount_amount > 0) discountInfo.push(`💸 <b>Discount:</b> -$${order.discount_amount.toFixed(2)}`);
    if (order.coupon_discount_amount && order.coupon_discount_amount > 0) discountInfo.push(`🎫 <b>Coupon:</b> -$${order.coupon_discount_amount.toFixed(2)}`);
    if (order.points_used > 0) discountInfo.push(`⭐ <b>Points Used:</b> ${order.points_used}`);

    return `
🛒 <b>NEW ORDER RECEIVED</b>

📋 <b>Order Number:</b> <code>${order.order_number}</code>

👤 <b>CUSTOMER INFORMATION</b>
• <b>Name:</b> ${customerName || 'Not provided'}
• <b>Email:</b> ${order.email}
${order.phone ? `• <b>Phone:</b> ${order.phone}` : ''}
${abaBankName ? `• <b>ABA Bank Name:</b> ${abaBankName}` : ''}

📍 <b>SHIPPING ADDRESS</b>
${fullAddress || 'Not provided'}

💰 <b>ORDER SUMMARY</b>
• <b>Subtotal:</b> $${order.subtotal.toFixed(2)}
• <b>Shipping:</b> $${order.shipping_cost.toFixed(2)}
${discountInfo.length > 0 ? discountInfo.join('\n') + '\n' : ''}• <b>Total Amount:</b> $${order.total_amount.toFixed(2)}
${order.payment_method ? `• <b>Payment Method:</b> ${order.payment_method}` : ''}

📦 <b>ORDER ITEMS</b>
${items}

${specialNotes ? `📝 <b>Special Notes:</b>\n${specialNotes}\n\n` : ''}📅 <b>Order Date:</b> ${new Date(order.created_at).toLocaleString()}
🔄 <b>Status:</b> ${order.payment_status} / ${order.fulfillment_status}

💬 <b>Reply with /done when order is completed</b>
    `.trim();
  }

  /**
   * Format confirmation message for Telegram
   */
  private formatConfirmationMessage(order: OrderData, action: 'confirmed' | 'cancelled', processedBy: string): string {
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
🛒 <b>NEW ORDER RECEIVED - ${actionText}${emoji}</b>

📋 <b>Order Number:</b> ${order.order_number}

👤 <b>CUSTOMER INFORMATION</b>
• Name: ${firstName} ${lastName}
• Email: ${email}
• Phone: ${phone}
• ABA Bank Name: ${abaBankName}

📍 <b>SHIPPING ADDRESS</b>
${fullAddress}

💰 <b>ORDER SUMMARY</b>
• Subtotal: $${(order.subtotal || 0).toFixed(2)}
• Shipping: $${(order.shipping_cost || 0).toFixed(2)}
• Total Amount: $${order.total_amount.toFixed(2)}
• Payment Method: ${order.payment_method || 'qr_code'}

📦 <b>ORDER ITEMS</b>
${itemsText}
    `.trim();
  }



  /**
   * Send message to Telegram
   */
  private async sendMessage(params: any): Promise<TelegramResponse> {
    const url = `${TELEGRAM_API_BASE}${this.config.botToken}/sendMessage`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    return await response.json();
  }

  /**
   * Store Telegram notification in database
   */
  private async storeTelegramNotification(notification: {
    order_id: string;
    message_id: string;
    group_id: string;
    thread_id: string;
    message_type: 'notification' | 'confirmation';
  }): Promise<void> {
    try {
      const supabase = createServiceRoleClient();
      
      const { error } = await supabase
        .from('telegram_notifications')
        .insert(notification);

      if (error) {
        console.error('❌ Failed to store Telegram notification:', error);
      }
    } catch (error) {
      console.error('❌ Error storing Telegram notification:', error);
    }
  }
}

// Export singleton instance
export const telegramNotificationService = new TelegramNotificationService();
