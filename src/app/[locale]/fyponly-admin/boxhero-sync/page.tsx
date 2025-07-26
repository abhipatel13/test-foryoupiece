'use client'

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, RefreshCw, CheckCircle, XCircle, Clock, Database, Zap, Settings, Activity, BarChart3, History } from 'lucide-react';
import { useEnhancedSync, useCacheInvalidation } from '@/hooks/useRealTimeRefresh';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface SyncResult {
  success: boolean;
  categoriesSynced?: number;
  totalItemsProcessed?: number;
  duration?: number;
  error?: string;
  timestamp: string;
}

interface SyncStatus {
  lastSync: any;
  recentLogs: any[];
  isHealthy: boolean;
}

export default function BoxHeroSyncPage() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const queryClient = useQueryClient();

  // Enhanced sync functionality
  const {
    isSyncing: isEnhancedSyncing,
    syncHistory,
    startEnhancedSync,
    loadSyncHistory
  } = useEnhancedSync();

  const {
    isInvalidating,
    invalidateAll,
    invalidateCategories,
    invalidateProducts
  } = useCacheInvalidation();

  // Sync options for enhanced sync
  const [syncOptions, setSyncOptions] = useState({
    syncCategories: true,
    syncImages: true,
    syncProducts: false,
    dryRun: false
  });

  // Fetch sync status on component mount
  useEffect(() => {
    fetchSyncStatus();
  }, []);

  const fetchSyncStatus = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/boxhero/sync');
      const data = await response.json();
      
      if (data.success) {
        setSyncStatus(data.data);
      }
    } catch (error) {
      console.error('Error fetching sync status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const triggerSync = async () => {
    try {
      setIsSyncing(true);
      setLastSyncResult(null);
      
      const response = await fetch('/api/admin/boxhero/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          triggeredBy: 'admin_interface'
        })
      });
      
      const result = await response.json();

      // Transform the result to match expected format
      const transformedResult = {
        success: result.success,
        categoriesSynced: result.data?.categoriesSynced,
        totalItemsProcessed: result.data?.totalItemsProcessed,
        productsUpdated: result.data?.productsUpdated || 0,
        productsSkipped: result.data?.productsSkipped || 0,
        productItemsProcessed: result.data?.productItemsProcessed || 0,
        duration: result.data?.duration,
        error: result.error,
        timestamp: result.data?.timestamp || new Date().toISOString()
      };

      setLastSyncResult(transformedResult);

      // Trigger cache invalidation if sync was successful
      if (result.success) {
        console.log('🗑️ Invalidating React Query cache after successful BoxHero sync');

        // Invalidate all product-related queries
        await queryClient.invalidateQueries({ queryKey: ['products'] });
        await queryClient.invalidateQueries({ queryKey: ['product'] });
        await queryClient.invalidateQueries({ queryKey: ['categories'] });
        await queryClient.invalidateQueries({ queryKey: ['inventory'] });

        // IMPORTANT: Invalidate dashboard stats to show updated counts
        await queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });

        console.log('✅ React Query cache invalidated successfully');
        toast.success('Sync completed successfully! Product data refreshed.');
      } else {
        toast.error('Sync failed: ' + (result.error || 'Unknown error'));
      }

      // Refresh sync status after sync
      await fetchSyncStatus();
      
    } catch (error) {
      console.error('Error triggering sync:', error);
      setLastSyncResult({
        success: false,
        error: 'Failed to trigger sync',
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (ms: number) => {
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Enhanced sync methods
  const handleEnhancedSync = async () => {
    try {
      const result = await startEnhancedSync(syncOptions);

      // Invalidate dashboard stats after enhanced sync
      console.log('🗑️ Invalidating dashboard cache after enhanced sync...');
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });

      toast.success(`Enhanced sync completed successfully!`);
      // Refresh the regular sync status too
      await fetchSyncStatus();
    } catch (error) {
      toast.error('Enhanced sync failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleCacheInvalidation = async (type: string) => {
    try {
      switch (type) {
        case 'all':
          await invalidateAll();
          break;
        case 'categories':
          await invalidateCategories();
          break;
        case 'products':
          await invalidateProducts();
          break;
      }
      toast.success(`${type} cache invalidated successfully`);
    } catch (error) {
      toast.error('Cache invalidation failed');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">BoxHero Sync Management</h1>
        <p className="text-muted-foreground">
          Comprehensive BoxHero inventory synchronization with basic and advanced features.
        </p>
      </div>

      {/* Main Sync Interface with Tabs */}
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic" className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Basic Sync
          </TabsTrigger>
          <TabsTrigger value="enhanced" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Enhanced Sync
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Sync History
          </TabsTrigger>
          <TabsTrigger value="cache" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            Cache Management
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-6">
          <div className="space-y-6">

      {/* Sync Control Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Manual Sync Control
          </CardTitle>
          <CardDescription>
            Trigger a manual sync to update categories, products, and stock quantities from BoxHero inventory
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button 
              onClick={triggerSync} 
              disabled={isSyncing}
              className="flex items-center gap-2"
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={fetchSyncStatus}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Database className="h-4 w-4" />
              Refresh Status
            </Button>
          </div>

          {/* Last Sync Result */}
          {lastSyncResult && (
            <div className="mt-4 p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                {lastSyncResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span className="font-medium">
                  {lastSyncResult.success ? 'Sync Successful' : 'Sync Failed'}
                </span>
                <Badge variant={lastSyncResult.success ? 'default' : 'destructive'}>
                  {formatDate(lastSyncResult.timestamp)}
                </Badge>
              </div>
              
              {lastSyncResult.success ? (
                <div className="text-sm text-muted-foreground">
                  <p>Categories synced: {lastSyncResult.categoriesSynced}</p>
                  <p>Total items processed: {lastSyncResult.totalItemsProcessed}</p>
                  {(lastSyncResult.productsUpdated > 0 || lastSyncResult.productItemsProcessed > 0) && (
                    <>
                      <p>Products updated: {lastSyncResult.productsUpdated}</p>
                      <p>Products processed: {lastSyncResult.productItemsProcessed}</p>
                      {lastSyncResult.productsSkipped > 0 && (
                        <p>Products skipped: {lastSyncResult.productsSkipped}</p>
                      )}
                    </>
                  )}
                  <p>Duration: {formatDuration(lastSyncResult.duration || 0)}</p>
                </div>
              ) : (
                <p className="text-sm text-red-600">{lastSyncResult.error}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Sync Status
          </CardTitle>
          <CardDescription>
            Current synchronization status and health
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading sync status...</span>
            </div>
          ) : syncStatus ? (
            <div className="space-y-4">
              {/* Health Status */}
              <div className="flex items-center gap-2">
                <span className="font-medium">Health Status:</span>
                <Badge variant={syncStatus.isHealthy ? 'default' : 'destructive'}>
                  {syncStatus.isHealthy ? 'Healthy' : 'Needs Sync'}
                </Badge>
              </div>

              {/* Last Successful Sync */}
              {syncStatus.lastSync ? (
                <div>
                  <span className="font-medium">Last Successful Sync:</span>
                  <div className="mt-1 text-sm text-muted-foreground">
                    <p>Date: {formatDate(syncStatus.lastSync.created_at)}</p>
                    <p>Categories: {syncStatus.lastSync.categories_synced}</p>
                    <p>Items: {syncStatus.lastSync.total_items_processed}</p>
                    <p>Duration: {formatDuration(syncStatus.lastSync.sync_duration_ms)}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No successful sync found</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Failed to load sync status</p>
          )}
        </CardContent>
      </Card>

      {/* Recent Sync Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Sync History</CardTitle>
          <CardDescription>
            Last 5 sync operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {syncStatus?.recentLogs && syncStatus.recentLogs.length > 0 ? (
            <div className="space-y-3">
              {syncStatus.recentLogs.map((log: any) => (
                <div key={log.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    {log.status === 'completed' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : log.status === 'failed' ? (
                      <XCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <Clock className="h-4 w-4 text-yellow-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {log.status === 'completed' ? 'Completed' : 
                         log.status === 'failed' ? 'Failed' : 'In Progress'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(log.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    {log.status === 'completed' && (
                      <p>{log.categories_synced} categories</p>
                    )}
                    {log.error_message && (
                      <p className="text-red-600 max-w-xs truncate">{log.error_message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No sync history available</p>
          )}
        </CardContent>
      </Card>
          </div>
        </TabsContent>

        <TabsContent value="enhanced" className="mt-6">
          <div className="space-y-6">
            {/* Enhanced Sync Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Enhanced Sync Configuration
                </CardTitle>
                <CardDescription>
                  Configure advanced sync options with detailed reporting
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={syncOptions.syncCategories}
                      onChange={(e) => setSyncOptions(prev => ({ ...prev, syncCategories: e.target.checked }))}
                      disabled={isEnhancedSyncing}
                    />
                    <span>Categories</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={syncOptions.syncImages}
                      onChange={(e) => setSyncOptions(prev => ({ ...prev, syncImages: e.target.checked }))}
                      disabled={isEnhancedSyncing}
                    />
                    <span>Images</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={syncOptions.syncProducts}
                      onChange={(e) => setSyncOptions(prev => ({ ...prev, syncProducts: e.target.checked }))}
                      disabled={isEnhancedSyncing}
                    />
                    <span>Products (Beta)</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={syncOptions.dryRun}
                      onChange={(e) => setSyncOptions(prev => ({ ...prev, dryRun: e.target.checked }))}
                      disabled={isEnhancedSyncing}
                    />
                    <span>Dry Run</span>
                  </label>
                </div>

                <Button
                  onClick={handleEnhancedSync}
                  disabled={isEnhancedSyncing}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isEnhancedSyncing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4 mr-2" />
                  )}
                  {isEnhancedSyncing ? 'Enhanced Syncing...' : 'Start Enhanced Sync'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Enhanced Sync History</CardTitle>
              <CardDescription>
                Detailed history of enhanced sync operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {syncHistory.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No enhanced sync history available. Start your first enhanced sync above.
                </p>
              ) : (
                <div className="space-y-4">
                  {syncHistory.slice(0, 10).map((sync: any) => (
                    <div
                      key={sync.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <Badge variant={sync.status === 'completed' ? 'default' : 'destructive'}>
                          {sync.status === 'completed' ? (
                            <CheckCircle className="w-3 h-3 mr-1" />
                          ) : (
                            <XCircle className="w-3 h-3 mr-1" />
                          )}
                          {sync.status}
                        </Badge>
                        <div>
                          <p className="font-medium">
                            {new Date(sync.startedAt).toLocaleString()}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {sync.triggeredBy} • {sync.duration ? `${(sync.duration / 1000).toFixed(1)}s` : 'N/A'}
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

        <TabsContent value="cache" className="mt-6">
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
                  <Database className="w-4 h-4 mr-2" />
                  Categories Cache
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCacheInvalidation('products')}
                  disabled={isInvalidating}
                >
                  <Database className="w-4 h-4 mr-2" />
                  Products Cache
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
