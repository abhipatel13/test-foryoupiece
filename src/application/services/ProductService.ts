import { Result, ID, PaginatedResult } from '@/shared/types/common';
import { Product } from '@/domain/entities/Product';
import { GetProducts } from '../use-cases/products/GetProducts';
import { GetProduct } from '../use-cases/products/GetProduct';
import { SupabaseProductRepository } from '@/infrastructure/repositories/SupabaseProductRepository';

/**
 * Product Application Service
 * Orchestrates product-related use cases and provides a clean API for the presentation layer
 */
export class ProductService {
  private productRepository = new SupabaseProductRepository();
  private getProductsUseCase = new GetProducts(this.productRepository);
  private getProductUseCase = new GetProduct(this.productRepository);

  /**
   * Get products with filtering and pagination
   */
  async getProducts(params?: {
    categoryId?: ID;
    isFeatured?: boolean;
    isInStock?: boolean;
    priceMin?: number;
    priceMax?: number;
    searchQuery?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
  }): Promise<Result<PaginatedResult<Product>>> {
    const request = {
      filters: {
        categoryId: params?.categoryId,
        isFeatured: params?.isFeatured,
        isInStock: params?.isInStock,
        priceMin: params?.priceMin,
        priceMax: params?.priceMax,
        searchQuery: params?.searchQuery,
      },
      limit: params?.limit,
      offset: params?.offset,
      sort: params?.sortBy ? {
        field: params.sortBy,
        direction: params.sortDirection || 'asc'
      } : undefined,
    };

    return this.getProductsUseCase.execute(request);
  }

  /**
   * Get a single product by ID
   */
  async getProductById(id: ID): Promise<Result<Product>> {
    const result = await this.getProductUseCase.execute({ id });
    
    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: result.data.product };
  }

  /**
   * Get a single product by SKU
   */
  async getProductBySku(sku: string): Promise<Result<Product>> {
    const result = await this.getProductUseCase.execute({ sku });
    
    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: result.data.product };
  }

  /**
   * Search products by query
   */
  async searchProducts(query: string, limit = 20): Promise<Result<Product[]>> {
    return this.productRepository.search(query, limit);
  }

  /**
   * Get featured products
   */
  async getFeaturedProducts(limit = 10): Promise<Result<Product[]>> {
    return this.productRepository.getFeatured(limit);
  }

  /**
   * Get products by category
   */
  async getProductsByCategory(
    categoryId: ID,
    params?: { limit?: number; offset?: number }
  ): Promise<Result<PaginatedResult<Product>>> {
    return this.productRepository.findByCategory(categoryId, params);
  }

  /**
   * Get low stock products (admin only)
   */
  async getLowStockProducts(limit = 20): Promise<Result<Product[]>> {
    return this.productRepository.getLowStock(limit);
  }

  /**
   * Get all products for admin (including inactive ones)
   */
  async getProductsAdmin(params?: {
    categoryId?: ID;
    isFeatured?: boolean;
    isActive?: boolean;
    priceMin?: number;
    priceMax?: number;
    searchQuery?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
  }): Promise<Result<PaginatedResult<Product>>> {
    const request = {
      filters: {
        categoryId: params?.categoryId,
        isFeatured: params?.isFeatured,
        isActive: params?.isActive, // Allow filtering by active status, but don't force it to true
        priceMin: params?.priceMin,
        priceMax: params?.priceMax,
        searchQuery: params?.searchQuery,
      },
      limit: params?.limit,
      offset: params?.offset,
      sort: params?.sortBy ? {
        field: params.sortBy,
        direction: params.sortDirection || 'asc'
      } : undefined,
    };

    // Use repository directly to bypass the public-only filter in GetProducts use case
    return this.productRepository.findMany(request);
  }

  /**
   * Update a product (admin only)
   */
  async updateProduct(productId: ID, updates: Partial<{
    sku: string;
    name_en: string;
    name_ja?: string;
    description_en?: string;
    description_ja?: string;
    short_description_en?: string;
    short_description_ja?: string;
    price: number;
    compare_at_price?: number;
    cost_price?: number;
    stock_quantity: number;
    low_stock_threshold: number;
    weight_grams?: number;
    brand?: string;
    is_active: boolean;
    is_featured: boolean;
    is_preorder: boolean;
    preorder_limit?: number;
    requires_shipping: boolean;
    is_digital: boolean;
    track_inventory: boolean;
    allow_backorder: boolean;
    seo_title?: string;
    seo_description?: string;
  }>): Promise<Result<Product>> {
    try {
      // Get current product
      const currentResult = await this.productRepository.findById(productId);
      if (!currentResult.success || !currentResult.data) {
        return { success: false, error: new Error('Product not found') };
      }

      const currentProduct = currentResult.data;

      // Update basic info if provided
      if (updates.name_en || updates.name_ja || updates.description_en || updates.description_ja) {
        currentProduct.updateBasicInfo(
          updates.name_en || currentProduct.nameEn,
          updates.name_ja || currentProduct.nameJa,
          updates.description_en || currentProduct.descriptionEn,
          updates.description_ja || currentProduct.descriptionJa
        );
      }

      // Update price if provided
      if (updates.price !== undefined) {
        const price = Price.create(updates.price);
        const costPrice = updates.cost_price ? Price.create(updates.cost_price) : undefined;
        currentProduct.updatePrice(price, costPrice);
      }

      // Update stock if provided
      if (updates.stock_quantity !== undefined) {
        currentProduct.updateStock(updates.stock_quantity);
      }

      // Update other properties directly (this would need to be added to the Product entity)
      // For now, we'll use the repository's update method directly
      return this.productRepository.update(currentProduct);
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  // Adapter methods for backward compatibility with existing queries
  /**
   * Adapter method to maintain compatibility with existing productQueries.getProducts
   */
  async getProductsLegacy(filters?: {
    category_id?: string;
    is_featured?: boolean;
    is_active?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const result = await this.getProducts({
      categoryId: filters?.category_id,
      isFeatured: filters?.is_featured,
      limit: filters?.limit,
      offset: filters?.offset,
    });

    if (!result.success) {
      throw result.error;
    }

    // Convert to legacy format
    return result.data.data.map(product => product.toPlainObject());
  }

  /**
   * Adapter method to maintain compatibility with existing productQueries.getProduct
   */
  async getProductLegacy(id: string) {
    const result = await this.getProductById(id);

    if (!result.success) {
      throw result.error;
    }

    return result.data.toPlainObject();
  }

  /**
   * Adapter method to maintain compatibility with existing productQueries.getProductBySku
   */
  async getProductBySkuLegacy(sku: string) {
    const result = await this.getProductBySku(sku);

    if (!result.success) {
      throw result.error;
    }

    return result.data.toPlainObject();
  }

  /**
   * Adapter method to maintain compatibility with existing productQueries.searchProducts
   */
  async searchProductsLegacy(query: string, limit = 20) {
    const result = await this.searchProducts(query, limit);

    if (!result.success) {
      throw result.error;
    }

    return result.data.map(product => product.toPlainObject());
  }
}
