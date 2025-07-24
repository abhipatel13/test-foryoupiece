'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adminQueries } from '@/lib/supabase/queries'
import { formatPrice } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  TrendingUp, 
  Package, 
  ShoppingCart, 
  Users, 
  DollarSign,
  Eye,
  AlertCircle,
  CheckCircle
} from 'lucide-react'

interface DashboardStats {
  totalOrders: number
  totalRevenue: number
  totalProducts: number
  totalUsers: number
  pendingOrders: number
  lowStockProducts: number
  recentOrders: any[]
  topProducts: any[]
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardStats()
  }, [])

  const loadDashboardStats = async () => {
    try {
      const dashboardData = await adminQueries.getDashboardStats()
      setStats(dashboardData)
    } catch (error) {
      console.error('Error loading dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome to your admin dashboard. Here's what's happening with your store today.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats ? formatPrice(stats.totalRevenue) : '$0'}
            </div>
            <p className="text-xs text-muted-foreground">
              +20.1% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalOrders || 0}</div>
            <p className="text-xs text-muted-foreground">
              +180.1% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalProducts || 0}</div>
            <p className="text-xs text-muted-foreground">
              +19% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground">
              +201 since last hour
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alert Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-orange-800">
              <AlertCircle className="h-5 w-5" />
              <span>Pending Orders</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-900 mb-2">
              {stats?.pendingOrders || 0}
            </div>
            <p className="text-orange-700 mb-4">Orders awaiting payment verification</p>
            <Button asChild size="sm" className="bg-orange-600 hover:bg-orange-700">
              <Link href="/fyponly-admin/orders?status=pending">
                Review Orders
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-red-800">
              <Package className="h-5 w-5" />
              <span>Low Stock Alert</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-900 mb-2">
              {stats?.lowStockProducts || 0}
            </div>
            <p className="text-red-700 mb-4">Products with low inventory</p>
            <Button asChild size="sm" variant="destructive">
              <Link href="/fyponly-admin/products?filter=low-stock">
                Manage Inventory
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>Latest orders from your customers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.recentOrders?.length ? (
                stats.recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">#{order.order_number}</p>
                      <p className="text-sm text-gray-500">{order.customer_email}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatPrice(order.total_amount)}</p>
                      <Badge 
                        variant={order.payment_status === 'verified' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {order.payment_status}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No recent orders</p>
                </div>
              )}
            </div>
            <div className="mt-4">
              <Button asChild variant="outline" className="w-full">
                <Link href="/fyponly-admin/orders">
                  <Eye className="h-4 w-4 mr-2" />
                  View All Orders
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
            <CardDescription>Best selling products this month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.topProducts?.length ? (
                stats.topProducts.map((product, index) => (
                  <div key={product.id} className="flex items-center space-x-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-indigo-600">#{index + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{product.name_en}</p>
                      <p className="text-sm text-gray-500">{product.sales_count} sold</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatPrice(product.price)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No sales data available</p>
                </div>
              )}
            </div>
            <div className="mt-4">
              <Button asChild variant="outline" className="w-full">
                <Link href="/fyponly-admin/products">
                  <Package className="h-4 w-4 mr-2" />
                  Manage Products
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common administrative tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button asChild className="h-auto p-4 flex-col space-y-2">
              <Link href="/fyponly-admin/products/new">
                <Package className="h-6 w-6" />
                <span>Add New Product</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto p-4 flex-col space-y-2">
              <Link href="/fyponly-admin/orders?status=pending">
                <CheckCircle className="h-6 w-6" />
                <span>Process Orders</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto p-4 flex-col space-y-2">
              <Link href="/fyponly-admin/analytics">
                <TrendingUp className="h-6 w-6" />
                <span>View Analytics</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
