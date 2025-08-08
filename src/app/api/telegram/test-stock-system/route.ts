import { NextRequest, NextResponse } from 'next/server';
import { stockManager } from '@/lib/telegram/stock-manager';
import { stockMessageParser, TelegramUpdate } from '@/lib/telegram/stock-message-parser';

/**
 * Test Telegram Stock System End-to-End
 * POST /api/telegram/test-stock-system
 * 
 * This endpoint tests the complete stock deduction flow with sample messages
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing Telegram Stock System End-to-End...');

    const body = await request.json();
    const { testMessage, dryRun = true } = body;

    if (!testMessage) {
      return NextResponse.json({
        success: false,
        error: 'testMessage is required in request body'
      }, { status: 400 });
    }

    // Create a mock Telegram update for testing
    const mockUpdate: TelegramUpdate = {
      update_id: 999999,
      message: {
        message_id: 999999,
        from: {
          id: 123456789,
          is_bot: false,
          first_name: 'Test',
          username: 'testuser'
        },
        chat: {
          id: parseInt(process.env.TELEGRAM_STOCK_GROUP_ID || '0'),
          type: 'supergroup'
        },
        message_thread_id: parseInt(process.env.TELEGRAM_STOCK_THREAD_ID || '0'),
        date: Math.floor(Date.now() / 1000),
        text: testMessage
      }
    };

    const results = {
      configuration: {
        groupId: process.env.TELEGRAM_STOCK_GROUP_ID,
        threadId: process.env.TELEGRAM_STOCK_THREAD_ID,
        processingEnabled: process.env.TELEGRAM_STOCK_PROCESSING_ENABLED,
        dryRun
      },
      tests: {} as any
    };

    // Test 1: Message Validation
    console.log('📋 Testing message validation...');
    const isValid = stockMessageParser.isValidStockMessage(mockUpdate);
    results.tests.messageValidation = {
      success: isValid,
      message: isValid ? 'Message passed validation' : 'Message failed validation',
      details: {
        hasText: !!mockUpdate.message?.text,
        correctGroup: mockUpdate.message?.chat.id === parseInt(process.env.TELEGRAM_STOCK_GROUP_ID || '0'),
        correctThread: mockUpdate.message?.message_thread_id === parseInt(process.env.TELEGRAM_STOCK_THREAD_ID || '0'),
        containsOrderConfirmation: mockUpdate.message?.text?.toLowerCase().includes('order confirmation'),
        doesNotContainOrderId: !mockUpdate.message?.text?.toLowerCase().includes('order id')
      }
    };

    if (!isValid) {
      return NextResponse.json({
        success: false,
        error: 'Message validation failed',
        results
      });
    }

    // Test 2: Message Parsing
    console.log('🔍 Testing message parsing...');
    const parseResult = stockMessageParser.parseMessage(testMessage);
    results.tests.messageParsing = {
      success: parseResult.isValid,
      data: {
        totalProducts: parseResult.totalProducts,
        products: parseResult.products,
        errors: parseResult.errors
      }
    };

    if (!parseResult.isValid) {
      return NextResponse.json({
        success: false,
        error: 'Message parsing failed',
        results
      });
    }

    // Test 3: Product Matching (if not dry run)
    if (!dryRun) {
      console.log('🎯 Testing product matching...');
      try {
        const stockResult = await stockManager.processStockUpdate(mockUpdate);
        results.tests.stockProcessing = {
          success: stockResult.success,
          data: {
            productsFound: stockResult.productsFound,
            productsUpdated: stockResult.productsUpdated,
            productsFailed: stockResult.productsFailed,
            exactMatches: stockResult.exactMatches,
            fuzzyMatches: stockResult.fuzzyMatches,
            unmatchedProducts: stockResult.unmatchedProducts,
            updatedProducts: stockResult.updatedProducts,
            warnings: stockResult.warnings,
            errors: stockResult.errors,
            processingTimeMs: stockResult.processingTimeMs
          }
        };
      } catch (error) {
        results.tests.stockProcessing = {
          success: false,
          error: `Stock processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    } else {
      results.tests.stockProcessing = {
        success: true,
        message: 'Skipped (dry run mode)',
        note: 'Set dryRun: false to test actual stock updates'
      };
    }

    // Calculate overall success
    const allTests = Object.values(results.tests);
    const successfulTests = allTests.filter((test: any) => test.success).length;
    const totalTests = allTests.length;
    const overallSuccess = successfulTests === totalTests;

    console.log(`🏁 Test completed: ${successfulTests}/${totalTests} tests passed`);

    return NextResponse.json({
      success: overallSuccess,
      summary: `${successfulTests}/${totalTests} tests passed`,
      dryRun,
      results,
      recommendations: generateTestRecommendations(results.tests, dryRun)
    });

  } catch (error) {
    console.error('❌ Test system error:', error);
    return NextResponse.json({
      success: false,
      error: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  }
}

/**
 * GET endpoint to provide sample test messages
 */
