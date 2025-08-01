'use client'

import { useEffect, useState } from 'react'
import { useIsClient } from '@/lib/hooks/use-ssr-safe-store'
import { SSRErrorBoundary } from '@/components/error-boundary/ssr-error-boundary'
import dynamic from 'next/dynamic'

// Dynamically import Header to avoid SSR issues
const Header = dynamic(
  () => import('./header').then((mod) => ({ default: mod.Header })),
  {
    ssr: false,
    loading: () => (
      <div className="h-16 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="h-8 w-32 bg-gray-200 animate-pulse rounded"></div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="h-8 w-8 bg-gray-200 animate-pulse rounded"></div>
              <div className="h-8 w-8 bg-gray-200 animate-pulse rounded"></div>
              <div className="h-8 w-8 bg-gray-200 animate-pulse rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }
)

/**
 * SSR-safe wrapper for the Header component
 * Prevents hydration mismatches by only rendering the Header on the client side
 */
export function SSRSafeHeader() {
  const isClient = useIsClient()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Don't render anything during SSR
  if (!isClient || !mounted) {
    return (
      <div className="h-16 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="h-8 w-32 bg-gray-200 animate-pulse rounded"></div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="h-8 w-8 bg-gray-200 animate-pulse rounded"></div>
              <div className="h-8 w-8 bg-gray-200 animate-pulse rounded"></div>
              <div className="h-8 w-8 bg-gray-200 animate-pulse rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <SSRErrorBoundary>
      <Header />
    </SSRErrorBoundary>
  )
}
