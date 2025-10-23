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

export default function SyncClientPage() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const queryClient = useQueryClient();

  const [isChunkSyncing, setIsChunkSyncing] = useState(false);
  const [chunkProgress, setChunkProgress] = useState({ processed: 0, updated: 0, skipped: 0, hasMore: false, cursor: null as string | null });

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

  const [syncOptions, setSyncOptions] = useState({
    syncCategories: true,
    syncImages: true,
    syncProducts: false,
    dryRun: false
  });

  useEffect(() => {
    fetchSyncStatus();
  }, []);

  const fetchSyncStatus = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/boxhero/sync');
      const data = await response.json();
      if (data.success) setSyncStatus(data.data);
    } catch (error) {
      console.error('Error fetching sync status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const runChunkedStockSync = async () => {
    try {
      setIsChunkSyncing(true);
      setChunkProgress({ processed: 0, updated: 0, skipped: 0, hasMore: false, cursor: null });

      let cursor: string | null = null;
      let totalProcessed = 0;
      let totalUpdated = 0;
      let totalSkipped = 0;
      let hasMore = true;

      while (hasMore) {
        const res: Response = await fetch('/api/admin/boxhero/stock-chunk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cursor, limit: 100 })
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          toast.error('Chunk sync failed');
          throw new Error(errText || 'Chunk sync failed');
        }
        const data: any = await res.json();
        totalProcessed += Number(data?.stats?.processed || 0);
        totalUpdated += Number(data?.stats?.itemsUpdated || 0);
        totalSkipped += Number(data?.stats?.itemsSkipped || 0);
        cursor = data?.cursor || null;
        hasMore = !!data?.hasMore;
        setChunkProgress({ processed: totalProcessed, updated: totalUpdated, skipped: totalSkipped, hasMore, cursor });
        await new Promise(r => setTimeout(r, 200));
      }

      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['product'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });
      toast.success(`Chunked stock sync completed. Updated ${totalUpdated} items.`);
    } catch (e) {
      // no-op: toast already shown
    } finally {
      setIsChunkSyncing(false);
    }
  }

  const triggerSync = async () => {
    try {
      setIsSyncing(true);
      setLastSyncResult(null);

      const response = await fetch('/api/admin/boxhero-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'full-sync',
          triggeredBy: 'admin_interface',
          dryRun: false,
          updateExisting: true,
          addNew: true,
          syncStock: true
        })
      });

      const result = await response.json();

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

      if (result.success) {
        console.log('🗑️ Invalidating React Query cache after successful BoxHero sync');
        await queryClient.invalidateQueries({ queryKey: ['products'] });
        await queryClient.invalidateQueries({ queryKey: ['product'] });
        await queryClient.invalidateQueries({ queryKey: ['categories'] });
        await queryClient.invalidateQueries({ queryKey: ['inventory'] });
        await queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });

        // Broadcast same-tab and cross-tab update signals
        if (typeof window !== 'undefined') {
          const tables = ['products','categories']
          window.dispatchEvent(new CustomEvent('fyp:admin:data-updated', { detail: { tables, reason: 'boxhero_sync' } }))
          try {
            if ('BroadcastChannel' in window) {
              const ch = new BroadcastChannel('fyp-admin-updates')
              ch.postMessage({ type: 'data-updated', tables, reason: 'boxhero_sync', ts: Date.now() })
              ch.close()
            }
          } catch {}
          try {
            localStorage.setItem('fyp:admin:last-update', JSON.stringify({ tables, reason: 'boxhero_sync', ts: Date.now() }))
          } catch {}
        }

        console.log('✅ React Query cache invalidated successfully');
        toast.success('Sync completed successfully! Product data refreshed.');
      } else {
        toast.error('Sync failed: ' + (result.error || 'Unknown error'));
      }

      await fetchSyncStatus();
    } catch (error) {
      console.error('Error triggering sync:', error);
      setLastSyncResult({ success: false, error: 'Failed to trigger sync', timestamp: new Date().toISOString() } as any);
    } finally {
      setIsSyncing(false);
    }
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleString();
  const formatDuration = (ms: number) => `${(ms / 1000).toFixed(2)}s`;

  const handleEnhancedSync = async () => {
    try {
      const result = await startEnhancedSync(syncOptions);
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });
      toast.success(`Enhanced sync completed successfully!`);
      await fetchSyncStatus();
    } catch (error) {
      toast.error('Enhanced sync failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleCacheInvalidation = async (type: string) => {
    try {
      switch (type) {
        case 'all': await invalidateAll(); break;
        case 'categories': await invalidateCategories(); break;
        case 'products': await invalidateProducts(); break;
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
        <p className="text-muted-foreground">Comprehensive BoxHero inventory synchronization with basic and advanced features.</p>
      </div>

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic" className="flex items-center gap-2"><RefreshCw className="w-4 h-4" />Basic Sync</TabsTrigger>
          <TabsTrigger value="enhanced" className="flex items-center gap-2"><Zap className="w-4 h-4" />Enhanced Sync</TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2"><History className="w-4 h-4" />Sync History</TabsTrigger>
          <TabsTrigger value="cache" className="flex items-center gap-2"><Database className="w-4 h-4" />Cache Management</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5" />Manual Sync Control</CardTitle>
                <CardDescription>Trigger a manual sync to update categories, products, and stock quantities from BoxHero inventory</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Button onClick={triggerSync} disabled={isSyncing} className="flex items-center gap-2">
                    {isSyncing ? (<Loader2 className="h-4 w-4 animate-spin" />) : (<RefreshCw className="h-4 w-4" />)}
                    {isSyncing ? 'Syncing...' : 'Sync Now'}
                  </Button>
                  <Button variant="secondary" onClick={runChunkedStockSync} disabled={isChunkSyncing} className="flex items-center gap-2">
                    {isChunkSyncing ? (<Loader2 className="h-4 w-4 animate-spin" />) : (<RefreshCw className="h-4 w-4" />)}
                    {isChunkSyncing ? 'Chunk Syncing...' : 'Chunked Stock Sync (Scalable)'}
                  </Button>
                  <Button variant="outline" onClick={fetchSyncStatus} disabled={isLoading} className="flex items-center gap-2">
                    <Database className="h-4 w-4" />Refresh Status
                  </Button>
                </div>
                {isChunkSyncing || chunkProgress.processed > 0 ? (
                  <div className="mt-3 text-sm text-muted-foreground">
                    <p>Chunked sync progress: processed {chunkProgress.processed}, updated {chunkProgress.updated}, skipped {chunkProgress.skipped}{chunkProgress.hasMore ? '...' : ''}</p>
                  </div>
                ) : null}
                {lastSyncResult && (
                  <div className="mt-4 p-4 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      {lastSyncResult.success ? (<CheckCircle className="h-5 w-5 text-green-500" />) : (<XCircle className="h-5 w-5 text-red-500" />)}
                      <span className="font-medium">{lastSyncResult.success ? 'Sync Successful' : 'Sync Failed'}</span>
                      <Badge variant={lastSyncResult.success ? 'default' : 'destructive'}>{formatDate(lastSyncResult.timestamp)}</Badge>
                    </div>
                    {lastSyncResult.success ? (
                      <div className="text-sm text-muted-foreground">
                        <p>Categories synced: {lastSyncResult.categoriesSynced}</p>
                        <p>Total items processed: {lastSyncResult.totalItemsProcessed}</p>
                        {(lastSyncResult as any).productsUpdated > 0 || (lastSyncResult as any).productItemsProcessed > 0 ? (
                          <>
                            <p>Products updated: {(lastSyncResult as any).productsUpdated}</p>
                            <p>Products processed: {(lastSyncResult as any).productItemsProcessed}</p>
                            {(lastSyncResult as any).productsSkipped > 0 && (<p>Products skipped: {(lastSyncResult as any).productsSkipped}</p>)}
                          </>
                        ) : null}
                        <p>Duration: {formatDuration(lastSyncResult.duration || 0)}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-red-600">{lastSyncResult.error}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />Sync Status</CardTitle>
                <CardDescription>Current synchronization status and health</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /><span>Loading sync status...</span></div>
                ) : syncStatus ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Health Status:</span>
                      <Badge variant={syncStatus.isHealthy ? 'default' : 'destructive'}>{syncStatus.isHealthy ? 'Healthy' : 'Needs Sync'}</Badge>
                    </div>
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
                    ) : (<p className="text-sm text-muted-foreground">No successful sync found</p>)}
                  </div>
                ) : (<p className="text-sm text-muted-foreground">Failed to load sync status</p>)}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="enhanced" className="mt-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5" />Enhanced Sync Configuration</CardTitle>
                <CardDescription>Configure advanced sync options with detailed reporting</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <label className="flex items-center space-x-2"><input type="checkbox" checked={syncOptions.syncCategories} onChange={(e) => setSyncOptions(prev => ({ ...prev, syncCategories: e.target.checked }))} disabled={isEnhancedSyncing} /><span>Categories</span></label>
                  <label className="flex items-center space-x-2"><input type="checkbox" checked={syncOptions.syncImages} onChange={(e) => setSyncOptions(prev => ({ ...prev, syncImages: e.target.checked }))} disabled={isEnhancedSyncing} /><span>Images</span></label>
                  <label className="flex items-center space-x-2"><input type="checkbox" checked={syncOptions.syncProducts} onChange={(e) => setSyncOptions(prev => ({ ...prev, syncProducts: e.target.checked }))} disabled={isEnhancedSyncing} /><span>Products (Beta)</span></label>
                  <label className="flex items-center space-x-2"><input type="checkbox" checked={syncOptions.dryRun} onChange={(e) => setSyncOptions(prev => ({ ...prev, dryRun: e.target.checked }))} disabled={isEnhancedSyncing} /><span>Dry Run</span></label>
                </div>
                <Button onClick={handleEnhancedSync} disabled={isEnhancedSyncing} className="bg-blue-600 hover:bg-blue-700">
                  {isEnhancedSyncing ? (<Loader2 className="w-4 h-4 mr-2 animate-spin" />) : (<Zap className="w-4 h-4 mr-2" />)}
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
              <CardDescription>Detailed history of enhanced sync operations</CardDescription>
            </CardHeader>
            <CardContent>
              {syncHistory.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No enhanced sync history available. Start your first enhanced sync above.</p>
              ) : (
                <div className="space-y-4">
                  {syncHistory.slice(0, 10).map((sync: any) => (
                    <div key={sync.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <Badge variant={sync.status === 'completed' ? 'default' : 'destructive'}>
                          {sync.status === 'completed' ? (<CheckCircle className="w-3 h-3 mr-1" />) : (<XCircle className="w-3 h-3 mr-1" />)}
                          {sync.status}
                        </Badge>
                        <div>
                          <p className="font-medium">{new Date(sync.startedAt).toLocaleString()}</p>
                          <p className="text-sm text-muted-foreground">{sync.triggeredBy} • {sync.duration ? `${(sync.duration / 1000).toFixed(1)}s` : 'N/A'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{sync.metrics?.changes?.categoriesAdded || 0} categories</p>
                        <p className="text-xs text-muted-foreground">{sync.metrics?.errors?.length || 0} errors</p>
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
              <CardTitle className="flex items-center gap-2"><Database className="w-5 h-5" />Cache Management</CardTitle>
              <CardDescription>Invalidate caches to ensure fresh data display</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => handleCacheInvalidation('all')} disabled={isInvalidating}><Zap className="w-4 h-4 mr-2" />Clear All Cache</Button>
                <Button variant="outline" size="sm" onClick={() => handleCacheInvalidation('categories')} disabled={isInvalidating}><Database className="w-4 h-4 mr-2" />Categories Cache</Button>
                <Button variant="outline" size="sm" onClick={() => handleCacheInvalidation('products')} disabled={isInvalidating}><Database className="w-4 h-4 mr-2" />Products Cache</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

