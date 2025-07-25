'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Package, 
  Award,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'
import type { SalesAnalytics } from '@/app/api/admin/analytics/sales-performance/route'

interface PerformanceChartsProps {
  salesData: SalesAnalytics[]
  isLoading: boolean
  period: number
}

export function PerformanceCharts({ salesData, isLoading, period }: PerformanceChartsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num)
  }

  // Calculate insights
  const topPerformers = salesData.slice(0, 10)
  const currentBestSellers = salesData.filter(item => item.is_current_best_seller)
  const misalignedProducts = salesData.filter(item => 
    (item.is_current_best_seller && item.revenue_rank > 20) || 
    (!item.is_current_best_seller && item.revenue_rank <= 10)
  )

  const totalRevenue = salesData.reduce((sum, item) => sum + item.total_revenue, 0)
  const revenueFromBestSellers = currentBestSellers.reduce((sum, item) => sum + item.total_revenue, 0)
  const bestSellerRevenuePercentage = totalRevenue > 0 ? (revenueFromBestSellers / totalRevenue) * 100 : 0

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 bg-secondary rounded w-48 animate-pulse"></div>
              <div className="h-4 bg-secondary rounded w-32 animate-pulse"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[...Array(5)].map((_, j) => (
                  <div key={j} className="flex items-center justify-between">
                    <div className="h-4 bg-secondary rounded w-32 animate-pulse"></div>
                    <div className="h-4 bg-secondary rounded w-20 animate-pulse"></div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Key Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Best Seller Revenue Share</p>
                <p className="text-2xl font-bold">{bestSellerRevenuePercentage.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(revenueFromBestSellers)} of {formatCurrency(totalRevenue)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Award className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Best Sellers</p>
                <p className="text-2xl font-bold">{currentBestSellers.length}</p>
                <p className="text-xs text-muted-foreground">
                  Out of {salesData.length} products
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Misaligned Products</p>
                <p className="text-2xl font-bold">{misalignedProducts.length}</p>
                <p className="text-xs text-muted-foreground">
                  Need attention
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Revenue Performers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Top Revenue Performers
            </CardTitle>
            <CardDescription>
              Products generating the most revenue in the last {period} days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topPerformers.map((product, index) => {
                const revenuePercentage = totalRevenue > 0 ? (product.total_revenue / totalRevenue) * 100 : 0
                return (
                  <div key={product.product_id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium w-6">#{index + 1}</span>
                        {product.is_current_best_seller && (
                          <Badge variant="secondary" className="text-xs">
                            BS #{product.current_best_seller_position}
                          </Badge>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{product.name_en}</p>
                        <p className="text-xs text-muted-foreground">{product.sku}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">{formatCurrency(product.total_revenue)}</p>
                      <p className="text-xs text-muted-foreground">{revenuePercentage.toFixed(1)}%</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Performance Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Performance Score Distribution
            </CardTitle>
            <CardDescription>
              How products are performing across different score ranges
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { range: '90-100%', color: 'bg-green-500', products: salesData.filter(p => p.performance_score >= 90) },
                { range: '70-89%', color: 'bg-blue-500', products: salesData.filter(p => p.performance_score >= 70 && p.performance_score < 90) },
                { range: '50-69%', color: 'bg-yellow-500', products: salesData.filter(p => p.performance_score >= 50 && p.performance_score < 70) },
                { range: '30-49%', color: 'bg-orange-500', products: salesData.filter(p => p.performance_score >= 30 && p.performance_score < 50) },
                { range: '0-29%', color: 'bg-red-500', products: salesData.filter(p => p.performance_score < 30) }
              ].map((bucket) => {
                const percentage = salesData.length > 0 ? (bucket.products.length / salesData.length) * 100 : 0
                return (
                  <div key={bucket.range} className="flex items-center gap-3">
                    <div className="w-16 text-sm font-medium">{bucket.range}</div>
                    <div className="flex-1 bg-secondary rounded-full h-6 relative">
                      <div 
                        className={`${bucket.color} h-6 rounded-full flex items-center justify-center text-white text-xs font-medium`}
                        style={{ width: `${Math.max(percentage, 5)}%` }}
                      >
                        {bucket.products.length > 0 && bucket.products.length}
                      </div>
                    </div>
                    <div className="w-12 text-sm text-muted-foreground text-right">
                      {percentage.toFixed(0)}%
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Best Seller Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Best Seller Performance
            </CardTitle>
            <CardDescription>
              How current best sellers are performing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {currentBestSellers.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No best sellers configured
                </p>
              ) : (
                currentBestSellers
                  .sort((a, b) => (a.current_best_seller_position || 999) - (b.current_best_seller_position || 999))
                  .slice(0, 10)
                  .map((product) => {
                    const isPerformingWell = product.revenue_rank <= 20
                    return (
                      <div key={product.product_id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="text-xs">
                            #{product.current_best_seller_position}
                          </Badge>
                          <div>
                            <p className="font-medium text-sm">{product.name_en}</p>
                            <p className="text-xs text-muted-foreground">
                              Revenue rank: #{product.revenue_rank}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isPerformingWell ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-orange-600" />
                          )}
                          <span className="text-sm font-medium">
                            {product.performance_score.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    )
                  })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Opportunity Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Missed Opportunities
            </CardTitle>
            <CardDescription>
              High-performing products not marked as best sellers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {salesData
                .filter(product => !product.is_current_best_seller && product.revenue_rank <= 15)
                .slice(0, 8)
                .map((product) => (
                  <div key={product.product_id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-blue-600">
                        #{product.revenue_rank}
                      </span>
                      <div>
                        <p className="font-medium text-sm">{product.name_en}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(product.total_revenue)} revenue
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{product.performance_score.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(product.total_units_sold)} units
                      </p>
                    </div>
                  </div>
                ))}
              {salesData.filter(product => !product.is_current_best_seller && product.revenue_rank <= 15).length === 0 && (
                <p className="text-muted-foreground text-center py-4">
                  All top performers are already best sellers
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
