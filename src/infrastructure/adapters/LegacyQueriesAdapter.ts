import { getProductService } from '@/shared/utils/service-registry';

/**
 * Legacy Queries Adapter
 * Provides backward compatibility with existing query interfaces
 * while using the new clean architecture underneath
 */

/**
 * Product queries adapter - maintains the same interface as the original productQueries
 */
export const productQueriesAdapter = {
  async getProducts(filters?: {
    category_id?: string;
    is_featured?: boolean;
    is_active?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const productService = getProductService();
    return productService.getProductsLegacy(filters);
  },

  async getProduct(id: string) {
    const productService = getProductService();
    return productService.getProductLegacy(id);
  },

  async getProductBySku(sku: string) {
    const productService = getProductService();
    return productService.getProductBySkuLegacy(sku);
  },

  async searchProducts(query: string, limit = 20) {
    const productService = getProductService();
    return productService.searchProductsLegacy(query, limit);
  }
};

// Note: Unused adapter methods removed during cleanup.
// Only productQueriesAdapter is currently implemented and used.
// Future implementations should be added here when needed.
