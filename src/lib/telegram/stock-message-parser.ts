/**
 * Telegram Stock Message Parser
 * Handles parsing of ORDER CONFIRMATION messages for stock updates
 */

export interface ParsedProduct {
  rawText: string;
  extractedName: string;
  quantity: number;
  price?: number;
  lineNumber: number;
}

export interface MessageParseResult {
  isValid: boolean;
  products: ParsedProduct[];
  totalProducts: number;
  errors: string[];
  rawMessage: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: {
    id: number;
    first_name: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
  };
  message_thread_id?: number;
  text?: string;
  date: number;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
}

/**
 * Stock Message Parser Class
 */
export class StockMessageParser {
  // Regex patterns for product extraction - Enhanced to handle all format variations
  private readonly productPatterns = [
    // Pattern 1: "1. Product Name x2 = $50.00" (no space before quantity)
    /^(\d+)\.?\s+(.+?)\s*[x*×](\d+)\s*=\s*\$?([\d.,]+)[\$]?/i,

    // Pattern 2: "1. Product Name x 2 = $50.00" (space before quantity)
    /^(\d+)\.?\s+(.+?)\s*[x*×]\s+(\d+)\s*=\s*\$?([\d.,]+)[\$]?/i,

    // Pattern 3: "Product Name x2 = $50.00" (no number prefix, no space before quantity)
    /^(.+?)\s*[x*×](\d+)\s*=\s*\$?([\d.,]+)[\$]?/i,

    // Pattern 4: "Product Name x 2 = $50.00" (no number prefix, space before quantity)
    /^(.+?)\s*[x*×]\s+(\d+)\s*=\s*\$?([\d.,]+)[\$]?/i,

    // Pattern 5: "Product Name * 2 = $50.00" (asterisk with space)
    /^(.+?)\s*\*\s+(\d+)\s*=\s*\$?([\d.,]+)[\$]?/i,

    // Pattern 6: "Product Name *2 = $50.00" (asterisk without space)
    /^(.+?)\s*\*(\d+)\s*=\s*\$?([\d.,]+)[\$]?/i,

    // Pattern 7: "Product Name (x2) = $50.00" (parentheses format)
    /^(.+?)\s*\([x*×](\d+)\)\s*=\s*\$?([\d.,]+)[\$]?/i,

    // Pattern 8: "2 Product Name * 3 = $150.00" (quantity first - rare but possible)
    /^(\d+)\s+(.+?)\s*[x*×]\s*(\d+)\s*=\s*\$?([\d.,]+)[\$]?/i,

    // Pattern 9: Generic catch-all for any remaining variations
    /^(.+?)\s*[x*×]\s*(\d+)\s*=\s*\$?([\d.,]+)[\$]?/i
  ];

  /**
   * Check if message should be processed for stock updates
   */
  isValidStockMessage(update: TelegramUpdate): boolean {
    const message = update.message || update.edited_message;
    if (!message) return false;

    // Must have text content
    if (!message.text) return false;

    // Must be from the correct group
    const groupId = parseInt(process.env.TELEGRAM_STOCK_GROUP_ID || '0');
    if (message.chat.id !== groupId) {
      console.log(`📦 Message not from stock group (${message.chat.id} !== ${groupId}), ignoring`);
      return false;
    }

    // Must be from the correct thread
    const threadId = parseInt(process.env.TELEGRAM_STOCK_THREAD_ID || '0');
    if (message.message_thread_id !== threadId) {
      console.log(`📦 Message not from stock thread (${message.message_thread_id} !== ${threadId}), ignoring`);
      return false;
    }

    // Must contain "ORDER CONFIRMATION" (case-insensitive) - exact format requirement
    const text = message.text.toLowerCase();
    if (!text.includes('order confirmation')) {
      console.log('📦 Message does not contain "ORDER CONFIRMATION", ignoring');
      return false;
    }

    // Must NOT contain "Order ID" (indicates duplicate or test message)
    if (text.includes('order id')) {
      console.log('📦 Message contains "Order ID", ignoring as duplicate/test message');
      return false;
    }

    // Must contain at least one product pattern
    const hasProducts = this.hasProductPatterns(message.text);
    if (!hasProducts) {
      console.log('📦 Message does not contain valid product patterns, ignoring');
    }

    return hasProducts;
  }

