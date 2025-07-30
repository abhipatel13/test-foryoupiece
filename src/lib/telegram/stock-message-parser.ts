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
  // Regex patterns for product extraction
  private readonly productPatterns = [
    // Pattern 1: "1. Product Name x 2 = 50.00" or "1. Product Name *2 = 19$"
    /^(\d+)\.?\s+(.+?)\s*[x*×]\s*(\d+)\s*=\s*([\d.,]+)[\$]?/i,

    // Pattern 2: "Product Name x 2 = 50.00" (without number prefix)
    /^(.+?)\s*[x*×]\s*(\d+)\s*=\s*([\d.,]+)[\$]?/i,

    // Pattern 3: "2 Product Name * 3 = 150.00" (quantity first)
    /^(\d+)\s+(.+?)\s*[x*×]\s*(\d+)\s*=\s*([\d.,]+)[\$]?/i,

    // Pattern 4: "Product Name (x2) = 50.00" (parentheses)
    /^(.+?)\s*\([x*×](\d+)\)\s*=\s*([\d.,]+)[\$]?/i,

    // Pattern 5: "Item name x Qty = Price" format from your message
    /^(.+?)\s*[x*×]\s*(\d+)\s*=\s*([\d.,]+)[\$]?/i
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
    if (message.chat.id !== groupId) return false;

    // Must be from the correct thread
    const threadId = parseInt(process.env.TELEGRAM_STOCK_THREAD_ID || '0');
    if (message.message_thread_id !== threadId) return false;

    // Must contain "ORDER CONFIRMATION" (case-insensitive)
    const text = message.text.toLowerCase();
    if (!text.includes('order confirmation')) return false;

    // Must NOT contain "#Order" (indicates order ID, not stock update)
    if (text.includes('#order') || text.includes('#Order')) return false;

    // Must contain at least one product pattern
    return this.hasProductPatterns(message.text);
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

    // Handle different pattern structures
    if (match.length === 5) {
      // Pattern: "1. Product Name x 2 = 50.00"
      const [, prefix, name, qty, priceStr] = match;
      productName = name.trim();
      quantity = parseInt(qty);
      price = parseFloat(priceStr.replace(/,/g, ''));
    } else if (match.length === 4) {
      // Pattern: "Product Name x 2 = 50.00"
      const [, name, qty, priceStr] = match;
      productName = name.trim();
      quantity = parseInt(qty);
      price = parseFloat(priceStr.replace(/,/g, ''));
    } else {
      throw new Error(`Unexpected match pattern length: ${match.length}`);
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
    if (!authorizedUsers) {
      console.warn('No authorized users configured for stock updates');
      return false;
    }

    const authorizedIds = authorizedUsers.split(',').map(id => parseInt(id.trim()));
    return authorizedIds.includes(userId);
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
