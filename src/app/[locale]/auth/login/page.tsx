'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import Script from 'next/script'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'

import { Eye, EyeOff, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

// Telegram Login Widget Component
function TelegramLoginWidget() {
  const [isLoaded, setIsLoaded] = useState(false)
  const [showFallback, setShowFallback] = useState(false)
  const [nonce, setNonce] = useState<string | null>(null)
  const [deepLinkUrl, setDeepLinkUrl] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [isInitiated, setIsInitiated] = useState(false)
  const beginSignIn = () => {
    try {
      const payload = { ts: Date.now(), v: 1 }
      localStorage.setItem('AUTH_SIGNIN_IN_PROGRESS', JSON.stringify(payload))
    } catch {}
    setIsInitiated(true)
  }


  useEffect(() => {
    // Load Telegram widget script
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.async = true
    script.setAttribute('data-telegram-login', 'Authenticationfypbot')
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-auth-url', `${window.location.origin}/api/auth/telegram/verify`)
    script.setAttribute('data-request-access', 'write')

    const container = document.getElementById('telegram-login-widget')
    if (container) {
      container.appendChild(script)
      // Capture clicks inside the widget to show loading immediately
      const clickHandler = () => beginSignIn()
      container.addEventListener('click', clickHandler, true)
      ;(window as any).__tg_click_handler__ = clickHandler
      setIsLoaded(true)
    }

    // Show fallback after 5 seconds if widget doesn't work
    const fallbackTimer = setTimeout(() => {
      setShowFallback(true)
    }, 5000)

    return () => {
      clearTimeout(fallbackTimer)
      // Cleanup
      if (container) {
        const ch = (window as any).__tg_click_handler__
        if (ch) container.removeEventListener('click', ch, true)
      }
      if (container && script.parentNode) {
        container.removeChild(script)
      }
    }
  }, [])

  const handleFallbackLogin = async () => {
    try {
      beginSignIn()

      const response = await fetch('/api/auth/telegram/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()
      if (data.success) {
        setNonce(data.nonce)
        setDeepLinkUrl(data.deepLinkUrl)
        startPolling(data.nonce)
      } else {
        toast.error('Failed to generate login link')
      }
    } catch (error) {
      toast.error('Failed to generate login link')
    }
  }

  const startPolling = async (nonceToCheck: string) => {
    beginSignIn()
    setIsPolling(true)
    const maxAttempts = 60 // 10 minutes
    let attempts = 0

    const poll = async () => {
      try {
        const response = await fetch(`/api/auth/telegram/poll?nonce=${nonceToCheck}`)
        const data = await response.json()

        if (data.success && data.status === 'verified' && data.session) {
          // Set session cookies and redirect
          const supabase = createClient()
          await supabase.auth.setSession(data.session)
          toast.success('Successfully logged in with Telegram!')
          try {
            if (!(window as any).__postLoginReloadDone) {
              ;(window as any).__postLoginReloadDone = true
              const base = '/en/profile?auth=telegram_success'
              const sep = base.includes('?') ? '&' : '?'
              window.location.replace(`${base}${sep}r=${Date.now()}`)
            } else {
              window.location.replace('/en/profile?auth=telegram_success')
            }
          } catch {
            window.location.replace('/en/profile?auth=telegram_success')
          }
          return
        }

        if (data.success && data.status === 'pending') {
          attempts++
          if (attempts < maxAttempts) {
            setTimeout(poll, 10000) // Poll every 10 seconds
          } else {
            setIsPolling(false)
            toast.error('Login timeout. Please try again.')
          }
        } else {
          setIsPolling(false)
          toast.error('Login failed. Please try again.')
        }
      } catch (error) {
        setIsPolling(false)
        toast.error('Login failed. Please try again.')
      }
    }

    poll()
  }

  return (
    <div className="w-full space-y-3">
      {!isLoaded && (
        <Button
          type="button"
          variant="outline"
          className="w-full h-12 sm:h-11 text-base sm:text-sm font-medium border-border hover:bg-accent hover:text-accent-foreground transition-colors"
          disabled
        >
          <svg className="w-5 h-5 mr-3 sm:w-4 sm:h-4 sm:mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.374 0 0 5.373 0 12s5.374 12 12 12 12-5.373 12-12S18.626 0 12 0zm5.568 8.16c-.169 1.858-.896 6.728-.896 6.728-.302 1.507-1.123 1.507-1.745 1.507-.896 0-1.745-.302-2.301-.604-.302-.151-.604-.453-.906-.604-.151-.075-.302-.151-.302-.302 0-.151.151-.302.453-.604.604-.604 1.507-1.507 2.26-2.26.302-.302.453-.604.302-.755-.151-.151-.453 0-.755.302-.906.906-1.96 1.96-2.866 2.866-.302.302-.604.453-.906.453-.302 0-.604-.151-.906-.453-.604-.604-1.208-1.208-1.745-1.745-.302-.302-.453-.604-.302-.755.151-.151.453 0 .755.302l1.507 1.507c.151.151.302.151.453 0s.151-.302 0-.453l-1.507-1.507c-.302-.302-.453-.604-.302-.755.151-.151.453 0 .755.302.604.604 1.208 1.208 1.745 1.745.302.302.604.453.906.453.302 0 .604-.151.906-.453.906-.906 1.96-1.96 2.866-2.866.302-.302.604-.453.755-.302.151.151 0 .453-.302.755-.755.755-1.658 1.658-2.26 2.26-.302.302-.453.453-.453.604 0 .151.151.226.302.302.302.151.604.453.906.604.556.302 1.405.604 2.301.604.622 0 1.443 0 1.745-1.507 0 0 .727-4.87.896-6.728.075-.604-.151-1.208-.604-1.208-.302 0-.604.151-.755.453-.604 1.208-1.507 3.019-2.26 4.528-.151.302-.302.453-.453.453s-.302-.151-.453-.453c-.755-1.509-1.658-3.32-2.26-4.528-.151-.302-.453-.453-.755-.453-.453 0-.679.604-.604 1.208z"/>
          </svg>
          Loading Telegram Login...
        </Button>
      )}

      <div id="telegram-login-widget" className="w-full flex justify-center" />

      {(isInitiated || isPolling) && (
        <p className="text-xs text-muted-foreground text-center">
          We are signing you in, please wait...
        </p>
      )}


      {showFallback && !nonce && (
        <div className="text-center space-y-2">
          <p className="text-xs text-muted-foreground">Having trouble with the button above?</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleFallbackLogin}
            className="text-xs"
          >
            Continue in Telegram App
          </Button>
        </div>
      )}

      {deepLinkUrl && (
        <div className="text-center space-y-3 p-4 border rounded-lg bg-muted/50">
          <p className="text-sm font-medium">Complete login in Telegram</p>
          <p className="text-xs text-muted-foreground">
            Click the button below to open Telegram and complete your login
          </p>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => window.open(deepLinkUrl, '_blank')}
            disabled={isPolling}
          >
            {isPolling ? 'Waiting for confirmation...' : 'Open Telegram'}
          </Button>
          {isPolling && (
            <p className="text-xs text-muted-foreground">
              After confirming in Telegram, you'll be automatically logged in here.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function LoginPageContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/'

  const supabase = createClient()

  useEffect(() => {
    try {
      // Check if user is already logged in
      const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          console.log('🔄 User already authenticated, redirecting to:', redirectTo)
          router.push(redirectTo)
        }
      }
      checkUser()

      // Handle OAuth callback errors (defensively decode params)
      const rawError = searchParams.get('error')
      const rawErrorMessage = searchParams.get('message')
      const rawErrorCode = searchParams.get('code')

      if (rawError) {
        // Safe decode helper
        const safeDecode = (v: string | null) => {
          if (!v) return null
          try { return decodeURIComponent(v) } catch { return v }
        }

        const decodedMessage = safeDecode(rawErrorMessage)
        const decodedCode = safeDecode(rawErrorCode)

        const errorMessages: Record<string, string> = {
          'user_creation_failed': 'Failed to create user account. Please try again.',
          'session_creation_failed': 'Failed to create session. Please try again.',
          'telegram_auth_failed': decodedMessage ? `Telegram authentication failed: ${decodedMessage}` : 'Telegram authentication failed. Please try again.',
          'auth_system_error': 'Authentication system error. Please try again.',
          'invalid_data': 'Invalid authentication data. Please try again.',
          'invalid_signature': 'Invalid Telegram signature. Please try again.',
          'expired_auth': 'Authentication data expired. Please try again.',
          'config_error': 'Authentication configuration error. Please contact support.',
          'rate_limit': 'Too many authentication attempts. Please wait and try again.',
        }

        const displayMessage = errorMessages[rawError] || 'Authentication failed. Please try again.'

        // Log detailed error information without risking decode errors
        try {
          const errorDetails = {
            error: rawError,
            errorMessageRaw: rawErrorMessage,
            errorMessage: decodedMessage,
            errorCodeRaw: rawErrorCode,
            errorCode: decodedCode,
            displayMessage,
            timestamp: new Date().toISOString(),
            // Add URL context for debugging
            currentUrl: window.location.href,
            searchParamsAll: Object.fromEntries(searchParams.entries())
          }

          // Only log if there's actually error data to log
          if (rawError || rawErrorMessage || rawErrorCode) {
            console.error('🚨 Login page error details:', errorDetails)
          } else {
            console.warn('⚠️ Empty error parameters detected - this may indicate a URL parsing issue')
          }
        } catch (logErr) {
          // Ensure logging never crashes the effect
          console.error('🚨 Login page error (fallback)', String(logErr))
        }

        setError(displayMessage)
        toast.error(displayMessage)

        // Clear error parameters from URL to prevent re-triggering
        const url = new URL(window.location.href)
        url.searchParams.delete('error')
        url.searchParams.delete('message')
        url.searchParams.delete('code')
        url.searchParams.delete('details')
        window.history.replaceState({}, '', url.toString())
      }
    } catch (e) {
      // Absolute safeguard: the effect must never crash React tree
      console.error('🚨 Login page init error (guard):', e)
    }
  }, [supabase, router, redirectTo, searchParams])
  // Handle Telegram success arriving back on the login page with session bridge
  useEffect(() => {
    try {
      const authParam = searchParams.get('auth')
      const sessionBridge = searchParams.get('session_bridge')
      if (authParam === 'telegram_success' && sessionBridge) {
        ;(async () => {
          try {
            // Decode bridge
            let decodedJson = ''
            try {
              decodedJson = typeof window !== 'undefined' && typeof atob === 'function'
                ? atob(sessionBridge)
                : Buffer.from(sessionBridge, 'base64').toString()
            } catch {
              decodedJson = Buffer.from(sessionBridge, 'base64').toString()
            }
            const sessionData = JSON.parse(decodedJson)

            if (sessionData?.access_token && sessionData?.refresh_token) {
              const { error } = await supabase.auth.setSession({
                access_token: sessionData.access_token,
                refresh_token: sessionData.refresh_token,
                expires_at: sessionData.expires_at,
              })
              if (!error) {
                // Ensure profile exists before navigating
                try {
                  const controller = new AbortController()
                  const t = setTimeout(() => controller.abort(), 5000)
                  await fetch('/api/auth/ensure-profile', { method: 'POST', cache: 'no-store', signal: controller.signal })
                  clearTimeout(t)
                } catch {}

                // Clean URL params to avoid reprocessing
                const url = new URL(window.location.href)
                url.searchParams.delete('auth')
                url.searchParams.delete('session_bridge')
                window.history.replaceState({}, '', url.toString())

                // Immediate hard reload into profile with cache-busting
                const base = '/en/profile?auth=telegram_success'
                const sep = base.includes('?') ? '&' : '?'
                window.location.replace(`${base}${sep}r=${Date.now()}`)
              }
            }
          } catch (e) {
            console.error('❌ Telegram session bridge handling on login page failed:', e)
          }
        })()
      }
    } catch (e) {
      console.error('🚨 Login page Telegram bridge guard error:', e)
    }
  }, [searchParams, supabase])

  // Redirect off the login page immediately when auth state becomes SIGNED_IN
  useEffect(() => {
    let mounted = true
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return
      if (event === 'SIGNED_IN') {
        try { localStorage.removeItem('AUTH_SIGNIN_IN_PROGRESS') } catch {}
        setLoading(false)
        // Force a hard reload to guarantee full data hydration (profile, points, tier)
        try {
          if (!(window as any).__postLoginReloadDone) {
            ;(window as any).__postLoginReloadDone = true
            const url = redirectTo?.startsWith('/') ? redirectTo : '/'
            const sep = url.includes('?') ? '&' : '?'
            window.location.replace(`${url}${sep}r=${Date.now()}`)
          }
        } catch (e) {
          // Fallback: soft navigation if window access blocked
          router.replace(redirectTo)
        }
      }
    })
    return () => {
      mounted = false
      subscription?.subscription?.unsubscribe?.()
    }
  }, [supabase, router, redirectTo])


  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
        toast.error('Login failed: ' + error.message)
        return
      }

      if (data.user) {
        toast.success('Successfully logged in!')
        // Hard reload to ensure all profile and saved data are fresh
        try {
          if (!(window as any).__postLoginReloadDone) {
            ;(window as any).__postLoginReloadDone = true
            const url = redirectTo?.startsWith('/') ? redirectTo : '/'
            const sep = url.includes('?') ? '&' : '?'
            window.location.replace(`${url}${sep}r=${Date.now()}`)
          }
        } catch (e) {
          // Fallback soft navigation if needed
          router.push(redirectTo)
        }
      }
    } catch (err) {
      setError('An unexpected error occurred')
      toast.error('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }



  const handleGoogleLogin = async () => {
    setLoading(true)
    setError('')

    // Mark OAuth flow as in-flight to avoid interceptor interference
    if (typeof window !== 'undefined') {
      ;(window as any).__oauthSignInInFlight = true
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/en/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        }
      })

      if (error) {
        setError(error.message)
        toast.error('Google login failed: ' + error.message)
      }
    } catch (err) {
      setError('Failed to initiate Google login')
      toast.error('Failed to initiate Google login')
    } finally {
      // Clear OAuth in-flight flag regardless of outcome
      if (typeof window !== 'undefined') {
        ;(window as any).__oauthSignInInFlight = false
      }
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-6 px-4 sm:py-12 sm:px-6 lg:px-8">
      <div className="auth-form-container space-y-6 sm:space-y-8">
        {/* Header - Mobile-First Responsive */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center justify-center space-x-2 text-foreground hover:text-primary transition-colors">
            <div className="flex items-center space-x-2">
              <Image
                src="/favicon.jpg"
                alt="Foryoupiece"
                width={32}
                height={32}
                className="rounded-lg shadow-sm object-contain flex-shrink-0"
                priority
              />
              <Image
                src="/logo.jpg"
                alt="Foryoupiece"
                width={80}
                height={24}
                className="object-contain flex-shrink-0 hidden xs:block"
                priority
              />
            </div>
          </Link>
          <h2 className="mt-4 sm:mt-6 text-2xl sm:text-3xl font-extrabold text-foreground">
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Or{' '}
            <Link href="/en/auth/register" className="font-medium text-primary hover:text-primary/80 transition-colors">
              create a new account
            </Link>
          </p>
        </div>

        <Card className="shadow-2xl border border-gray-200 bg-white mx-auto lg:shadow-2xl lg:border-gray-300">
          <CardHeader className="space-y-1 pb-6 px-8 sm:px-10 lg:px-12 pt-8 sm:pt-10 lg:pt-12">
            <CardTitle className="text-lg sm:text-xl lg:text-2xl font-semibold text-center text-gray-900">Welcome back</CardTitle>
            <CardDescription className="text-center text-gray-600 text-sm sm:text-base">
              Sign in to access your account and continue shopping
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6 px-8 sm:px-10 lg:px-12 pb-8 sm:pb-10 lg:pb-12">
            {/* Error Alert - Mobile Optimized */}
            {error && (
              <Alert variant="destructive" className="text-sm">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Email/Password Form - Mobile-First */}
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="!pl-12 h-12 sm:h-11 text-base sm:text-sm"
                    required
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="!pl-12 !pr-12 h-12 sm:h-11 text-base sm:text-sm"
                    required
                    disabled={loading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-muted/50 flex items-center justify-center min-w-[44px] min-h-[44px]"
                    disabled={loading}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Mobile-Responsive Remember Me and Forgot Password */}
              <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-primary focus:ring-primary border-border rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-foreground">
                    Remember me
                  </label>
                </div>

                <div className="text-sm">
                  <Link href="/en/auth/forgot-password" className="font-medium text-primary hover:text-primary/80 transition-colors">
                    Forgot your password?
                  </Link>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 sm:h-11 text-base sm:text-sm font-medium"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign in'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>

            {/* Separator - Mobile Optimized */}
            <div className="relative my-4 sm:my-6">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-3 text-muted-foreground font-medium">Or continue with</span>
              </div>
            </div>

            {/* Social Login Options - Mobile-First Design */}
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 sm:h-11 text-base sm:text-sm font-medium border-border hover:bg-accent hover:text-accent-foreground transition-colors"
                onClick={handleGoogleLogin}
                disabled={loading}
              >
                <svg className="w-5 h-5 mr-3 sm:w-4 sm:h-4 sm:mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </Button>

              {/* Telegram Login Widget - Production Only */}
              {process.env.NODE_ENV === 'production' && (
                <TelegramLoginWidget />
              )}
            </div>

          </CardContent>
        </Card>

        {/* Footer - Mobile Optimized */}
        <div className="text-center text-xs sm:text-sm text-muted-foreground px-2">
          <p className="leading-relaxed">
            By signing in, you agree to our{' '}
            <Link href="/en/terms" className="font-medium text-primary hover:text-primary/80 transition-colors underline-offset-4 hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/en/privacy" className="font-medium text-primary hover:text-primary/80 transition-colors underline-offset-4 hover:underline">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center py-6 px-4 sm:py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-sm sm:max-w-md lg:max-w-md xl:max-w-md space-y-6 sm:space-y-8">
          <div className="text-center">
            <h2 className="mt-4 sm:mt-6 text-2xl sm:text-3xl font-extrabold text-foreground">Loading...</h2>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mt-4"></div>
          </div>
        </div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  )
}
