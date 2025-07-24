'use client'

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, CheckCircle, XCircle, Clock, Database, Zap } from 'lucide-react';

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
      setLastSyncResult(result);
      
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">BoxHero Sync Management</h1>
        <p className="text-muted-foreground">
          Manually synchronize product categories from BoxHero inventory system to local database.
        </p>
      </div>

      {/* Sync Control Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Manual Sync Control
          </CardTitle>
          <CardDescription>
            Trigger a manual sync to update categories from BoxHero inventory
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
  );
}
