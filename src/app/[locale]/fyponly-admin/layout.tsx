'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useSSRSafeAuth } from '@/lib/hooks/use-ssr-safe-auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Settings,
  BarChart3,
  FileText,
  Shield,
  RefreshCw,
  Eye,
  EyeOff,
  ArrowLeft,
  Crown,
  Tag,
  Tags,
  Award,
  Gift,
  Zap,
  AlertCircle,
  Lock,
  Mail,
  Menu,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import AdminMfaEnrollment from '@/components/admin/AdminMfaEnrollment'
import AdminMfaChallenge from '@/components/admin/AdminMfaChallenge'

interface AdminLayoutProps {
  children: React.ReactNode
}

function AdminLoginForm() {
  const { signInWithEmail } = useSSRSafeAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showMfaEnrollment, setShowMfaEnrollment] = useState(false)
  const [showMfaChallenge, setShowMfaChallenge] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [mfaFactors, setMfaFactors] = useState<any>(null)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })

  // Check for password reset success message and pre-populate email
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.get('message') === 'password_reset_success') {
        setShowSuccessMessage(true)
        toast.success('Password reset successful! Please log in with your new password.')

        // Admin email will be pre-populated via useAdminConfig hook
        // No longer using client-side environment variables for security

        // Clean up the URL
        window.history.replaceState({}, '', window.location.pathname)
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Use the new Supabase MFA-enabled admin login API
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        })
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        setError(result.error || 'Login failed')
        toast.error(result.error || 'Login failed')
        return
      }

      if (result.requiresMfaEnrollment) {
        // Show MFA enrollment form
        setCurrentUser(result.user)
        setShowMfaEnrollment(true)
        toast.info(result.message)
      } else if (result.requiresMfaChallenge) {
        // Show MFA challenge form
        setCurrentUser(result.user)
        setMfaFactors(result.factors)
        setShowMfaChallenge(true)
        toast.info(result.message)
      } else {
        // Direct login success (already has MFA and is authenticated)
        toast.success(result.message)
        // The user should now be authenticated, trigger a page refresh
        window.location.reload()
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to sign in'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleMfaSuccess = () => {
    toast.success('Admin access granted!')
    // Trigger page refresh to update authentication state
    window.location.reload()
  }

  const handleMfaBack = () => {
    setShowMfaEnrollment(false)
    setShowMfaChallenge(false)
    setCurrentUser(null)
    setMfaFactors(null)
    setFormData({ email: '', password: '' })
    setError(null)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (error) setError(null)
  }



  // Show MFA enrollment form if required
  if (showMfaEnrollment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <Link href="/" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Foryoupiece
            </Link>
          </div>
          <AdminMfaEnrollment
            user={currentUser}
            onEnrollmentSuccess={handleMfaSuccess}
            onBack={handleMfaBack}
          />
        </div>
      </div>
    )
  }

  // Show MFA challenge form if required
  if (showMfaChallenge) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <Link href="/" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Foryoupiece
            </Link>
          </div>
          <AdminMfaChallenge
            user={currentUser}
            factors={mfaFactors}
            onChallengeSuccess={handleMfaSuccess}
            onBack={handleMfaBack}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-6 sm:py-12 px-3 sm:px-4 lg:px-6 xl:px-8">
      <div className="auth-form-container w-full space-y-6 sm:space-y-8 mx-auto"
           style={{ maxWidth: '440px' }}>
        {/* Header - Mobile-First Responsive */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4 min-h-[44px] px-2 py-2 rounded-md hover:bg-gray-100 transition-colors">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Foryoupiece
          </Link>
          <div className="flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-black mr-3" />
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black">Admin Access</h2>
          </div>
          <p className="mt-2 text-sm text-gray-600 max-w-sm mx-auto">
            Secure administrator login portal
          </p>
        </div>

        <Card className="border-gray-200 shadow-lg">
          <CardHeader className="bg-white border-b border-gray-100">
            <CardTitle className="text-black flex items-center text-lg sm:text-xl">
              <Shield className="h-5 w-5 mr-3" />
              Administrator Login
            </CardTitle>
            <CardDescription className="text-red-600 text-sm">
              This area is restricted to authorized administrators only
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6 px-4 sm:px-6">
            {/* Success Alert */}
            {showSuccessMessage && (
              <div className="bg-green-50 border border-green-200 rounded-md p-3">
                <p className="text-sm text-green-700">
                  ✅ Password reset successful! Please log in with your new password.
                </p>
              </div>
            )}

            {/* Error Alert */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Admin Login Form - Mobile-First Responsive */}
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              <div>
                <Label htmlFor="email" className="text-sm font-medium text-gray-700 block mb-2">Administrator Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter admin email"
                  className="mt-1 h-11 min-h-[44px] text-base"
                />
              </div>

              <div>
                <Label htmlFor="password" className="text-sm font-medium text-gray-700 block mb-2">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Enter admin password"
                    className="pr-10 h-11 min-h-[44px] text-base"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center min-w-[44px] min-h-[44px] justify-center hover:bg-gray-100 rounded-r-md transition-colors"
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

              <Button
                type="submit"
                className="w-full bg-black hover:bg-gray-800 text-white h-11 min-h-[44px] text-base font-medium transition-colors"
                disabled={loading}
              >
                {loading ? 'Authenticating...' : 'Access Admin Panel'}
              </Button>
            </form>

            {/* Forgot Password Link */}
            <div className="text-center">
              <Link
                href="/en/auth/admin-forgot-password"
                className="text-sm text-red-600 hover:text-red-700 hover:underline min-h-[44px] inline-flex items-center px-2 py-2 rounded-md hover:bg-red-50 transition-colors"
              >
                Forgot your admin password?
              </Link>
            </div>



            {/* Security Notice */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <div className="flex">
                <Shield className="h-4 w-4 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
                <div className="text-xs text-yellow-700">
                  <p className="font-medium">Security Notice</p>
                  <p>All admin access attempts are logged and monitored. Unauthorized access is prohibited.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, isAuthenticated, loading } = useSSRSafeAuth()
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false) || 'en'
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminUser, setAdminUser] = useState<any>(null)
  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [adminCheckComplete, setAdminCheckComplete] = useState(false)

  useEffect(() => {
    // Only check admin status once per user session
    if (!adminCheckComplete && user && isAuthenticated) {
      checkAdminStatus()
    } else if (!user || !isAuthenticated) {
      setCheckingAdmin(false)
      setIsAdmin(false)
      setAdminCheckComplete(false)
    }
  }, [user, isAuthenticated, adminCheckComplete])

  const checkAdminStatus = async () => {
    if (!user || !isAuthenticated || adminCheckComplete) {
      setCheckingAdmin(false)
      return
    }

    try {
      // Use client-side API call to check admin status
      const response = await fetch('/api/admin/check-status')
      const result = await response.json()

      if (response.ok && result.isAdmin) {
        setIsAdmin(true)
        setAdminUser(result.user)

        // Log admin access only in development
        if (process.env.NODE_ENV === 'development') {
          console.log('Admin access granted:', {
            userId: result.user.id,
            email: result.user.email,
            role: result.user.role,
            timestamp: new Date().toISOString()
          })
        }
      } else {
        setIsAdmin(false)
        setAdminUser(null)
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error checking admin status:', error)
      }
      setIsAdmin(false)
      setAdminUser(null)
    } finally {
      setCheckingAdmin(false)
      setAdminCheckComplete(true)
    }
  }

  if (loading || checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking permissions...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <AdminLoginForm />
  }

  if (!isAdmin) {
    // Log unauthorized access attempt only in development
    if (process.env.NODE_ENV === 'development') {
      console.warn('Unauthorized admin access attempt:', {
        userId: user?.id,
        email: user?.email,
        timestamp: new Date().toISOString(),
        userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'unknown'
      })
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-3 sm:px-4">
        <Card className="w-full max-w-md border-red-200">
          <CardContent className="p-4 sm:p-6 text-center">
            <Shield className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 text-red-500" />
            <h2 className="text-lg sm:text-xl font-semibold mb-2 text-red-800">Access Denied</h2>
            <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4">You don't have permission to access the admin panel.</p>
            <div className="space-y-2">
              <Button
                onClick={() => router.push(`/${locale}/auth/login`)}
                className="w-full bg-red-600 hover:bg-red-700 h-10 sm:h-11 text-sm sm:text-base"
              >
                Admin Login
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/')}
                className="w-full h-10 sm:h-11 text-sm sm:text-base"
              >
                Go Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const navigation = [
    {
      name: 'Dashboard',
      href: `/${locale}/fyponly-admin`,
      icon: LayoutDashboard,
      current: false
    },
    {
      name: 'Products',
      href: `/${locale}/fyponly-admin/products`,
      icon: Package,
      current: false
    },
    {
      name: 'Product Categories',
      href: `/${locale}/fyponly-admin/product-categories`,
      icon: Tags,
      current: false
    },
    {
      name: 'Orders',
      href: `/${locale}/fyponly-admin/orders`,
      icon: ShoppingCart,
      current: false
    },
    {
      name: 'Users',
      href: `/${locale}/fyponly-admin/users`,
      icon: Users,
      current: false
    },
    {
      name: 'Coupons',
      href: `/${locale}/fyponly-admin/coupons`,
      icon: Tag,
      current: false
    },
    {
      name: 'Analytics',
      href: `/${locale}/fyponly-admin/analytics`,
      icon: BarChart3,
      current: false
    },
    {
      name: 'Points Management',
      href: `/${locale}/fyponly-admin/points`,
      icon: Crown,
      current: false
    },
    {
      name: 'Tier Management',
      href: `/${locale}/fyponly-admin/tiers`,
      icon: Award,
      current: false
    },
    {
      name: 'Tier Rewards',
      href: `/${locale}/fyponly-admin/tier-rewards`,
      icon: Gift,
      current: false
    },
    {
      name: 'BoxHero Sync',
      href: `/${locale}/fyponly-admin/boxhero-sync`,
      icon: RefreshCw,
      current: false
    },
    {
      name: 'Reports',
      href: `/${locale}/fyponly-admin/reports`,
      icon: FileText,
      current: false
    },
    {
      name: 'Settings',
      href: `/${locale}/fyponly-admin/settings`,
      icon: Settings,
      current: false
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Mobile menu overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setMobileMenuOpen(false)} />
          </div>
        )}

        {/* Mobile sidebar */}
        <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white transform transition-transform duration-300 ease-in-out md:hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="flex flex-col flex-grow pt-5 overflow-y-auto border-r">
            <div className="flex items-center justify-between flex-shrink-0 px-4">
              <div className="flex items-center space-x-2">
                <Image
                  src="/favicon.jpg"
                  alt="ForYouPiece Admin"
                  width={32}
                  height={32}
                  className="rounded-lg shadow-sm object-contain"
                  priority
                />
                <span className="font-bold text-lg sm:text-xl">Admin</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 flex-grow flex flex-col">
              <nav className="flex-1 px-2 pb-4 space-y-1">
                {navigation.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    >
                      <Icon className="mr-3 flex-shrink-0 h-5 w-5" />
                      {item.name}
                    </Link>
                  )
                })}
              </nav>
            </div>

            <div className="flex-shrink-0 p-4">
              <Separator className="mb-4" />
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                    <Shield className="h-4 w-4 text-indigo-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    Admin User
                  </p>
                  <Badge variant="secondary" className="text-xs">
                    Administrator
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop sidebar */}
        <div className="hidden md:flex md:w-64 md:flex-col">
          <div className="flex flex-col flex-grow pt-5 bg-white overflow-y-auto border-r">
            <div className="flex items-center flex-shrink-0 px-4">
              <div className="flex items-center space-x-2">
                <Image
                  src="/favicon.jpg"
                  alt="ForYouPiece Admin"
                  width={32}
                  height={32}
                  className="rounded-lg shadow-sm object-contain"
                  priority
                />
                <span className="font-bold text-xl">Admin</span>
              </div>
            </div>

            <div className="mt-5 flex-grow flex flex-col">
              <nav className="flex-1 px-2 pb-4 space-y-1">
                {navigation.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    >
                      <Icon className="mr-3 flex-shrink-0 h-5 w-5" />
                      {item.name}
                    </Link>
                  )
                })}
              </nav>
            </div>

            <div className="flex-shrink-0 p-4">
              <Separator className="mb-4" />
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                    <Shield className="h-4 w-4 text-indigo-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    Admin User
                  </p>
                  <Badge variant="secondary" className="text-xs">
                    Administrator
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main content - Mobile-First Responsive */}
        <div className="flex flex-col flex-1 w-full md:w-auto">
          {/* Top bar - Mobile-First Responsive */}
          <div className="bg-white shadow-sm border-b">
            <div className="px-3 sm:px-4 lg:px-6 xl:px-8">
              <div className="flex justify-between items-center h-14 sm:h-16">
                <div className="flex items-center space-x-3">
                  {/* Mobile menu button */}
                  <button
                    onClick={() => setMobileMenuOpen(true)}
                    className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                  >
                    <Menu className="h-5 w-5" />
                  </button>
                  <h1 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                    Foryoupiece Admin Panel
                  </h1>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-4">
                  <Button asChild variant="outline" size="sm" className="text-xs sm:text-sm">
                    <Link href="/">
                      View Store
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Page content - Mobile-First Responsive */}
          <main className="flex-1 p-3 sm:p-4 lg:p-6 xl:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
