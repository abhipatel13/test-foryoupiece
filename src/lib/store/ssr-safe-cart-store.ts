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
    addItem: () => {},
    removeItem: () => {},
    updateQuantity: () => {},
    clearCart: () => {},
    getItemCount: () => 0,
    getTotalPrice: () => 0,
    getItemById: () => undefined,
    setUserId: () => {},
    forceLoadCartForUser: () => {},
    clearCartOnLogout: () => {},
    setHydrated: () => {}
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
            addItem: state.addItem,
            removeItem: state.removeItem,
            updateQuantity: state.updateQuantity,
            clearCart: state.clearCart,
            getItemCount: state.getItemCount,
            getTotalPrice: state.getTotalPrice,
            getItemById: state.getItemById,
            setUserId: state.setUserId,
            forceLoadCartForUser: state.forceLoadCartForUser,
            clearCartOnLogout: state.clearCartOnLogout,
            setHydrated: state.setHydrated
          })
        })

        // Set initial state
        setStoreData({
          items: data.items,
          isLoading: data.isLoading,
          isHydrated: data.isHydrated,
          userId: data.userId,
          addItem: data.addItem,
          removeItem: data.removeItem,
          updateQuantity: data.updateQuantity,
          clearCart: data.clearCart,
          getItemCount: data.getItemCount,
          getTotalPrice: data.getTotalPrice,
          getItemById: data.getItemById,
          setUserId: data.setUserId,
          forceLoadCartForUser: data.forceLoadCartForUser,
          clearCartOnLogout: data.clearCartOnLogout,
          setHydrated: data.setHydrated
        })

        return subscribe
      } catch (error) {
        console.warn('Error accessing cart store:', error)
      }
    }
  }, [isClient])

  return storeData
}
