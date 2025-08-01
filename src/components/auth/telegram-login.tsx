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

  // Telegram bot configuration from environment variables
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_AUTH_BOT_USERNAME || 'Authenticationfypbot'
  const botId = process.env.NEXT_PUBLIC_TELEGRAM_AUTH_BOT_ID || '8066090295'

  const handleTelegramAuth = async (user: TelegramUser) => {
    try {
      setLoading(true)
      
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
        
        // Reload the page to update authentication state
        window.location.reload()
      } else {
        throw new Error(result.error || 'Authentication failed')
      }
    } catch (error: any) {
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
    if (scriptLoadedRef.current || !widgetRef.current) return

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
    ;(window as any)[callbackName] = handleTelegramAuth
    script.setAttribute('data-onauth', callbackName)

    // Clear any existing content and append the script
    widgetRef.current.innerHTML = ''
    widgetRef.current.appendChild(script)
    
    scriptLoadedRef.current = true
  }

  useEffect(() => {
    // Only load the widget on the client side
    if (typeof window !== 'undefined') {
      loadTelegramWidget()
    }

    return () => {
      // Cleanup callback function
      const callbackName = `telegramLoginCallback_${Date.now()}`
      if ((window as any)[callbackName]) {
        delete (window as any)[callbackName]
      }
    }
  }, [])

  // Fallback button for when Telegram widget doesn't load or for localhost
  const handleFallbackClick = () => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      toast.info('Telegram Login Widget only works on public domains. Please deploy to test Telegram authentication.')
    } else {
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
