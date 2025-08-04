'use client'

/**
 * Request deduplication utility to prevent concurrent identical API calls
 * Especially useful for admin status checks and profile loading
 */

interface PendingRequest {
  promise: Promise<any>
  timestamp: number
  abortController: AbortController
}

interface RequestCache {
  [key: string]: {
    data: any
    timestamp: number
    ttl: number
  }
}

class RequestDeduplicator {
  private pendingRequests: Map<string, PendingRequest> = new Map()
  private cache: RequestCache = {}
  private defaultTTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Execute a request with deduplication and caching
   */
  async execute<T>(
    key: string,
    requestFn: (signal?: AbortSignal) => Promise<T>,
    options: {
      ttl?: number
      forceRefresh?: boolean
      timeout?: number
    } = {}
  ): Promise<T> {
    const { ttl = this.defaultTTL, forceRefresh = false, timeout = 30000 } = options

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = this.cache[key]
      if (cached && (Date.now() - cached.timestamp) < cached.ttl) {
        console.log('📦 Request cache hit:', key)
        return cached.data
      }
    }

    // Check if request is already pending
    const pending = this.pendingRequests.get(key)
    if (pending) {
      console.log('🔄 Request deduplication hit:', key)
      try {
        return await pending.promise
      } catch (error) {
        // If pending request failed, remove it and try again
        this.pendingRequests.delete(key)
        throw error
      }
    }

    // Create new request with timeout
    const abortController = new AbortController()
    const timeoutId = setTimeout(() => {
      abortController.abort()
    }, timeout)

    const promise = (async () => {
      try {
        console.log('🚀 Executing new request:', key)
        const result = await requestFn(abortController.signal)
        
        // Cache the result
        this.cache[key] = {
          data: result,
          timestamp: Date.now(),
          ttl
        }

        return result
      } catch (error) {
        // Don't cache errors
        throw error
      } finally {
        clearTimeout(timeoutId)
        this.pendingRequests.delete(key)
      }
    })()

    // Store pending request
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now(),
      abortController
    })

    return promise
  }

  /**
   * Clear cache for specific key
   */
  clearCache(key: string) {
    delete this.cache[key]
    console.log('🗑️ Cache cleared for:', key)
  }

  /**
   * Clear all cache
   */
  clearAllCache() {
    this.cache = {}
    console.log('🗑️ All cache cleared')
  }

  /**
   * Cancel pending request
   */
  cancelRequest(key: string) {
    const pending = this.pendingRequests.get(key)
    if (pending) {
      pending.abortController.abort()
      this.pendingRequests.delete(key)
      console.log('❌ Request cancelled:', key)
    }
  }

  /**
   * Cancel all pending requests
   */
  cancelAllRequests() {
    for (const [key, pending] of this.pendingRequests.entries()) {
      pending.abortController.abort()
    }
    this.pendingRequests.clear()
    console.log('❌ All requests cancelled')
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const now = Date.now()
    const cacheKeys = Object.keys(this.cache)
    const validCache = cacheKeys.filter(key => 
      (now - this.cache[key].timestamp) < this.cache[key].ttl
    )
    const expiredCache = cacheKeys.filter(key => 
      (now - this.cache[key].timestamp) >= this.cache[key].ttl
    )

    return {
      totalCached: cacheKeys.length,
      validCached: validCache.length,
      expiredCached: expiredCache.length,
      pendingRequests: this.pendingRequests.size
    }
  }

  /**
   * Clean up expired cache entries
   */
  cleanupExpiredCache() {
    const now = Date.now()
    const expiredKeys: string[] = []

    for (const [key, cached] of Object.entries(this.cache)) {
      if ((now - cached.timestamp) >= cached.ttl) {
        expiredKeys.push(key)
      }
    }

    expiredKeys.forEach(key => delete this.cache[key])
    
    if (expiredKeys.length > 0) {
      console.log('🧹 Cleaned up expired cache entries:', expiredKeys.length)
    }

    return expiredKeys.length
  }
}

// Singleton instance
let deduplicatorInstance: RequestDeduplicator | null = null

export function getRequestDeduplicator(): RequestDeduplicator {
  if (!deduplicatorInstance) {
    deduplicatorInstance = new RequestDeduplicator()
    
    // Set up periodic cache cleanup
    if (typeof window !== 'undefined') {
      setInterval(() => {
        deduplicatorInstance?.cleanupExpiredCache()
      }, 5 * 60 * 1000) // Clean up every 5 minutes
    }
  }
  return deduplicatorInstance
}

