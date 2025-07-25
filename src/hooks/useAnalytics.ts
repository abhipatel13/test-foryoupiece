import { useState, useEffect } from 'react'
import type { SalesAnalytics, SalesPerformanceResponse } from '@/app/api/admin/analytics/sales-performance/route'
import type { BestSellerRecommendation, RecommendationsResponse } from '@/app/api/admin/analytics/recommendations/route'
import type { BulkUpdateRequest, BulkUpdateResponse } from '@/app/api/admin/analytics/bulk-update/route'

export interface AnalyticsFilters {
  days: number
  minSales: number
  limit: number
}

export interface RecommendationFilters {
  days: number
  confidenceThreshold: number
  maxRecommendations: number
}

// Hook for sales performance analytics
export function useSalesAnalytics(filters: AnalyticsFilters = { days: 30, minSales: 1, limit: 50 }) {
  const [data, setData] = useState<SalesPerformanceResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams({
        days: filters.days.toString(),
        min_sales: filters.minSales.toString(),
        limit: filters.limit.toString()
      })

      console.log('📊 Fetching sales analytics with filters:', filters)

      const response = await fetch(`/api/admin/analytics/sales-performance?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: SalesPerformanceResponse = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch sales analytics')
      }

      console.log('✅ Sales analytics fetched successfully:', result.data.summary)
      setData(result)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      console.error('❌ Error fetching sales analytics:', errorMessage)
      setError(errorMessage)
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }

  const refetch = () => {
    fetchAnalytics()
  }

  useEffect(() => {
    fetchAnalytics()
  }, [filters.days, filters.minSales, filters.limit])

  return {
    data: data?.data || null,
    isLoading,
    error,
    refetch
  }
}

// Hook for best seller recommendations
export function useBestSellerRecommendations(filters: RecommendationFilters = { 
  days: 30, 
  confidenceThreshold: 0.7, 
  maxRecommendations: 20 
}) {
  const [data, setData] = useState<RecommendationsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRecommendations = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams({
        days: filters.days.toString(),
        confidence_threshold: filters.confidenceThreshold.toString(),
        max_recommendations: filters.maxRecommendations.toString()
      })

      console.log('🤖 Fetching best seller recommendations with filters:', filters)

      const response = await fetch(`/api/admin/analytics/recommendations?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: RecommendationsResponse = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch recommendations')
      }

      console.log('✅ Recommendations fetched successfully:', result.data.summary)
      setData(result)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      console.error('❌ Error fetching recommendations:', errorMessage)
      setError(errorMessage)
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }

  const refetch = () => {
    fetchRecommendations()
  }

  useEffect(() => {
    fetchRecommendations()
  }, [filters.days, filters.confidenceThreshold, filters.maxRecommendations])

  return {
    data: data?.data || null,
    isLoading,
    error,
    refetch
  }
}

// Hook for bulk updates
export function useBulkBestSellerUpdate() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const applyBulkUpdate = async (updates: BulkUpdateRequest['updates'], reason?: string): Promise<BulkUpdateResponse | null> => {
    try {
      setIsLoading(true)
      setError(null)

      console.log('🔄 Applying bulk best seller updates:', updates.length, 'items')

      const response = await fetch('/api/admin/analytics/bulk-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          updates,
          reason
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: BulkUpdateResponse = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to apply bulk updates')
      }

      console.log('✅ Bulk updates applied successfully:', result.data)
      return result

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      console.error('❌ Error applying bulk updates:', errorMessage)
      setError(errorMessage)
      return null
    } finally {
      setIsLoading(false)
    }
  }

  return {
    applyBulkUpdate,
    isLoading,
    error
  }
}

// Hook for analytics dashboard summary
export function useAnalyticsDashboard(days: number = 30) {
  const salesAnalytics = useSalesAnalytics({ days, minSales: 1, limit: 100 })
  const recommendations = useBestSellerRecommendations({ days, confidenceThreshold: 0.6, maxRecommendations: 50 })

  const isLoading = salesAnalytics.isLoading || recommendations.isLoading
  const error = salesAnalytics.error || recommendations.error

  const dashboardData = {
    salesPerformance: salesAnalytics.data,
    recommendations: recommendations.data,
    summary: {
      totalRevenue: salesAnalytics.data?.summary.total_revenue || 0,
      totalProducts: salesAnalytics.data?.summary.total_products_analyzed || 0,
      currentBestSellers: salesAnalytics.data?.summary.current_best_sellers_count || 0,
      recommendedChanges: recommendations.data?.summary.total_recommendations || 0,
      performanceDiscrepancies: salesAnalytics.data?.summary.performance_discrepancies || 0,
      avgConfidenceScore: recommendations.data?.summary.avg_confidence_score || 0
    }
  }

  const refetch = () => {
    salesAnalytics.refetch()
    recommendations.refetch()
  }

  return {
    data: dashboardData,
    isLoading,
    error,
    refetch
  }
}
