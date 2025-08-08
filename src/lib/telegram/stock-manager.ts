/**
 * Telegram Stock Manager
 * Main orchestrator for processing Telegram stock update messages
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { stockMessageParser, TelegramUpdate, MessageParseResult } from './stock-message-parser';
import { productMatcher, ProductMatchResult, ProductMatch } from './product-matcher';

export interface StockUpdateResult {
  success: boolean;
  messageId: number;
  userId: number;
  username?: string;
  processingTimeMs: number;
  productsFound: number;
  productsUpdated: number;
  productsFailed: number;
  exactMatches: number;
  fuzzyMatches: number;
  unmatchedProducts: string[];
  updatedProducts: Array<{
    productId: string;
    productName: string;
    oldStock: number;
    newStock: number;
    quantity: number;
  }>;
  warnings: string[];
  errors: string[];
  responseMessage?: string;
}

/**
 * Stock Manager Class
 */
export class StockManager {
  private supabase = createServiceRoleClient();

  /**
   * Process a Telegram update for stock management
   */
  async processStockUpdate(update: TelegramUpdate): Promise<StockUpdateResult> {
    const startTime = Date.now();
    const message = update.message || update.edited_message;

    if (!message) {
      throw new Error('No message found in update');
    }

    console.log(`📦 [STOCK] Starting stock update processing for message ${message.message_id}`);
    console.log(`📦 [STOCK] From: ${message.from?.first_name || 'Unknown'} (@${message.from?.username || 'unknown'})`);
    console.log(`📦 [STOCK] Chat: ${message.chat.id}, Thread: ${message.message_thread_id}`);

    const result: StockUpdateResult = {
      success: false,
      messageId: message.message_id,
      userId: message.from?.id || 0,
      username: message.from?.username,
      processingTimeMs: 0,
      productsFound: 0,
      productsUpdated: 0,
      productsFailed: 0,
      exactMatches: 0,
      fuzzyMatches: 0,
      unmatchedProducts: [],
      updatedProducts: [],
      warnings: [],
      errors: []
    };

    try {
      // Step 1: Validate message
      console.log('📦 [STOCK] Step 1: Validating message...');
      if (!stockMessageParser.isValidStockMessage(update)) {
        console.log('❌ [STOCK] Message validation failed');
        result.errors.push('Message does not meet stock update criteria');
        result.processingTimeMs = Date.now() - startTime;
        return result;
      }
      console.log('✅ [STOCK] Message validation passed');

      // Step 2: Check user authorization
      console.log('📦 [STOCK] Step 2: Checking user authorization...');
      const userInfo = stockMessageParser.extractUserInfo(message);
      if (!stockMessageParser.isAuthorizedUser(userInfo.id, userInfo.username)) {
        console.log(`❌ [STOCK] User ${userInfo.displayName} is not authorized`);
        result.errors.push(`User ${userInfo.displayName} is not authorized for stock updates`);
        result.processingTimeMs = Date.now() - startTime;
        return result;
      }
      console.log(`✅ [STOCK] User ${userInfo.displayName} is authorized`);

      // Step 3: Parse message for products
      console.log('📦 [STOCK] Step 3: Parsing message for products...');
      const parseResult = stockMessageParser.parseMessage(message.text || '');
      if (!parseResult.isValid) {
        console.log(`❌ [STOCK] Message parsing failed: ${parseResult.errors.join(', ')}`);
        result.errors.push(...parseResult.errors);
        result.processingTimeMs = Date.now() - startTime;
        return result;
      }
      console.log(`✅ [STOCK] Found ${parseResult.totalProducts} products in message`);

      result.productsFound = parseResult.totalProducts;

      // Step 4: Match products to database
      console.log('📦 [STOCK] Step 4: Matching products to database...');
      const matchResult = await productMatcher.matchProducts(parseResult.products);
      result.exactMatches = matchResult.exactMatches;
      result.fuzzyMatches = matchResult.fuzzyMatches;
      result.unmatchedProducts = matchResult.unmatched.map(p => p.extractedName);

      console.log(`✅ [STOCK] Product matching completed:`);
      console.log(`   - Exact matches: ${result.exactMatches}`);
      console.log(`   - Fuzzy matches: ${result.fuzzyMatches}`);
      console.log(`   - Unmatched: ${result.unmatchedProducts.length}`);
      if (result.unmatchedProducts.length > 0) {
        console.log(`   - Unmatched products: ${result.unmatchedProducts.join(', ')}`);
      }

      // Step 5: Update stock quantities
      console.log('📦 [STOCK] Step 5: Updating stock quantities...');
      const updateResults = await this.updateStockQuantities(matchResult.matches);
      result.productsUpdated = updateResults.successCount;
      result.productsFailed = updateResults.failureCount;
      result.updatedProducts = updateResults.updatedProducts;
      result.warnings.push(...updateResults.warnings);
      result.errors.push(...updateResults.errors);

      console.log(`✅ [STOCK] Stock updates completed:`);
      console.log(`   - Successfully updated: ${result.productsUpdated}`);
      console.log(`   - Failed updates: ${result.productsFailed}`);
      if (result.warnings.length > 0) {
        console.log(`   - Warnings: ${result.warnings.join(', ')}`);
      }

      // Step 6: Calculate success before logging
      result.success = result.productsUpdated > 0 || result.unmatchedProducts.length === 0;
      result.processingTimeMs = Date.now() - startTime;

      // Step 7: Log the processing (now with correct success status)
      console.log('📦 [STOCK] Step 6: Logging stock update...');
      await this.logStockUpdate(message, parseResult, matchResult, updateResults, result);

      // Step 8: Generate response message
      console.log('📦 [STOCK] Step 7: Generating response message...');
      result.responseMessage = this.generateResponseMessage(result);

      // Final summary
      console.log(`🏁 [STOCK] Processing completed in ${result.processingTimeMs}ms`);
      console.log(`📊 [STOCK] Final result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      console.log(`📈 [STOCK] Summary: ${result.productsUpdated}/${result.productsFound} products updated`);

      return result;

    } catch (error) {
      console.error(`❌ [STOCK] Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.errors.push(`Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.processingTimeMs = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Update stock quantities for matched products
   */
  private async updateStockQuantities(matches: ProductMatch[]): Promise<{
    successCount: number;
    failureCount: number;
    updatedProducts: Array<{
      productId: string;
      productName: string;
      oldStock: number;
      newStock: number;
      quantity: number;
    }>;
    warnings: string[];
    errors: string[];
  }> {
    const result = {
      successCount: 0,
      failureCount: 0,
      updatedProducts: [] as any[],
      warnings: [] as string[],
      errors: [] as string[]
    };

    for (const match of matches) {
      try {
        // Validate the stock update
        const validation = productMatcher.validateStockUpdate(match);
        if (!validation.valid) {
          result.errors.push(`Cannot update ${match.productName}: ${validation.warning}`);
          result.failureCount++;
          continue;
        }

        if (validation.warning) {
          result.warnings.push(`${match.productName}: ${validation.warning}`);
        }

        // Calculate quantity change (negative for stock reduction)
        const quantityChange = -match.parsedProduct.quantity;

        // Get current stock to check if update would result in negative stock
        const { data: currentProduct, error: fetchError } = await this.supabase
          .from('products')
          .select('stock_quantity, name_en')
          .eq('id', match.productId)
          .single();

        if (fetchError) {
          result.errors.push(`Failed to fetch current stock for ${match.productName}: ${fetchError.message}`);
          result.failureCount++;
          continue;
        }

        const currentStock = currentProduct.stock_quantity;
        const newStock = currentStock + quantityChange;

        // If the update would result in negative stock, handle appropriately
        if (newStock < 0) {
          console.log(`⚠️ Stock would go negative for ${currentProduct.name_en}: ${currentStock} + ${quantityChange} = ${newStock}`);

          // If already at 0, log as successful no-change
          if (currentStock === 0) {
            console.log(`✅ Stock remains at 0 for ${currentProduct.name_en}: 0 → 0 (already out of stock)`);
            result.updatedProducts.push({
              productId: match.productId,
              productName: match.productName,
              oldStock: 0,
              newStock: 0,
              quantity: match.parsedProduct.quantity
            });
            result.successCount++;
            continue;
          }

          // Otherwise, set to 0
          const { data: updateResult, error } = await this.supabase
            .rpc('update_product_stock_with_logging', {
              product_id: match.productId,
              quantity_change: -currentStock, // Set to 0
              reason: 'Telegram stock update (prevented negative stock)',
              reference_type: 'sale'
            });

          if (error) {
            result.errors.push(`Failed to update stock to 0 for ${match.productName}: ${error.message}`);
            result.failureCount++;
            continue;
          }

          if (updateResult && updateResult.success) {
            console.log(`✅ Stock updated to 0 for ${currentProduct.name_en}: ${updateResult.old_quantity} → 0 (prevented negative)`);
            result.updatedProducts.push({
              productId: match.productId,
              productName: match.productName,
              oldStock: updateResult.old_quantity,
              newStock: 0,
              quantity: match.parsedProduct.quantity
            });
            result.successCount++;
          } else {
            result.errors.push(`Failed to update stock to 0 for ${match.productName}: ${updateResult?.error || 'Unknown error'}`);
            result.failureCount++;
          }
        } else {
          // Normal stock update
          const { data: updateResult, error } = await this.supabase
            .rpc('update_product_stock_with_logging', {
              product_id: match.productId,
              quantity_change: quantityChange,
              reason: 'Telegram stock update',
              reference_type: 'sale'
            });

          if (error) {
            result.errors.push(`Failed to update ${match.productName}: ${error.message}`);
            result.failureCount++;
            continue;
          }

          if (updateResult && updateResult.success) {
            result.updatedProducts.push({
              productId: match.productId,
              productName: match.productName,
              oldStock: updateResult.old_quantity,
              newStock: updateResult.new_quantity,
              quantity: match.parsedProduct.quantity
            });
            result.successCount++;
          } else {
            result.errors.push(`Failed to update ${match.productName}: ${updateResult?.error || 'Unknown error'}`);
            result.failureCount++;
          }
        }

      } catch (error) {
        result.errors.push(`Error updating ${match.productName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        result.failureCount++;
      }
    }

    return result;
  }

  /**
   * Log stock update processing to database
   */
  private async logStockUpdate(
    message: any,
    parseResult: MessageParseResult,
    matchResult: ProductMatchResult,
    updateResults: any,
    finalResult: StockUpdateResult
  ): Promise<void> {
    try {
      const userInfo = stockMessageParser.extractUserInfo(message);

      // Insert main log record
      const { data: logRecord, error: logError } = await this.supabase
        .from('telegram_stock_updates')
        .insert({
          telegram_message_id: message.message_id,
          telegram_user_id: userInfo.id,
          telegram_username: userInfo.username,
          telegram_user_first_name: userInfo.firstName,
          message_text: message.text,
          processing_status: finalResult.success ? 'completed' : 'failed',
          products_found: finalResult.productsFound,
          products_updated: finalResult.productsUpdated,
          products_failed: finalResult.productsFailed,
          unmatched_products: finalResult.unmatchedProducts,
          updated_products: finalResult.updatedProducts,
          error_details: finalResult.errors.length > 0 ? finalResult.errors.join('; ') : null,
          processing_time_ms: finalResult.processingTimeMs,
          processed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (logError) {
        console.error('Failed to log stock update:', logError);
        return;
      }

      // Insert product match records
      if (logRecord) {
        const matchRecords = [
          ...matchResult.matches.map(match => ({
            stock_update_id: logRecord.id,
            raw_product_text: match.parsedProduct.rawText,
            extracted_name: match.parsedProduct.extractedName,
            extracted_quantity: match.parsedProduct.quantity,
            matched_product_id: match.productId,
            matched_product_name: match.productName,
            match_confidence: match.matchConfidence,
            match_method: match.matchMethod,
            old_stock_quantity: match.currentStock,
            new_stock_quantity: match.currentStock - match.parsedProduct.quantity,
            stock_updated: true
          })),
          ...matchResult.unmatched.map(unmatched => ({
            stock_update_id: logRecord.id,
            raw_product_text: unmatched.rawText,
            extracted_name: unmatched.extractedName,
            extracted_quantity: unmatched.quantity,
            matched_product_id: null,
            matched_product_name: null,
            match_confidence: null,
            match_method: 'failed',
            old_stock_quantity: null,
            new_stock_quantity: null,
            stock_updated: false
          }))
        ];

        if (matchRecords.length > 0) {
          const { error: matchError } = await this.supabase
            .from('telegram_stock_product_matches')
            .insert(matchRecords);

          if (matchError) {
            console.error('Failed to log product matches:', matchError);
          }
        }
      }

    } catch (error) {
      console.error('Error logging stock update:', error);
    }
  }

  /**
   * Generate response message for Telegram
   */
  private generateResponseMessage(result: StockUpdateResult): string {
    const timestamp = new Date().toLocaleString();
    const username = result.username ? `@${result.username}` : 'Unknown User';

    if (!result.success && result.errors.length > 0) {
      return `❌ Stock Update Failed\n\n` +
             `⚠️ Errors: ${result.errors.length}\n` +
             `${result.errors.map(error => `• ${error}`).join('\n')}\n\n` +
             `⏰ Processed at: ${timestamp}\n` +
             `👤 By: ${username}`;
    }

    let message = `📊 Stock Update Results\n\n`;

    if (result.productsUpdated > 0) {
      message += `✅ Updated: ${result.productsUpdated} products\n`;
      result.updatedProducts.forEach(product => {
        message += `• ${product.productName}: ${product.oldStock} → ${product.newStock} (-${product.quantity})\n`;
      });
      message += '\n';
    }

    if (result.unmatchedProducts.length > 0) {
      message += `⚠️ Unmatched products: ${result.unmatchedProducts.length}\n`;
      result.unmatchedProducts.forEach(productName => {
        message += `• ${productName} - not found\n`;
      });
      message += '\n';
    }

    if (result.warnings.length > 0) {
      message += `⚠️ Warnings:\n`;
      result.warnings.forEach(warning => {
        message += `• ${warning}\n`;
      });
      message += '\n';
    }

    message += `⏰ Processed at: ${timestamp}\n`;
    message += `👤 By: ${username}\n`;
    message += `⚡ Processing time: ${result.processingTimeMs}ms`;

    return message;
  }
}

// Export singleton instance
export const stockManager = new StockManager();
