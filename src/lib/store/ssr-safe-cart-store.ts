'use client'

import { useEffect, useState } from 'react'
import { useCartStore } from './cart-store'

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined'

// Define the cart store interface for SSR safety
interface CartStoreInterface {
  items: any[]
  isLoading: boolean
  isInitialized: boolean
  isHydrated: boolean
  userId: string | null
  pointsToRedeem: number
  appliedCoupon: any
  shippingCalculation: any
  addItem: (item: any) => Promise<void>
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  getItemCount: () => number
  getTotal: () => number
  getTotalQuantity: () => number
  getTotalPrice: () => number
  getShippingFee: () => number
  getTotalSavings: () => number
  getFinalTotal: () => number
  getFinalTotalWithPoints: () => number
  getPointsDiscount: () => number
  getTotalPointsEarned: () => number
  getCouponDiscount: () => number
  getFinalTotalWithCouponAndPoints: () => number
  getItemById: (id: string) => any
  setUserId: (id: string) => void
  forceLoadCartForUser: (userId: string) => Promise<void>
  clearCartOnLogout: () => Promise<void>
  setHydrated: (hydrated: boolean) => void
  applyCoupon: (code: string) => Promise<{ success: boolean; message: string }>
  removeCoupon: () => void
  setPointsToRedeem: (points: number) => void
  clearPointsRedemption: () => void
  validatePointsRedemption: () => { isValid: boolean; message: string }
  validateStock: () => { isValid: boolean; message: string }
  getStockMessage: () => string
  calculateShipping: () => void
  getShippingMessage: () => string
  getShippingCalculation: () => any
  validateCartStock: () => Promise<{ isValid: boolean; invalidItems: any[] }>
  refreshStockStatus: () => Promise<void>
  isStockValidationNeeded: () => boolean
}

// Default SSR-safe cart store implementation
const createDefaultCartStore = (): CartStoreInterface => ({
  items: [],
  isLoading: false,
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
  clearCartOnLogout: async () => {},
  setHydrated: () => {},
  applyCoupon: async () => ({ success: false, message: 'Cart not available during SSR' }),
  removeCoupon: () => {},
  setPointsToRedeem: () => {},
  clearPointsRedemption: () => {},
  validatePointsRedemption: () => ({ isValid: false, message: 'Cart not available during SSR' }),
  validateStock: () => ({ isValid: true, message: '' }),
  getStockMessage: () => '',
  calculateShipping: () => {},
  getShippingMessage: () => '',
  getShippingCalculation: () => null,
  validateCartStock: async () => ({ isValid: true, invalidItems: [] }),
  refreshStockStatus: async () => {},
  isStockValidationNeeded: () => false
})

/**
 * SSR-safe wrapper for the cart store
 * Returns default values during SSR and actual store values after hydration
 */
export function useSSRSafeCartStore(): CartStoreInterface {
  // If we're not in a browser environment, return default implementation
  if (!isBrowser) {
    return createDefaultCartStore()
  }

  // Client-side state management
  const [isHydrated, setIsHydrated] = useState(false)

  // Use the actual cart store on client side
  const actualCartStore = useCartStore()

  // Hydration effect - only runs on client
  useEffect(() => {
    if (isBrowser) {
      setIsHydrated(true)
    }
  }, [])

  // Return default implementation until hydrated
  if (!isHydrated) {
    return createDefaultCartStore()
  }

  // Return actual cart store after hydration
  return {
    ...actualCartStore,
    isInitialized: true,
    isHydrated: true
  }
}


