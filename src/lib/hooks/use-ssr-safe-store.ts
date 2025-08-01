'use client'

import { useEffect, useState } from 'react'

/**
 * SSR-safe wrapper for Zustand stores
 * Prevents hydration mismatches by ensuring stores are only accessed on the client
 */
export function useSSRSafeStore<T, F>(
  store: (callback: (state: T) => unknown) => unknown,
  callback: (state: T) => F,
  fallback?: F
): F | undefined {
  const result = store(callback) as F
  const [data, setData] = useState<F | undefined>(fallback)

  useEffect(() => {
    setData(result)
  }, [result])

  return data
}

/**
 * Hook to check if component is mounted on client side
 * Useful for preventing SSR hydration mismatches
 */
export function useIsClient() {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  return isClient
}

/**
 * SSR-safe store hook that returns default values during SSR
 * and actual store values after hydration
 */
export function useSSRSafeStoreWithDefaults<T>(
  useStore: () => T,
  defaults: T
): T {
  const [isClient, setIsClient] = useState(false)
  const [storeData, setStoreData] = useState<T>(defaults)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (isClient) {
      try {
        const data = useStore()
        setStoreData(data)
      } catch (error) {
        console.warn('Store access error during hydration:', error)
        setStoreData(defaults)
      }
    }
  }, [isClient, useStore, defaults])

  return isClient ? storeData : defaults
}
