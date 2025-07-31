'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { TelegramLogin } from '@/components/auth/telegram-login'
import { Eye, EyeOff, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

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
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.push(redirectTo)
      }
    }
    checkUser()
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
        router.push(redirectTo)
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
      setLoading(false)
    }
  }

  const handleTelegramAuth = async (user: any) => {
    try {
      // The TelegramLogin component handles the authentication
      // This callback is called after successful authentication
      toast.success('Successfully signed in with Telegram!')
      router.push(redirectTo)
    } catch (error: any) {
      toast.error(error.message || 'Failed to sign in with Telegram')
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
                    className="pl-10 h-12 sm:h-11 text-base sm:text-sm"
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
                    className="pl-10 pr-12 h-12 sm:h-11 text-base sm:text-sm"
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

              {/* Telegram Login Widget */}
              <div className="w-full">
                <TelegramLogin
                  botName={process.env.NEXT_PUBLIC_TELEGRAM_AUTH_BOT_USERNAME || 'Authenticationfypbot'}
                  onAuth={handleTelegramAuth}
                  className="w-full"
                  buttonSize="large"
                />
              </div>
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
