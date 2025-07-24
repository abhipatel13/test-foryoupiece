'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/lib/hooks/use-auth'
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
  ArrowLeft,
  Crown,
  Tag
} from 'lucide-react'
import { toast } from 'sonner'

interface AdminLayoutProps {
  children: React.ReactNode
}

function AdminLoginForm() {
  const { signInWithEmail } = useAuth()
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
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to sign in'
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

  const handleTempLogin = async () => {
    setLoading(true)
    setError(null)

    try {
      await signInWithEmail('akito12350@gmail.com', 'temppassword123')
      toast.success('Super admin access granted!')
    } catch (err: any) {
      setError('Temporary login failed. Please use your admin credentials.')
      toast.error('Temporary login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Foryoupiece
          </Link>
          <div className="flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-red-600 mr-2" />
            <h2 className="text-3xl font-bold text-gray-900">Admin Access</h2>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            Secure administrator login portal
          </p>
        </div>

        <Card className="border-red-200">
          <CardHeader className="bg-red-50">
            <CardTitle className="text-red-800 flex items-center">
              <Shield className="h-5 w-5 mr-2" />
              Administrator Login
            </CardTitle>
            <CardDescription className="text-red-600">
              This area is restricted to authorized administrators only
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {/* Error Alert */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Admin Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Administrator Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter admin email"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative mt-1">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Enter admin password"
                    className="pr-10"
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

              <Button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700"
                disabled={loading}
              >
                {loading ? 'Authenticating...' : 'Access Admin Panel'}
              </Button>
            </form>

            {/* Temporary Login Section */}
            <div className="border-t pt-4">
              <div className="text-center mb-3">
                <p className="text-sm text-gray-600 mb-2">For testing and demonstration:</p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleTempLogin}
                disabled={loading}
              >
                <UserCheck className="h-4 w-4 mr-2" />
                {loading ? 'Accessing...' : 'Temporary Admin Access'}
              </Button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Uses akito12350@gmail.com credentials for testing
              </p>
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
  const { user, isAuthenticated, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string || 'en'
  const [isAdmin, setIsAdmin] = useState(false)
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
      const adminUser = await adminQueries.getAdminUser(user.id)

      // Enhanced security check - verify user email for super admin
      if (adminUser && adminUser.role === 'super_admin') {
        if (user.email !== 'akito12350@gmail.com') {
          if (process.env.NODE_ENV === 'development') {
            console.error('Super admin role mismatch - unauthorized access attempt')
          }
          setIsAdmin(false)
          setCheckingAdmin(false)
          setAdminCheckComplete(true)
          return
        }
      }

      setIsAdmin(!!adminUser)

      // Log admin access only in development
      if (adminUser && process.env.NODE_ENV === 'development') {
        console.log('Admin access granted:', {
          userId: user.id,
          email: user.email,
          role: adminUser.role,
          timestamp: new Date().toISOString()
        })
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error checking admin status:', error)
      }
      setIsAdmin(false)
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md border-red-200">
          <CardContent className="p-6 text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-semibold mb-2 text-red-800">Access Denied</h2>
            <p className="text-gray-600 mb-4">You don't have permission to access the admin panel.</p>
            <div className="space-y-2">
              <Button
                onClick={() => router.push(`/${locale}/auth/login`)}
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
        {/* Sidebar */}
        <div className="hidden md:flex md:w-64 md:flex-col">
          <div className="flex flex-col flex-grow pt-5 bg-white overflow-y-auto border-r">
            <div className="flex items-center flex-shrink-0 px-4">
              <div className="flex items-center space-x-2">
                <Image
                  src="/favicon.jpg"
                  alt="ForYouPiece Admin"
                  width={32}
                  height={32}
                  className="rounded-lg shadow-sm"
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

        {/* Main content */}
        <div className="flex flex-col flex-1">
          {/* Top bar */}
          <div className="bg-white shadow-sm border-b">
            <div className="px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center">
                  <h1 className="text-lg font-semibold text-gray-900">
                    Foryoupiece Admin Panel
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
