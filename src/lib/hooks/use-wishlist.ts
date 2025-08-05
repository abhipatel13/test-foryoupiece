'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSSRSafeAuth } from './use-ssr-safe-auth'
import { toast } from 'sonner'

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

export function useWishlist() {
  const { user, isAuthenticated } = useSSRSafeAuth()
  const [items, setItems] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Load wishlist items
  const loadWishlist = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setItems([])
      setInitialized(true)
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/wishlist')

      if (!response.ok) {
        // Handle HTTP errors gracefully
        if (response.status === 401) {
          // User not authenticated, clear wishlist
          setItems([])
          setInitialized(true)
          return
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      if (result.success) {
        setItems(result.data || [])
      } else {
        // Log error for debugging but don't throw
        if (process.env.NODE_ENV === 'development') {
          console.warn('Failed to load wishlist:', result.error)
        }
        setItems([])
      }
    } catch (error) {
      // Log error for debugging but don't throw
      if (process.env.NODE_ENV === 'development') {
        console.warn('Error loading wishlist:', error)
      }
      setItems([])
    } finally {
      setLoading(false)
      setInitialized(true)
    }
  }, [isAuthenticated, user])

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
      const response = await fetch('/api/wishlist', {
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
          return [result.data, ...prev]
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

      const response = await fetch(`/api/wishlist?${params}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        // Remove the item from local state
        setItems(prev => 
          prev.filter(item => 
            !(item.product.id === productId && 
              (variantId ? item.variant?.id === variantId : !item.variant))
          )
        )
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
      clearWishlist()
    }
  }, [isAuthenticated, user, loadWishlist, clearWishlist])

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
