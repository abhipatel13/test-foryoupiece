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
import { Eye, EyeOff, Lock, ArrowRight, AlertCircle, CheckCircle, Shield } from 'lucide-react'
import { toast } from 'sonner'

export default function AdminResetPasswordPage() {
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
    const validateSession = async () => {
      try {
        setInitialLoading(true)
        setError('')

        // Check for error parameters from Supabase
        const error = searchParams.get('error')
        const errorCode = searchParams.get('error_code')
        const errorDescription = searchParams.get('error_description')

        if (error) {
          console.log('❌ Admin reset error parameters detected:', { error, errorCode, errorDescription })

          if (errorCode === 'otp_expired') {
            setError('Your admin password reset link has expired. Please request a new password reset.')
          } else if (error === 'access_denied') {
            setError('Access denied. Please request a new admin password reset.')
          } else {
            setError('Invalid or expired admin reset link. Please request a new password reset.')
          }
          setInitialLoading(false)
          return
        }

        // Check for code parameter (Supabase redirects with code)
        const code = searchParams.get('code')

        console.log('🔍 Checking for admin password reset code...', {
          hasCode: !!code,
          code: code ? 'present' : 'missing'
        })

        // If we have a code parameter, exchange it for a session using PKCE flow
        if (code) {
          console.log('🔑 Found admin reset code, exchanging for session...')

          try {
            // Exchange the PKCE code for a session
            const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

            if (exchangeError) {
              console.log('❌ Failed to exchange admin PKCE code for session:', exchangeError.message)
              setError('Invalid or expired admin reset link. Please request a new password reset.')
              setInitialLoading(false)
              return
            }

            if (data.session) {
              console.log('✅ Admin session established from PKCE code exchange:', {
                userId: data.session.user.id,
                email: data.session.user.email
              })
              setInitialLoading(false)
              return
            } else {
              console.log('❌ Admin PKCE code exchange succeeded but no session returned')
              setError('Failed to establish admin session. Please try clicking the reset link again.')
              setInitialLoading(false)
              return
            }
          } catch (exchangeError) {
            console.log('❌ Admin PKCE code exchange error:', exchangeError)
            setError('Invalid or expired admin reset link. Please request a new password reset.')
            setInitialLoading(false)
            return
          }
        }

        // Check for hash fragments (alternative Supabase approach)
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const type = hashParams.get('type')

        console.log('🔍 Checking for admin password reset tokens in hash...', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          type: type
        })

        // If we have tokens in the hash, set the session
        if (accessToken && refreshToken && type === 'recovery') {
          console.log('🔑 Found admin recovery tokens in URL hash, setting session...')

          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          })

          if (sessionError) {
            console.log('❌ Failed to set admin session from tokens:', sessionError.message)
            setError('Invalid or expired admin reset link. Please request a new password reset.')
            setInitialLoading(false)
            return
          }

          if (data.session) {
            console.log('✅ Admin session established from recovery tokens:', {
              userId: data.session.user.id,
              email: data.session.user.email
            })
            setInitialLoading(false)
            return
          }
        }

        // Check if user already has a valid session
        console.log('🔍 Checking for existing admin session...')
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.log('❌ Admin session error:', sessionError.message)
          setError('Invalid or expired admin reset link. Please request a new password reset.')
          setInitialLoading(false)
          return
        }

        if (!session) {
          console.log('❌ No valid admin session found and no recovery tokens')
          setError('Invalid or expired admin reset link. Please request a new password reset.')
          setInitialLoading(false)
          return
        }

        console.log('✅ Valid admin session found for password reset:', {
          userId: session.user.id,
          email: session.user.email
        })
        setInitialLoading(false)
      } catch (err) {
        console.error('❌ Admin session validation error:', err)
        setError('An error occurred while validating your admin reset link.')
        setInitialLoading(false)
      }
    }

    validateSession()
  }, [searchParams, supabase.auth])





  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!password || !confirmPassword) {
      setError('Please fill in all fields')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Check if this is the super admin who might have MFA enabled
      const { data: { session } } = await supabase.auth.getSession()
      const userEmail = session?.user?.email || ''
      const isSuperAdmin = userEmail === 'akito12350@gmail.com'

      if (isSuperAdmin) {
        // Check if super admin has MFA enabled and needs AAL2 session
        console.log('🔍 Checking super admin MFA status before password update...')
        const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

        if (aalError) {
          console.log('❌ Error checking super admin AAL:', aalError)
          setError('Authentication error occurred')
          toast.error('Authentication error occurred')
          return
        }

        console.log('🔍 Current super admin AAL status:', aalData)

        // If super admin has MFA enrolled but current level is aal1, they need to complete MFA
        if (aalData.nextLevel === 'aal2' && aalData.currentLevel === 'aal1') {
          console.log('⚠️ Super admin has MFA enabled but needs to complete MFA challenge for password reset')

          // Check if super admin has MFA factors
          const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors()

          if (factorsError) {
            console.log('❌ Error listing super admin MFA factors:', factorsError)
            setError('Unable to verify super admin MFA status')
            toast.error('Unable to verify super admin MFA status')
            return
          }

          console.log('🔍 Super admin MFA factors found:', factors)

          if (factors.totp && factors.totp.length > 0) {
            // Super admin has TOTP factors, show MFA challenge
            setError('Multi-factor authentication is required to reset your super admin password. Your account has MFA enabled, which requires additional verification to change passwords. Please temporarily disable MFA to reset your password.')
            toast.error('Super admin MFA verification required for password reset')
            return
          }
        }
      } else {
        // Regular admin users don't have MFA
        console.log('🔍 Regular admin user, no MFA check needed')
      }

      // Proceed with admin password update
      console.log('🔄 Updating admin password...')
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) {
        console.error('❌ Admin password update failed:', error)

        // Check if this is the AAL2 error (should only happen for super admin with MFA)
        if (error.message.includes('AAL2 session is required')) {
          if (isSuperAdmin) {
            setError('Multi-factor authentication is required to reset your super admin password. Your account has MFA enabled, which requires additional verification to change passwords. Please temporarily disable MFA to reset your password.')
            toast.error('Super admin MFA verification required for password reset')
          } else {
            setError('Unexpected MFA error. Please contact support.')
            toast.error('Unexpected MFA error')
          }
          return
        }

        setError(error.message)
        toast.error('Admin password reset failed: ' + error.message)
        return
      }

      console.log('✅ Admin password updated successfully')
      setSuccess(true)
      toast.success('Admin password updated successfully!')

      // Clear the current session to force fresh admin login
      try {
        console.log('🔄 Clearing current session to force fresh admin login...')
        await supabase.auth.signOut()
        console.log('✅ Session cleared successfully')
      } catch (signOutError) {
        console.log('⚠️ Session clear failed (non-critical):', signOutError)
      }

      // Redirect to admin login after a short delay
      setTimeout(() => {
        router.push('/en/fyponly-admin?message=password_reset_success')
      }, 2000)
    } catch (err) {
      console.error('❌ Admin password update exception:', err)
      setError('An unexpected error occurred')
      toast.error('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Validating admin reset link...</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <Link href="/" className="flex justify-center mb-6">
                <div className="relative">
                  <Image
                    src="/logo.jpg"
                    alt="Foryoupiece"
                    width={120}
                    height={40}
                    className="h-10 w-auto"
                    priority
                  />
                </div>
              </Link>
              <CardTitle className="text-2xl font-bold text-gray-900">Password updated!</CardTitle>
              <CardDescription>Your admin password has been successfully updated</CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-gray-900">Success!</h3>
                <p className="text-sm text-gray-600">
                  Your admin password has been updated. You will be redirected to the admin login page shortly.
                </p>
              </div>
              <Link href="/en/fyponly-admin">
                <Button className="w-full">
                  Continue to Admin Login
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <Link href="/" className="flex justify-center mb-6">
              <div className="relative">
                <Image
                  src="/logo.jpg"
                  alt="Foryoupiece"
                  width={120}
                  height={40}
                  className="h-10 w-auto"
                  priority
                />
              </div>
            </Link>
            <CardTitle className="text-2xl font-bold text-gray-900">Set new admin password</CardTitle>
            <CardDescription>Enter your new admin password below</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
                  <Shield className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">Admin Password Reset</h3>
                <p className="text-sm text-gray-600">
                  Choose a strong password that you haven't used before
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                    New Password
                  </Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-gray-400" />
                    </div>
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      className="pl-10 pr-10"
                      placeholder="Enter your new password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                    Confirm New Password
                  </Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-gray-400" />
                    </div>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      className="pl-10 pr-10"
                      placeholder="Confirm your new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Updating password...
                    </>
                  ) : (
                    <>
                      Update admin password
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>
            </div>

            {/* Security Notice */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <div className="flex">
                <Shield className="h-4 w-4 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
                <div className="text-xs text-yellow-700">
                  <p className="font-medium">Security Notice</p>
                  <p>Admin password changes are logged and monitored for security purposes.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
