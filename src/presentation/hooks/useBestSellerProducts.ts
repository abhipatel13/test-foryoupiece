import { useState, useEffect } from 'react'

export interface BestSellerProduct {
  id: string
  sku: string
  name_en: string
  name_ja: string
  description_en: string | null
  description_ja: string | null
  price: number
  compare_at_price: number | null
  images: string[]
  brand: string | null
  stock_quantity: number
  is_featured: boolean
  is_best_seller: boolean
  best_seller_position: number
  created_at: string
  updated_at: string
  category: {
    id: string
    name_en: string
    name_ja: string
    slug: string
  } | null
  stock_status: string
}

export interface BestSellerResponse {
  success: boolean
  data: BestSellerProduct[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  error?: string
}

export interface UseBestSellerProductsOptions {
  limit?: number
  page?: number
  topTierOnly?: boolean
  autoFetch?: boolean
}

export function useBestSellerProducts(options: UseBestSellerProductsOptions = {}) {
  const {
    limit = 6,
    page = 1,
    topTierOnly = false,
    autoFetch = true
  } = options

  const [data, setData] = useState<BestSellerResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBestSellers = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams({
        limit: limit.toString(),
        page: page.toString(),
        ...(topTierOnly && { top_tier_only: 'true' })
      })

      console.log('🏆 Fetching best sellers with params:', params.toString())

      const response = await fetch(`/api/products/best-sellers?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: BestSellerResponse = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch best sellers')
      }

      console.log('✅ Best sellers fetched successfully:', result.data.length, 'products')
      setData(result)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      console.error('❌ Error fetching best sellers:', errorMessage)
      setError(errorMessage)
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }

  const refetch = () => {
    fetchBestSellers()
  }

  useEffect(() => {
    if (autoFetch) {
      fetchBestSellers()
    }
  }, [limit, page, topTierOnly, autoFetch])

  return {
    data: data?.data || [],
    pagination: data?.pagination || null,
    isLoading,
    error,
    refetch,
    fetchBestSellers
  }
}

// Convenience hook for homepage (top 6 best sellers)
export function useHomepageBestSellers() {
  return useBestSellerProducts({ limit: 6, page: 1 })
}

// Convenience hook for top tier best sellers (positions 1-10)
export function useTopTierBestSellers(limit: number = 10) {
  return useBestSellerProducts({ limit, topTierOnly: true })
}
