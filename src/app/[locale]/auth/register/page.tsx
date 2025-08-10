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
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('Name is required')
      return false
    }
    if (!formData.email.trim()) {
      setError('Email is required')
      return false
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long')
      return false
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return false
    }
    return true
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!validateForm()) {
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
          }
        }
      })

      if (error) {
        setError(error.message)
        toast.error('Registration failed: ' + error.message)
        return
      }

      if (data.user) {
        setSuccess(true)
        toast.success('Registration successful! Please check your email to verify your account.')
        
        // Redirect to login after a short delay
        setTimeout(() => {
          router.push('/en/auth/login?message=registration_success')
        }, 2000)
      }
    } catch (err) {
      setError('An unexpected error occurred')
      toast.error('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    setLoading(true)
    setError('')

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/en/auth/callback?redirectTo=/`,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        }
      })

      if (error) {
        setError(error.message)
        toast.error('Google sign up failed: ' + error.message)
      }
    } catch (err) {
      setError('Failed to initiate Google sign up')
      toast.error('Failed to initiate Google sign up')
    } finally {
      setLoading(false)
    }
  }



  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-6 px-4 sm:py-12 sm:px-6 lg:px-8">
        <div className="auth-form-container">
          <Card className="shadow-2xl border border-gray-200 bg-white lg:shadow-2xl lg:border-gray-300">
            <CardHeader className="text-center space-y-2 pb-4">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-2">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle className="text-xl sm:text-2xl font-semibold">Registration Successful!</CardTitle>
              <CardDescription className="text-muted-foreground leading-relaxed">
                We've sent you a verification email. Please check your inbox and click the verification link to activate your account.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <Button asChild className="w-full h-12 sm:h-11 text-base sm:text-sm font-medium">
                <Link href="/en/auth/login">
                  Continue to Login
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
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
              />
            </div>
          </Link>
          <h2 className="mt-4 sm:mt-6 text-2xl sm:text-3xl font-extrabold text-foreground">
            Create your account
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Or{' '}
            <Link href="/en/auth/login" className="font-medium text-primary hover:text-primary/80 transition-colors">
              sign in to your existing account
            </Link>
          </p>
        </div>

        <Card className="shadow-2xl border border-gray-200 bg-white mx-auto lg:shadow-2xl lg:border-gray-300">
          <CardHeader className="space-y-1 pb-6 px-8 sm:px-10 lg:px-12 pt-8 sm:pt-10 lg:pt-12">
            <CardTitle className="text-xl sm:text-2xl font-semibold text-center text-gray-900">Join Foryoupiece</CardTitle>
            <CardDescription className="text-center text-gray-600">
              Create an account to start shopping for premium Japanese products
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

            {/* Registration Form - Mobile-First */}
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter your full name"
                    className="!pl-12 h-11 text-base sm:text-sm"
                    required
                    disabled={loading}
                    autoComplete="name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="Enter your email"
                    className="!pl-12 h-11 text-base sm:text-sm"
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
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Create a password"
                    className="!pl-12 !pr-12 h-11 text-base sm:text-sm"
                    required
                    disabled={loading}
                    autoComplete="new-password"
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
                <p className="text-xs text-muted-foreground">Must be at least 6 characters long</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Confirm your password"
                    className="!pl-10 !pr-12 h-11 text-base sm:text-sm"
                    required
                    disabled={loading}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-muted/50 flex items-center justify-center min-w-[44px] min-h-[44px]"
                    disabled={loading}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-base sm:text-sm font-medium"
                disabled={loading}
              >
                {loading ? 'Creating account...' : 'Create account'}
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

            {/* Social Sign Up Options - Mobile-First Design */}
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 text-base sm:text-sm font-medium border-border hover:bg-accent hover:text-accent-foreground transition-colors"
                onClick={handleGoogleSignUp}
                disabled={loading}
              >
                <svg className="w-5 h-5 mr-3 sm:w-4 sm:h-4 sm:mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign up with Google
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer - Mobile Optimized */}
        <div className="text-center text-xs sm:text-sm text-muted-foreground px-2">
          <p className="leading-relaxed">
            By creating an account, you agree to our{' '}
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
