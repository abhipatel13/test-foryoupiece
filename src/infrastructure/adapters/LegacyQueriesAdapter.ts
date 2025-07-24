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

/**
 * User queries adapter - placeholder for future implementation
 */
export const userQueriesAdapter = {
  async getProfile(userId: string) {
    // TODO: Implement using UserService
    throw new Error('Not implemented yet - use legacy userQueries for now');
  },

  async updateProfile(userId: string, updates: any) {
    // TODO: Implement using UserService
    throw new Error('Not implemented yet - use legacy userQueries for now');
  },

  async createProfile(profile: any) {
    // TODO: Implement using UserService
    throw new Error('Not implemented yet - use legacy userQueries for now');
  },

  async getPointTransactions(userId: string, limit = 50) {
    // TODO: Implement using UserService
    throw new Error('Not implemented yet - use legacy userQueries for now');
  }
};

/**
 * Category queries adapter - placeholder for future implementation
 */
export const categoryQueriesAdapter = {
  async getCategories() {
    // TODO: Implement using CategoryService
    throw new Error('Not implemented yet - use legacy categoryQueries for now');
  },

  async getCategory(id: string) {
    // TODO: Implement using CategoryService
    throw new Error('Not implemented yet - use legacy categoryQueries for now');
  },

  async getCategoryBySlug(slug: string) {
    // TODO: Implement using CategoryService
    throw new Error('Not implemented yet - use legacy categoryQueries for now');
  }
};

/**
 * Order queries adapter - placeholder for future implementation
 */
export const orderQueriesAdapter = {
  async getOrders(filters?: any) {
    // TODO: Implement using OrderService
    throw new Error('Not implemented yet - use legacy orderQueries for now');
  },

  async getOrder(id: string) {
    // TODO: Implement using OrderService
    throw new Error('Not implemented yet - use legacy orderQueries for now');
  },

  async createOrder(orderData: any) {
    // TODO: Implement using OrderService
    throw new Error('Not implemented yet - use legacy orderQueries for now');
  },

  async updateOrderStatus(id: string, status: any) {
    // TODO: Implement using OrderService
    throw new Error('Not implemented yet - use legacy orderQueries for now');
  }
};

/**
 * Admin queries adapter - placeholder for future implementation
 */
export const adminQueriesAdapter = {
  async getDashboardStats() {
    // TODO: Implement using AdminService
    throw new Error('Not implemented yet - use legacy adminQueries for now');
  },

  async getAdminUser(userId: string) {
    // TODO: Implement using AdminService
    throw new Error('Not implemented yet - use legacy adminQueries for now');
  }
};
