import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSecureAdminAuth } from '@/lib/hooks/use-secure-admin-auth';

export interface TrendingProduct {
  id: string;
  product_id: string;
  sku: string;
  name_en: string;
  name_ja: string;
  price: number;
  compare_at_price?: number;
  images: string[];
  stock_quantity: number;
  is_featured: boolean;
  category_name: string;
  selection_type: 'algorithm' | 'manual';
  algorithm_category?: 'top_selling' | 'recently_added' | 'random_stock';
  product_position: number;
  trending_score: number;
  sales_count: number;
}

export interface TrendingProductsResponse {
  success: boolean;
  products: TrendingProduct[];
  count: number;
  stats?: {
    settings: Array<{
      setting_key: string;
      setting_value: any;
      description: string;
    }>;
    lastRefresh: {
      refresh_type: string;
      products_changed: number;
      created_at: string;
    } | null;
  };
}

/**
 * Hook for fetching trending products
 */
export function useTrendingProducts(limit = 10, includeStats = false) {
  return useQuery({
    queryKey: ['trending-products', limit, includeStats],
    queryFn: async (): Promise<TrendingProductsResponse> => {
      const params = new URLSearchParams({
        limit: limit.toString(),
        include_stats: includeStats.toString()
      });

      const response = await fetch(`/api/trending-products?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch trending products: ${response.statusText}`);
      }

      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes (trending products update every 2 days)
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

/**
 * Hook for refreshing trending products (admin use)
 */
export function useRefreshTrendingProducts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { 
      refresh_type?: 'manual' | 'scheduled' | 'conditional';
      user_id?: string;
    } = {}) => {
      const response = await fetch('/api/trending-products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_type: params.refresh_type || 'manual',
          user_id: params.user_id
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to refresh trending products');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch trending products
      queryClient.invalidateQueries({ queryKey: ['trending-products'] });
    },
  });
}

/**
 * Hook for admin trending products management
 * Uses secure httpOnly cookie-based authentication
 */
export function useAdminTrendingProducts() {
  const { getAuthHeaders, isAuthenticated } = useSecureAdminAuth();

  return useQuery({
    queryKey: ['admin-trending-products'],
    queryFn: async () => {
      // Get secure auth headers (validates session)
      const headers = await getAuthHeaders();

      const response = await fetch('/api/admin/trending-products', {
        credentials: 'include', // Include httpOnly cookies
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch admin trending products');
      }

      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 5 * 60 * 1000, // 5 minutes
    enabled: isAuthenticated, // Only enable when admin is authenticated
  });
}

/**
 * Hook for managing manual trending products (admin)
 * Uses secure httpOnly cookie-based authentication
 */
export function useManageTrendingProducts() {
  const queryClient = useQueryClient();
  const { getAuthHeaders } = useSecureAdminAuth();

  const addProduct = useMutation({
    mutationFn: async (params: {
      product_id: string;
      position: number;
      user_id?: string;
    }) => {
      // Get secure auth headers (validates session)
      const headers = await getAuthHeaders();

      const response = await fetch('/api/admin/trending-products', {
        method: 'POST',
        credentials: 'include', // Include httpOnly cookies
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to add trending product');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trending-products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-trending-products'] });
    },
  });

  const updateProduct = useMutation({
    mutationFn: async (params: {
      trending_id: string;
      position?: number;
      is_active?: boolean;
    }) => {
      // Get secure auth headers (validates session)
      const headers = await getAuthHeaders();

      const response = await fetch('/api/admin/trending-products', {
        method: 'PUT',
        credentials: 'include', // Include httpOnly cookies
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to update trending product');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trending-products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-trending-products'] });
    },
  });

  const removeProduct = useMutation({
    mutationFn: async (trending_id: string) => {
      // Get secure auth headers (validates session)
      const headers = await getAuthHeaders();

      const response = await fetch(`/api/admin/trending-products?trending_id=${trending_id}`, {
        method: 'DELETE',
        credentials: 'include', // Include httpOnly cookies
        headers: {
          ...headers
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to remove trending product');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trending-products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-trending-products'] });
    },
  });

  return {
    addProduct,
    updateProduct,
    removeProduct
  };
}
