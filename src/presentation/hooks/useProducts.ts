import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { getProductService } from '@/shared/utils/service-registry';
import { Product } from '@/domain/entities/Product';
import { PaginatedResult, ID } from '@/shared/types/common';

interface UseProductsParams {
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
}

interface UseProductsOptions extends Omit<UseQueryOptions<PaginatedResult<Product>>, 'queryKey' | 'queryFn'> {
  enabled?: boolean;
}

/**
 * Hook for fetching products using the new clean architecture
 */
export function useProducts(params?: UseProductsParams, options?: UseProductsOptions) {
  const productService = getProductService();

  return useQuery({
    queryKey: ['products', params],
    queryFn: async () => {
      const result = await productService.getProducts(params);
      
      if (!result.success) {
        throw result.error;
      }
      
      return result.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
}

/**
 * Hook for fetching a single product by ID
 */
export function useProduct(id: ID, options?: Omit<UseQueryOptions<Product>, 'queryKey' | 'queryFn'>) {
  const productService = getProductService();

  return useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const result = await productService.getProductById(id);
      
      if (!result.success) {
        throw result.error;
      }
      
      return result.data;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
}

/**
 * Hook for fetching a single product by SKU
 */
export function useProductBySku(sku: string, options?: Omit<UseQueryOptions<Product>, 'queryKey' | 'queryFn'>) {
  const productService = getProductService();

  return useQuery({
    queryKey: ['product', 'sku', sku],
    queryFn: async () => {
      const result = await productService.getProductBySku(sku);
      
      if (!result.success) {
        throw result.error;
      }
      
      return result.data;
    },
    enabled: !!sku,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
}

/**
 * Hook for searching products
 */
export function useProductSearch(query: string, limit = 20, options?: Omit<UseQueryOptions<Product[]>, 'queryKey' | 'queryFn'>) {
  const productService = getProductService();

  return useQuery({
    queryKey: ['products', 'search', query, limit],
    queryFn: async () => {
      const result = await productService.searchProducts(query, limit);
      
      if (!result.success) {
        throw result.error;
      }
      
      return result.data;
    },
    enabled: !!query && query.length >= 2, // Only search if query is at least 2 characters
    staleTime: 2 * 60 * 1000, // 2 minutes (shorter for search results)
    cacheTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

/**
 * Hook for fetching featured products
 */
export function useFeaturedProducts(limit = 10, options?: Omit<UseQueryOptions<Product[]>, 'queryKey' | 'queryFn'>) {
  const productService = getProductService();

  return useQuery({
    queryKey: ['products', 'featured', limit],
    queryFn: async () => {
      const result = await productService.getFeaturedProducts(limit);
      
      if (!result.success) {
        throw result.error;
      }
      
      return result.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes (featured products change less frequently)
    cacheTime: 15 * 60 * 1000, // 15 minutes
    ...options,
  });
}

/**
 * Hook for fetching products by category
 */
export function useProductsByCategory(
  categoryId: ID,
  params?: { limit?: number; offset?: number },
  options?: Omit<UseQueryOptions<PaginatedResult<Product>>, 'queryKey' | 'queryFn'>
) {
  const productService = getProductService();

  return useQuery({
    queryKey: ['products', 'category', categoryId, params],
    queryFn: async () => {
      const result = await productService.getProductsByCategory(categoryId, params);
      
      if (!result.success) {
        throw result.error;
      }
      
      return result.data;
    },
    enabled: !!categoryId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
}
