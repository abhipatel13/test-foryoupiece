import { Result, DomainError, ID } from '@/shared/types/common';
import { IProductRepository } from '@/domain/repositories/IProductRepository';
import { BoxHeroService } from '@/infrastructure/services/BoxHeroService';
import { Product } from '@/domain/entities/Product';

export interface StockMovement {
  productId: ID;
  quantity: number;
  type: 'sale' | 'return' | 'adjustment' | 'restock';
  reference?: string;
  note?: string;
  locationId?: string;
}

export interface InventoryUpdate {
  productId: ID;
  oldQuantity: number;
  newQuantity: number;
  movement: StockMovement;
  boxHeroSynced: boolean;
  timestamp: Date;
}

/**
 * Inventory Service
 * Manages stock levels and integrates with BoxHero for real-time inventory tracking
 */
export class InventoryService {
  constructor(
    private productRepository: IProductRepository,
    private boxHeroService?: BoxHeroService
  ) {}

  /**
   * Record a sale and update stock levels
   */
  async recordSale(
    productId: ID,
    quantity: number,
    orderId?: string,
    locationId?: string
  ): Promise<Result<InventoryUpdate>> {
    try {
      // Get current product
      const productResult = await this.productRepository.findById(productId);
      if (!productResult.success || !productResult.data) {
        return {
          success: false,
          error: new DomainError('Product not found', 'PRODUCT_NOT_FOUND')
        };
      }

      const product = productResult.data;
      const oldQuantity = product.stockQuantity;
      const newQuantity = Math.max(0, oldQuantity - quantity);

      // Update local stock
      const updateResult = await this.productRepository.updateStock(productId, newQuantity);
      if (!updateResult.success) {
        return { success: false, error: updateResult.error };
      }

      const movement: StockMovement = {
        productId,
        quantity,
        type: 'sale',
        reference: orderId,
        note: `Sale: ${quantity} units`,
        locationId
      };

      // Sync with BoxHero if available
      let boxHeroSynced = false;
      if (this.boxHeroService && product.metadata?.boxhero_id) {
        try {
          const boxHeroResult = await this.recordBoxHeroMovement(
            product.metadata.boxhero_id,
            quantity,
            'out',
            locationId,
            `Sale from ForYouPiece - Order: ${orderId}`,
            orderId
          );
          boxHeroSynced = boxHeroResult.success;
          
          if (!boxHeroSynced) {
            console.warn(`Failed to sync sale to BoxHero: ${boxHeroResult.error?.message}`);
          }
        } catch (error) {
          console.warn('BoxHero sync failed for sale:', error);
        }
      }

      const inventoryUpdate: InventoryUpdate = {
        productId,
        oldQuantity,
        newQuantity,
        movement,
        boxHeroSynced,
        timestamp: new Date()
      };

      console.log(`📦 Stock updated: ${product.nameEn} - ${oldQuantity} → ${newQuantity} (BoxHero: ${boxHeroSynced ? '✅' : '❌'})`);

      return { success: true, data: inventoryUpdate };
    } catch (error) {
      return {
        success: false,
        error: new DomainError('Failed to record sale', 'RECORD_SALE_ERROR', error)
      };
    }
  }

  /**
   * Record a return and update stock levels
   */
  async recordReturn(
    productId: ID,
    quantity: number,
    orderId?: string,
    locationId?: string
  ): Promise<Result<InventoryUpdate>> {
    try {
      // Get current product
      const productResult = await this.productRepository.findById(productId);
      if (!productResult.success || !productResult.data) {
        return {
          success: false,
          error: new DomainError('Product not found', 'PRODUCT_NOT_FOUND')
        };
      }

      const product = productResult.data;
      const oldQuantity = product.stockQuantity;
      const newQuantity = oldQuantity + quantity;

      // Update local stock
      const updateResult = await this.productRepository.updateStock(productId, newQuantity);
      if (!updateResult.success) {
        return { success: false, error: updateResult.error };
      }

      const movement: StockMovement = {
        productId,
        quantity,
        type: 'return',
        reference: orderId,
        note: `Return: ${quantity} units`,
        locationId
      };

      // Sync with BoxHero if available
      let boxHeroSynced = false;
      if (this.boxHeroService && product.metadata?.boxhero_id) {
        try {
          const boxHeroResult = await this.recordBoxHeroMovement(
            product.metadata.boxhero_id,
            quantity,
            'in',
            locationId,
            `Return to ForYouPiece - Order: ${orderId}`,
            orderId
          );
          boxHeroSynced = boxHeroResult.success;
        } catch (error) {
          console.warn('BoxHero sync failed for return:', error);
        }
      }

      const inventoryUpdate: InventoryUpdate = {
        productId,
        oldQuantity,
        newQuantity,
        movement,
        boxHeroSynced,
        timestamp: new Date()
      };

      console.log(`📦 Stock updated: ${product.nameEn} - ${oldQuantity} → ${newQuantity} (Return)`);

      return { success: true, data: inventoryUpdate };
    } catch (error) {
      return {
        success: false,
        error: new DomainError('Failed to record return', 'RECORD_RETURN_ERROR', error)
      };
    }
  }

