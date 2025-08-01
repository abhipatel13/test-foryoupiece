'use client'

import React, { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error?: Error
}

/**
 * Error boundary specifically designed for SSR-related errors
 * Catches hydration mismatches and Zustand store errors
 */
export class SSRErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if this is an SSR-related error
    const isSSRError = 
      error.message.includes('useSyncExternalStore') ||
      error.message.includes('hydration') ||
      error.message.includes('Zustand') ||
      error.message.includes('Text content does not match')

    if (isSSRError) {
      console.warn('SSR Error caught by boundary:', error.message)
    }

    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('SSR Error Boundary caught an error:', error, errorInfo)
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
      // Return custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-center p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Loading Application...
            </h2>
            <p className="text-gray-600 mb-6">
              Please wait while we initialize the application.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Hook version of the error boundary for functional components
 */
export function useSSRErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null)

  React.useEffect(() => {
    if (error) {
      throw error
    }
  }, [error])

  const handleError = React.useCallback((error: Error) => {
    console.error('SSR Error handled:', error)
    setError(error)
  }, [])

  return handleError
}