  /**
   * Check if text contains valid product patterns
   */
  private hasProductPatterns(text: string): boolean {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    for (const line of lines) {
      for (const pattern of this.productPatterns) {
        if (pattern.test(line)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Parse message text to extract product information
   */
  parseMessage(messageText: string): MessageParseResult {
    const result: MessageParseResult = {
      isValid: false,
      products: [],
      totalProducts: 0,
      errors: [],
      rawMessage: messageText
    };

    try {
      const lines = messageText.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      let lineNumber = 0;
      
      for (const line of lines) {
        lineNumber++;
        
        // Skip header lines and non-product lines
        if (this.isHeaderLine(line)) continue;
        
        const product = this.parseProductLine(line, lineNumber);
        if (product) {
          result.products.push(product);
        }
      }

      result.totalProducts = result.products.length;
      result.isValid = result.totalProducts > 0;

      if (result.totalProducts === 0) {
        result.errors.push('No valid product patterns found in message');
      }

    } catch (error) {
      result.errors.push(`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Parse a single product line
   */
  private parseProductLine(line: string, lineNumber: number): ParsedProduct | null {
    for (const pattern of this.productPatterns) {
      const match = line.match(pattern);
      if (match) {
        try {
          return this.extractProductFromMatch(match, line, lineNumber);
        } catch (error) {
          console.warn(`Failed to extract product from line ${lineNumber}: ${line}`, error);
          continue;
        }
      }
    }
    
    return null;
  }

  /**
   * Extract product information from regex match
   */
  private extractProductFromMatch(match: RegExpMatchArray, rawText: string, lineNumber: number): ParsedProduct {
    let productName: string;
    let quantity: number;
    let price: number | undefined;

    // Handle different pattern structures based on match groups
    if (match.length === 5) {
      // Pattern with prefix: "1. Product Name x 2 = 50.00" or "2 Product Name * 3 = 150.00"
      const [, prefix, name, qty, priceStr] = match;
      productName = name.trim();
      quantity = parseInt(qty);
      price = parseFloat(priceStr.replace(/,/g, ''));
    } else if (match.length === 4) {
      // Pattern without prefix: "Product Name x 2 = 50.00"
      const [, name, qty, priceStr] = match;
      productName = name.trim();
      quantity = parseInt(qty);
      price = parseFloat(priceStr.replace(/,/g, ''));
    } else if (match.length === 3) {
      // Simplified pattern: "Product Name x2" (no price)
      const [, name, qty] = match;
      productName = name.trim();
      quantity = parseInt(qty);
      price = undefined;
    } else {
      throw new Error(`Unexpected match pattern length: ${match.length} for line: ${rawText}`);
    }

    // Validate extracted data
    if (!productName || productName.length === 0) {
      throw new Error('Empty product name');
    }

    if (isNaN(quantity) || quantity <= 0) {
      throw new Error(`Invalid quantity: ${quantity}`);
    }

    if (price !== undefined && (isNaN(price) || price < 0)) {
      throw new Error(`Invalid price: ${price}`);
    }

    // Log successful extraction for debugging
    console.log(`📦 Extracted product: "${productName}" x${quantity} ${price ? `= $${price}` : ''} (line ${lineNumber})`);

    return {
      rawText,
      extractedName: this.cleanProductName(productName),
      quantity,
      price,
      lineNumber
    };
  }

  /**
   * Clean and normalize product name
   */
  private cleanProductName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[""'']/g, '"') // Normalize quotes
      .replace(/[–—]/g, '-') // Normalize dashes
      .toLowerCase(); // Convert to lowercase for matching
  }

  /**
   * Check if line is a header/non-product line
   */
  private isHeaderLine(line: string): boolean {
    const lowerLine = line.toLowerCase();
    
    // Skip common header patterns
    const headerPatterns = [
      /order\s+confirmation/i,
      /🎀.*order.*confirmation.*🎀/i,
      /total/i,
      /subtotal/i,
      /shipping/i,
      /tax/i,
      /discount/i,
      /customer/i,
      /date/i,
      /time/i,
      /payment/i,
      /delivery/i,
      /^-+$/,
      /^=+$/,
      /^\*+$/,
      /^#+$/
    ];

    return headerPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Validate user authorization for stock updates
   */
  isAuthorizedUser(userId: number, username?: string): boolean {
    const authorizedUsers = process.env.TELEGRAM_STOCK_AUTHORIZED_USERS;

    // If no authorized users configured, allow all users (for testing/production flexibility)
    if (!authorizedUsers || authorizedUsers.trim() === '' || authorizedUsers === '123456789') {
      console.log(`📦 [AUTH] No specific authorization configured, allowing user ${userId} (${username || 'unknown'})`);
      return true;
    }

    const authorizedIds = authorizedUsers.split(',').map(id => parseInt(id.trim()));
    const isAuthorized = authorizedIds.includes(userId);

    console.log(`📦 [AUTH] User ${userId} (${username || 'unknown'}) authorization: ${isAuthorized ? 'ALLOWED' : 'DENIED'}`);
    console.log(`📦 [AUTH] Authorized IDs: ${authorizedIds.join(', ')}`);

    return isAuthorized;
  }

  /**
   * Extract user information from Telegram message
   */
  extractUserInfo(message: TelegramMessage) {
    return {
      id: message.from?.id || 0,
      username: message.from?.username,
      firstName: message.from?.first_name || 'Unknown',
      displayName: message.from?.username 
        ? `@${message.from.username}` 
        : message.from?.first_name || 'Unknown User'
    };
  }
}

// Export singleton instance
export const stockMessageParser = new StockMessageParser();
