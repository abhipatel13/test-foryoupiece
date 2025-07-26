'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Activity,
  User,
  Clock,
  Filter,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronRight,
  Database,
  Package,
  ShoppingCart,
  Settings,
  Zap
} from 'lucide-react'
import { toast } from 'sonner'

interface ActivityLog {
  id: string
  admin_user_id: string
  action_type: string
  action_description: string
  resource_type?: string
  resource_id?: string
  resource_name?: string
  before_data?: any
  after_data?: any
  metadata?: any
  created_at: string
  admin_user?: {
    id: string
    first_name?: string
    last_name?: string
    email: string
  }
}

interface ActivityLogsSummary {
  totalActivities: number
  byActionType: Record<string, number>
  byResourceType: Record<string, number>
  byAdmin: Record<string, number>
}

export default function ActivityLogsPanel() {
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [summary, setSummary] = useState<ActivityLogsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())
  
  // Filters
  const [filters, setFilters] = useState({
    actionType: 'all',
    resourceType: 'all',
    adminUserId: '',
    days: 7,
    search: ''
  })

  // Pagination
  const [pagination, setPagination] = useState({
    limit: 20,
    offset: 0,
    total: 0,
    hasMore: false
  })

  useEffect(() => {
    loadActivityLogs()
  }, [filters, pagination.offset])

  const loadActivityLogs = async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString(),
        days: filters.days.toString()
      })

      if (filters.actionType && filters.actionType !== 'all') params.append('action_type', filters.actionType)
      if (filters.resourceType && filters.resourceType !== 'all') params.append('resource_type', filters.resourceType)
      if (filters.adminUserId) params.append('admin_user_id', filters.adminUserId)

      const response = await fetch(`/api/admin/activity-logs?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      
      if (result.success) {
        setActivityLogs(result.data.activityLogs)
        setSummary(result.data.summary)
        setPagination(prev => ({
          ...prev,
          total: result.data.pagination.total,
          hasMore: result.data.pagination.hasMore
        }))
      } else {
        throw new Error(result.error || 'Failed to load activity logs')
      }
    } catch (error) {
      console.error('❌ Failed to load activity logs:', error)
      toast.error('Failed to load activity logs')
    } finally {
      setLoading(false)
    }
  }

  const toggleLogExpansion = (logId: string) => {
    const newExpanded = new Set(expandedLogs)
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId)
    } else {
      newExpanded.add(logId)
    }
    setExpandedLogs(newExpanded)
  }

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'sync_triggered':
        return <Zap className="w-4 h-4 text-blue-500" />
      case 'product_updated':
        return <Package className="w-4 h-4 text-green-500" />
      case 'order_updated':
        return <ShoppingCart className="w-4 h-4 text-orange-500" />
      case 'cache_invalidation':
        return <Database className="w-4 h-4 text-purple-500" />
      case 'settings_changed':
        return <Settings className="w-4 h-4 text-gray-500" />
      default:
        return <Activity className="w-4 h-4 text-gray-400" />
    }
  }

  const getActionBadge = (actionType: string) => {
    const colors: Record<string, string> = {
      sync_triggered: 'bg-blue-100 text-blue-800',
      product_updated: 'bg-green-100 text-green-800',
      order_updated: 'bg-orange-100 text-orange-800',
      cache_invalidation: 'bg-purple-100 text-purple-800',
      settings_changed: 'bg-gray-100 text-gray-800'
    }

    return (
      <Badge className={colors[actionType] || 'bg-gray-100 text-gray-800'}>
        {actionType.replace('_', ' ').toUpperCase()}
      </Badge>
    )
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const filteredLogs = activityLogs.filter(log => {
    if (!filters.search) return true
    const searchLower = filters.search.toLowerCase()
    return (
      log.action_description.toLowerCase().includes(searchLower) ||
      log.resource_name?.toLowerCase().includes(searchLower) ||
      log.admin_user?.email.toLowerCase().includes(searchLower)
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Activity Logs</h2>
          <p className="text-muted-foreground">
            Track all administrative actions and system changes
          </p>
        </div>
        
        <Button onClick={loadActivityLogs} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{summary.totalActivities}</p>
                  <p className="text-sm text-muted-foreground">Total Activities</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{summary.byActionType.sync_triggered || 0}</p>
                  <p className="text-sm text-muted-foreground">Sync Operations</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{summary.byActionType.cache_invalidation || 0}</p>
                  <p className="text-sm text-muted-foreground">Cache Operations</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{Object.keys(summary.byAdmin).length}</p>
                  <p className="text-sm text-muted-foreground">Active Admins</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Search</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search activities..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Action Type</label>
              <Select
                value={filters.actionType}
                onValueChange={(value) => setFilters(prev => ({ ...prev, actionType: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  <SelectItem value="sync_triggered">Sync Triggered</SelectItem>
                  <SelectItem value="cache_invalidation">Cache Invalidation</SelectItem>
                  <SelectItem value="product_updated">Product Updated</SelectItem>
                  <SelectItem value="order_updated">Order Updated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Resource Type</label>
              <Select
                value={filters.resourceType}
                onValueChange={(value) => setFilters(prev => ({ ...prev, resourceType: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All resources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All resources</SelectItem>
                  <SelectItem value="sync">Sync</SelectItem>
                  <SelectItem value="cache">Cache</SelectItem>
                  <SelectItem value="product">Product</SelectItem>
                  <SelectItem value="order">Order</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Time Period</label>
              <Select
                value={filters.days.toString()}
                onValueChange={(value) => setFilters(prev => ({ ...prev, days: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Last 24 hours</SelectItem>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => setFilters({
                  actionType: 'all',
                  resourceType: 'all',
                  adminUserId: '',
                  days: 7,
                  search: ''
                })}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activities</CardTitle>
          <CardDescription>
            Showing {filteredLogs.length} of {pagination.total} activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                    <div className="w-16 h-6 bg-gray-200 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No activity logs found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log) => (
                <div key={log.id} className="border rounded-lg">
                  <div
                    className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleLogExpansion(log.id)}
                  >
                    <div className="flex items-center gap-2">
                      {expandedLogs.has(log.id) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      {getActionIcon(log.action_type)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getActionBadge(log.action_type)}
                        <span className="text-sm text-muted-foreground">
                          by {log.admin_user?.first_name || log.admin_user?.email || 'Unknown'}
                        </span>
                      </div>
                      <p className="text-sm">{log.action_description}</p>
                    </div>
                    
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(log.created_at)}
                      </div>
                    </div>
                  </div>
                  
                  {expandedLogs.has(log.id) && (
                    <div className="px-4 pb-4 border-t bg-muted/20">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <h4 className="font-medium mb-2">Details</h4>
                          <div className="space-y-1 text-sm">
                            <p><strong>Resource:</strong> {log.resource_type || 'N/A'}</p>
                            <p><strong>Resource ID:</strong> {log.resource_id || 'N/A'}</p>
                            <p><strong>Resource Name:</strong> {log.resource_name || 'N/A'}</p>
                            <p><strong>Timestamp:</strong> {new Date(log.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                        
                        {(log.before_data || log.after_data) && (
                          <div>
                            <h4 className="font-medium mb-2">Data Changes</h4>
                            <div className="text-xs">
                              {log.before_data && (
                                <div className="mb-2">
                                  <strong>Before:</strong>
                                  <pre className="bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                                    {JSON.stringify(log.before_data, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.after_data && (
                                <div>
                                  <strong>After:</strong>
                                  <pre className="bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                                    {JSON.stringify(log.after_data, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {pagination.hasMore && (
            <div className="text-center mt-6">
              <Button
                variant="outline"
                onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                disabled={loading}
              >
                Load More
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
