'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { authFetch } from '@/lib/utils/auth-interceptor';

interface StockUpdate {
  id: string;
  telegram_message_id: number;
  telegram_username: string;
  telegram_user_first_name: string;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed' | 'ignored';
  products_found: number;
  products_updated: number;
  products_failed: number;
  unmatched_products: string[];
  updated_products: Array<{
    productId: string;
    productName: string;
    oldStock: number;
    newStock: number;
    quantity: number;
  }>;
  error_details?: string;
  processing_time_ms: number;
  created_at: string;
  processed_at?: string;
}

interface StockStats {
  totalUpdates: number;
  successfulUpdates: number;
  failedUpdates: number;
  totalProductsUpdated: number;
  averageProcessingTime: number;
  recentActivity: StockUpdate[];
}

export default function TelegramStockMonitoring() {
  const [stats, setStats] = useState<StockStats | null>(null);
  const [recentUpdates, setRecentUpdates] = useState<StockUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchStockData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await authFetch('/api/admin/telegram/stock-monitoring');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch stock data');
      }

      setStats(result.data.stats);
      setRecentUpdates(result.data.recentUpdates);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stock data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockData();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'ignored':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: 'default',
      failed: 'destructive',
      processing: 'secondary',
      ignored: 'outline'
    };
    
    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading stock monitoring data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="p-6">
          <div className="flex items-center text-red-600">
            <XCircle className="h-5 w-5 mr-2" />
            <span>Error loading stock data: {error}</span>
          </div>
          <Button onClick={fetchStockData} className="mt-4" variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Telegram Stock Management</h2>
        <Button onClick={fetchStockData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Updates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUpdates}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.totalUpdates > 0 
                  ? Math.round((stats.successfulUpdates / stats.totalUpdates) * 100)
                  : 0}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Products Updated</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.totalProductsUpdated}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Avg Processing Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageProcessingTime}ms</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Updates */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Stock Updates</CardTitle>
        </CardHeader>
        <CardContent>
          {recentUpdates.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No stock updates found</p>
          ) : (
            <div className="space-y-4">
              {recentUpdates.map((update) => (
                <div key={update.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(update.processing_status)}
                      <span className="font-medium">
                        Message #{update.telegram_message_id}
                      </span>
                      {getStatusBadge(update.processing_status)}
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(update.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">User:</span>
                      <div className="font-medium">
                        {update.telegram_username 
                          ? `@${update.telegram_username}` 
                          : update.telegram_user_first_name}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Products Found:</span>
                      <div className="font-medium">{update.products_found}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Updated:</span>
                      <div className="font-medium text-green-600">{update.products_updated}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Failed:</span>
                      <div className="font-medium text-red-600">{update.products_failed}</div>
                    </div>
                  </div>

                  {update.updated_products && update.updated_products.length > 0 && (
                    <div className="mt-3">
                      <span className="text-sm text-gray-600">Updated Products:</span>
                      <div className="mt-1 space-y-1">
                        {update.updated_products.map((product, index) => (
                          <div key={index} className="text-sm bg-green-50 p-2 rounded">
                            <span className="font-medium">{product.productName}</span>
                            <span className="text-gray-600 ml-2">
                              {product.oldStock} → {product.newStock} (-{product.quantity})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {update.unmatched_products && update.unmatched_products.length > 0 && (
                    <div className="mt-3">
                      <span className="text-sm text-gray-600">Unmatched Products:</span>
                      <div className="mt-1 space-y-1">
                        {update.unmatched_products.map((product, index) => (
                          <div key={index} className="text-sm bg-yellow-50 p-2 rounded">
                            <span className="font-medium">{product}</span>
                            <span className="text-gray-600 ml-2">- not found</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {update.error_details && (
                    <div className="mt-3">
                      <span className="text-sm text-gray-600">Error Details:</span>
                      <div className="text-sm bg-red-50 p-2 rounded text-red-700 mt-1">
                        {update.error_details}
                      </div>
                    </div>
                  )}

                  <div className="mt-3 text-xs text-gray-500">
                    Processing time: {update.processing_time_ms}ms
                    {update.processed_at && (
                      <span className="ml-4">
                        Processed: {new Date(update.processed_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
