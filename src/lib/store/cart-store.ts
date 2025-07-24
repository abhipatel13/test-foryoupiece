'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { cartQueries } from '@/lib/supabase/queries'
import { pointsToDollars, calculateOrderPoints } from '@/lib/utils'

export type CartItem = {
  id: string
  name: string
  price: number
  originalPrice?: number // For sale items, this is the compare_at_price
  quantity: number
  image: string
  variant?: string
  sku?: string
  stockQuantity?: number // Available stock for validation
  points_rate?: number // Points rate percentage (e.g., 1.00 = 1%)
}

type CartStore = {
  items: CartItem[]
  isLoading: boolean
  userId: string | null
  pointsToRedeem: number
  addItem: (item: CartItem, stockQuantity?: number) => Promise<boolean>
  removeItem: (id: string, variant?: string) => Promise<void>
  updateQuantity: (id: string, quantity: number, variant?: string) => Promise<boolean>
  clearCart: () => void
  clearCartOnLogout: () => Promise<void>
  getTotal: () => number
  getItemCount: () => number
  getShippingFee: () => number
  getTotalSavings: () => number
  getFinalTotal: () => number
  getTotalPointsEarned: () => number
  setUserId: (userId: string | null, forceReload?: boolean) => void
  forceLoadCartForUser: (userId: string) => void
  setItems: (items: CartItem[]) => void
  deduplicateItems: () => void
  syncWithDatabase: () => Promise<void>
  loadCartFromDatabase: () => Promise<void>
  validateStock: (id: string, requestedQuantity: number, currentStock?: number) => { isValid: boolean; message: string }
  getStockMessage: (stockQuantity: number) => string
  // Points redemption functions
  setPointsToRedeem: (points: number) => void
  getPointsDiscount: () => number
  getFinalTotalWithPoints: () => number
  validatePointsRedemption: (points: number, userPointsBalance: number) => { isValid: boolean; message: string }
  clearPointsRedemption: () => void
}

// Helper function to normalize variant values consistently
const normalizeVariant = (variant?: string | null): string | undefined => {
  return variant || undefined
}

// Helper function to deduplicate cart items by merging quantities
const deduplicateCartItems = (items: CartItem[]): CartItem[] => {
  const itemMap = new Map<string, CartItem>()

  items.forEach(item => {
    const key = `${item.id}-${normalizeVariant(item.variant)}`
    const existing = itemMap.get(key)

    if (existing) {
      // Merge quantities for duplicate items
      existing.quantity += item.quantity
    } else {
      // Add new item with normalized variant
      itemMap.set(key, {
        ...item,
        variant: normalizeVariant(item.variant)
      })
    }
  })

  return Array.from(itemMap.values())
}

// Stock validation helper functions
const getStockValidationMessage = (stockQuantity: number): string => {
  if (stockQuantity <= 0) return 'Out of stock'
  if (stockQuantity === 1) return 'Only 1 left in stock'
  if (stockQuantity <= 5) return `Only ${stockQuantity} left in stock`
  return 'In stock'
}

