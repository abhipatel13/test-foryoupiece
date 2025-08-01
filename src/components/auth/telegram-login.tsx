'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Send } from 'lucide-react'
import { toast } from 'sonner'

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

interface TelegramLoginProps {
  className?: string
  children?: React.ReactNode
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  onSuccess?: (user: TelegramUser) => void
  onError?: (error: Error) => void
}

export function TelegramLogin({
  className = '',
  children,
  variant = 'outline',
  size = 'default',
  onSuccess,
  onError
}: TelegramLoginProps) {
  const [loading, setLoading] = useState(false)
  const widgetRef = useRef<HTMLDivElement>(null)
  const scriptLoadedRef = useRef(false)
  const callbackNameRef = useRef<string>('')

  console.log('🔄 TelegramLogin component mounted/rendered')

  // Telegram bot configuration from environment variables
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_AUTH_BOT_USERNAME || 'Authenticationfypbot'
  const botId = process.env.NEXT_PUBLIC_TELEGRAM_AUTH_BOT_ID || '8066090295'

  const handleTelegramAuth = async (user: TelegramUser) => {
    try {
      setLoading(true)
      console.log('🔄 Telegram authentication started for user:', user.id, user.username)

      // Send the Telegram user data to our API for verification and authentication
      const response = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(user),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to authenticate with Telegram')
      }

      const result = await response.json()
      
      if (result.success) {
        toast.success('Successfully signed in with Telegram!')

        if (onSuccess) {
          onSuccess(user)
        }

        // Use the magic link returned by the API to properly authenticate the user
        if (result.redirect_url) {
          console.log('🔄 Redirecting to Supabase magic link for authentication')
          window.location.href = result.redirect_url
        } else {
          // Fallback to page reload if no redirect URL provided
          console.log('⚠️ No redirect URL provided, falling back to page reload')
          window.location.reload()
        }
      } else {
        throw new Error(result.error || 'Authentication failed')
      }
    } catch (error: any) {
      console.error('❌ Telegram auth error:', error)
      const errorMessage = error.message || 'Failed to sign in with Telegram'
      toast.error(errorMessage)
      
      if (onError) {
        onError(error)
      }
    } finally {
      setLoading(false)
    }
  }

  const loadTelegramWidget = () => {
    console.log('🔄 loadTelegramWidget called, scriptLoaded:', scriptLoadedRef.current, 'widgetRef:', !!widgetRef.current)
    if (scriptLoadedRef.current || !widgetRef.current) {
      console.log('⚠️ Skipping widget load - already loaded or no widget ref')
      return
    }

    console.log('🔄 Loading Telegram widget with bot:', botUsername, 'ID:', botId)

    // Create the Telegram Login Widget script
    const script = document.createElement('script')
    script.async = true
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', botUsername)
    script.setAttribute('data-size', size === 'lg' ? 'large' : size === 'sm' ? 'small' : 'medium')
    script.setAttribute('data-radius', '8')
    script.setAttribute('data-request-access', 'write')
    script.setAttribute('data-userpic', 'false')

    // Set up the callback function
    const callbackName = `telegramLoginCallback_${Date.now()}`
    callbackNameRef.current = callbackName
    console.log('🔄 Setting up Telegram callback:', callbackName)
    ;(window as any)[callbackName] = (user: TelegramUser) => {
      console.log('🎯 Telegram callback triggered with user:', user)
      handleTelegramAuth(user)
    }
    script.setAttribute('data-onauth', callbackName)

    // Handle script loading
    script.onload = () => {
      console.log('✅ Telegram widget script loaded successfully')
    }

    script.onerror = (error) => {
      console.error('❌ Failed to load Telegram widget script:', error)
      setLoading(false)
    }

    // Debug: Log all script attributes
    console.log('🔧 Telegram widget script attributes:', {
      src: script.src,
      'data-telegram-login': script.getAttribute('data-telegram-login'),
      'data-size': script.getAttribute('data-size'),
      'data-onauth': script.getAttribute('data-onauth'),
      'data-request-access': script.getAttribute('data-request-access')
    })

    // Clear any existing content and append the script
    widgetRef.current.innerHTML = ''
    widgetRef.current.appendChild(script)

    scriptLoadedRef.current = true
  }

  useEffect(() => {
    console.log('🔄 TelegramLogin useEffect called, window available:', typeof window !== 'undefined')
    // Only load the widget on the client side
    if (typeof window !== 'undefined') {
      console.log('🔄 Calling loadTelegramWidget()')
      loadTelegramWidget()
    }

    return () => {
      // Clean up the global callback function
      if (callbackNameRef.current && (window as any)[callbackNameRef.current]) {
        console.log('🧹 Cleaning up Telegram callback:', callbackNameRef.current)
        delete (window as any)[callbackNameRef.current]
      }
    }
  }, [])

  // Fallback button for when Telegram widget doesn't load or for localhost
  const handleFallbackClick = () => {
    console.log('🔄 Fallback button clicked on hostname:', window.location.hostname)
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      toast.info('Telegram Login Widget only works on public domains. Please deploy to test Telegram authentication.')
    } else {
      console.log('❌ Telegram widget failed to load on production domain')
      toast.error('Telegram Login Widget failed to load. Please try again.')
    }
  }

  return (
    <div className="relative">
      {/* Telegram Widget Container */}
      <div 
        ref={widgetRef} 
        className={`telegram-widget-container ${loading ? 'opacity-50 pointer-events-none' : ''}`}
        style={{ minHeight: '44px' }}
      />
      
      {/* Fallback Button - shown when widget doesn't load */}
      <Button
        variant={variant}
        size={size}
        className={`absolute inset-0 w-full min-h-[44px] ${className} telegram-fallback-btn`}
        onClick={handleFallbackClick}
        disabled={loading}
        style={{ display: 'none' }}
      >
        {children || (
          <>
            <Send className="h-4 w-4 mr-2" />
            Continue with Telegram
          </>
        )}
      </Button>

      {/* Custom styling to hide fallback when widget loads */}
      <style jsx>{`
        .telegram-widget-container:empty + .telegram-fallback-btn {
          display: flex !important;
        }
        
        .telegram-widget-container iframe {
          width: 100% !important;
          min-height: 44px !important;
          border-radius: 8px !important;
        }
      `}</style>
    </div>
  )
}

// Alternative compact button for smaller spaces
export function TelegramLoginCompact({
  className = '',
  onSuccess,
  onError
}: {
  className?: string
  onSuccess?: (user: TelegramUser) => void
  onError?: (error: Error) => void
}) {
  return (
    <TelegramLogin
      className={className}
      variant="outline"
      size="sm"
      onSuccess={onSuccess}
      onError={onError}
    >
      <Send className="h-4 w-4 mr-2" />
      Telegram
    </TelegramLogin>
  )
}
