'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSSRSafeAuth } from './use-ssr-safe-auth'
import { toast } from 'sonner'
import { authFetch } from '@/lib/utils/auth-interceptor'

interface WishlistItem {
  id: string
  created_at: string
  product: {
    id: string
    name_en: string
    description_en: string
    price: number
    compare_at_price?: number
    sku: string
    images: string[]
    stock_quantity: number
    is_active: boolean
    category?: {
      id: string
      name_en: string
      slug: string
    }
  }
  variant?: {
    id: string
    name: string
    price_adjustment: number
    sku_suffix: string
  }
}

// Module-level cache and in-flight deduplication to prevent N duplicate requests per page
let __wishlistCache: WishlistItem[] = []
let __wishlistInitialized = false
let __wishlistInFlight: Promise<WishlistItem[]> | null = null
let __wishlistUserId: string | null = null

export function useWishlist() {
  const { user, isAuthenticated } = useSSRSafeAuth()
  const [items, setItems] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Load wishlist items with module-level in-flight dedupe and cache by user
  const loadWishlist = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setItems([])
      setInitialized(true)
      return
    }

    // Return cached result if for same user and already initialized
    if (__wishlistInitialized && __wishlistUserId === user.id && __wishlistCache.length) {
      setItems(__wishlistCache)
      setInitialized(true)
      return
    }

    try {
      setLoading(true)

      // If a request is already in flight for this user, await it
      if (__wishlistInFlight && __wishlistUserId === user.id) {
        const data = await __wishlistInFlight
        setItems(data)
        setInitialized(true)
        return
      }

      __wishlistUserId = user.id
      __wishlistInFlight = (async () => {
        const response = await authFetch('/api/wishlist')
        if (!response.ok) {
          if (response.status === 401) return []
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        const result = await response.json()
        const data: WishlistItem[] = result.success ? (result.data || []) : []
        return data
      })()

      const data = await __wishlistInFlight
      __wishlistCache = data
      __wishlistInitialized = true
      setItems(data)
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Error loading wishlist:', error)
      }
      __wishlistCache = []
      setItems([])
    } finally {
      __wishlistInFlight = null
      setLoading(false)
      setInitialized(true)
    }
  }, [isAuthenticated, user?.id])

  // Check if item is in wishlist
  const isInWishlist = useCallback((productId: string, variantId?: string) => {
    return items.some(item =>
      item.product.id === productId &&
      (variantId ? item.variant?.id === variantId : !item.variant)
    )
  }, [items])

  // Add item to wishlist
  const addToWishlist = useCallback(async (productId: string, variantId?: string) => {
    if (!isAuthenticated) {
      toast.error('Please log in to add items to your wishlist')
      return false
    }

    // Check if item is already in wishlist
    if (isInWishlist(productId, variantId)) {
      toast.info('This item is already in your wishlist')
      return false
    }

    try {
      const response = await authFetch('/api/wishlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          productId,
          variantId
        })
      })

      const result = await response.json()

      if (result.success) {
        // Add the new item to the local state only if it's not already there
        setItems(prev => {
          const exists = prev.some(item =>
            item.product.id === productId &&
            (variantId ? item.variant?.id === variantId : !item.variant)
          )
          if (exists) {
            return prev
          }
          const next = [result.data, ...prev]
          // Update module cache to keep other consumers in sync
          if (user?.id === __wishlistUserId) {
            __wishlistCache = next
          }
          return next
        })
        toast.success(result.message || 'Item added to wishlist')
        return true
      } else {
        // Handle duplicate case specifically
        if (result.isAlreadyInWishlist) {
          toast.info('This item is already in your wishlist')
        } else {
          toast.error(result.error || 'Failed to add item to wishlist')
        }
        return false
      }
    } catch (error) {
      console.error('Error adding to wishlist:', error)
      toast.error('Failed to add item to wishlist')
      return false
    }
  }, [isAuthenticated, isInWishlist])

  // Remove item from wishlist
  const removeFromWishlist = useCallback(async (productId: string, variantId?: string) => {
    if (!isAuthenticated) {
      return false
    }

    try {
      const params = new URLSearchParams({ productId })
      if (variantId) params.append('variantId', variantId)

      const response = await authFetch(`/api/wishlist?${params}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        // Remove the item from local state
        setItems(prev => {
          const next = prev.filter(item =>
            !(item.product.id === productId &&
              (variantId ? item.variant?.id === variantId : !item.variant))
          )
          if (user?.id === __wishlistUserId) {
            __wishlistCache = next
          }
          return next
        })
        toast.success('Item removed from wishlist')
        return true
      } else {
        toast.error(result.error || 'Failed to remove item from wishlist')
        return false
      }
    } catch (error) {
      console.error('Error removing from wishlist:', error)
      toast.error('Failed to remove item from wishlist')
      return false
    }
  }, [isAuthenticated])



  // Toggle item in wishlist
  const toggleWishlist = useCallback(async (productId: string, variantId?: string) => {
    if (isInWishlist(productId, variantId)) {
      return await removeFromWishlist(productId, variantId)
    } else {
      return await addToWishlist(productId, variantId)
    }
  }, [isInWishlist, addToWishlist, removeFromWishlist])

  // Get wishlist count
  const getWishlistCount = useCallback(() => {
    return items.length
  }, [items])

  // Clear wishlist (for logout)
  const clearWishlist = useCallback(() => {
    setItems([])
    setInitialized(false)
  }, [])

  // Load wishlist when user authentication changes
  useEffect(() => {
    if (isAuthenticated && user) {
      loadWishlist()
    } else {
      setItems([])
      setInitialized(false)
    }
  }, [isAuthenticated, user?.id]) // Only depend on user.id to prevent infinite loops

  return {
    items,
    loading,
    initialized,
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
    toggleWishlist,
    getWishlistCount,
    clearWishlist,
    refreshWishlist: loadWishlist
  }
}
