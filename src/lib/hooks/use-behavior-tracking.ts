import { useCallback, useEffect, useState } from 'react'
import { useSSRSafeAuth } from '@/lib/hooks/use-ssr-safe-auth'

export type BehaviorType =
  | 'search'
  | 'product_view'
  | 'category_view'
  | 'cart_add'
  | 'cart_remove'
  | 'wishlist_add'
  | 'wishlist_remove'
  | 'purchase'
  | 'page_view'

export interface TrackBehaviorOptions {
  productId?: string
  categoryId?: string
  searchQuery?: string
  sessionId?: string
  metadata?: Record<string, any>
}

export function useBehaviorTracking() {
  const { user, loading } = useSSRSafeAuth()
  const [isReady, setIsReady] = useState(false)

  // Wait for auth to be fully loaded before allowing tracking
  useEffect(() => {
    if (!loading) {
      // Add a small delay to ensure auth state is stable
      const timer = setTimeout(() => {
        setIsReady(true)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [loading])

  const trackBehavior = useCallback(async (
    behaviorType: BehaviorType,
    options: TrackBehaviorOptions = {}
  ) => {
    // Wait for auth to be ready
    if (!isReady) {
      console.log('🔍 Skipping behavior tracking - auth not ready yet')
      return
    }

    // Only track behavior for authenticated users
    if (!user?.id) {
      console.log('🔍 Skipping behavior tracking - user not authenticated')
      return
    }

    try {
      const response = await fetch('/api/behavior/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          behaviorType,
          ...options,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('❌ Failed to track behavior:', errorData.error)
        return
      }

      const result = await response.json()
      console.log(`✅ Tracked ${behaviorType} behavior:`, result.message)
    } catch (error) {
      console.error('❌ Error tracking behavior:', error)
    }
  }, [user?.id, isReady])

  const trackProductView = useCallback((productId: string, metadata?: Record<string, any>) => {
    return trackBehavior('product_view', { productId, metadata })
  }, [trackBehavior])

  const trackCategoryView = useCallback((categoryId: string, metadata?: Record<string, any>) => {
    return trackBehavior('category_view', { categoryId, metadata })
  }, [trackBehavior])

  const trackCartAdd = useCallback((productId: string, metadata?: Record<string, any>) => {
    return trackBehavior('cart_add', { productId, metadata })
  }, [trackBehavior])

  const trackCartRemove = useCallback((productId: string, metadata?: Record<string, any>) => {
    return trackBehavior('cart_remove', { productId, metadata })
  }, [trackBehavior])

  const trackSearch = useCallback((searchQuery: string, metadata?: Record<string, any>) => {
    return trackBehavior('search', { searchQuery, metadata })
  }, [trackBehavior])

  const trackPageView = useCallback((metadata?: Record<string, any>) => {
    return trackBehavior('page_view', { metadata })
  }, [trackBehavior])

  return {
    trackBehavior,
    trackProductView,
    trackCategoryView,
    trackCartAdd,
    trackCartRemove,
    trackSearch,
    trackPageView,
    isAuthenticated: !!user?.id,
    isReady: isReady && !!user?.id
  }
}
