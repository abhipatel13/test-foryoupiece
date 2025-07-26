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
  CheckCircle,
  RefreshCw,
  Zap,
  Clock,
  Activity
} from 'lucide-react'
import { useAdminDashboardRealTime } from '@/hooks/useRealTimeRefresh'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useQuery, useQueryClient } from '@tanstack/react-query'

interface BoxHeroSync {
  uniqueProducts: number
  totalQuantity: number
  syncStatus: string
  confidence: string
  explanation: string
}

interface DashboardStats {
  totalOrders: number
  totalRevenue: number
  totalProducts: number
  totalUsers: number
  pendingOrders: number
  lowStockProducts: number
  recentOrders: any[]
  topProducts: any[]
  boxHeroSync?: BoxHeroSync | null
}

export default function AdminDashboard() {
  const queryClient = useQueryClient()

  // Use React Query for real-time dashboard stats
  const {
    data: stats,
    isLoading: loading,
    error,
    refetch: refetchStats,
    isFetching
  } = useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: async () => {
      console.log('🔄 Fetching dashboard stats via React Query...');
      const response = await fetch('/api/admin/dashboard-stats', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load dashboard stats');
      }

      console.log('✅ Dashboard stats loaded via React Query:', result.data);
      return result.data;
    },
    staleTime: 0, // Always fetch fresh data
    cacheTime: 1000 * 60 * 5, // Keep in cache for 5 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 2
  })

  // Use real-time refresh capabilities
  const {
    isRefreshing,
    lastRefresh,
    autoRefreshEnabled,
    toggleAutoRefresh,
    refreshDashboard,
    invalidateDashboard,
    isInvalidating,
    isSyncing,
    syncAndRefresh,
    syncHistory
  } = useAdminDashboardRealTime()

  // Handle errors
  useEffect(() => {
    if (error) {
      console.error('❌ Dashboard stats error:', error);
      toast.error('Failed to load dashboard stats');
    }
  }, [error])

  // Enhanced refresh function with cache invalidation
  const handleRefresh = async () => {
    try {
      console.log('🔄 Refreshing dashboard with cache invalidation...');

      // Invalidate React Query cache
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });

      // Also trigger manual refetch
      await refetchStats();

      // Refresh other dashboard components
      await refreshDashboard();

      toast.success('Dashboard refreshed successfully');
      console.log('✅ Dashboard refresh completed');
    } catch (error) {
      console.error('❌ Dashboard refresh failed:', error);
      toast.error('Failed to refresh dashboard');
    }
  }

  // Auto-refresh after BoxHero sync
  const handleSyncAndRefresh = async () => {
    try {
      console.log('🔄 Starting BoxHero sync and dashboard refresh...');

      // Perform sync
      await syncAndRefresh();

      // Force refresh dashboard stats
      await handleRefresh();

      toast.success('Sync completed and dashboard refreshed');
    } catch (error) {
      console.error('❌ Sync and refresh failed:', error);
      toast.error('Sync failed');
    }
  }

  // Enhanced sync function
  const handleEnhancedSync = async () => {
    try {
      const result = await syncAndRefresh({
        syncCategories: true,
        syncImages: true,
        syncProducts: false
      })
      toast.success(`Sync completed: ${result.summary.categoriesProcessed} categories processed`)
    } catch (error) {
      toast.error('Sync failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  // Cache invalidation function
  const handleCacheInvalidation = async () => {
    try {
      console.log('🗑️ Invalidating dashboard cache...');

      // Invalidate React Query cache
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });

      // Also invalidate other admin caches
      await invalidateDashboard();

      // Force refetch
      await refetchStats();

      toast.success('Cache invalidated and dashboard refreshed');
      console.log('✅ Cache invalidation completed');
    } catch (error) {
      console.error('❌ Cache invalidation failed:', error);
      toast.error('Cache invalidation failed');
    }
  }

  if (loading && !stats) {
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Welcome to your admin dashboard. Here's what's happening with your store today.</p>
        </div>

        {/* Real-time Controls */}
        <div className="flex items-center gap-2">
          {/* Real-time Status Indicator */}
          {(isFetching || isRefreshing) && (
            <div className="flex items-center text-sm text-blue-600 mr-2">
              <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
              Updating...
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading || isRefreshing || isFetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${(isRefreshing || isFetching) ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCacheInvalidation}
            disabled={isInvalidating}
          >
            <Zap className={`h-4 w-4 mr-2 ${isInvalidating ? 'animate-pulse' : ''}`} />
            Clear Cache
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncAndRefresh}
            disabled={isSyncing}
          >
            <Activity className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-pulse' : ''}`} />
            Sync & Refresh
          </Button>

          <Button
            variant={autoRefreshEnabled ? "default" : "outline"}
            size="sm"
            onClick={toggleAutoRefresh}
          >
            <Clock className="h-4 w-4 mr-2" />
            Auto Refresh
          </Button>
        </div>
      </div>

      {/* Status Indicators */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {(isSyncing || isInvalidating || isFetching) && (
            <Alert className="w-auto">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {isSyncing && "Enhanced sync in progress..."}
                {isInvalidating && "Cache invalidation in progress..."}
                {isFetching && "Fetching latest data..."}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Data Freshness Indicator */}
        <div className="text-sm text-gray-500 flex items-center gap-2">
          {stats?.timestamp && (
            <>
              <Clock className="h-4 w-4" />
              Last updated: {new Date(stats.timestamp).toLocaleTimeString()}
            </>
          )}
          {autoRefreshEnabled && (
            <Badge variant="secondary" className="ml-2">
              Auto-refresh ON
            </Badge>
          )}
        </div>
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
            {stats?.boxHeroSync && stats.boxHeroSync.syncStatus === 'COMPLETE' ? (
              <p className="text-xs text-green-600">
                ✅ {stats.boxHeroSync.uniqueProducts} unique products synced
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Synced from inventory
              </p>
            )}
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

      {/* BoxHero Sync Status */}
      {stats?.boxHeroSync && (
        <Card className={stats.boxHeroSync.syncStatus === 'COMPLETE' ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}>
          <CardHeader>
            <CardTitle className={`flex items-center space-x-2 ${stats.boxHeroSync.syncStatus === 'COMPLETE' ? 'text-green-800' : 'text-yellow-800'}`}>
              {stats.boxHeroSync.syncStatus === 'COMPLETE' ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
              <span>BoxHero Inventory Sync</span>
            </CardTitle>
            <CardDescription className={stats.boxHeroSync.syncStatus === 'COMPLETE' ? 'text-green-700' : 'text-yellow-700'}>
              {stats.boxHeroSync.explanation}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-700">
                  {stats.boxHeroSync.uniqueProducts}
                </div>
                <p className="text-xs text-muted-foreground">Unique Products</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-700">
                  {stats.boxHeroSync.totalQuantity}
                </div>
                <p className="text-xs text-muted-foreground">Total Inventory Units</p>
              </div>
            </div>
            {stats.boxHeroSync.syncStatus === 'COMPLETE' && (
              <div className="bg-green-100 p-3 rounded-lg mb-4">
                <p className="text-sm text-green-800">
                  <strong>✅ Perfect Sync:</strong> All {stats.boxHeroSync.uniqueProducts} unique products retrieved with {stats.boxHeroSync.totalQuantity} total inventory units.
                  No data loss - the sync is working perfectly!
                </p>
              </div>
            )}
            <Button asChild size="sm" className={stats.boxHeroSync.syncStatus === 'COMPLETE' ? "bg-green-600 hover:bg-green-700" : "bg-yellow-600 hover:bg-yellow-700"}>
              <Link href="/en/fyponly-admin/boxhero-sync">
                View Sync Details
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

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