// Utility functions for common operations
export const requestUtils = {
  /**
   * Deduplicated admin status check
   */
  checkAdminStatus: async (userId: string, forceRefresh = false) => {
    const deduplicator = getRequestDeduplicator()
    return deduplicator.execute(
      `admin_status_${userId}`,
      async (signal) => {
        const response = await fetch('/api/admin/check-status', {
          signal,
          headers: {
            'Cache-Control': forceRefresh ? 'no-cache' : 'max-age=300'
          }
        })
        
        if (!response.ok) {
          throw new Error(`Admin status check failed: ${response.status}`)
        }
        
        return response.json()
      },
      { ttl: 5 * 60 * 1000, forceRefresh } // 5 minute cache
    )
  },

  /**
   * Deduplicated user profile fetch
   */
  fetchUserProfile: async (userId: string, forceRefresh = false) => {
    const deduplicator = getRequestDeduplicator()
    return deduplicator.execute(
      `user_profile_${userId}`,
      async (signal) => {
        const response = await fetch(`/api/users/${userId}/profile`, {
          signal,
          headers: {
            'Cache-Control': forceRefresh ? 'no-cache' : 'max-age=300'
          }
        })
        
        if (!response.ok) {
          throw new Error(`Profile fetch failed: ${response.status}`)
        }
        
        return response.json()
      },
      { ttl: 10 * 60 * 1000, forceRefresh } // 10 minute cache
    )
  },

  /**
   * Deduplicated points breakdown fetch
   */
  fetchPointsBreakdown: async (userId: string, forceRefresh = false) => {
    const deduplicator = getRequestDeduplicator()
    return deduplicator.execute(
      `points_breakdown_${userId}`,
      async (signal) => {
        // Use PointsService directly for better performance
        const { PointsService } = await import('@/lib/services/points-service')
        const pointsService = new PointsService()
        const result = await pointsService.getPointsBreakdown(userId)

        if (result.error) {
          throw new Error(result.error)
        }

        return result.breakdown
      },
      { ttl: 5 * 60 * 1000, forceRefresh } // 5 minute cache for points data
    )
  },

  /**
   * Deduplicated user points summary fetch
   */
  fetchUserPointsSummary: async (userId: string, forceRefresh = false) => {
    const deduplicator = getRequestDeduplicator()
    return deduplicator.execute(
      `user_points_summary_${userId}`,
      async (signal) => {
        const { PointsService } = await import('@/lib/services/points-service')
        const pointsService = new PointsService()
        const result = await pointsService.getUserPointsSummary(userId)

        if (result.error) {
          throw new Error(result.error)
        }

        return result.summary
      },
      { ttl: 3 * 60 * 1000, forceRefresh } // 3 minute cache for summary
    )
  },

  /**
   * Prefetch user data for dropdown performance
   */
  prefetchUserData: async (userId: string) => {
    const deduplicator = getRequestDeduplicator()

    // Prefetch profile and points data in parallel
    const promises = [
      deduplicator.execute(
        `user_profile_${userId}`,
        async () => {
          const { userQueries } = await import('@/lib/supabase/queries')
          return userQueries.getProfile(userId)
        },
        { ttl: 10 * 60 * 1000 } // 10 minute cache
      ),
      deduplicator.execute(
        `user_points_summary_${userId}`,
        async () => {
          const { PointsService } = await import('@/lib/services/points-service')
          const pointsService = new PointsService()
          const result = await pointsService.getUserPointsSummary(userId)
          return result.error ? null : result.summary
        },
        { ttl: 3 * 60 * 1000 } // 3 minute cache
      )
    ]

    try {
      await Promise.allSettled(promises)
      console.log('🚀 User data prefetched successfully for:', userId)
    } catch (error) {
      console.warn('⚠️ User data prefetch failed:', error)
    }
  },

  /**
   * Clear cache for user-related data
   */
  clearUserCache: (userId: string) => {
    const deduplicator = getRequestDeduplicator()
    deduplicator.clearCache(`admin_status_${userId}`)
    deduplicator.clearCache(`user_profile_${userId}`)
    deduplicator.clearCache(`points_breakdown_${userId}`)
  }
}
