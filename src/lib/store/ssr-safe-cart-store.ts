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
  // Points
  setPointsToRedeem: () => {},
  getPointsDiscount: () => 0,
  getFinalTotalWithPoints: () => 0,
  clearPointsRedemption: () => {},
  validatePointsRedemption: () => ({ isValid: false, message: 'Cart not available during SSR' }),
  // Coupons
  applyCoupon: async () => ({ success: false, message: 'Cart not available during SSR' }),
  removeCoupon: () => {},
  getCouponDiscount: () => 0,
  getFinalTotalWithCouponAndPoints: () => 0,
  // Stock validation
  validateStock: () => ({ isValid: true, message: '' }),
  getStockMessage: () => '',
  validateCartStock: async () => ({ isValid: true, invalidItems: [] }),
  refreshStockStatus: async () => {},
  isStockValidationNeeded: () => false,
  // Shipping
  calculateShipping: async () => {},
  getShippingMessage: () => '',
  getShippingCalculation: () => null
})


// Build a proxy that forwards method calls to the real store even before hydration
function createProxyCartStore(isHydrated: boolean): CartStoreInterface {
  const safeGet = () => {
    try { return (useCartStore as any)?.getState?.() } catch { return null }
  }
  const s = safeGet()

  return {
    // Expose the latest state if available; otherwise sensible defaults
    items: s?.items ?? [],
    isLoading: s?.isLoading ?? false,
    isInitialized: isHydrated,
    isHydrated,
    userId: s?.userId ?? null,
    pointsToRedeem: s?.pointsToRedeem ?? 0,
    appliedCoupon: s?.appliedCoupon ?? null,
    shippingCalculation: s?.shippingCalculation ?? null,

    // Forwarders (never no-op on client)
    addItem: async (...args: any[]) => (safeGet()?.addItem?.(...args)) ?? false,
    removeItem: async (...args: any[]) => { await safeGet()?.removeItem?.(...args) },
    updateQuantity: async (...args: any[]) => (safeGet()?.updateQuantity?.(...args)) ?? false,
    clearCart: () => { safeGet()?.clearCart?.() },

    getItemCount: () => safeGet()?.getItemCount?.() ?? (s?.items?.length ?? 0),
    getTotal: () => safeGet()?.getTotal?.() ?? 0,
    getTotalQuantity: () => safeGet()?.getTotalQuantity?.() ?? (s?.items?.reduce?.((sum: number, i: any) => sum + (i.quantity || 0), 0) ?? 0),
    getShippingFee: () => safeGet()?.getShippingFee?.() ?? 0,
    getTotalSavings: () => safeGet()?.getTotalSavings?.() ?? 0,
    getFinalTotal: () => safeGet()?.getFinalTotal?.() ?? 0,
    getTotalPointsEarned: () => safeGet()?.getTotalPointsEarned?.() ?? 0,

    setUserId: (id: string, forceReload?: boolean) => { safeGet()?.setUserId?.(id, forceReload) },
    forceLoadCartForUser: async (userId: string) => { await safeGet()?.forceLoadCartForUser?.(userId) },
    clearCartOnLogout: async () => { await safeGet()?.clearCartOnLogout?.() },
    setHydrated: (hydrated: boolean) => { safeGet()?.setHydrated?.(hydrated) },

    // Points
    setPointsToRedeem: (points: number) => { safeGet()?.setPointsToRedeem?.(points) },
    getPointsDiscount: () => safeGet()?.getPointsDiscount?.() ?? 0,
    getFinalTotalWithPoints: () => safeGet()?.getFinalTotalWithPoints?.() ?? 0,
    validatePointsRedemption: (points: number, userPointsBalance: number) => safeGet()?.validatePointsRedemption?.(points, userPointsBalance) ?? ({ isValid: false, message: '' }),
    clearPointsRedemption: () => { safeGet()?.clearPointsRedemption?.() },

    // Coupons
    applyCoupon: (coupon: any) => { safeGet()?.applyCoupon?.(coupon) },
    removeCoupon: () => { safeGet()?.removeCoupon?.() },
    getCouponDiscount: () => safeGet()?.getCouponDiscount?.() ?? 0,
    getFinalTotalWithCouponAndPoints: () => safeGet()?.getFinalTotalWithCouponAndPoints?.() ?? 0,

    // Stock validation
    validateStock: (id: string, requestedQuantity: number, currentStock?: number) => safeGet()?.validateStock?.(id, requestedQuantity, currentStock) ?? ({ isValid: true, message: '' }),
    getStockMessage: (stockQuantity: number) => safeGet()?.getStockMessage?.(stockQuantity) ?? '',
    validateCartStock: async () => (safeGet()?.validateCartStock?.()) ?? ({ success: true, hasIssues: false, canCheckout: true }),
    refreshStockStatus: async () => { await safeGet()?.refreshStockStatus?.() },
    isStockValidationNeeded: () => safeGet()?.isStockValidationNeeded?.() ?? false,

    // Shipping
    calculateShipping: async () => { await safeGet()?.calculateShipping?.() },
    getShippingMessage: () => safeGet()?.getShippingMessage?.() ?? '',
    getShippingCalculation: () => safeGet()?.getShippingCalculation?.() ?? null,
  }
}

/**
 * SSR-safe wrapper for the cart store
 * - On server: returns default read-only implementation
 * - On client before hydration: returns a proxy that forwards method calls so nothing is lost
 * - After hydration: returns the real store with isInitialized=true
 */
export function useSSRSafeCartStore(): CartStoreInterface {
  if (!isBrowser) {
    return createDefaultCartStore()
  }

  const [hydrated, setHydrated] = useState(false)
  // Access the store to subscribe components post-hydration
  const actualCartStore = useCartStore()

  // Mark hydration and notify underlying store
  useEffect(() => {
    setHydrated(true)
    try { useCartStore.getState().setHydrated?.(true) } catch {}
  }, [])

  // Before hydration, expose a proxy that forwards method calls
  if (!hydrated) {
    return createProxyCartStore(false)
  }

  // After hydration, return the real store with explicit flags
  return {
    ...actualCartStore,
    isInitialized: true,
    isHydrated: true,
  } as unknown as CartStoreInterface
}


