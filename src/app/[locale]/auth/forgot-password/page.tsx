'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Mail, ArrowRight, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  
  const supabase = createClient()

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.push('/')
      }
    }
    checkUser()
  }, [supabase, router])

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!email.trim()) {
      setError('Please enter your email address')
      setLoading(false)
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address')
      setLoading(false)
      return
    }

    try {
      // Try the callback approach first
      const callbackUrl = `${window.location.origin}/en/auth/callback?type=recovery&redirectTo=/en/auth/reset-password`
      console.log('📧 Sending password reset email with callback URL:', callbackUrl)

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: callbackUrl,
      })

      if (error) {
        console.error('❌ Password reset email failed:', error)
        setError(error.message)
        toast.error('Password reset failed: ' + error.message)
        return
      }

      console.log('✅ Password reset email sent successfully')
      setSuccess(true)
      toast.success('Password reset email sent! Please check your inbox.')
    } catch (err) {
      console.error('❌ Password reset exception:', err)
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
            <h2 className="mt-6 text-3xl font-bold text-gray-900">Check your email</h2>
            <p className="mt-2 text-sm text-gray-600">
              We've sent password reset instructions to your email address
            </p>
          </div>

          <Card className="mt-8">
            <CardContent className="space-y-6 pt-6">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="mt-4">
                  <h3 className="text-lg font-medium text-gray-900">Email sent successfully</h3>
                  <p className="mt-2 text-sm text-gray-600">
                    We've sent a password reset link to <strong>{email}</strong>
                  </p>
                  <p className="mt-2 text-sm text-gray-600">
                    Please check your inbox and follow the instructions to reset your password.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <Button
                  onClick={() => {
                    setSuccess(false)
                    setEmail('')
                    setError('')
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Send another email
                </Button>
                
                <Button asChild className="w-full">
                  <Link href="/en/auth/login">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to login
                  </Link>
                </Button>
              </div>
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
          <h2 className="mt-6 text-3xl font-bold text-gray-900">Reset your password</h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter your email address and we'll send you a link to reset your password
          </p>
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Forgot your password?</CardTitle>
            <CardDescription>
              No worries! Enter your email address below and we'll send you a reset link.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handlePasswordReset} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="pl-10"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Sending reset email...' : 'Send reset email'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>

            <div className="text-center">
              <Link href="/en/auth/login" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                <ArrowLeft className="inline mr-1 h-3 w-3" />
                Back to login
              </Link>
            </div>
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
