'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useSSRSafeAuth } from './use-ssr-safe-auth'
import { requestUtils } from '@/lib/utils/request-deduplication'
import { useIsClient } from './use-ssr-safe-store'

interface PerformanceOptimizationOptions {
  prefetchUserData?: boolean
  prefetchPointsData?: boolean
  enableBackgroundRefresh?: boolean
  backgroundRefreshInterval?: number
}

/**
 * Performance optimization hook for user data and dropdown performance
 * Handles prefetching, caching, and background refresh of user-related data
 */
export function usePerformanceOptimization(options: PerformanceOptimizationOptions = {}) {
  const {
    prefetchUserData = true,
    prefetchPointsData = true,
    enableBackgroundRefresh = true,
    backgroundRefreshInterval = 5 * 60 * 1000 // 5 minutes
  } = options

  const { user, isAuthenticated, loading } = useSSRSafeAuth()
  const isClient = useIsClient()
  const backgroundRefreshRef = useRef<NodeJS.Timeout | null>(null)
  const lastPrefetchRef = useRef<string | null>(null)

  // Prefetch user data when authenticated
  const prefetchData = useCallback(async (userId: string, force = false) => {
    if (!isClient || !userId) return

    // Avoid duplicate prefetches for the same user
    if (!force && lastPrefetchRef.current === userId) return

    try {
      console.log('🚀 Prefetching user data for performance optimization:', userId)
      
      const promises: Promise<any>[] = []

      if (prefetchUserData) {
        promises.push(requestUtils.prefetchUserData(userId))
      }

      if (prefetchPointsData) {
        promises.push(
          requestUtils.fetchUserPointsSummary(userId).catch(err => {
            console.warn('⚠️ Points data prefetch failed:', err)
            return null
          })
        )
      }

      await Promise.allSettled(promises)
      lastPrefetchRef.current = userId
      console.log('✅ User data prefetch completed')
    } catch (error) {
      console.warn('⚠️ User data prefetch failed:', error)
    }
  }, [isClient, prefetchUserData, prefetchPointsData])

  // Background refresh function
  const backgroundRefresh = useCallback(async (userId: string) => {
    if (!isClient || !userId) return

    try {
      console.log('🔄 Background refresh of user data:', userId)
      
      // Refresh with force flag to bypass cache
      await Promise.allSettled([
        requestUtils.fetchUserProfile(userId, true),
        requestUtils.fetchUserPointsSummary(userId, true)
      ])
      
      console.log('✅ Background refresh completed')
    } catch (error) {
      console.warn('⚠️ Background refresh failed:', error)
    }
  }, [isClient])

  // Set up background refresh interval
  useEffect(() => {
    if (!enableBackgroundRefresh || !isAuthenticated || !user?.id) {
      if (backgroundRefreshRef.current) {
        clearInterval(backgroundRefreshRef.current)
        backgroundRefreshRef.current = null
      }
      return
    }

    // Clear existing interval
    if (backgroundRefreshRef.current) {
      clearInterval(backgroundRefreshRef.current)
    }

    // Set up new interval
    backgroundRefreshRef.current = setInterval(() => {
      if (user?.id) {
        backgroundRefresh(user.id)
      }
    }, backgroundRefreshInterval)

    return () => {
      if (backgroundRefreshRef.current) {
        clearInterval(backgroundRefreshRef.current)
        backgroundRefreshRef.current = null
      }
    }
  }, [enableBackgroundRefresh, isAuthenticated, user?.id, backgroundRefreshInterval, backgroundRefresh])

  // Initial prefetch when user becomes available
  useEffect(() => {
    if (!loading && isAuthenticated && user?.id) {
      // Small delay to ensure auth state is stable
      const timer = setTimeout(() => {
        prefetchData(user.id)
      }, 100)

      return () => clearTimeout(timer)
    }
  }, [loading, isAuthenticated, user?.id, prefetchData])

  // Manual refresh function
  const refreshUserData = useCallback(async (force = false) => {
    if (!user?.id) return

    await prefetchData(user.id, force)
  }, [user?.id, prefetchData])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (backgroundRefreshRef.current) {
        clearInterval(backgroundRefreshRef.current)
      }
    }
  }, [])

  return {
    refreshUserData,
    isOptimized: !!lastPrefetchRef.current,
    lastPrefetchUserId: lastPrefetchRef.current
  }
}

/**
 * Hook specifically for dropdown performance optimization
 * Provides optimized data loading for account dropdowns
 */
export function useDropdownPerformance() {
  const { user, isAuthenticated } = useSSRSafeAuth()
  const isClient = useIsClient()

  // Prefetch data when dropdown is likely to be opened
  const prefetchForDropdown = useCallback(async () => {
    if (!isClient || !isAuthenticated || !user?.id) return

    try {
      // Prefetch essential dropdown data
      await Promise.allSettled([
        requestUtils.fetchUserProfile(user.id),
        requestUtils.fetchUserPointsSummary(user.id)
      ])
    } catch (error) {
      console.warn('⚠️ Dropdown prefetch failed:', error)
    }
  }, [isClient, isAuthenticated, user?.id])

  // Prefetch on hover or focus events
  const handlePrefetchTrigger = useCallback(() => {
    prefetchForDropdown()
  }, [prefetchForDropdown])

  return {
    prefetchForDropdown,
    handlePrefetchTrigger,
    isReady: isAuthenticated && !!user?.id
  }
}

/**
 * Performance monitoring hook
 * Tracks dropdown performance metrics
 */
export function useDropdownPerformanceMonitoring() {
  const performanceRef = useRef<{
    openTime?: number
    loadTime?: number
    cacheHit?: boolean
  }>({})

  const startTiming = useCallback(() => {
    performanceRef.current.openTime = performance.now()
  }, [])

  const endTiming = useCallback((cacheHit = false) => {
    if (performanceRef.current.openTime) {
      performanceRef.current.loadTime = performance.now() - performanceRef.current.openTime
      performanceRef.current.cacheHit = cacheHit
      
      console.log('📊 Dropdown Performance:', {
        loadTime: `${performanceRef.current.loadTime.toFixed(2)}ms`,
        cacheHit,
        target: '< 200ms'
      })
    }
  }, [])

  const getMetrics = useCallback(() => {
    return { ...performanceRef.current }
  }, [])

  return {
    startTiming,
    endTiming,
    getMetrics
  }
}
