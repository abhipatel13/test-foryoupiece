'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Database,
  TrendingUp,
  Package,
  Zap,
  Settings,
  Activity,
  BarChart3,
  History
} from 'lucide-react'
import { useEnhancedSync, useCacheInvalidation } from '@/hooks/useRealTimeRefresh'
import { toast } from 'sonner'

interface SyncMetrics {
  before: {
    products: number
    categories: number
    totalStock: number
  }
  after: {
    products: number
    categories: number
    totalStock: number
  }
  changes: {
    productsAdded: number
    productsUpdated: number
    categoriesAdded: number
    categoriesUpdated: number
    inventoryAdjustments: number
  }
  performance: {
    duration: number
    apiCalls: number
    cacheInvalidations: number
  }
  errors: Array<{
    type: 'error' | 'warning'
    message: string
    timestamp: string
  }>
}

export default function EnhancedSyncDashboard() {
  const [syncOptions, setSyncOptions] = useState({
    syncCategories: true,
    syncImages: true,
    syncProducts: false,
    dryRun: false
  })

  const {
    isSyncing,
    lastSync,
    syncHistory,
    startEnhancedSync,
    loadSyncHistory
  } = useEnhancedSync()

  const {
    isInvalidating,
    invalidateAll,
    invalidateCategories,
    invalidateProducts
  } = useCacheInvalidation()

  const [selectedSync, setSelectedSync] = useState<any>(null)

  useEffect(() => {
    loadSyncHistory()
  }, [loadSyncHistory])

  const handleEnhancedSync = async () => {
    try {
      const result = await startEnhancedSync(syncOptions)
      toast.success(`Enhanced sync completed successfully!`)
      setSelectedSync(result.syncReport)
    } catch (error) {
      toast.error('Enhanced sync failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  const handleCacheInvalidation = async (type: string) => {
    try {
      switch (type) {
        case 'all':
          await invalidateAll()
          break
        case 'categories':
          await invalidateCategories()
          break
        case 'products':
          await invalidateProducts()
          break
      }
      toast.success(`${type} cache invalidated successfully`)
    } catch (error) {
      toast.error('Cache invalidation failed')
    }
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>
      case 'in_progress':
        return <Badge variant="secondary"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />In Progress</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Enhanced BoxHero Sync</h2>
          <p className="text-muted-foreground">
            Comprehensive sync with detailed reporting and real-time monitoring
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={handleEnhancedSync}
            disabled={isSyncing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSyncing ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-2" />
            )}
            {isSyncing ? 'Syncing...' : 'Start Enhanced Sync'}
          </Button>
        </div>
      </div>

      {/* Sync Options */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Sync Configuration
          </CardTitle>
          <CardDescription>
            Configure what data to sync and how to process it
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={syncOptions.syncCategories}
                onChange={(e) => setSyncOptions(prev => ({ ...prev, syncCategories: e.target.checked }))}
                disabled={isSyncing}
              />
              <span>Categories</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={syncOptions.syncImages}
                onChange={(e) => setSyncOptions(prev => ({ ...prev, syncImages: e.target.checked }))}
                disabled={isSyncing}
              />
              <span>Images</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={syncOptions.syncProducts}
                onChange={(e) => setSyncOptions(prev => ({ ...prev, syncProducts: e.target.checked }))}
                disabled={isSyncing}
              />
              <span>Products (Beta)</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={syncOptions.dryRun}
                onChange={(e) => setSyncOptions(prev => ({ ...prev, dryRun: e.target.checked }))}
                disabled={isSyncing}
              />
              <span>Dry Run</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Cache Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Cache Management
          </CardTitle>
          <CardDescription>
            Invalidate caches to ensure fresh data display
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCacheInvalidation('all')}
              disabled={isInvalidating}
            >
              <Zap className="w-4 h-4 mr-2" />
              Clear All Cache
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCacheInvalidation('categories')}
              disabled={isInvalidating}
            >
              <Package className="w-4 h-4 mr-2" />
              Categories Cache
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCacheInvalidation('products')}
              disabled={isInvalidating}
            >
              <Package className="w-4 h-4 mr-2" />
              Products Cache
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sync History and Details */}
      <Tabs defaultValue="history" className="w-full">
        <TabsList>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Sync History
          </TabsTrigger>
          <TabsTrigger value="details" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Detailed Report
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Performance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Sync Operations</CardTitle>
              <CardDescription>
                History of enhanced sync operations with detailed metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              {syncHistory.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No sync history available. Start your first enhanced sync above.
                </p>
              ) : (
                <div className="space-y-4">
                  {syncHistory.slice(0, 10).map((sync: any) => (
                    <div
                      key={sync.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => setSelectedSync(sync)}
                    >
                      <div className="flex items-center gap-4">
                        {getStatusBadge(sync.status)}
                        <div>
                          <p className="font-medium">
                            {new Date(sync.startedAt).toLocaleString()}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {sync.triggeredBy} • {formatDuration(sync.duration || 0)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {sync.metrics?.changes?.categoriesAdded || 0} categories
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {sync.metrics?.errors?.length || 0} errors
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          {selectedSync ? (
            <Card>
              <CardHeader>
                <CardTitle>Sync Report Details</CardTitle>
                <CardDescription>
                  Comprehensive report for sync operation {selectedSync.id}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h4 className="font-medium mb-2">Before Sync</h4>
                    <div className="space-y-1 text-sm">
                      <p>Products: {selectedSync.metrics?.before?.products || 0}</p>
                      <p>Categories: {selectedSync.metrics?.before?.categories || 0}</p>
                      <p>Total Stock: {selectedSync.metrics?.before?.totalStock || 0}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Changes Made</h4>
                    <div className="space-y-1 text-sm">
                      <p>Categories Added: {selectedSync.metrics?.changes?.categoriesAdded || 0}</p>
                      <p>Categories Updated: {selectedSync.metrics?.changes?.categoriesUpdated || 0}</p>
                      <p>Inventory Adjustments: {selectedSync.metrics?.changes?.inventoryAdjustments || 0}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Performance</h4>
                    <div className="space-y-1 text-sm">
                      <p>Duration: {formatDuration(selectedSync.duration || 0)}</p>
                      <p>API Calls: {selectedSync.metrics?.performance?.apiCalls || 0}</p>
                      <p>Cache Invalidations: {selectedSync.metrics?.performance?.cacheInvalidations || 0}</p>
                    </div>
                  </div>
                </div>

                {selectedSync.metrics?.errors?.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-medium mb-2">Errors & Warnings</h4>
                    <div className="space-y-2">
                      {selectedSync.metrics.errors.map((error: any, index: number) => (
                        <Alert key={index} variant={error.type === 'error' ? 'destructive' : 'default'}>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            <strong>{error.type.toUpperCase()}:</strong> {error.message}
                            <br />
                            <small className="text-muted-foreground">
                              {new Date(error.timestamp).toLocaleString()}
                            </small>
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">
                  Select a sync operation from the history to view detailed report
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Analytics</CardTitle>
              <CardDescription>
                Sync performance trends and optimization insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Performance analytics will be available after running multiple sync operations
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
