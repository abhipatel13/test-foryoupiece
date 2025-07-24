import { Result, ID, PaginatedResult, QueryParams } from '@/shared/types/common';
import { Product } from '../entities/Product';
import { SKU } from '../value-objects/SKU';

export interface ProductFilters {
  categoryId?: ID;
  isFeatured?: boolean;
  isActive?: boolean;
  isInStock?: boolean;
  priceMin?: number;
  priceMax?: number;
  tags?: string[];
  searchQuery?: string;
}

export interface ProductQueryParams extends QueryParams {
  filters?: ProductFilters;
}

/**
 * Product repository interface
 * Defines the contract for product data access operations
 */
export interface IProductRepository {
  /**
   * Find a product by ID
   */
  findById(id: ID): Promise<Result<Product | null>>;

  /**
   * Find a product by SKU
   */
  findBySku(sku: SKU): Promise<Result<Product | null>>;

  /**
   * Find multiple products with pagination and filtering
   */
  findMany(params?: ProductQueryParams): Promise<Result<PaginatedResult<Product>>>;

  /**
   * Search products by text query
   */
  search(query: string, limit?: number): Promise<Result<Product[]>>;

  /**
   * Get featured products
   */
  getFeatured(limit?: number): Promise<Result<Product[]>>;

  /**
   * Get products by category
   */
  findByCategory(categoryId: ID, params?: QueryParams): Promise<Result<PaginatedResult<Product>>>;

  /**
   * Get low stock products
   */
  getLowStock(limit?: number): Promise<Result<Product[]>>;

  /**
   * Create a new product
   */
  create(product: Product): Promise<Result<Product>>;

  /**
   * Update an existing product
   */
  update(product: Product): Promise<Result<Product>>;

  /**
   * Delete a product (soft delete)
   */
  delete(id: ID): Promise<Result<void>>;

  /**
   * Check if a product exists by SKU
   */
  existsBySku(sku: SKU): Promise<Result<boolean>>;

  /**
   * Update product stock quantity
   */
  updateStock(id: ID, quantity: number): Promise<Result<void>>;

  /**
   * Bulk update stock quantities
   */
  bulkUpdateStock(updates: Array<{ id: ID; quantity: number }>): Promise<Result<void>>;
}
