'use client'

import { useState, useEffect, useCallback } from 'react'
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
  const [isValidToken, setIsValidToken] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const supabase = createClient()

  // Listen for auth state changes - this is the primary method
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔄 Auth state change:', { event, userId: session?.user?.id })

      if (event === 'PASSWORD_RECOVERY' && session) {
        console.log('✅ Password recovery session established')
        setIsValidToken(true)
        setSessionReady(true)
        setInitialLoading(false)
      } else if (event === 'INITIAL_SESSION' && session) {
        // Fallback: check if we already have a valid session
        console.log('✅ Initial session found for password reset:', {
          userId: session.user.id,
          email: session.user.email
        })
        setIsValidToken(true)
        setSessionReady(true)
        setInitialLoading(false)
      } else if (event === 'SIGNED_IN' && session) {
        // Another fallback for existing sessions
        console.log('✅ Signed in session found for password reset')
        setIsValidToken(true)
        setSessionReady(true)
        setInitialLoading(false)
      }
    })

    // Set a timeout to show error if no auth event occurs
    const timeout = setTimeout(() => {
      if (!sessionReady) {
        console.log('❌ No auth event received within timeout')
        setError('No valid authentication session found. Please click the reset link from your email.')
        setInitialLoading(false)
      }
    }, 5000) // 5 second timeout

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [supabase, sessionReady])




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
      console.log('🔄 Updating password...')

      // Update the user's password using Supabase
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) {
        console.log('❌ Password update failed:', error)
        setError(error.message)
        toast.error('Password reset failed: ' + error.message)
        setLoading(false)
        return
      }

      console.log('✅ Password updated successfully')
      setSuccess(true)
      toast.success('Password updated successfully!')

      // Redirect to login after a short delay
      setTimeout(() => {
        router.push('/en/profile?message=password_reset_success')
      }, 2000)
    } catch (err) {
      console.error('❌ Password reset error:', err)
      setError('An unexpected error occurred')
      toast.error('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-6 px-4 sm:py-12 sm:px-6 lg:px-8">
        <div className="auth-form-container mx-auto">
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
                    Your password has been updated successfully. 
                    {/* You can now sign in with your new password. */}
                  </p>
                </div>
              </div>

              <Button asChild className="w-full">
                <Link href="/en/profile">
                  Continue 
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
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-6 px-4 sm:py-12 sm:px-6 lg:px-8">
      <div className="auth-form-container mx-auto">
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

        <Card className="mt-8 shadow-2xl border border-gray-200 bg-white lg:shadow-2xl lg:border-gray-300">
          <CardHeader className="px-8 sm:px-10 lg:px-12 pt-8 sm:pt-10 lg:pt-12 pb-6">
            <CardTitle className="text-gray-900">Create new password</CardTitle>
            <CardDescription className="text-gray-600">
              Choose a strong password that you haven't used before
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 px-8 sm:px-10 lg:px-12 pb-8 sm:pb-10 lg:pb-12">
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
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Link href="/en/auth/forgot-password">
                  <Button className="w-full">
                    Request New Reset Link
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            )}

            {/* Session Not Ready Alert */}
            {!initialLoading && !error && !sessionReady && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Session could not be established. Please try clicking the reset link again.</AlertDescription>
              </Alert>
            )}

            {/* Success Alert */}
            {!initialLoading && !error && sessionReady && isValidToken && (
              <Alert className="mb-6">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>Reset link validated successfully. You can now set your new password.</AlertDescription>
              </Alert>
            )}

            {!initialLoading && !error && sessionReady && isValidToken && (
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
                    className="pl-12 pr-10"
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
