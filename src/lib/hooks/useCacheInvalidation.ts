import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Hook to handle cache invalidation after BoxHero sync
 * This hook listens for cache invalidation events and invalidates React Query caches
 */
export function useCacheInvalidation() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Create a custom event listener for cache invalidation
    const handleCacheInvalidation = (event: CustomEvent) => {
      const { keys, reason } = event.detail;
      
      console.log('🗑️ Cache invalidation triggered:', { keys, reason });

      // Invalidate specific query keys
      if (keys && Array.isArray(keys)) {
        keys.forEach((key: string) => {
          switch (key) {
            case 'products':
              // Invalidate all product-related queries
              queryClient.invalidateQueries({ queryKey: ['products'] });
              queryClient.invalidateQueries({ queryKey: ['product'] });
              break;
            case 'categories':
              // Invalidate category-related queries
              queryClient.invalidateQueries({ queryKey: ['categories'] });
              break;
            case 'inventory':
              // Invalidate inventory-related queries
              queryClient.invalidateQueries({ queryKey: ['inventory'] });
              queryClient.invalidateQueries({ queryKey: ['stock'] });
              break;
            default:
              // Invalidate the specific key
              queryClient.invalidateQueries({ queryKey: [key] });
          }
        });
      } else {
        // If no specific keys, invalidate all queries
        queryClient.invalidateQueries();
      }

      console.log('✅ React Query cache invalidated');
    };

    // Add event listener
    window.addEventListener('cache-invalidation', handleCacheInvalidation as EventListener);

    // Cleanup
    return () => {
      window.removeEventListener('cache-invalidation', handleCacheInvalidation as EventListener);
    };
  }, [queryClient]);

  // Function to manually trigger cache invalidation
  const invalidateCache = (keys?: string[], reason?: string) => {
    const event = new CustomEvent('cache-invalidation', {
      detail: { keys, reason }
    });
    window.dispatchEvent(event);
  };

  return { invalidateCache };
}

/**
 * Utility function to trigger cache invalidation from anywhere in the app
 */
export function triggerCacheInvalidation(keys?: string[], reason?: string) {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('cache-invalidation', {
      detail: { keys, reason }
    });
    window.dispatchEvent(event);
  }
}
