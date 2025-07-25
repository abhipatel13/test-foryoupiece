'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Award,
  TrendingUp,
  DollarSign,
  Package,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Crown,
  BarChart3
} from 'lucide-react'
import type { SalesAnalytics } from '@/app/api/admin/analytics/sales-performance/route'

interface SalesPerformanceTableProps {
  data: SalesAnalytics[]
  isLoading: boolean
  period: number
}

type SortField = 'revenue' | 'units' | 'orders' | 'performance_score' | 'name'
type SortDirection = 'asc' | 'desc'

export function SalesPerformanceTable({ data, isLoading, period }: SalesPerformanceTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('revenue')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [filterType, setFilterType] = useState<'all' | 'best_sellers' | 'non_best_sellers' | 'discrepancies'>('all')

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
  }

  const filteredAndSortedData = data
    .filter(item => {
      // Search filter
      const matchesSearch = searchTerm === '' || 
        item.name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase())
      
      if (!matchesSearch) return false

      // Type filter
      switch (filterType) {
        case 'best_sellers':
          return item.is_current_best_seller
        case 'non_best_sellers':
          return !item.is_current_best_seller
        case 'discrepancies':
          return (item.is_current_best_seller && item.revenue_rank > 20) || 
                 (!item.is_current_best_seller && item.revenue_rank <= 10)
        default:
          return true
      }
    })
    .sort((a, b) => {
      let aValue: number | string
      let bValue: number | string

      switch (sortField) {
        case 'revenue':
          aValue = a.total_revenue
          bValue = b.total_revenue
          break
        case 'units':
          aValue = a.total_units_sold
          bValue = b.total_units_sold
          break
        case 'orders':
          aValue = a.order_count
          bValue = b.order_count
          break
        case 'performance_score':
          aValue = a.performance_score
          bValue = b.performance_score
          break
        case 'name':
          aValue = a.name_en
          bValue = b.name_en
          break
        default:
          aValue = a.total_revenue
          bValue = b.total_revenue
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      const numA = Number(aValue)
      const numB = Number(bValue)
      return sortDirection === 'asc' ? numA - numB : numB - numA
    })

  const getPerformanceStatus = (item: SalesAnalytics) => {
    if (item.is_current_best_seller && item.revenue_rank <= 10) {
      return { status: 'excellent', color: 'bg-green-100 text-green-800', icon: CheckCircle }
    } else if (item.is_current_best_seller && item.revenue_rank <= 20) {
      return { status: 'good', color: 'bg-blue-100 text-blue-800', icon: TrendingUp }
    } else if (item.is_current_best_seller && item.revenue_rank > 20) {
      return { status: 'poor', color: 'bg-red-100 text-red-800', icon: AlertTriangle }
    } else if (!item.is_current_best_seller && item.revenue_rank <= 10) {
      return { status: 'opportunity', color: 'bg-yellow-100 text-yellow-800', icon: Crown }
    } else {
      return { status: 'normal', color: 'bg-gray-100 text-gray-800', icon: Package }
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sales Performance Analysis</CardTitle>
          <CardDescription>Loading performance data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="h-4 bg-secondary rounded w-8"></div>
                  <div className="h-4 bg-secondary rounded w-32"></div>
                  <div className="h-4 bg-secondary rounded w-20"></div>
                </div>
                <div className="h-4 bg-secondary rounded w-24"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Sales Performance Analysis
        </CardTitle>
        <CardDescription>
          Detailed performance metrics for the last {period} days
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              <SelectItem value="best_sellers">Current Best Sellers</SelectItem>
              <SelectItem value="non_best_sellers">Non-Best Sellers</SelectItem>
              <SelectItem value="discrepancies">Performance Issues</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results Summary */}
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            Showing {filteredAndSortedData.length} of {data.length} products
          </p>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('name')}
                    className="h-auto p-0 font-semibold"
                  >
                    Product {getSortIcon('name')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('revenue')}
                    className="h-auto p-0 font-semibold"
                  >
                    Revenue {getSortIcon('revenue')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('units')}
                    className="h-auto p-0 font-semibold"
                  >
                    Units Sold {getSortIcon('units')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('orders')}
                    className="h-auto p-0 font-semibold"
                  >
                    Orders {getSortIcon('orders')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('performance_score')}
                    className="h-auto p-0 font-semibold"
                  >
                    Score {getSortIcon('performance_score')}
                  </Button>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Sale</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedData.map((item, index) => {
                const performanceStatus = getPerformanceStatus(item)
                const StatusIcon = performanceStatus.icon
                
                return (
                  <TableRow key={item.product_id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">#{item.revenue_rank}</span>
                        {item.is_current_best_seller && (
                          <Badge variant="secondary" className="text-xs">
                            BS #{item.current_best_seller_position}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.name_en}</p>
                        <p className="text-sm text-muted-foreground">{item.sku}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-semibold">{formatCurrency(item.total_revenue)}</p>
                        <p className="text-sm text-muted-foreground">
                          Avg: {formatCurrency(item.avg_order_value)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{formatNumber(item.total_units_sold)}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{formatNumber(item.order_count)}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-12 bg-secondary rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full" 
                            style={{ width: `${Math.min(100, item.performance_score)}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{item.performance_score.toFixed(1)}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={performanceStatus.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {performanceStatus.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{formatDate(item.last_sale_date)}</p>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        {filteredAndSortedData.length === 0 && (
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No products found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search or filter criteria
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
