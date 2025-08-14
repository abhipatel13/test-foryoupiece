'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { cartQueries } from '@/lib/supabase/queries'
import { pointsToDollars, calculateOrderPoints } from '@/lib/utils'
import { AppliedCoupon } from '@/types/coupon'
import { shippingService, type ShippingCalculationResult } from '@/lib/services/shipping-service'

import { tabSyncUtils } from '@/lib/utils/multi-tab-sync'

// Helper function to track cart behavior
const trackCartBehavior = async (
  behaviorType: 'cart_add' | 'cart_remove',
  userId: string | null,
  productId: string,
  metadata?: Record<string, any>
) => {
  if (!userId) return // Only track for authenticated users

  try {
    await fetch('/api/behavior/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        behaviorType,
        productId,
        sessionId: `session_${userId}_${Date.now()}`,
        metadata
      })
    })
  } catch (error) {
    console.error('Failed to track cart behavior:', error)
  }
}

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
  stockStatus?: 'in_stock' | 'low_stock' | 'out_of_stock' | 'insufficient_stock' // Real-time stock status
  stockMessage?: string // Human-readable stock message
  lastStockCheck?: string // Timestamp of last stock validation
}

type CartStore = {
  items: CartItem[]
  isLoading: boolean
  isHydrated: boolean
  userId: string | null
  pointsToRedeem: number
  appliedCoupon: AppliedCoupon | null
  shippingCalculation: ShippingCalculationResult | null
  addItem: (item: CartItem, stockQuantity?: number) => Promise<boolean>
  removeItem: (id: string, variant?: string) => Promise<void>
  updateQuantity: (id: string, quantity: number, variant?: string) => Promise<boolean>
  clearCart: () => void
  clearCartOnLogout: () => Promise<void>
  getTotal: () => number
  getItemCount: () => number
  getTotalQuantity: () => number
  getShippingFee: () => number
  getTotalSavings: () => number
  getFinalTotal: () => number
  getTotalPointsEarned: () => number
  setUserId: (userId: string | null, forceReload?: boolean) => void
  forceLoadCartForUser: (userId: string) => Promise<void>
  setItems: (items: CartItem[]) => void
  deduplicateItems: () => void
  syncWithDatabase: () => Promise<void>
  loadCartFromDatabase: () => Promise<void>
  setHydrated: (hydrated: boolean) => void
  validateStock: (id: string, requestedQuantity: number, currentStock?: number) => { isValid: boolean; message: string }
  getStockMessage: (stockQuantity: number) => string
  cleanupInvalidQuantities: () => Promise<void>
  // Real-time stock validation functions
  validateCartStock: () => Promise<{ success: boolean; hasIssues: boolean; canCheckout: boolean }>
  refreshStockStatus: () => Promise<void>
  isStockValidationNeeded: () => boolean
  // Points redemption functions
  setPointsToRedeem: (points: number) => void
  getPointsDiscount: () => number
  getFinalTotalWithPoints: () => number
  validatePointsRedemption: (points: number, userPointsBalance: number) => { isValid: boolean; message: string }
  clearPointsRedemption: () => void
  // Coupon functions
  applyCoupon: (coupon: AppliedCoupon) => void
  removeCoupon: () => void
  getCouponDiscount: () => number
  getFinalTotalWithCouponAndPoints: () => number
  // Enhanced shipping functions
  calculateShipping: () => Promise<void>
  getShippingMessage: () => string
  getShippingCalculation: () => ShippingCalculationResult | null
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
      isHydrated: false,
      userId: null,
      pointsToRedeem: 0,
      shippingCalculation: null,
      appliedCoupon: null,

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
            console.log('👤 User changed, clearing localStorage and loading from database')
            // Clear localStorage to prevent cross-browser conflicts
            try {
              localStorage.removeItem('foryoupiece-cart')
              console.log('🧹 Cleared cart localStorage for user change')
            } catch (error) {
              console.warn('Failed to clear cart localStorage:', error)
            }
          } else if (forceReload) {
            console.log('👤 Same user but forcing cart reload from database')
          }

          // Don't clear items immediately - keep them until database load completes
          // This prevents the cart count from showing 0 temporarily
          get().loadCartFromDatabase()
          // Recalculate shipping for the new user
          get().calculateShipping()
        } else if (!userId && currentUserId) {
          // User logged out - clear all cart data immediately
          console.log('🚪 User logged out, clearing all cart data')
          set({
            items: [],
            userId: null,
            pointsToRedeem: 0,
            appliedCoupon: null,
            shippingCalculation: null,
            isLoading: false,
            isHydrated: true
          })
          // Clear localStorage immediately on logout
          try {
            localStorage.removeItem('foryoupiece-cart')
            console.log('🧹 Cleared cart localStorage on logout')
          } catch (error) {
            console.warn('Failed to clear cart localStorage on logout:', error)
          }
          // Inform other tabs/UI about cart state reset
          try {
            tabSyncUtils.broadcastCartCleared()
          } catch (e) {
            console.warn('Failed to broadcast CART_CLEARED:', e)
          }
        }
      },

      // Force cart loading for authenticated user (used during authentication)
      forceLoadCartForUser: async (userId: string) => {
        try {
          console.log('🛒 Force loading cart for authenticated user:', { userId })
          await get().loadCartFromDatabase();
        } catch (e) {
          console.warn('⚠️ forceLoadCartForUser failed to load from DB, falling back to setUserId force reload', e)
          get().setUserId(userId, true)
        }
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

        // DEBUG: Log the values being used for stock validation
        console.log('🛒 Cart addItem debug:', {
          itemId: item.id,
          itemName: item.name,
          requestedQuantity: item.quantity,
          currentCartQuantity,
          totalRequestedQuantity,
          stockQuantity,
          existingItemIndex
        })

        // Validate stock if stockQuantity is provided
        if (stockQuantity !== undefined) {
          const validation = get().validateStock(item.id, totalRequestedQuantity, stockQuantity)
          console.log('🛒 Stock validation result:', {
            isValid: validation.isValid,
            message: validation.message,
            totalRequestedQuantity,
            stockQuantity
          })
          if (!validation.isValid) {
            console.warn('Stock validation failed:', validation.message)
            // Show the validation message to the user
            if (typeof window !== 'undefined' && window.toast) {
              window.toast.error(validation.message)
            }
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

            // Track cart add behavior
            await trackCartBehavior('cart_add', userId, item.id, {
              quantity: item.quantity,
              price: item.price,
              name: item.name,
              variant: item.variant,
              source: 'cart_store'
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

        // Find the item being removed for tracking
        const itemToRemove = items.find(
          (item) => item.id === id && normalizeVariant(item.variant) === normalizeVariant(variant)
        )

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
            // Get fresh cart items from database
            const cartItems = await cartQueries.getCartItems(userId)
            const dbItemToRemove = cartItems.find(
              (item) => item.product_id === id &&
                       (item.variant_id === variant ||
                        (item.variant_id === null && variant === undefined) ||
                        (item.variant_id === null && variant === null))
            )

            if (dbItemToRemove) {
              console.log('Removing item from database:', dbItemToRemove.id)
              await cartQueries.removeFromCart(dbItemToRemove.id)
              console.log('Successfully removed item from database')

              // Track cart remove behavior
              if (itemToRemove) {
                await trackCartBehavior('cart_remove', userId, id, {
                  quantity: itemToRemove.quantity,
                  price: itemToRemove.price,
                  name: itemToRemove.name,
                  variant: itemToRemove.variant,
                  source: 'cart_store'
                })
              }
            } else {
              console.warn('Item not found in database for removal:', { id, variant })
            }
          } catch (error) {
            console.error('Failed to remove item from database:', error)
            // Revert the local state change if database operation failed
            set({ items })
            throw error
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
        console.log('🧹 Clearing cart completely')
        set({
          items: [],
          pointsToRedeem: 0,
          appliedCoupon: null,
          shippingCalculation: null,
          isLoading: false
        })

        // Clear localStorage to prevent conflicts
        try {
          localStorage.removeItem('foryoupiece-cart')
          console.log('🧹 Cleared cart localStorage')
        } catch (error) {
          console.warn('Failed to clear cart localStorage:', error)
        }

        // Clear database cart if user is logged in
        if (userId) {
          try {
            await cartQueries.clearCart(userId)
            console.log('🧹 Cleared cart in database')
          } catch (error) {
            console.error('Failed to clear cart in database:', error)
          }
        }
      },

      clearCartOnLogout: async () => {
        const { userId, items } = get()
        console.log('🧹 Starting cart logout cleanup:', {
          userId,
          itemCount: items.length
        })

        // Save current cart to database before clearing local state
        if (userId && items.length > 0) {
          try {
            await get().syncWithDatabase()
            console.log('✅ Cart saved to database successfully before logout')
          } catch (error) {
            console.error('❌ Failed to save cart to database on logout:', error)
          }
        }

        // Clear all cart state completely
        console.log('🧹 Clearing all cart state on logout')
        set({
          items: [],
          userId: null,
          pointsToRedeem: 0,
          appliedCoupon: null,
          shippingCalculation: null,
          isLoading: false,
          isHydrated: true
        })

        // Clear localStorage to prevent cross-browser conflicts
        try {
          localStorage.removeItem('foryoupiece-cart')
          console.log('🧹 Cleared cart localStorage on logout')
        } catch (error) {
          console.warn('Failed to clear cart localStorage on logout:', error)
        }

        // Notify other tabs/UI explicitly
        try {
          tabSyncUtils.broadcastCartCleared()
        } catch (e) {
          console.warn('Failed to broadcast CART_CLEARED:', e)
        }
      },

      setHydrated: (hydrated: boolean) => {
        console.log('🔄 Cart store: Setting hydrated state:', hydrated)
        set({ isHydrated: hydrated })
      },

      getTotal: () => {
        const { items } = get()
        return items.reduce((total, item) => total + item.price * item.quantity, 0)
      },

      getItemCount: () => {
        const { items } = get()
        return items.length
      },

      getTotalQuantity: () => {
        const { items } = get()
        return items.reduce((count, item) => count + item.quantity, 0)
      },

      getShippingFee: () => {
        const { shippingCalculation, items } = get()

        // Use enhanced shipping calculation if available
        if (shippingCalculation) {
          return shippingCalculation.shippingFee
        }

        // Fallback to basic quantity-based calculation
        const totalQuantity = get().getTotalQuantity()
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
          set({ isLoading: false }) // Ensure loading state is cleared
          return
        }

        if (isLoading) {
          console.log('🛒 Cart is already loading, skipping duplicate request')
          return
        }

        console.log('🛒 Loading cart from database for user:', userId)
        set({ isLoading: true })
        // Reduced timeout to prevent stuck loading state (5 seconds instead of 15)
        const loadTimeout = setTimeout(() => {
          console.warn('⏰ Cart load timeout - forcing isLoading=false')
          set({ isLoading: false })
        }, 5000)
        try {
          // Clear localStorage before loading from database to ensure consistency
          try {
            localStorage.removeItem('foryoupiece-cart')
            console.log('🧹 Cleared cart localStorage before database load')
          } catch (error) {
            console.warn('Failed to clear cart localStorage:', error)
          }

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
            stockQuantity: item.product?.stock_quantity || undefined,
            points_rate: item.product?.points_rate || 1.00
          }))

          // Apply deduplication when loading from database
          const deduplicatedItems = deduplicateCartItems(items)

          // Update items atomically to prevent flickering
          set({ items: deduplicatedItems, isLoading: false })

          console.log('✅ Cart loaded successfully:', {
            itemCount: deduplicatedItems.length,
            totalQuantity: deduplicatedItems.reduce((sum, item) => sum + item.quantity, 0)
          })

          // Clean up any invalid quantities after loading
          await get().cleanupInvalidQuantities()
        } catch (error) {
          console.error('❌ Failed to load cart from database:', error)
          console.error('❌ Cart loading error details:', {
            message: error.message,
            stack: error.stack,
            userId
          })

          // Only clear items if there was an error and we don't have any local items
          const currentItems = get().items
          if (currentItems.length === 0) {
            set({ items: [] })
          }

          // Always clear loading state on error
          set({ isLoading: false })
        } finally {
          // Ensure loading state is always cleared
          try { clearTimeout(loadTimeout) } catch {}
          set({ isLoading: false })
        }
      },

      syncWithDatabase: async () => {
        const { userId, items, isLoading } = get()
        if (!userId) {
          console.log('🛒 Skipping sync - no user ID')
          return
        }

        // Prevent concurrent sync operations
        if (isLoading) {
          console.log('🛒 Sync already in progress, skipping')
          return
        }

        console.log('🛒 Syncing cart with database:', {
          userId,
          itemCount: items.length,
          items: items.map(item => ({ id: item.id, quantity: item.quantity, variant: item.variant }))
        })

        set({ isLoading: true })
        // Defensive timeout to prevent stuck loading state
        const syncTimeout = setTimeout(() => {
          console.warn('⏰ Cart sync timeout - forcing isLoading=false')
          set({ isLoading: false })
        }, 15000)
        try {
          // Clear existing cart in database
          await cartQueries.clearCart(userId)
          console.log('🛒 Cleared existing cart in database')

          // Add all current items to database in a single transaction-like operation
          const addPromises = items.map(item =>
            cartQueries.addToCart({
              user_id: userId,
              product_id: item.id,
              variant_id: item.variant || null,
              quantity: item.quantity
            })
          )

          await Promise.all(addPromises)
          console.log('✅ Cart synced successfully to database')
        } catch (error) {
          console.error('❌ Failed to sync cart with database:', error)
          throw error // Re-throw to allow caller to handle
        } finally {
          try { clearTimeout(syncTimeout) } catch {}
          set({ isLoading: false })
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

      cleanupInvalidQuantities: async () => {
        const { items, userId } = get()
        let hasChanges = false

        const cleanedItems = items.map(item => {
          if (item.stockQuantity !== undefined && item.quantity > item.stockQuantity) {
            console.warn(`Cleaning up cart item ${item.name}: reducing quantity from ${item.quantity} to ${item.stockQuantity}`)
            hasChanges = true
            return {
              ...item,
              quantity: Math.max(1, item.stockQuantity) // Ensure at least 1, or remove if stock is 0
            }
          }
          return item
        }).filter(item => item.stockQuantity === undefined || item.stockQuantity > 0) // Remove items with 0 stock

        if (hasChanges) {
          set({ items: cleanedItems })

          // Sync with database if user is logged in
          if (userId) {
            try {
              // Clear and re-add all items to ensure database consistency
              await cartQueries.clearCart(userId)
              for (const item of cleanedItems) {
                await cartQueries.addToCart({
                  user_id: userId,
                  product_id: item.id,
                  variant_id: item.variant || null,
                  quantity: item.quantity
                })
              }
              console.log('Cart cleanup completed and synced with database')
            } catch (error) {
              console.error('Failed to sync cleaned cart with database:', error)
            }
          }
        }
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

      // Coupon methods
      applyCoupon: (coupon: AppliedCoupon) => {
        set({ appliedCoupon: coupon })
        // Recalculate shipping when coupon is applied
        get().calculateShipping()
      },

      removeCoupon: () => {
        set({ appliedCoupon: null })
        // Recalculate shipping when coupon is removed
        get().calculateShipping()
      },

      getCouponDiscount: () => {
        const { appliedCoupon } = get()
        return appliedCoupon?.discountAmount || 0
      },

      getFinalTotalWithCouponAndPoints: () => {
        const { getFinalTotal, getPointsDiscount, getCouponDiscount } = get()
        const total = getFinalTotal()
        const pointsDiscount = getPointsDiscount()
        const couponDiscount = getCouponDiscount()
        return Math.max(0, total - pointsDiscount - couponDiscount)
      },

      // Enhanced shipping functions
      calculateShipping: async () => {
        const { items, userId, appliedCoupon } = get()
        const itemCount = items.reduce((count, item) => count + item.quantity, 0)

        try {
          const shippingResult = await shippingService.calculateShipping({
            itemCount,
            userId: userId || undefined,
            appliedCouponCode: appliedCoupon?.code
          })

          set({ shippingCalculation: shippingResult })
        } catch (error) {
          console.error('Error calculating shipping:', error)
          // Fallback to basic calculation
          set({
            shippingCalculation: {
              shippingFee: itemCount >= 4 ? 0 : 1.50,
              isFreeShipping: itemCount >= 4,
              freeShippingReason: itemCount >= 4 ? 'quantity' : 'none'
            }
          })
        }
      },

      getShippingMessage: () => {
        const { shippingCalculation } = get()
        return shippingCalculation?.message || 'Standard shipping'
      },

      getShippingCalculation: () => {
        const { shippingCalculation } = get()
        return shippingCalculation
      },

      // Real-time stock validation functions
      validateCartStock: async () => {
        const { items } = get()

        if (items.length === 0) {
          return { success: true, hasIssues: false, canCheckout: true }
        }

        try {
          const validationItems = items.map(item => ({
            id: item.id,
            variant: item.variant,
            quantity: item.quantity
          }))

          const response = await fetch('/api/cart/validate-stock', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ items: validationItems })
          })

          if (!response.ok) {
            throw new Error('Failed to validate stock')
          }

          const data = await response.json()

          if (data.success) {
            // Update cart items with current stock information
            const updatedItems = items.map(item => {
              const validation = data.results.find((r: any) =>
                r.id === item.id && r.variant === item.variant
              )

              if (validation) {
                return {
                  ...item,
                  stockQuantity: validation.currentStock,
                  stockStatus: validation.status,
                  stockMessage: validation.message,
                  lastStockCheck: new Date().toISOString()
                }
              }

              return item
            })

            set({ items: updatedItems })

            return {
              success: true,
              hasIssues: data.hasOutOfStock || data.hasInsufficientStock,
              canCheckout: data.canProceedToCheckout
            }
          } else {
            console.error('Stock validation failed:', data.message)
            return { success: false, hasIssues: true, canCheckout: false }
          }
        } catch (error) {
          console.error('Error validating cart stock:', error)
          return { success: false, hasIssues: true, canCheckout: false }
        }
      },

      refreshStockStatus: async () => {
        const { validateCartStock } = get()
        await validateCartStock()
      },

      isStockValidationNeeded: () => {
        const { items } = get()
        const now = new Date()
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)

        return items.some(item => {
          if (!item.lastStockCheck) return true
          const lastCheck = new Date(item.lastStockCheck)
          return lastCheck < fiveMinutesAgo
        })
      }
    }),
    {
      name: 'foryoupiece-cart',
      version: 2, // Increment version to fix duplicate issue
      migrate: (persistedState: any, version: number) => {
        // Handle migration from older versions
        if (version < 2) {
          console.log('🔄 Migrating cart store to version 2, clearing old data')
          // Reset state for version migration to prevent conflicts
          return {
            items: [],
            isLoading: false,
            pointsToRedeem: 0,
            appliedCoupon: null,
            shippingCalculation: null,
            userId: null,
            isHydrated: false,
          }
        }
        return persistedState
      },
      onRehydrateStorage: () => (state) => {
        try {
          // Deduplicate items when loading from localStorage
          if (state?.items && Array.isArray(state.items)) {
            const deduplicatedItems = deduplicateCartItems(state.items)
            state.items = deduplicatedItems
          } else {
            // Reset to empty array if items is not valid
            if (state) {
              state.items = []
            }
          }
          // Reset loading state on hydration to prevent stuck loading states
          if (state) {
            state.isLoading = false
            state.isHydrated = true // Mark as hydrated after successful rehydration
            // Ensure other states have safe defaults
            if (!state.pointsToRedeem) {
              state.pointsToRedeem = 0
            }
            if (!state.appliedCoupon) {
              state.appliedCoupon = null
            }
            if (!state.shippingCalculation) {
              state.shippingCalculation = null
            }
          }
        } catch (error) {
          console.warn('Cart store hydration error:', error)
          // Reset to safe defaults on hydration error
          if (state) {
            state.items = []
            state.isLoading = false
            state.isHydrated = true // Still mark as hydrated even on error
            state.pointsToRedeem = 0
            state.appliedCoupon = null
            state.shippingCalculation = null
            // Keep userId if it exists
          }
        }
      },
      // Add better error handling for production environments
      partialize: (state) => ({
        // Only persist minimal data to reduce cross-browser conflicts
        // For authenticated users, cart data should come from database
        userId: state.userId,
        // Don't persist items for authenticated users - they come from database
        items: state.userId ? [] : state.items,
        // Don't persist user-specific data that should come from database
        pointsToRedeem: state.userId ? 0 : state.pointsToRedeem,
        appliedCoupon: state.userId ? null : state.appliedCoupon,
        // Don't persist shippingCalculation as it should be recalculated
        // Don't persist loading state
      }),
    }
  )
)