  /**
   * Manually adjust stock levels
   */
  async adjustStock(
    productId: ID,
    newQuantity: number,
    reason: string,
    locationId?: string
  ): Promise<Result<InventoryUpdate>> {
    try {
      // Get current product
      const productResult = await this.productRepository.findById(productId);
      if (!productResult.success || !productResult.data) {
        return {
          success: false,
          error: new DomainError('Product not found', 'PRODUCT_NOT_FOUND')
        };
      }

      const product = productResult.data;
      const oldQuantity = product.stockQuantity;
      const adjustmentQuantity = newQuantity - oldQuantity;

      // Update local stock
      const updateResult = await this.productRepository.updateStock(productId, newQuantity);
      if (!updateResult.success) {
        return { success: false, error: updateResult.error };
      }

      const movement: StockMovement = {
        productId,
        quantity: Math.abs(adjustmentQuantity),
        type: 'adjustment',
        note: reason,
        locationId
      };

      // Sync with BoxHero if available
      let boxHeroSynced = false;
      if (this.boxHeroService && product.metadata?.boxhero_id) {
        try {
          const boxHeroResult = await this.boxHeroService.adjustQuantity(
            product.metadata.boxhero_id,
            locationId || await this.getDefaultLocationId(),
            adjustmentQuantity,
            reason
          );
          boxHeroSynced = boxHeroResult.success;
        } catch (error) {
          console.warn('BoxHero sync failed for adjustment:', error);
        }
      }

      const inventoryUpdate: InventoryUpdate = {
        productId,
        oldQuantity,
        newQuantity,
        movement,
        boxHeroSynced,
        timestamp: new Date()
      };

      console.log(`📦 Stock adjusted: ${product.nameEn} - ${oldQuantity} → ${newQuantity} (${reason})`);

      return { success: true, data: inventoryUpdate };
    } catch (error) {
      return {
        success: false,
        error: new DomainError('Failed to adjust stock', 'ADJUST_STOCK_ERROR', error)
      };
    }
  }

  /**
   * Check if product is in stock
   */
  async checkStock(productId: ID, requestedQuantity: number): Promise<Result<{
    available: boolean;
    currentStock: number;
    requestedQuantity: number;
    shortfall?: number;
  }>> {
    try {
      const productResult = await this.productRepository.findById(productId);
      if (!productResult.success || !productResult.data) {
        return {
          success: false,
          error: new DomainError('Product not found', 'PRODUCT_NOT_FOUND')
        };
      }

      const product = productResult.data;
      const currentStock = product.stockQuantity;
      const available = currentStock >= requestedQuantity;
      const shortfall = available ? undefined : requestedQuantity - currentStock;

      return {
        success: true,
        data: {
          available,
          currentStock,
          requestedQuantity,
          shortfall
        }
      };
    } catch (error) {
      return {
        success: false,
        error: new DomainError('Failed to check stock', 'CHECK_STOCK_ERROR', error)
      };
    }
  }

  /**
   * Get products with low stock
   */
  async getLowStockProducts(): Promise<Result<Product[]>> {
    try {
      // This would need to be implemented in the repository
      // For now, get all products and filter
      const productsResult = await this.productRepository.findMany({
        limit: 1000,
        offset: 0
      });

      if (!productsResult.success) {
        return { success: false, error: productsResult.error };
      }

      const lowStockProducts = productsResult.data.data.filter(product => 
        product.stockQuantity <= product.lowStockThreshold
      );

      return { success: true, data: lowStockProducts };
    } catch (error) {
      return {
        success: false,
        error: new DomainError('Failed to get low stock products', 'LOW_STOCK_ERROR', error)
      };
    }
  }

  /**
   * Record movement in BoxHero
   */
  private async recordBoxHeroMovement(
    boxHeroItemId: string,
    quantity: number,
    type: 'in' | 'out',
    locationId?: string,
    note?: string,
    reference?: string
  ): Promise<Result<any>> {
    if (!this.boxHeroService) {
      return {
        success: false,
        error: new DomainError('BoxHero service not available', 'NO_BOXHERO_SERVICE')
      };
    }

    try {
      const effectiveLocationId = locationId || await this.getDefaultLocationId();
      
      return await this.boxHeroService.recordStockMovement(
        type,
        boxHeroItemId,
        effectiveLocationId,
        quantity,
        undefined, // unit price not needed for stock movements
        note,
        reference
      );
    } catch (error) {
      return {
        success: false,
        error: new DomainError('Failed to record BoxHero movement', 'BOXHERO_MOVEMENT_ERROR', error)
      };
    }
  }

  /**
   * Get default BoxHero location ID
   */
  private async getDefaultLocationId(): Promise<string> {
    if (!this.boxHeroService) {
      throw new Error('BoxHero service not available');
    }

    const locationsResult = await this.boxHeroService.getLocations();
    if (!locationsResult.success || locationsResult.data.length === 0) {
      throw new Error('No BoxHero locations available');
    }

    return locationsResult.data[0].id;
  }
}
