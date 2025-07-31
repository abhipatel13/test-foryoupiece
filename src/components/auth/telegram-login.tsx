'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

// Global flag to prevent multiple widget initializations
let globalTelegramInitialized = false
let globalCallbackName: string | null = null

interface TelegramLoginProps {
  botName: string
  onAuth?: (user: any) => void
  className?: string
  buttonSize?: 'large' | 'medium' | 'small'
  cornerRadius?: number
  requestAccess?: boolean
  usePic?: boolean
  lang?: string
  redirectTo?: string
}

declare global {
  interface Window {
    TelegramLoginWidget: {
      dataOnauth: (user: any) => void
    }
  }
}

export function TelegramLogin({
  botName,
  onAuth,
  className = '',
  buttonSize = 'large',
  cornerRadius = 10,
  requestAccess = true,
  usePic = true,
  lang = 'en',
  redirectTo
}: TelegramLoginProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isInitialized = useRef(false)
  const { signInWithTelegram } = useAuth()

  // Create stable callback references
  const stableSignInWithTelegram = useCallback(signInWithTelegram, [])
  const stableOnAuth = useCallback(onAuth || (() => {}), [onAuth])

  useEffect(() => {
    if (!botName) {
      console.error('❌ Telegram bot name is required')
      return
    }

    // Check if widget is already initialized globally
    if (globalTelegramInitialized && globalCallbackName) {
      console.log('🔒 Telegram widget already initialized globally, skipping...')
      return
    }

    // Check if container already has a widget
    if (containerRef.current && containerRef.current.children.length > 0) {
      console.log('🔒 Container already has widget, skipping...')
      return
    }

    console.log('🚀 Initializing Telegram widget with bot:', botName)

    // Create unique callback function name
    const callbackName = `telegramCallback_${Date.now()}`
    globalCallbackName = callbackName
    console.log('📝 Created callback function:', callbackName)

    // Define the callback function
    ;(window as any)[callbackName] = async (user: any) => {
      try {
        console.log('🎯 Telegram callback triggered!', { callbackName, user })

        // Verify the authentication data
        if (!user || !user.id || !user.first_name) {
          console.error('❌ Invalid Telegram authentication data:', user)
          throw new Error('Invalid Telegram authentication data')
        }

        console.log('🔄 Starting Telegram authentication for user:', {
          id: user.id,
          first_name: user.first_name,
          username: user.username
        })

        // Call the auth function - this will create session directly
        await stableSignInWithTelegram(user, redirectTo)

        // Session is now established and user will be redirected
        console.log('✅ Telegram authentication completed successfully')

        // Call onAuth callback if provided
        stableOnAuth(user)

      } catch (error: any) {
        console.error('❌ Telegram authentication error:', error)
        toast.error(error.message || 'Failed to sign in with Telegram')
      }
    }

    console.log('📦 Callback function registered on window:', callbackName)

    // Create the script element
    const script = document.createElement('script')
    script.id = `telegram-login-${botName}`
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', botName)
    script.setAttribute('data-size', buttonSize)
    script.setAttribute('data-corner-radius', cornerRadius.toString())
    script.setAttribute('data-request-access', requestAccess ? 'write' : '')
    script.setAttribute('data-userpic', usePic.toString())
    script.setAttribute('data-lang', lang)
    script.setAttribute('data-onauth', callbackName)
    script.async = true

    console.log('🔧 Script attributes set:', {
      'data-telegram-login': botName,
      'data-size': buttonSize,
      'data-onauth': callbackName
    })

    // Add error handling for script loading
    script.onerror = (error) => {
      console.error('❌ Failed to load Telegram widget script:', error)
      toast.error('Failed to load Telegram widget')
    }

    script.onload = () => {
      console.log('✅ Telegram widget script loaded successfully')
    }

    // Clear container and append script
    if (containerRef.current) {
      console.log('📍 Appending script to container')
      containerRef.current.innerHTML = ''
      containerRef.current.appendChild(script)
      // Mark as initialized globally
      globalTelegramInitialized = true
      console.log('✅ Telegram widget marked as globally initialized')
    } else {
      console.error('❌ Container ref is null')
    }

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up Telegram widget')
      // Only cleanup if this is the active callback
      if (globalCallbackName === callbackName) {
        // Remove the callback function
        if ((window as any)[callbackName]) {
          delete (window as any)[callbackName]
        }
        globalCallbackName = null
        globalTelegramInitialized = false
        console.log('🔄 Reset global Telegram initialization state')
      }

      // Remove the script if it exists and is still in the DOM
      if (script && script.parentNode) {
        try {
          script.parentNode.removeChild(script)
        } catch (error) {
          console.warn('Script already removed from DOM')
        }
      }
    }
  }, [botName, buttonSize, cornerRadius, requestAccess, usePic, lang]) // Stable dependencies only

  if (!botName) {
    return (
      <div className={`p-4 border border-red-200 rounded-lg bg-red-50 ${className}`}>
        <p className="text-red-600 text-sm">
          Telegram bot name is not configured. Please check your environment variables.
        </p>
      </div>
    )
  }

  // Add a test button for debugging
  const testCallback = () => {
    console.log('🧪 Testing callback function manually')
    const testUser = {
      id: 123456789,
      first_name: 'Test',
      last_name: 'User',
      username: 'testuser',
      auth_date: Math.floor(Date.now() / 1000),
      hash: 'test_hash'
    }

    // Find the callback function
    const callbackName = Object.keys(window).find(key => key.startsWith('telegramCallback_'))
    if (callbackName) {
      console.log('🎯 Found callback function:', callbackName)
      ;(window as any)[callbackName](testUser)
    } else {
      console.error('❌ No callback function found')
    }
  }

  return (
    <div className={`telegram-login-widget-container ${className}`}>
      <div
        ref={containerRef}
        className="telegram-login-widget"
        style={{ minHeight: '40px' }}
      />
      {process.env.NODE_ENV === 'development' && (
        <button
          onClick={testCallback}
          className="mt-2 px-2 py-1 text-xs bg-gray-200 rounded"
          type="button"
        >
          Test Callback
        </button>
      )}
    </div>
  )
}

