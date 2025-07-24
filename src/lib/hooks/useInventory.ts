import { useState } from 'react';
import { toast } from 'sonner';

export interface InventoryOperation {
  productId: string;
  quantity: number;
  orderId?: string;
  locationId?: string;
  reason?: string;
}

export interface InventoryUpdate {
  productId: string;
  oldQuantity: number;
  newQuantity: number;
  boxHeroSynced: boolean;
  timestamp: string;
}

export interface StockCheck {
  available: boolean;
  currentStock: number;
  requestedQuantity: number;
  shortfall?: number;
}

/**
 * Hook for inventory management operations
 */
export function useInventory() {
  const [loading, setLoading] = useState(false);

  /**
   * Record a sale and update stock
   */
  const recordSale = async (operation: InventoryOperation): Promise<InventoryUpdate | null> => {
    setLoading(true);
    try {
      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'sale',
          ...operation,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        return data.data;
      } else {
        toast.error(`Failed to record sale: ${data.error}`);
        return null;
      }
    } catch (error) {
      console.error('Failed to record sale:', error);
      toast.error('Failed to record sale');
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Record a return and update stock
   */
  const recordReturn = async (operation: InventoryOperation): Promise<InventoryUpdate | null> => {
    setLoading(true);
    try {
      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'return',
          ...operation,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        return data.data;
      } else {
        toast.error(`Failed to record return: ${data.error}`);
        return null;
      }
    } catch (error) {
      console.error('Failed to record return:', error);
      toast.error('Failed to record return');
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Manually adjust stock levels
   */
  const adjustStock = async (
    productId: string,
    newQuantity: number,
    reason: string,
    locationId?: string
  ): Promise<InventoryUpdate | null> => {
    setLoading(true);
    try {
      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'adjust',
          productId,
          quantity: newQuantity,
          reason,
          locationId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        return data.data;
      } else {
        toast.error(`Failed to adjust stock: ${data.error}`);
        return null;
      }
    } catch (error) {
      console.error('Failed to adjust stock:', error);
      toast.error('Failed to adjust stock');
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Check if product is in stock
   */
  const checkStock = async (productId: string, requestedQuantity: number): Promise<StockCheck | null> => {
    setLoading(true);
    try {
      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'check',
          productId,
          quantity: requestedQuantity,
        }),
      });

      const data = await response.json();

      if (data.success) {
        return data.data;
      } else {
        toast.error(`Failed to check stock: ${data.error}`);
        return null;
      }
    } catch (error) {
      console.error('Failed to check stock:', error);
      toast.error('Failed to check stock');
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get products with low stock
   */
  const getLowStockProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/inventory?action=low-stock');
      const data = await response.json();

      if (data.success) {
        return data.data;
      } else {
        toast.error(`Failed to get low stock products: ${data.error}`);
        return [];
      }
    } catch (error) {
      console.error('Failed to get low stock products:', error);
      toast.error('Failed to get low stock products');
      return [];
    } finally {
      setLoading(false);
    }
  };

  /**
   * Process multiple inventory operations at once
   */
  const bulkOperations = async (operations: (InventoryOperation & { action: 'sale' | 'return' | 'adjust' })[]) => {
    setLoading(true);
    try {
      const response = await fetch('/api/inventory', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operations,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Processed ${data.processed} operations successfully`);
      } else {
        toast.error(`Processed ${data.processed} operations, ${data.errors} failed`);
      }

      return data;
    } catch (error) {
      console.error('Failed to process bulk operations:', error);
      toast.error('Failed to process bulk operations');
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Automatically record sale when order is completed
   * This should be called from the checkout/order completion process
   */
  const processOrderCompletion = async (
    orderId: string,
    items: Array<{ productId: string; quantity: number }>,
    locationId?: string
  ) => {
    const operations = items.map(item => ({
      action: 'sale' as const,
      productId: item.productId,
      quantity: item.quantity,
      orderId,
      locationId,
    }));

    return await bulkOperations(operations);
  };

  /**
   * Process order cancellation/refund
   */
  const processOrderCancellation = async (
    orderId: string,
    items: Array<{ productId: string; quantity: number }>,
    locationId?: string
  ) => {
    const operations = items.map(item => ({
      action: 'return' as const,
      productId: item.productId,
      quantity: item.quantity,
      orderId,
      locationId,
    }));

    return await bulkOperations(operations);
  };

  return {
    loading,
    recordSale,
    recordReturn,
    adjustStock,
    checkStock,
    getLowStockProducts,
    bulkOperations,
    processOrderCompletion,
    processOrderCancellation,
  };
}
