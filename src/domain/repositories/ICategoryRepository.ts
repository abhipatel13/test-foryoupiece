import { Result, ID, PaginatedResult, QueryParams } from '@/shared/types/common';
import { Category } from '../entities/Category';

export interface CategoryFilters {
  parentId?: ID;
  isActive?: boolean;
  isRoot?: boolean;
}

export interface CategoryQueryParams extends QueryParams {
  filters?: CategoryFilters;
}

/**
 * Category repository interface
 * Defines the contract for category data access operations
 */
export interface ICategoryRepository {
  /**
   * Find a category by ID
   */
  findById(id: ID): Promise<Result<Category | null>>;

  /**
   * Find a category by slug
   */
  findBySlug(slug: string): Promise<Result<Category | null>>;

  /**
   * Find multiple categories with pagination and filtering
   */
  findMany(params?: CategoryQueryParams): Promise<Result<PaginatedResult<Category>>>;

  /**
   * Get all active categories
   */
  findActive(): Promise<Result<Category[]>>;

  /**
   * Get root categories (no parent)
   */
  findRootCategories(): Promise<Result<Category[]>>;

  /**
   * Get child categories of a parent
   */
  findByParentId(parentId: ID): Promise<Result<Category[]>>;

  /**
   * Create a new category
   */
  create(category: Category): Promise<Result<Category>>;

  /**
   * Update an existing category
   */
  update(category: Category): Promise<Result<Category>>;

  /**
   * Delete a category (soft delete)
   */
  delete(id: ID): Promise<Result<void>>;

  /**
   * Check if a category exists by slug
   */
  existsBySlug(slug: string): Promise<Result<boolean>>;

  /**
   * Update category sort order
   */
  updateSortOrder(id: ID, sortOrder: number): Promise<Result<void>>;

  /**
   * Get category hierarchy (tree structure)
   */
  getHierarchy(): Promise<Result<Category[]>>;
}
