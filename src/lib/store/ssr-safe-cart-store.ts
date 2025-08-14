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
  addItem: (item: any, stockQuantity?: number) => Promise<boolean>
  removeItem: (id: string, variant?: string) => Promise<void>
  updateQuantity: (id: string, quantity: number, variant?: string) => Promise<boolean>
  clearCart: () => void
  getItemCount: () => number
  getTotal: () => number
  getTotalQuantity: () => number
  getShippingFee: () => number
  getTotalSavings: () => number
  getFinalTotal: () => number
  getTotalPointsEarned: () => number
  setUserId: (id: string, forceReload?: boolean) => void
  forceLoadCartForUser: (userId: string) => Promise<void>
  clearCartOnLogout: () => Promise<void>
  setHydrated: (hydrated: boolean) => void
  // Points
  setPointsToRedeem: (points: number) => void
  getPointsDiscount: () => number
  getFinalTotalWithPoints: () => number
  validatePointsRedemption: (points: number, userPointsBalance: number) => { isValid: boolean; message: string }
  clearPointsRedemption: () => void
  // Coupons
  applyCoupon: (coupon: any) => void
  removeCoupon: () => void
  getCouponDiscount: () => number
  getFinalTotalWithCouponAndPoints: () => number
  // Stock validation
  validateStock: (id: string, requestedQuantity: number, currentStock?: number) => { isValid: boolean; message: string }
  getStockMessage: (stockQuantity: number) => string
  validateCartStock: () => Promise<{ success: boolean; hasIssues: boolean; canCheckout: boolean }>
  refreshStockStatus: () => Promise<void>
  isStockValidationNeeded: () => boolean
  // Shipping
  calculateShipping: () => Promise<void>
  getShippingMessage: () => string
  getShippingCalculation: () => any
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
  addItem: async () => false,
  removeItem: async () => {},
  updateQuantity: async () => false,
  clearCart: () => {},
  getItemCount: () => 0,
  getTotal: () => 0,
  getTotalQuantity: () => 0,
  getShippingFee: () => 0,
  getTotalSavings: () => 0,
  getFinalTotal: () => 0,
  getTotalPointsEarned: () => 0,
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
  calculateShipping: async () => {},
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


