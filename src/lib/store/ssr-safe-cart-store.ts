'use client'

import { useEffect, useState } from 'react'
import { useCartStore } from './cart-store'

// Global state change listeners for cart
const cartListeners = new Set<(state: typeof globalCartState) => void>()

/**
 * SSR-safe wrapper for the cart store
 * Returns default values during SSR and actual store values after hydration
 * Uses global singleton pattern to prevent infinite re-rendering loops
 */
export function useSSRSafeCartStore() {
  // Simple client-side detection
  const [isClient, setIsClient] = useState(false)

  // Get the actual cart store
  const cartStore = useCartStore()

  // Client-side hydration effect
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Return SSR-safe values during server-side rendering
  if (!isClient) {
    return {
      items: [],
      isLoading: true,
      isInitialized: false,
      isHydrated: false,
      userId: null,
      pointsToRedeem: 0,
      appliedCoupon: null,
      shippingCalculation: null,
      // Provide no-op functions for SSR
      addItem: async () => {},
      removeItem: () => {},
      updateQuantity: () => {},
      clearCart: () => {},
      getItemCount: () => 0,
      getTotal: () => 0,
      getTotalQuantity: () => 0,
      getTotalPrice: () => 0,
      getShippingFee: () => 0,
      getTotalSavings: () => 0,
      getFinalTotal: () => 0,
      getFinalTotalWithPoints: () => 0,
      getPointsDiscount: () => 0,
      getTotalPointsEarned: () => 0,
      getCouponDiscount: () => 0,
      getFinalTotalWithCouponAndPoints: () => 0,
      getItemById: () => null,
      setUserId: () => {},
      forceLoadCartForUser: async () => {},
      clearCartOnLogout: () => {},
      setHydrated: () => {},
      applyCoupon: async () => ({ success: false, message: '' }),
      removeCoupon: () => {},
      setPointsToRedeem: () => {},
      clearPointsRedemption: () => {},
      validatePointsRedemption: () => ({ isValid: false, message: '' }),
      validateStock: () => ({ isValid: true, message: '' }),
      getStockMessage: () => '',
      calculateShipping: () => {},
      getShippingMessage: () => '',
      getShippingCalculation: () => null,
      validateCartStock: async () => ({ isValid: true, invalidItems: [] }),
      refreshStockStatus: async () => {},
      isStockValidationNeeded: () => false
    }
  }

  // Return actual cart store values on client-side
  return {
    ...cartStore,
    isInitialized: !cartStore.isLoading
  }
}