// Alternative component for custom styling
export function TelegramLoginButton({
  botName,
  onAuth,
  className = '',
  children
}: {
  botName: string
  onAuth?: (user: any) => void
  className?: string
  children?: React.ReactNode
}) {
  const { signInWithTelegram } = useAuth()

  const handleTelegramAuth = () => {
    if (!botName) {
      toast.error('Telegram bot is not configured')
      return
    }

    // Use the bot ID for OAuth (numeric ID required)
    const botId = process.env.NEXT_PUBLIC_TELEGRAM_AUTH_BOT_ID || '8066090295'

    // Open Telegram auth in popup - use production domain
    const origin = window.location.origin
    const authUrl = `https://oauth.telegram.org/auth?bot_id=${botId}&origin=${encodeURIComponent(origin)}&request_access=write`

    const popup = window.open(
      authUrl,
      'telegram-auth',
      'width=400,height=500,scrollbars=yes,resizable=yes'
    )

    // Listen for messages from popup
    const messageListener = async (event: MessageEvent) => {
      if (event.origin !== 'https://oauth.telegram.org') return

      if (event.data && event.data.type === 'telegram-auth') {
        try {
          await signInWithTelegram(event.data.user)

          if (onAuth) {
            onAuth(event.data.user)
          }

          toast.success('Successfully signed in with Telegram!')
          popup?.close()
        } catch (error: any) {
          console.error('Telegram authentication error:', error)
          toast.error(error.message || 'Failed to sign in with Telegram')
          popup?.close()
        }
      }
    }

    window.addEventListener('message', messageListener)

    // Cleanup when popup closes
    const checkClosed = setInterval(() => {
      if (popup?.closed) {
        window.removeEventListener('message', messageListener)
        clearInterval(checkClosed)
      }
    }, 1000)
  }

  return (
    <Button
      onClick={handleTelegramAuth}
      className={className}
      type="button"
    >
      {children || (
        <div className="flex items-center justify-center space-x-2">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.568 8.16l-1.61 7.59c-.12.54-.44.67-.89.42l-2.46-1.81-1.19 1.14c-.13.13-.24.24-.49.24l.17-2.43 4.47-4.03c.19-.17-.04-.27-.3-.1L9.39 13.17l-2.43-.76c-.53-.17-.54-.53.11-.78l9.49-3.66c.44-.17.83.11.69.78z"/>
          </svg>
          <span>Continue with Telegram</span>
        </div>
      )}
    </Button>
  )
}