export async function GET(request: NextRequest) {
  const sampleMessages = {
    validOrderConfirmation: `🎀✨ ORDER CONFIRMATION ✨🎀

👤 Customer Info
Name: John Doe
Phone number: +855 12 345 678
Address: Street 123, Phnom Penh, Cambodia

🛒 Items
Item name x Qty = Price
1. Premium Japanese Green Tea x2 = $25.00
2. Organic Matcha Powder x1 = $15.50

💸 Pricing Summary
• Delivery Fee: $1.5
• Total amount: $42.00
• Deposit: $21.00 
• Amount Due: $21.00

🚢 Shipping method: Standard Delivery

📌 Important Notes  
🔒 Final Sale   : Orders are final and non-refundable. No cancellations, returns, or exchanges accepted. 
🚚 Delivery     : We will notify you once your items are ready for delivery.

🙏 Thank you for your purchase! 🤍`,

    invalidWithOrderId: `🎀✨ ORDER CONFIRMATION ✨🎀

👤 Customer Info
Name: Jane Smith
Phone number: +855 98 765 432
Address: Street 456, Siem Reap, Cambodia

🛒 Items
1. Japanese Sake x1 = $30.00

💸 Pricing Summary
• Total amount: $31.50

🙏 Thank you for your purchase! 🤍
Order ID: FYP-20250108-1234567890`,

    variousFormats: `🎀✨ ORDER CONFIRMATION ✨🎀

👤 Customer Info
Name: Test Customer
Phone number: +855 11 222 333
Address: Test Address

🛒 Items
1. Product A x2 = $20.00
2. Product B x 3 = $45.00
3. Product C *1 = $10.00
4. Product D * 2 = $30.00
Product E x1 = $15.00
Product F x 1 = $25.00

💸 Pricing Summary
• Total amount: $145.00

🙏 Thank you for your purchase! 🤍`
  };

  return NextResponse.json({
    success: true,
    sampleMessages,
    usage: {
      endpoint: '/api/telegram/test-stock-system',
      method: 'POST',
      body: {
        testMessage: 'string (required)',
        dryRun: 'boolean (optional, default: true)'
      },
      examples: {
        testValidMessage: {
          testMessage: sampleMessages.validOrderConfirmation,
          dryRun: true
        },
        testInvalidMessage: {
          testMessage: sampleMessages.invalidWithOrderId,
          dryRun: true
        }
      }
    }
  });
}

/**
 * Generate recommendations based on test results
 */
function generateTestRecommendations(tests: any, dryRun: boolean): string[] {
  const recommendations: string[] = [];

  if (!tests.messageValidation?.success) {
    recommendations.push('❌ Message validation failed. Check message format and configuration.');
    
    const details = tests.messageValidation?.details;
    if (details) {
      if (!details.hasText) recommendations.push('  - Message has no text content');
      if (!details.correctGroup) recommendations.push('  - Message not from correct group');
      if (!details.correctThread) recommendations.push('  - Message not from correct thread');
      if (!details.containsOrderConfirmation) recommendations.push('  - Message does not contain "ORDER CONFIRMATION"');
      if (!details.doesNotContainOrderId) recommendations.push('  - Message contains "Order ID" (should be filtered out)');
    }
  }

  if (!tests.messageParsing?.success) {
    recommendations.push('❌ Message parsing failed. Check product format patterns.');
    if (tests.messageParsing?.data?.errors?.length > 0) {
      recommendations.push(`  - Errors: ${tests.messageParsing.data.errors.join(', ')}`);
    }
  }

  if (tests.stockProcessing && !tests.stockProcessing.success) {
    recommendations.push('❌ Stock processing failed. Check database connectivity and product matching.');
    if (tests.stockProcessing.error) {
      recommendations.push(`  - Error: ${tests.stockProcessing.error}`);
    }
  }

  if (dryRun) {
    recommendations.push('ℹ️ This was a dry run. Set dryRun: false to test actual stock updates.');
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ All tests passed! The stock system is working correctly.');
  }

  return recommendations;
}
