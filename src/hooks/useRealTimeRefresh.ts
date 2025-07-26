/**
 * Real-time Data Refresh Hook
 * Provides automatic data refresh capabilities with manual refresh options
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

export interface RefreshOptions {
  autoRefresh?: boolean
  refreshInterval?: number // in milliseconds
  onRefresh?: () => Promise<void>
  onError?: (error: Error) => void
  dependencies?: string[] // Query keys to invalidate
}

export interface RefreshState {
  isRefreshing: boolean
  lastRefresh: Date | null
  refreshCount: number
  error: Error | null
  autoRefreshEnabled: boolean
}

export function useRealTimeRefresh(options: RefreshOptions = {}) {
  const {
    autoRefresh = false,
    refreshInterval = 30000, // 30 seconds default
    onRefresh,
    onError,
    dependencies = []
  } = options

  const queryClient = useQueryClient()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const [state, setState] = useState<RefreshState>({
    isRefreshing: false,
    lastRefresh: null,
    refreshCount: 0,
    error: null,
    autoRefreshEnabled: autoRefresh
  })

  // Manual refresh function
  const refresh = useCallback(async (invalidateCache = true) => {
    setState(prev => ({ ...prev, isRefreshing: true, error: null }))

    try {
      // Invalidate specified query keys
      if (invalidateCache && dependencies.length > 0) {
        await Promise.all(
          dependencies.map(key => queryClient.invalidateQueries({ queryKey: [key] }))
        )
      }

      // Call custom refresh function if provided
      if (onRefresh) {
        await onRefresh()
      }

      setState(prev => ({
        ...prev,
        isRefreshing: false,
        lastRefresh: new Date(),
        refreshCount: prev.refreshCount + 1,
        error: null
      }))

      console.log('✅ Data refresh completed')
    } catch (error) {
      const refreshError = error instanceof Error ? error : new Error('Refresh failed')
      
      setState(prev => ({
        ...prev,
        isRefreshing: false,
        error: refreshError
      }))

      if (onError) {
        onError(refreshError)
      }

      console.error('❌ Data refresh failed:', refreshError)
    }
  }, [queryClient, dependencies, onRefresh, onError])

  // Toggle auto-refresh
  const toggleAutoRefresh = useCallback(() => {
    setState(prev => ({
      ...prev,
      autoRefreshEnabled: !prev.autoRefreshEnabled
    }))
  }, [])

  // Set up auto-refresh interval
  useEffect(() => {
    if (state.autoRefreshEnabled && refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        refresh(true)
      }, refreshInterval)

      console.log(`🔄 Auto-refresh enabled (${refreshInterval}ms interval)`)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
        console.log('⏹️ Auto-refresh disabled')
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [state.autoRefreshEnabled, refreshInterval, refresh])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  return {
    ...state,
    refresh,
    toggleAutoRefresh,
    forceRefresh: () => refresh(true),
    softRefresh: () => refresh(false)
  }
}

/**
 * Hook for cache invalidation with admin privileges
 */
