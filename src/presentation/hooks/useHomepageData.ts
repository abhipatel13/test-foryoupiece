import { useQuery } from '@tanstack/react-query'
import { Product } from '@/domain/entities/Product'

interface HomepageDataResponse {
  success: boolean
  data: {
    deals: Product[]
    recently_added: Product[]
    trending: any[] | null
    metadata: {
      deals_count: number
      recently_added_count: number
      trending_count: number
      generated_at: string
    }
  }
  error?: string
}

interface UseHomepageDataOptions {
  dealsLimit?: number
  recentlyAddedLimit?: number
  includeTrending?: boolean
  enabled?: boolean
}

/**
 * Optimized hook for fetching homepage data
 * Combines deals, recently added, and trending products in a single API call
 * to reduce database round trips and improve performance
 */
export function useHomepageData(options: UseHomepageDataOptions = {}) {
  const {
    dealsLimit = 5,
    recentlyAddedLimit = 5,
    includeTrending = false,
    enabled = true
  } = options

  return useQuery({
    queryKey: ['homepage-data', dealsLimit, recentlyAddedLimit, includeTrending],
    queryFn: async (): Promise<HomepageDataResponse> => {
      const params = new URLSearchParams({
        deals_limit: dealsLimit.toString(),
        recently_added_limit: recentlyAddedLimit.toString(),
        include_trending: includeTrending.toString()
      })

      console.log('🏠 Fetching optimized homepage data...')

      const response = await fetch(`/api/homepage-data?${params}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch homepage data: ${response.statusText}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch homepage data')
      }

      console.log('✅ Homepage data fetched successfully:', result.data.metadata)
      
      return result
    },
    staleTime: 2 * 60 * 1000, // 2 minutes (shorter for homepage freshness)
    cacheTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 2,
    enabled,
    // Add error boundary
    onError: (error) => {
      console.error('❌ Homepage data fetch error:', error)
    }
  })
}

/**
 * Convenience hook for deals section only
 */
export function useDealsData(limit = 5) {
  const { data, isLoading, error } = useHomepageData({
    dealsLimit: limit,
    recentlyAddedLimit: 0,
    includeTrending: false
  })

  return {
    deals: data?.data.deals || [],
    isLoading,
    error,
    count: data?.data.metadata.deals_count || 0
  }
}

/**
 * Convenience hook for recently added section only
 */
export function useRecentlyAddedData(limit = 5) {
  const { data, isLoading, error } = useHomepageData({
    dealsLimit: 0,
    recentlyAddedLimit: limit,
    includeTrending: false
  })

  return {
    recentlyAdded: data?.data.recently_added || [],
    isLoading,
    error,
    count: data?.data.metadata.recently_added_count || 0
  }
}
