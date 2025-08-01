'use client'

import { useEffect, useState } from 'react'
import { useCartStore } from './cart-store'

/**
 * SSR-safe wrapper for the cart store
 * Returns default values during SSR and actual store values after hydration
 */
export function useSSRSafeCartStore() {
  const [isClient, setIsClient] = useState(false)
  const [storeData, setStoreData] = useState({
    items: [],
    isLoading: false,
    isHydrated: false,
    userId: null as string | null,
    pointsToRedeem: 0,
    appliedCoupon: null,
    shippingCalculation: null,
    addItem: () => Promise.resolve(false),
    removeItem: () => Promise.resolve(),
    updateQuantity: () => Promise.resolve(false),
    clearCart: () => {},
    getItemCount: () => 0,
    getTotal: () => 0,
    getTotalPrice: () => 0,
    getShippingFee: () => 0,
    getTotalSavings: () => 0,
    getFinalTotal: () => 0,
    getFinalTotalWithPoints: () => 0,
    getPointsDiscount: () => 0,
    getTotalPointsEarned: () => 0,
    getCouponDiscount: () => 0,
    getFinalTotalWithCouponAndPoints: () => 0,
    getItemById: () => undefined,
    setUserId: () => {},
    forceLoadCartForUser: () => {},
    clearCartOnLogout: () => Promise.resolve(),
    setHydrated: () => {},
    applyCoupon: () => {},
    removeCoupon: () => {},
    setPointsToRedeem: () => {},
    clearPointsRedemption: () => {},
    validateStock: () => ({ isValid: true, message: '' }),
    getStockMessage: () => '',
    calculateShipping: () => Promise.resolve(),
    getShippingMessage: () => '',
    getShippingCalculation: () => null
  })

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (isClient) {
      try {
        const data = useCartStore.getState()
        const subscribe = useCartStore.subscribe((state) => {
          setStoreData({
            items: state.items,
            isLoading: state.isLoading,
            isHydrated: state.isHydrated,
            userId: state.userId,
            pointsToRedeem: state.pointsToRedeem,
            appliedCoupon: state.appliedCoupon,
            shippingCalculation: state.shippingCalculation,
            addItem: state.addItem,
            removeItem: state.removeItem,
            updateQuantity: state.updateQuantity,
            clearCart: state.clearCart,
            getItemCount: state.getItemCount,
            getTotal: state.getTotal,
            getTotalPrice: state.getTotalPrice,
            getShippingFee: state.getShippingFee,
            getTotalSavings: state.getTotalSavings,
            getFinalTotal: state.getFinalTotal,
            getFinalTotalWithPoints: state.getFinalTotalWithPoints,
            getPointsDiscount: state.getPointsDiscount,
            getTotalPointsEarned: state.getTotalPointsEarned,
            getCouponDiscount: state.getCouponDiscount,
            getFinalTotalWithCouponAndPoints: state.getFinalTotalWithCouponAndPoints,
            getItemById: state.getItemById,
            setUserId: state.setUserId,
            forceLoadCartForUser: state.forceLoadCartForUser,
            clearCartOnLogout: state.clearCartOnLogout,
            setHydrated: state.setHydrated,
            applyCoupon: state.applyCoupon,
            removeCoupon: state.removeCoupon,
            setPointsToRedeem: state.setPointsToRedeem,
            clearPointsRedemption: state.clearPointsRedemption,
            validateStock: state.validateStock,
            getStockMessage: state.getStockMessage,
            calculateShipping: state.calculateShipping,
            getShippingMessage: state.getShippingMessage,
            getShippingCalculation: state.getShippingCalculation
          })
        })

        // Set initial state
        setStoreData({
          items: data.items,
          isLoading: data.isLoading,
          isHydrated: data.isHydrated,
          userId: data.userId,
          pointsToRedeem: data.pointsToRedeem,
          appliedCoupon: data.appliedCoupon,
          shippingCalculation: data.shippingCalculation,
          addItem: data.addItem,
          removeItem: data.removeItem,
          updateQuantity: data.updateQuantity,
          clearCart: data.clearCart,
          getItemCount: data.getItemCount,
          getTotal: data.getTotal,
          getTotalPrice: data.getTotalPrice,
          getShippingFee: data.getShippingFee,
          getTotalSavings: data.getTotalSavings,
          getFinalTotal: data.getFinalTotal,
          getFinalTotalWithPoints: data.getFinalTotalWithPoints,
          getPointsDiscount: data.getPointsDiscount,
          getTotalPointsEarned: data.getTotalPointsEarned,
          getCouponDiscount: data.getCouponDiscount,
          getFinalTotalWithCouponAndPoints: data.getFinalTotalWithCouponAndPoints,
          getItemById: data.getItemById,
          setUserId: data.setUserId,
          forceLoadCartForUser: data.forceLoadCartForUser,
          clearCartOnLogout: data.clearCartOnLogout,
          setHydrated: data.setHydrated,
          applyCoupon: data.applyCoupon,
          removeCoupon: data.removeCoupon,
          setPointsToRedeem: data.setPointsToRedeem,
          clearPointsRedemption: data.clearPointsRedemption,
          validateStock: data.validateStock,
          getStockMessage: data.getStockMessage,
          calculateShipping: data.calculateShipping,
          getShippingMessage: data.getShippingMessage,
          getShippingCalculation: data.getShippingCalculation
        })

        return subscribe
      } catch (error) {
        console.warn('Error accessing cart store:', error)
      }
    }
  }, [isClient])

  return storeData
}