const getPurchaseLimitMessage = (requestedQuantity: number, availableStock: number): string => {
  if (availableStock <= 0) {
    return 'This item is currently out of stock'
  }

  if (requestedQuantity > availableStock) {
    if (availableStock === 1) {
      return 'You can only buy 1 of this item'
    }
    return `You can only buy up to ${availableStock} of this item`
  }

  return ''
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,
      userId: null,
      pointsToRedeem: 0,

      setUserId: (userId, forceReload = false) => {
        const currentUserId = get().userId
        const currentItems = get().items

        // Check if userId actually changed or if we're forcing a reload
        if (userId === currentUserId && !forceReload) {
          return // No change and no force reload, skip processing
        }

        console.log('🛒 Cart setUserId processing:', {
          from: currentUserId,
          to: userId,
          currentItemCount: currentItems.length,
          forceReload
        })

        set({ userId })

        // Handle user authentication state changes
        if (userId) {
          if (userId !== currentUserId) {
            console.log('👤 User changed, loading cart from database')
          } else if (forceReload) {
            console.log('👤 Same user but forcing cart reload from database')
          }

          // Clear local cart first to avoid conflicts, then load from database
          set({ items: [], isLoading: false }) // Reset loading state to allow cart loading
          get().loadCartFromDatabase()
        } else if (!userId && currentUserId) {
          // User logged out - local cart will be cleared by clearCartOnLogout
          console.log('🚪 User logged out, cart will be handled by logout process')
        }
      },

      // Force cart loading for authenticated user (used during authentication)
      forceLoadCartForUser: (userId: string) => {
        console.log('🛒 Force loading cart for authenticated user:', { userId })
        get().setUserId(userId, true) // Force reload even if userId is the same
      },

      // Helper method to set items with deduplication
      setItems: (items: CartItem[]) => {
        const deduplicatedItems = deduplicateCartItems(items)
        set({ items: deduplicatedItems })
      },

      // Cleanup method to deduplicate existing cart items
      deduplicateItems: () => {
        const { items } = get()
        const deduplicatedItems = deduplicateCartItems(items)
        set({ items: deduplicatedItems })
      },

      addItem: async (item, stockQuantity) => {
        const { items, userId } = get()

        // Find existing item in cart
        const existingItemIndex = items.findIndex(
          (i) => i.id === item.id && normalizeVariant(i.variant) === normalizeVariant(item.variant)
        )

        const currentCartQuantity = existingItemIndex !== -1 ? items[existingItemIndex].quantity : 0
        const totalRequestedQuantity = currentCartQuantity + item.quantity

        // Validate stock if stockQuantity is provided
        if (stockQuantity !== undefined) {
          const validation = get().validateStock(item.id, totalRequestedQuantity, stockQuantity)
          if (!validation.isValid) {
            console.warn('Stock validation failed:', validation.message)
            return false
          }
        }

        let updatedItems
        if (existingItemIndex !== -1) {
          // Item exists, update quantity
          updatedItems = [...items]
          updatedItems[existingItemIndex] = {
            ...updatedItems[existingItemIndex],
            quantity: updatedItems[existingItemIndex].quantity + item.quantity,
            stockQuantity
          }
        } else {
          // New item, add to cart with normalized variant and stock info
          updatedItems = [...items, {
            ...item,
            variant: normalizeVariant(item.variant),
            stockQuantity
          }]
        }

        // Apply deduplication as a safety measure
        const deduplicatedItems = deduplicateCartItems(updatedItems)
        set({ items: deduplicatedItems })

        // Sync with database if user is logged in
        if (userId) {
          try {
            await cartQueries.addToCart({
              user_id: userId,
              product_id: item.id,
              variant_id: item.variant || null,
              quantity: existingItemIndex !== -1
                ? updatedItems[existingItemIndex].quantity
                : item.quantity
            })
          } catch (error) {
            console.error('Failed to sync cart with database:', error)
            return false
          }
        }

        return true
      },
      
      removeItem: async (id, variant) => {
        const { items, userId } = get()

        // Log for debugging
        console.log('Removing item:', { id, variant, currentItemCount: items.length })

        const updatedItems = items.filter(
          (item) => !(item.id === id && normalizeVariant(item.variant) === normalizeVariant(variant))
        )

        // Force state update to trigger re-renders
        set({ items: updatedItems })

        console.log('After removal:', { newItemCount: updatedItems.length })

        // Sync with database if user is logged in
        if (userId) {
          try {
            const cartItem = await cartQueries.getCartItems(userId)
            const itemToRemove = cartItem.find(
              (item) => item.product_id === id && item.variant_id === variant
            )
            if (itemToRemove) {
              await cartQueries.removeFromCart(itemToRemove.id)
            }
          } catch (error) {
            console.error('Failed to remove item from database:', error)
          }
        }
      },

      updateQuantity: async (id, quantity, variant) => {
        const { items, userId } = get()

        // Find the item to validate stock
        const targetItem = items.find(
          (item) => item.id === id && normalizeVariant(item.variant) === normalizeVariant(variant)
        )

        // Validate stock if stockQuantity is available
        if (targetItem?.stockQuantity !== undefined) {
          const validation = get().validateStock(id, quantity, targetItem.stockQuantity)
          if (!validation.isValid) {
            console.warn('Stock validation failed for quantity update:', validation.message)
            return false
          }
        }

        const updatedItems = items.map((item) => {
          if (item.id === id && normalizeVariant(item.variant) === normalizeVariant(variant)) {
            return { ...item, quantity }
          }
          return item
        })
        set({ items: updatedItems })

        // Sync with database if user is logged in
        if (userId) {
          try {
            const cartItems = await cartQueries.getCartItems(userId)
            const itemToUpdate = cartItems.find(
              (item) => item.product_id === id && item.variant_id === variant
            )
            if (itemToUpdate) {
              await cartQueries.updateCartItem(itemToUpdate.id, { quantity })
            }
          } catch (error) {
            console.error('Failed to update item in database:', error)
            return false
          }
        }

        return true
      },

      clearCart: async () => {
        const { userId } = get()
        set({ items: [], pointsToRedeem: 0 })

        // Clear database cart if user is logged in
        if (userId) {
          try {
            await cartQueries.clearCart(userId)
          } catch (error) {
            console.error('Failed to clear cart in database:', error)
          }
        }
      },

      clearCartOnLogout: async () => {
        const { userId, items } = get()
        console.log('🧹 Saving cart to database before logout:', {
          userId,
          itemCount: items.length
        })

        // Save current cart to database before clearing local state
        if (userId && items.length > 0) {
          try {
            await get().syncWithDatabase()
            console.log('✅ Cart saved to database successfully')
          } catch (error) {
            console.error('❌ Failed to save cart to database on logout:', error)
          }
        }

        // Clear only local state, preserve database cart
        console.log('🧹 Clearing local cart state on logout')
        set({ items: [], userId: null })
      },
      
      getTotal: () => {
        const { items } = get()
        return items.reduce((total, item) => total + item.price * item.quantity, 0)
      },

      getItemCount: () => {
        const { items } = get()
        return items.reduce((count, item) => count + item.quantity, 0)
      },

      getShippingFee: () => {
        const { items } = get()
        const totalQuantity = items.reduce((count, item) => count + item.quantity, 0)
        // Free shipping for 4+ items, otherwise $1.50
        return totalQuantity >= 4 ? 0 : 1.50
      },

      getTotalSavings: () => {
        const { items } = get()
        return items.reduce((savings, item) => {
          if (item.originalPrice && item.originalPrice > item.price) {
            return savings + (item.originalPrice - item.price) * item.quantity
          }
          return savings
        }, 0)
      },

      getFinalTotal: () => {
        const { getTotal, getShippingFee } = get()
        return getTotal() + getShippingFee()
      },

      getTotalPointsEarned: () => {
        const { items } = get()
        const orderItems = items.map(item => ({
          amount: item.price * item.quantity,
          pointsRate: item.points_rate || 1.00
        }))
        return calculateOrderPoints(orderItems)
      },

      loadCartFromDatabase: async () => {
        const { userId, isLoading } = get()
        if (!userId) {
          console.log('🛒 Skipping cart load - no userId')
          return
        }

        if (isLoading) {
          console.log('🛒 Cart is already loading, skipping duplicate request')
          return
        }

        console.log('🛒 Loading cart from database for user:', userId)
        set({ isLoading: true })
        try {
          const cartItems = await cartQueries.getCartItems(userId)
          console.log('🛒 Retrieved cart items from database:', {
            count: cartItems.length,
            items: cartItems.map(item => ({
              product_id: item.product_id,
              quantity: item.quantity,
              variant_id: item.variant_id
            }))
          })

          const items: CartItem[] = cartItems.map((item) => ({
            id: item.product_id,
            name: item.product?.name_en || 'Unknown Product',
            price: item.product?.price || 0,
            originalPrice: item.product?.compare_at_price || undefined,
            quantity: item.quantity,
            image: item.product?.images?.[0] || '/placeholder-product.jpg',
            variant: normalizeVariant(item.variant_id),
            sku: item.product?.sku || undefined,
            stockQuantity: item.product?.stock_quantity || undefined
          }))

          // Apply deduplication when loading from database
          const deduplicatedItems = deduplicateCartItems(items)
          set({ items: deduplicatedItems })
          console.log('✅ Cart loaded successfully:', {
            itemCount: deduplicatedItems.length,
            totalQuantity: deduplicatedItems.reduce((sum, item) => sum + item.quantity, 0)
          })
        } catch (error) {
          console.error('❌ Failed to load cart from database:', error)
          // Don't retry automatically to prevent infinite loops
          set({ items: [] })
        } finally {
          set({ isLoading: false })
        }
      },

      syncWithDatabase: async () => {
        const { userId, items } = get()
        if (!userId) {
          console.log('🛒 Skipping sync - no user ID')
          return
        }

        console.log('🛒 Syncing cart with database:', {
          userId,
          itemCount: items.length,
          items: items.map(item => ({ id: item.id, quantity: item.quantity, variant: item.variant }))
        })

        try {
          // Clear existing cart in database
          await cartQueries.clearCart(userId)
          console.log('🛒 Cleared existing cart in database')

          // Add all current items to database
          for (const item of items) {
            await cartQueries.addToCart({
              user_id: userId,
              product_id: item.id,
              variant_id: item.variant || null,
              quantity: item.quantity
            })
          }
          console.log('✅ Cart synced successfully to database')
        } catch (error) {
          console.error('❌ Failed to sync cart with database:', error)
          throw error // Re-throw to allow caller to handle
        }
      },

      // Stock validation functions
      validateStock: (id, requestedQuantity, currentStock) => {
        if (currentStock === undefined) {
          return { isValid: true, message: '' }
        }

        if (currentStock <= 0) {
          return {
            isValid: false,
            message: 'This item is currently out of stock'
          }
        }

        if (requestedQuantity > currentStock) {
          const message = currentStock === 1
            ? 'You can only buy 1 of this item'
            : `You can only buy up to ${currentStock} of this item`

          return {
            isValid: false,
            message
          }
        }

        return { isValid: true, message: '' }
      },

      getStockMessage: (stockQuantity) => {
        return getStockValidationMessage(stockQuantity)
      },

      // Points redemption functions
      setPointsToRedeem: (points) => {
        set({ pointsToRedeem: points })
      },

      getPointsDiscount: () => {
        const { pointsToRedeem } = get()
        return pointsToDollars(pointsToRedeem)
      },

      getFinalTotalWithPoints: () => {
        const { getFinalTotal, getPointsDiscount } = get()
        const finalTotal = getFinalTotal()
        const pointsDiscount = getPointsDiscount()
        return Math.max(0, finalTotal - pointsDiscount)
      },

      validatePointsRedemption: (points, userPointsBalance) => {
        // Minimum redemption: 500 points
        if (points < 500) {
          return {
            isValid: false,
            message: 'Minimum redemption is 500 points'
          }
        }

        // Must be in increments of 10
        if (points % 10 !== 0) {
          return {
            isValid: false,
            message: 'Points must be redeemed in increments of 10'
          }
        }

        // Cannot redeem more than user has
        if (points > userPointsBalance) {
          return {
            isValid: false,
            message: 'You cannot redeem more points than you have'
          }
        }

        // Cannot redeem more than the order total (in points equivalent)
        const { getFinalTotal } = get()
        const finalTotal = getFinalTotal()
        const maxRedeemablePoints = Math.floor(finalTotal * 1000) // Convert dollars to points (1000 points = $1)

        if (points > maxRedeemablePoints) {
          return {
            isValid: false,
            message: `You can only redeem up to ${maxRedeemablePoints} points for this order`
          }
        }

        return { isValid: true, message: '' }
      },

      clearPointsRedemption: () => {
        set({ pointsToRedeem: 0 })
      },
    }),
    {
      name: 'foryoupiece-cart',
      onRehydrateStorage: () => (state) => {
        // Deduplicate items when loading from localStorage
        if (state?.items) {
          const deduplicatedItems = deduplicateCartItems(state.items)
          state.items = deduplicatedItems
        }
      },
    }
  )
)
