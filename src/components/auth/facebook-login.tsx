'use client'

import { useState } from 'react'
import { useSSRSafeAuth } from '@/lib/hooks/use-ssr-safe-auth'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface FacebookLoginProps {
  className?: string
  children?: React.ReactNode
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  onSuccess?: () => void
  onError?: (error: Error) => void
}

export function FacebookLogin({
  className = '',
  children,
  variant = 'outline',
  size = 'default',
  onSuccess,
  onError
}: FacebookLoginProps) {
  const [loading, setLoading] = useState(false)
  const { signInWithFacebook } = useSSRSafeAuth()

  const handleFacebookSignIn = async () => {
    try {
      setLoading(true)
      await signInWithFacebook()
      
      if (onSuccess) {
        onSuccess()
      }
      
      // Note: The actual success toast will be shown after redirect
      // since OAuth redirects to a callback URL
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to sign in with Facebook'
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
      type="button"
      variant={variant}
      size={size}
      className={`${className} relative`}
      onClick={handleFacebookSignIn}
      disabled={loading}
    >
      {children || (
        <>
          <svg className="w-5 h-5 mr-3 sm:w-4 sm:h-4 sm:mr-2" viewBox="0 0 24 24">
            <path 
              fill="currentColor" 
              d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
            />
          </svg>
          {loading ? 'Signing in...' : 'Continue with Facebook'}
        </>
      )}
    </Button>
  )
}

// Alternative compact button for smaller spaces
export function FacebookLoginCompact({
  className = '',
  onSuccess,
  onError
}: {
  className?: string
  onSuccess?: () => void
  onError?: (error: Error) => void
}) {
  const [loading, setLoading] = useState(false)
  const { signInWithFacebook } = useSSRSafeAuth()

  const handleFacebookSignIn = async () => {
    try {
      setLoading(true)
      await signInWithFacebook()
      
      if (onSuccess) {
        onSuccess()
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to sign in with Facebook'
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
      type="button"
      variant="outline"
      size="sm"
      className={`${className} w-10 h-10 p-0`}
      onClick={handleFacebookSignIn}
      disabled={loading}
      title="Sign in with Facebook"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24">
        <path 
          fill="currentColor" 
          d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
        />
      </svg>
    </Button>
  )
}