export function useCacheInvalidation() {
  const [isInvalidating, setIsInvalidating] = useState(false)
  const [lastInvalidation, setLastInvalidation] = useState<Date | null>(null)

  const invalidateCache = useCallback(async (
    cacheTypes: string[] = ['all'],
    reason = 'manual_refresh',
    forceRefresh = true
  ) => {
    setIsInvalidating(true)

    try {
      const response = await fetch('/api/admin/cache/invalidate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cacheTypes,
          reason,
          forceRefresh
        })
      })

      if (!response.ok) {
        throw new Error(`Cache invalidation failed: ${response.status}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Cache invalidation failed')
      }

      setLastInvalidation(new Date())
      console.log('✅ Cache invalidation completed:', result.data.summary)

      return result.data
    } catch (error) {
      console.error('❌ Cache invalidation failed:', error)
      throw error
    } finally {
      setIsInvalidating(false)
    }
  }, [])

  const invalidateDashboard = useCallback(() => 
    invalidateCache(['dashboard'], 'dashboard_refresh'), [invalidateCache])

  const invalidateProducts = useCallback(() => 
    invalidateCache(['products'], 'products_refresh'), [invalidateCache])

  const invalidateCategories = useCallback(() => 
    invalidateCache(['categories'], 'categories_refresh'), [invalidateCache])

  const invalidateAll = useCallback(() => 
    invalidateCache(['all'], 'full_refresh'), [invalidateCache])

  return {
    isInvalidating,
    lastInvalidation,
    invalidateCache,
    invalidateDashboard,
    invalidateProducts,
    invalidateCategories,
    invalidateAll
  }
}

/**
 * Hook for enhanced sync operations
 */
export function useEnhancedSync() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [syncHistory, setSyncHistory] = useState<any[]>([])

  const startEnhancedSync = useCallback(async (options = {}) => {
    setIsSyncing(true)

    try {
      const response = await fetch('/api/admin/boxhero/enhanced-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(options)
      })

      if (!response.ok) {
        throw new Error(`Enhanced sync failed: ${response.status}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Enhanced sync failed')
      }

      setLastSync(new Date())
      console.log('✅ Enhanced sync completed:', result.data.summary)

      // Refresh sync history
      await loadSyncHistory()

      return result.data
    } catch (error) {
      console.error('❌ Enhanced sync failed:', error)
      throw error
    } finally {
      setIsSyncing(false)
    }
  }, [])

  const loadSyncHistory = useCallback(async (limit = 10) => {
    try {
      const response = await fetch(`/api/admin/boxhero/enhanced-sync?limit=${limit}&analytics=true`)
      
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setSyncHistory(result.data.syncHistory || [])
        }
      }
    } catch (error) {
      console.error('❌ Failed to load sync history:', error)
    }
  }, [])

  // Load sync history on mount
  useEffect(() => {
    loadSyncHistory()
  }, [loadSyncHistory])

  return {
    isSyncing,
    lastSync,
    syncHistory,
    startEnhancedSync,
    loadSyncHistory
  }
}

/**
 * Hook for admin activity monitoring
 */
export function useAdminActivityMonitor() {
  const [activities, setActivities] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadRecentActivities = useCallback(async (limit = 20) => {
    setIsLoading(true)

    try {
      // This would call an admin activity API endpoint
      // For now, we'll return empty array
      setActivities([])
    } catch (error) {
      console.error('❌ Failed to load admin activities:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRecentActivities()
  }, [loadRecentActivities])

  return {
    activities,
    isLoading,
    loadRecentActivities
  }
}

/**
 * Combined hook for admin dashboard with real-time capabilities
 */
export function useAdminDashboardRealTime() {
  const refreshHook = useRealTimeRefresh({
    autoRefresh: false, // Start with manual refresh
    refreshInterval: 60000, // 1 minute
    dependencies: ['dashboard-stats', 'admin-products', 'admin-orders']
  })

  const cacheHook = useCacheInvalidation()
  const syncHook = useEnhancedSync()
  const activityHook = useAdminActivityMonitor()

  // Combined refresh function
  const refreshDashboard = useCallback(async () => {
    await Promise.all([
      refreshHook.refresh(),
      activityHook.loadRecentActivities()
    ])
  }, [refreshHook, activityHook])

  // Combined sync and refresh
  const syncAndRefresh = useCallback(async (syncOptions = {}) => {
    const syncResult = await syncHook.startEnhancedSync(syncOptions)
    await refreshDashboard()
    return syncResult
  }, [syncHook, refreshDashboard])

  return {
    // Refresh state and controls
    ...refreshHook,
    
    // Cache invalidation
    ...cacheHook,
    
    // Enhanced sync
    ...syncHook,
    
    // Activity monitoring
    ...activityHook,
    
    // Combined operations
    refreshDashboard,
    syncAndRefresh
  }
}
