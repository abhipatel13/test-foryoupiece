'use client'

import { useEffect, useState } from 'react'

/**
 * Hook to handle client-side hydration and prevent SSR/client mismatches
 * Returns true only after the component has mounted on the client
 */
export function useHydration() {
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  return isHydrated
}
