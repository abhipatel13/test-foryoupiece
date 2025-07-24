import { Result, ID, NotFoundError } from '@/shared/types/common';
import { IProductRepository } from '@/domain/repositories/IProductRepository';
import { Product } from '@/domain/entities/Product';
import { SKU } from '@/domain/value-objects/SKU';

export interface GetProductByIdRequest {
  id: ID;
}

export interface GetProductBySkuRequest {
  sku: string;
}

export type GetProductRequest = GetProductByIdRequest | GetProductBySkuRequest;

export interface GetProductResponse {
  product: Product;
}

/**
 * Get Product Use Case
 * Retrieves a single product by ID or SKU
 */
export class GetProduct {
  constructor(private productRepository: IProductRepository) {}

  async execute(request: GetProductRequest): Promise<Result<GetProductResponse>> {
    try {
      let result: Result<Product | null>;

      // Determine if request is by ID or SKU
      if ('id' in request) {
        result = await this.productRepository.findById(request.id);
      } else {
        const sku = SKU.create(request.sku);
        result = await this.productRepository.findBySku(sku);
      }

      if (!result.success) {
        return { success: false, error: result.error };
      }

      if (!result.data) {
        const identifier = 'id' in request ? request.id : request.sku;
        return {
          success: false,
          error: new NotFoundError('Product', identifier)
        };
      }

      const product = result.data;

      // Check if product is active (for public access)
      if (!product.isActive) {
        const identifier = 'id' in request ? request.id : request.sku;
        return {
          success: false,
          error: new NotFoundError('Product', identifier)
        };
      }

      return {
        success: true,
        data: { product }
      };
    } catch (error) {
      return {
        success: false,
        error: new Error('An unexpected error occurred while fetching the product')
      };
    }
  }
}
