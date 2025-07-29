'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/hooks/use-auth'
import { useAdminConfig } from '@/hooks/use-admin-config'
import { adminQueries } from '@/lib/supabase/queries'
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
  UserCheck,
  ArrowLeft
} from 'lucide-react'
import { toast } from 'sonner'

interface AdminLayoutProps {
  children: React.ReactNode
}

function AdminLoginForm() {
  const { signInWithEmail } = useAuth()
  const { adminEmail, loading: configLoading, error: configError } = useAdminConfig()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await signInWithEmail(formData.email, formData.password)
      toast.success('Admin login successful!')
    } catch (err: unknown) {
      const errorMessage = (err as Error).message || 'Failed to sign in'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (error) setError(null)
  }

  // Pre-fill admin email when available
  useEffect(() => {
    if (adminEmail && !formData.email) {
      setFormData(prev => ({ ...prev, email: adminEmail }))
    }
  }, [adminEmail, formData.email])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-sm sm:max-w-md lg:max-w-lg xl:max-w-xl space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6 transition-colors duration-200 min-h-[44px] px-2 py-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Foryoupiece
          </Link>
          <div className="flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 sm:h-10 sm:w-10 text-black mr-3" />
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black">Admin Access</h2>
          </div>
          <p className="mt-2 text-sm sm:text-base text-gray-600 max-w-md mx-auto">
            Secure administrator login portal
          </p>
        </div>

        <Card className="border-gray-200 shadow-lg">
          <CardHeader className="bg-white border-b border-gray-100 pb-6">
            <CardTitle className="text-black flex items-center text-lg sm:text-xl">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6 mr-3" />
              Administrator Login
            </CardTitle>
            <CardDescription className="text-gray-600 text-sm sm:text-base mt-2">
              This area is restricted to authorized administrators only
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6 px-6 sm:px-8 pb-8">
            {/* Error Alert */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm sm:text-base text-red-700">{error}</p>
              </div>
            )}

            {/* Admin Login Form */}
            <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
              <div>
                <Label htmlFor="email" className="text-sm sm:text-base font-medium text-gray-700">
                  Administrator Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter admin email"
                  className="mt-2 h-11 sm:h-12 text-sm sm:text-base"
                />
              </div>

              <div>
                <Label htmlFor="password" className="text-sm sm:text-base font-medium text-gray-700">
                  Password
                </Label>
                <div className="relative mt-2">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Enter admin password"
                    className="pr-12 h-11 sm:h-12 text-sm sm:text-base"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center min-h-[44px] min-w-[44px] justify-center hover:bg-gray-50 rounded-r-md transition-colors duration-200"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-black hover:bg-gray-800 text-white h-11 sm:h-12 text-sm sm:text-base font-medium transition-colors duration-200"
                disabled={loading}
              >
                {loading ? 'Authenticating...' : 'Access Admin Panel'}
              </Button>
            </form>

            <Link
              href="/en/auth/admin-forgot-password"
              className="block text-center text-sm text-gray-600 hover:text-black transition-colors duration-200 min-h-[44px] flex items-center justify-center"
            >
              Forgot your admin password?
            </Link>

            {/* Security Notice */}
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
              <div className="flex items-start">
                <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600 mt-0.5 mr-3 flex-shrink-0" />
                <div className="text-xs sm:text-sm text-gray-700">
                  <p className="font-medium mb-1">Security Notice</p>
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
  const { user, isAuthenticated, loading } = useAuth()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)

  useEffect(() => {
    checkAdminStatus()
  }, [user, isAuthenticated])

  const checkAdminStatus = async () => {
    if (!user || !isAuthenticated) {
      setCheckingAdmin(false)
      return
    }

    try {
      const adminUser = await adminQueries.getAdminUser(user.id)

      // Enhanced security check is now handled server-side in admin middleware
      // This ensures proper security without exposing admin emails client-side

      setIsAdmin(!!adminUser)

      // Log admin access
      if (adminUser) {
        console.log('Admin access granted:', {
          userId: user.id,
          email: user.email,
          role: adminUser.role,
          timestamp: new Date().toISOString()
        })
      }
    } catch (error) {
      console.error('Error checking admin status:', error)
      setIsAdmin(false)
    } finally {
      setCheckingAdmin(false)
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
    // Unauthorized access attempt - handled gracefully

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md border-red-200">
          <CardContent className="p-6 text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-semibold mb-2 text-red-800">Access Denied</h2>
            <p className="text-gray-600 mb-4">You don&apos;t have permission to access the admin panel.</p>
            <div className="space-y-2">
              <Button
                onClick={() => router.push('/en/auth/login')}
                className="w-full bg-red-600 hover:bg-red-700"
              >
                Admin Login
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/')}
                className="w-full"
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
      href: '/fyponly-admin',
      icon: LayoutDashboard,
      current: false
    },
    {
      name: 'Products',
      href: '/fyponly-admin/products',
      icon: Package,
      current: false
    },
    {
      name: 'Orders',
      href: '/fyponly-admin/orders',
      icon: ShoppingCart,
      current: false
    },
    {
      name: 'Users',
      href: '/fyponly-admin/users',
      icon: Users,
      current: false
    },
    {
      name: 'Analytics',
      href: '/fyponly-admin/analytics',
      icon: BarChart3,
      current: false
    },
    {
      name: 'BoxHero Sync',
      href: '/fyponly-admin/boxhero-sync',
      icon: RefreshCw,
      current: false
    },
    {
      name: 'Reports',
      href: '/fyponly-admin/reports',
      icon: FileText,
      current: false
    },
    {
      name: 'Settings',
      href: '/fyponly-admin/settings',
      icon: Settings,
      current: false
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <div className="hidden md:flex md:w-64 md:flex-col">
          <div className="flex flex-col flex-grow pt-5 bg-white overflow-y-auto border-r">
            <div className="flex items-center flex-shrink-0 px-4">
              <div className="flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-sm">
                  FYP
                </div>
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

        {/* Main content */}
        <div className="flex flex-col flex-1">
          {/* Top bar */}
          <div className="bg-white shadow-sm border-b">
            <div className="px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center">
                  <h1 className="text-lg font-semibold text-gray-900">
                    ForYouPiece Admin Panel
                  </h1>
                </div>
                <div className="flex items-center space-x-4">
                  <Button asChild variant="outline" size="sm">
                    <Link href="/">
                      View Store
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Page content */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
