import { Result, PaginatedResult } from '@/shared/types/common';
import { IProductRepository, ProductQueryParams } from '@/domain/repositories/IProductRepository';
import { Product } from '@/domain/entities/Product';

export interface GetProductsRequest extends ProductQueryParams {}

export interface GetProductsResponse extends PaginatedResult<Product> {}

/**
 * Get Products Use Case
 * Retrieves products with filtering, sorting, and pagination
 */
export class GetProducts {
  constructor(private productRepository: IProductRepository) {}

  async execute(request?: GetProductsRequest): Promise<Result<GetProductsResponse>> {
    try {
      // Set default filters for public access
      const params: ProductQueryParams = {
        ...request,
        filters: {
          ...request?.filters,
          isActive: true, // Only show active products to public
        },
      };

      const result = await this.productRepository.findMany(params);
      
      if (!result.success) {
        return { success: false, error: result.error };
      }

      return {
        success: true,
        data: result.data
      };
    } catch (error) {
      return {
        success: false,
        error: new Error('An unexpected error occurred while fetching products')
      };
    }
  }
}
