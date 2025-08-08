# Telegram Automated Stock Deduction System

## Overview

This system automatically monitors Telegram messages in a specific group/thread for ORDER CONFIRMATION messages and deducts stock quantities from the database when valid orders are detected.

## System Components

### 1. Message Poller (`telegram-stock-poller.js`)
- Continuously polls Telegram API for new messages
- Filters messages from the correct group/thread
- Sends valid messages to the webhook for processing

### 2. Webhook Handler (`/api/telegram/stock-webhook`)
- Receives and validates incoming Telegram updates
- Processes stock updates through the stock manager
- Sends confirmation responses back to Telegram

### 3. Message Parser (`stock-message-parser.ts`)
- Validates message format and content
- Extracts product information from ORDER CONFIRMATION messages
- Supports multiple product format variations

### 4. Product Matcher (`product-matcher.ts`)
- Matches parsed product names to database products
- Uses exact and fuzzy matching algorithms
- Handles duplicate product names

### 5. Stock Manager (`stock-manager.ts`)
- Orchestrates the entire stock update process
- Updates product quantities in the database
- Logs all activities and generates response messages

## Configuration

### Environment Variables (.env.local)
```bash
# Stock Management Bot Token
TELEGRAM_STOCK_BOT_TOKEN=8204152720:AAEo_3y2futHz-oF5j2PuAjbtSJT5TCOesk

# Group and Thread Configuration
TELEGRAM_STOCK_GROUP_ID=-1002667614926
TELEGRAM_STOCK_THREAD_ID=3

# Security and Processing Settings
TELEGRAM_STOCK_WEBHOOK_SECRET=foryoupiece-stock-webhook-2025
TELEGRAM_STOCK_PROCESSING_ENABLED=true
TELEGRAM_STOCK_AUTO_CONFIRM=true
TELEGRAM_STOCK_LOG_LEVEL=info
```

## Message Format Requirements

The system processes messages with this exact format:

```
🎀✨ ORDER CONFIRMATION ✨🎀

👤 Customer Info
Name: [Customer Name]
Phone number: [Phone]
Address: [Address]

🛒 Items
Item name x Qty = Price
1. [Product Name] x[Quantity] = $[Price]

💸 Pricing Summary
• Delivery Fee: $1.5
• Total amount: $[Total]
• Deposit: $[Deposit] 
• Amount Due: $[Due]

🚢 or ✈️ Shipping method:

📌 Important Notes  
🔒 Final Sale   : Orders are final and non-refundable. No cancellations, returns, or exchanges accepted. 
🚚 Delivery     : We will notify you once your items are ready for delivery.

🙏 Thank you for your purchase! 🤍
```

### Supported Product Formats
- `1. Product Name x2 = $50.00` (no space before quantity)
- `1. Product Name x 2 = $50.00` (space before quantity)
- `Product Name x2 = $50.00` (no number prefix)
- `Product Name x 2 = $50.00` (no prefix, space before quantity)
- `Product Name * 2 = $50.00` (asterisk with space)
- `Product Name *2 = $50.00` (asterisk without space)

### Message Filtering Rules
✅ **PROCESSES messages that:**
- Contain "ORDER CONFIRMATION" (case-insensitive)
- Are from the correct group and thread
- Have valid product patterns
- Do NOT contain "Order ID"

❌ **IGNORES messages that:**
- Contain "Order ID" (duplicates/test messages)
- Are from wrong group or thread
- Don't contain "ORDER CONFIRMATION"
- Have no valid product patterns

## Testing the System

### 1. Test Bot Connectivity
```bash
GET /api/telegram/test-stock-bot
GET /api/telegram/test-stock-bot?send_test=true
```

This endpoint tests:
- Bot token validity
- Group access permissions
- Bot permissions in the chat
- Ability to send messages (optional)

### 2. Test Message Processing
```bash
POST /api/telegram/test-stock-system
Content-Type: application/json

{
  "testMessage": "🎀✨ ORDER CONFIRMATION ✨🎀\n\n👤 Customer Info\nName: Test Customer\n\n🛒 Items\n1. Test Product x2 = $20.00\n\n🙏 Thank you for your purchase! 🤍",
  "dryRun": true
}
```

### 3. Get Sample Test Messages
```bash
GET /api/telegram/test-stock-system
```

Returns sample messages for testing different scenarios.

## Running the System

### 1. Start the Development Server
```bash
npm run dev
```

### 2. Start the Telegram Poller (in separate terminal)
```bash
node telegram-stock-poller.js
```

### 3. Monitor Logs
The system provides detailed logging:
- `📦 [STOCK]` - Stock processing logs
- `✅` - Success indicators
- `❌` - Error indicators
- `⚠️` - Warning indicators

## Troubleshooting

### Common Issues

1. **Bot Token Invalid**
   - Check TELEGRAM_STOCK_BOT_TOKEN is correct
   - Verify bot is active and not revoked

2. **No Access to Group**
   - Ensure bot is added to the group
   - Check group ID is correct (negative number)
   - Verify bot has necessary permissions

3. **Messages Not Processing**
   - Check thread ID is correct
   - Verify message format matches requirements
   - Ensure messages don't contain "Order ID"

4. **Products Not Matching**
   - Check product names in database
   - Verify product names are active (is_active = true)
   - Check for typos or formatting differences

### Debug Steps

1. **Test Bot Connectivity**
   ```bash
   curl http://localhost:3000/api/telegram/test-stock-bot
   ```

2. **Test Message Processing**
   ```bash
   curl -X POST http://localhost:3000/api/telegram/test-stock-system \
     -H "Content-Type: application/json" \
     -d '{"testMessage": "YOUR_TEST_MESSAGE", "dryRun": true}'
   ```

3. **Check Logs**
   - Monitor console output from both server and poller
   - Look for specific error messages and warnings

4. **Verify Database**
   - Check products table for matching names
   - Verify stock quantities are being updated
   - Check stock_logs table for update history

## Security Considerations

- Bot token is sensitive - keep secure
- Webhook secret validates incoming requests
- User authorization can be configured
- All activities are logged for audit trail

## Performance Notes

- Polling interval is 5 seconds (configurable)
- Database queries are optimized for matching
- Fuzzy matching has performance implications
- Consider rate limiting for high-volume scenarios
