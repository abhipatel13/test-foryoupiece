'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface GoogleLoginProps {
  className?: string
  children?: React.ReactNode
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  onSuccess?: () => void
  onError?: (error: Error) => void
}

export function GoogleLogin({
  className = '',
  children,
  variant = 'outline',
  size = 'default',
  onSuccess,
  onError
}: GoogleLoginProps) {
  const [loading, setLoading] = useState(false)
  const { signInWithGoogle } = useAuth()

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true)
      await signInWithGoogle()
      
      if (onSuccess) {
        onSuccess()
      }
      
      // Note: The actual success toast will be shown after redirect
      // since OAuth redirects to a callback URL
    } catch (error: any) {
      console.error('Google sign-in error:', error)
      const errorMessage = error.message || 'Failed to sign in with Google'
      toast.error(errorMessage)
      
      if (onError) {
        onError(error)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleGoogleSignIn}
      disabled={loading}
      variant={variant}
      size={size}
      className={`${className} ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      type="button"
    >
      {children || (
        <div className="flex items-center justify-center space-x-2">
          {loading ? (
            <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          )}
          <span>{loading ? 'Signing in...' : 'Continue with Google'}</span>
        </div>
      )}
    </Button>
  )
}

// Alternative compact button for smaller spaces
export function GoogleLoginCompact({
  className = '',
  onSuccess,
  onError
}: {
  className?: string
  onSuccess?: () => void
  onError?: (error: Error) => void
}) {
  const [loading, setLoading] = useState(false)
  const { signInWithGoogle } = useAuth()

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true)
      await signInWithGoogle()
      
      if (onSuccess) {
        onSuccess()
      }
    } catch (error: any) {
      console.error('Google sign-in error:', error)
      const errorMessage = error.message || 'Failed to sign in with Google'
      toast.error(errorMessage)
      
      if (onError) {
        onError(error)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleGoogleSignIn}
      disabled={loading}
      className={`
        inline-flex items-center justify-center px-4 py-2 border border-gray-300 
        rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 
        hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 
        focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      type="button"
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mr-2" />
      ) : (
        <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
      )}
      {loading ? 'Signing in...' : 'Google'}
    </button>
  )
}
