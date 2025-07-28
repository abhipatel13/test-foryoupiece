'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Eye, EyeOff, Lock, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const supabase = createClient()

  useEffect(() => {
    const validateTokens = async () => {
      try {
        setInitialLoading(true)
        setError('')

        // Check for error parameters from Supabase
        const error = searchParams.get('error')
        const errorCode = searchParams.get('error_code')
        const errorDescription = searchParams.get('error_description')

        if (error) {
          console.log('❌ Error parameters detected:', { error, errorCode, errorDescription })

          if (errorCode === 'otp_expired') {
            setError('Your password reset link has expired. Please request a new password reset.')
          } else if (error === 'access_denied') {
            setError('Access denied. Please request a new password reset.')
          } else {
            setError('Invalid or expired reset link. Please request a new password reset.')
          }
          setInitialLoading(false)
          return
        }

        // Check if user already has an active session (from auth callback)
        const sessionParam = searchParams.get('session')
        if (sessionParam === 'active') {
          console.log('🔑 Active session detected from callback')
          const { data: { session } } = await supabase.auth.getSession()
          if (session) {
            console.log('✅ Valid session found for password reset')
            setInitialLoading(false)
            return // User can proceed to reset password
          }
        }

        // Check for tokens in URL parameters
        let accessToken = searchParams.get('access_token') || searchParams.get('token')
        let refreshToken = searchParams.get('refresh_token')
        let type = searchParams.get('type')

        // Also check for the specific token parameter that Supabase might use
        const resetToken = searchParams.get('token')

        console.log('🔍 Token Detection:', {
          accessToken: accessToken ? 'present' : 'missing',
          refreshToken: refreshToken ? 'present' : 'missing',
          resetToken: resetToken ? 'present' : 'missing',
          type: type
        })

        // Also check URL hash for tokens (Supabase sometimes uses hash fragments)
        if (typeof window !== 'undefined' && window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1))
          accessToken = accessToken || hashParams.get('access_token') || hashParams.get('token')
          refreshToken = refreshToken || hashParams.get('refresh_token')
          type = type || hashParams.get('type')

          console.log('🔍 Hash Parameters:', {
            hash: window.location.hash,
            hashAccessToken: hashParams.get('access_token') ? 'present' : 'missing',
            hashRefreshToken: hashParams.get('refresh_token') ? 'present' : 'missing',
            hashType: hashParams.get('type'),
            allHashParams: Object.fromEntries(hashParams.entries())
          })
        }

        console.log('🔍 URL Parameters:', {
          accessToken: accessToken ? 'present' : 'missing',
          refreshToken: refreshToken ? 'present' : 'missing',
          type: type,
          sessionParam: sessionParam,
          allParams: Object.fromEntries(searchParams.entries()),
          hash: typeof window !== 'undefined' ? window.location.hash : 'N/A'
        })

        // Handle different Supabase URL formats
        if ((type === 'recovery' && accessToken) || resetToken) {
          // This is the format Supabase uses for password recovery
          console.log('🔑 Processing recovery token...')

          try {
            // Use the token we found (either accessToken or resetToken)
            const tokenToUse = accessToken || resetToken
            console.log('🔑 Using token for verification:', tokenToUse ? 'present' : 'missing')

            // Try multiple approaches to handle the token
            let sessionSet = false

            // Method 1: Try exchangeCodeForSession (for newer Supabase versions)
            try {
              console.log('🔄 Trying exchangeCodeForSession...')
              const { data, error } = await supabase.auth.exchangeCodeForSession(tokenToUse)

              if (!error && data.session) {
                console.log('✅ Session exchanged successfully via exchangeCodeForSession')
                sessionSet = true
              } else {
                console.log('❌ exchangeCodeForSession failed:', error?.message)
              }
            } catch (exchangeError) {
              console.log('❌ exchangeCodeForSession exception:', exchangeError)
            }

            // Method 2: Try verifyOtp if exchangeCodeForSession failed
            if (!sessionSet) {
              try {
                console.log('🔄 Trying verifyOtp...')
                const { data, error } = await supabase.auth.verifyOtp({
                  token_hash: tokenToUse,
                  type: 'recovery'
                })

                if (!error && data.session) {
                  console.log('✅ Recovery token verified successfully via verifyOtp')
                  sessionSet = true
                } else {
                  console.log('❌ verifyOtp failed:', error?.message)
                }
              } catch (verifyError) {
                console.log('❌ verifyOtp exception:', verifyError)
              }
            }

            // Method 3: Try setSession as final fallback
            if (!sessionSet) {
              try {
                console.log('🔄 Trying setSession fallback...')
                const { error } = await supabase.auth.setSession({
                  access_token: tokenToUse,
                  refresh_token: refreshToken || '',
                })

                if (!error) {
                  console.log('✅ Session set successfully via setSession fallback')
                  sessionSet = true
                } else {
                  console.log('❌ setSession failed:', error?.message)
                }
              } catch (sessionError) {
                console.log('❌ setSession exception:', sessionError)
              }
            }

            // If none of the methods worked, show error
            if (!sessionSet) {
              console.log('❌ All token verification methods failed')
              setError('Invalid or expired reset link. Please request a new password reset.')
            }
          } catch (generalError) {
            console.error('❌ General token processing error:', generalError)
            setError('An error occurred while validating your reset link. Please try again.')
          }
        } else if (accessToken && refreshToken) {
          // Standard token format
          console.log('🔑 Processing standard tokens...')

          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (error) {
            console.error('Session error:', error)
            if (error.message.includes('expired') || error.message.includes('invalid')) {
              setError('Your password reset link has expired. Please request a new password reset.')
            } else {
              setError('Invalid or expired reset link. Please request a new password reset.')
            }
          } else {
            console.log('✅ Session set successfully')
          }
        } else {
          console.log('❌ No valid tokens found in URL')
          setError('Invalid or expired reset link. Please request a new password reset.')
        }
      } catch (err) {
        console.error('Token validation error:', err)
        setError('An error occurred while validating your reset link. Please try again.')
      } finally {
        setInitialLoading(false)
      }
    }

    validateTokens()
  }, [supabase, searchParams])

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long'
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return 'Password must contain at least one lowercase letter'
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return 'Password must contain at least one uppercase letter'
    }
    if (!/(?=.*\d)/.test(password)) {
      return 'Password must contain at least one number'
    }
    return null
  }

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validate passwords
    if (!password.trim() || !confirmPassword.trim()) {
      setError('Please fill in both password fields')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) {
        setError(error.message)
        toast.error('Password reset failed: ' + error.message)
        return
      }

      setSuccess(true)
      toast.success('Password updated successfully!')
      
      // Redirect to login after a short delay
      setTimeout(() => {
        router.push('/en/auth/login?message=password_reset_success')
      }, 2000)
    } catch (err) {
      setError('An unexpected error occurred')
      toast.error('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          {/* Header */}
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
                  className="object-contain flex-shrink-0"
                  priority
                />
              </div>
            </Link>
            <h2 className="mt-6 text-3xl font-bold text-gray-900">Password updated</h2>
            <p className="mt-2 text-sm text-gray-600">
              Your password has been successfully updated
            </p>
          </div>

          <Card className="mt-8">
            <CardContent className="space-y-6 pt-6">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="mt-4">
                  <h3 className="text-lg font-medium text-gray-900">Success!</h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Your password has been updated successfully. You can now sign in with your new password.
                  </p>
                </div>
              </div>

              <Button asChild className="w-full">
                <Link href="/en/auth/login">
                  Continue to login
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Header */}
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
                className="object-contain flex-shrink-0"
                priority
              />
            </div>
          </Link>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">Set new password</h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter your new password below
          </p>
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Create new password</CardTitle>
            <CardDescription>
              Choose a strong password that you haven't used before
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Loading State */}
            {initialLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-sm text-gray-600">Validating reset link...</span>
                </div>
              </div>
            )}

            {/* Error Alert */}
            {error && !initialLoading && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!initialLoading && !error && (
              <form onSubmit={handlePasswordReset} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your new password"
                    className="pl-10 pr-10"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your new password"
                    className="pl-10 pr-10"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    disabled={loading}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="text-sm text-gray-600">
                <p className="font-medium mb-2">Password requirements:</p>
                <ul className="space-y-1 text-xs">
                  <li className={password.length >= 8 ? 'text-green-600' : 'text-gray-500'}>
                    • At least 8 characters long
                  </li>
                  <li className={/(?=.*[a-z])/.test(password) ? 'text-green-600' : 'text-gray-500'}>
                    • Contains lowercase letter
                  </li>
                  <li className={/(?=.*[A-Z])/.test(password) ? 'text-green-600' : 'text-gray-500'}>
                    • Contains uppercase letter
                  </li>
                  <li className={/(?=.*\d)/.test(password) ? 'text-green-600' : 'text-gray-500'}>
                    • Contains number
                  </li>
                </ul>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Updating password...' : 'Update password'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-xs text-gray-500">
          <p>
            By using this service, you agree to our{' '}
            <Link href="/en/terms" className="font-medium text-blue-600 hover:text-blue-500">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/en/privacy" className="font-medium text-blue-600 hover:text-blue-500">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
