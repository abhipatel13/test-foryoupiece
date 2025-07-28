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
    const validateTokens = async () => {
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

        // Check if user already has an active session (from auth callback)
        const sessionParam = searchParams.get('session')
        if (sessionParam === 'active') {
          console.log('🔑 Active admin session detected from callback')
          const { data: { session } } = await supabase.auth.getSession()
          if (session) {
            console.log('✅ Valid admin session found for password reset:', {
              userId: session.user.id,
              email: session.user.email
            })
            setInitialLoading(false)
            return // User can proceed to reset password
          } else {
            console.log('❌ Session parameter present but no active session found')
          }
        }

        // Check for tokens in URL parameters
        let accessToken = searchParams.get('access_token')
        let refreshToken = searchParams.get('refresh_token')
        let type = searchParams.get('type')

        // Check for the recovery token from callback
        const recoveryToken = searchParams.get('token')

        console.log('🔍 Admin Token Detection:', {
          accessToken: accessToken ? 'present' : 'missing',
          refreshToken: refreshToken ? 'present' : 'missing',
          recoveryToken: recoveryToken ? 'present' : 'missing',
          type: type
        })
        
        // Also check URL hash for tokens (Supabase sometimes uses hash fragments)
        if (typeof window !== 'undefined' && window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1))
          accessToken = accessToken || hashParams.get('access_token')
          refreshToken = refreshToken || hashParams.get('refresh_token')
          type = type || hashParams.get('type')

          console.log('🔍 Admin Hash Parameters:', {
            hash: window.location.hash,
            hashAccessToken: hashParams.get('access_token') ? 'present' : 'missing',
            hashRefreshToken: hashParams.get('refresh_token') ? 'present' : 'missing',
            hashType: hashParams.get('type'),
            allHashParams: Object.fromEntries(hashParams.entries())
          })
        }

        console.log('🔍 Admin URL Parameters:', {
          accessToken: accessToken ? 'present' : 'missing',
          refreshToken: refreshToken ? 'present' : 'missing',
          recoveryToken: recoveryToken ? 'present' : 'missing',
          type: type,
          sessionParam: sessionParam,
          allParams: Object.fromEntries(searchParams.entries()),
          hash: typeof window !== 'undefined' ? window.location.hash : 'N/A'
        })

        // Handle recovery token from callback - use same robust approach as user reset
        if ((type === 'recovery' && recoveryToken) || recoveryToken) {
          console.log('🔑 Processing admin recovery token from callback...')

          try {
            // Use the token we found
            const tokenToUse = recoveryToken
            console.log('🔑 Using admin token for verification:', tokenToUse ? 'present' : 'missing')

            // Try multiple approaches to handle the token (same as user reset)
            let sessionSet = false

            // Method 1: Try exchangeCodeForSession (for newer Supabase versions)
            try {
              console.log('🔄 Trying admin exchangeCodeForSession...')
              const { data, error } = await supabase.auth.exchangeCodeForSession(tokenToUse)

              if (!error && data.session) {
                console.log('✅ Admin session exchanged successfully via exchangeCodeForSession')
                console.log('🔐 Admin session established:', {
                  userId: data.session.user.id,
                  email: data.session.user.email
                })
                sessionSet = true
              } else {
                console.log('❌ Admin exchangeCodeForSession failed:', error?.message)
              }
            } catch (exchangeError) {
              console.log('❌ Admin exchangeCodeForSession exception:', exchangeError)
            }

            // Method 2: Try verifyOtp if exchangeCodeForSession failed
            if (!sessionSet) {
              try {
                console.log('🔄 Trying admin verifyOtp...')
                const { data, error } = await supabase.auth.verifyOtp({
                  token_hash: tokenToUse,
                  type: 'recovery'
                })

                if (!error && data.session) {
                  console.log('✅ Admin recovery token verified successfully via verifyOtp')
                  console.log('🔐 Admin session established:', {
                    userId: data.session.user.id,
                    email: data.session.user.email
                  })
                  sessionSet = true
                } else {
                  console.log('❌ Admin verifyOtp failed:', error?.message)
                }
              } catch (verifyError) {
                console.log('❌ Admin verifyOtp exception:', verifyError)
              }
            }

            // Method 3: Try setSession as final fallback (if we have refresh token)
            if (!sessionSet && refreshToken) {
              try {
                console.log('🔄 Trying admin setSession fallback...')
                const { error } = await supabase.auth.setSession({
                  access_token: tokenToUse,
                  refresh_token: refreshToken,
                })

                if (!error) {
                  console.log('✅ Admin session set successfully via setSession fallback')
                  sessionSet = true
                } else {
                  console.log('❌ Admin setSession failed:', error?.message)
                }
              } catch (sessionError) {
                console.log('❌ Admin setSession exception:', sessionError)
              }
            }

            // If none of the methods worked, show error
            if (!sessionSet) {
              console.log('❌ All admin token verification methods failed')
              setError('Invalid or expired admin reset link. Please request a new password reset.')
            }
          } catch (generalError) {
            console.error('❌ General admin token processing error:', generalError)
            setError('An error occurred while validating your admin reset link. Please try again.')
          }
        }
        // Handle different Supabase URL formats for legacy tokens
        else if ((type === 'recovery' && accessToken)) {
          // This is the format Supabase uses for legacy password recovery
          console.log('🔑 Processing admin legacy recovery token...')

          try {
            // Use the access token for legacy format
            console.log('🔑 Using admin access token for verification:', accessToken ? 'present' : 'missing')
            
            // Try multiple approaches to handle the token (same as user reset)
            let sessionSet = false

            // Method 1: Try exchangeCodeForSession (for newer Supabase versions)
            try {
              console.log('🔄 Trying admin exchangeCodeForSession for legacy token...')
              const { data, error } = await supabase.auth.exchangeCodeForSession(accessToken)

              if (!error && data.session) {
                console.log('✅ Admin legacy session exchanged successfully via exchangeCodeForSession')
                sessionSet = true
              } else {
                console.log('❌ Admin legacy exchangeCodeForSession failed:', error?.message)
              }
            } catch (exchangeError) {
              console.log('❌ Admin legacy exchangeCodeForSession exception:', exchangeError)
            }

            // Method 2: Try verifyOtp if exchangeCodeForSession failed
            if (!sessionSet) {
              try {
                console.log('🔄 Trying admin verifyOtp for legacy token...')
                const { data, error } = await supabase.auth.verifyOtp({
                  token_hash: accessToken,
                  type: 'recovery'
                })

                if (!error && data.session) {
                  console.log('✅ Admin legacy recovery token verified successfully via verifyOtp')
                  sessionSet = true
                } else {
                  console.log('❌ Admin legacy verifyOtp failed:', error?.message)
                }
              } catch (verifyError) {
                console.log('❌ Admin legacy verifyOtp exception:', verifyError)
              }
            }

            // Method 3: Try setSession as fallback for legacy tokens
            if (!sessionSet && refreshToken) {
              try {
                console.log('🔄 Trying admin setSession fallback for legacy token...')
                const { error } = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken,
                })

                if (!error) {
                  console.log('✅ Admin session set successfully via setSession fallback')
                  sessionSet = true
                } else {
                  console.log('❌ Admin setSession failed:', error?.message)
                }
              } catch (sessionError) {
                console.log('❌ Admin setSession exception:', sessionError)
              }
            }
            
            // If none of the methods worked, show error
            if (!sessionSet) {
              console.log('❌ All admin token verification methods failed')
              setError('Invalid or expired admin reset link. Please request a new password reset.')
            }
          } catch (generalError) {
            console.error('❌ General admin token processing error:', generalError)
            setError('An error occurred while validating your admin reset link. Please try again.')
          }
        } else if (accessToken && refreshToken) {
          // Standard token format
          console.log('🔑 Processing standard admin tokens...')

          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (error) {
            console.error('Admin session error:', error)
            if (error.message.includes('expired') || error.message.includes('invalid')) {
              setError('Your admin password reset link has expired. Please request a new password reset.')
            } else {
              setError('Invalid or expired admin reset link. Please request a new password reset.')
            }
          } else {
            console.log('✅ Admin session set successfully')
          }
        } else {
          console.log('❌ No valid admin tokens found in URL')
          setError('Invalid or expired admin reset link. Please request a new password reset.')
        }
      } catch (error) {
        console.error('Admin token validation error:', error)
        setError('An error occurred while validating your reset link. Please try again.')
      } finally {
        setInitialLoading(false)
      }
    }

    validateTokens()
  }, [searchParams, supabase])

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
      // Check if we have a valid session first
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        console.log('❌ No active session found, attempting to re-verify token...')

        // Try to re-verify the token if no session exists (same robust approach as user reset)
        const recoveryToken = searchParams.get('token')
        if (recoveryToken) {
          console.log('🔄 Attempting to re-verify admin token for password update...')

          let sessionRestored = false

          // Method 1: Try exchangeCodeForSession
          try {
            console.log('🔄 Trying exchangeCodeForSession for password update...')
            const { data, error } = await supabase.auth.exchangeCodeForSession(recoveryToken)

            if (!error && data.session) {
              console.log('✅ Admin session restored via exchangeCodeForSession')
              sessionRestored = true
            } else {
              console.log('❌ exchangeCodeForSession failed for password update:', error?.message)
            }
          } catch (exchangeError) {
            console.log('❌ exchangeCodeForSession exception for password update:', exchangeError)
          }

          // Method 2: Try verifyOtp if exchangeCodeForSession failed
          if (!sessionRestored) {
            try {
              console.log('🔄 Trying verifyOtp for password update...')
              const { data, error: verifyError } = await supabase.auth.verifyOtp({
                token_hash: recoveryToken,
                type: 'recovery'
              })

              if (!verifyError && data.session) {
                console.log('✅ Admin token re-verified successfully via verifyOtp')
                sessionRestored = true
              } else {
                console.log('❌ verifyOtp failed for password update:', verifyError?.message)
              }
            } catch (verifyError) {
              console.log('❌ verifyOtp exception for password update:', verifyError)
            }
          }

          if (!sessionRestored) {
            console.log('❌ All token re-verification methods failed')
            setError('Your session has expired. Please request a new password reset link.')
            return
          }

          console.log('✅ Token re-verified successfully, proceeding with password update')
        } else {
          setError('Auth session missing. Please request a new password reset link.')
          return
        }
      }

      console.log('🔄 Updating admin password...')
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) {
        console.error('❌ Admin password update failed:', error)
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
