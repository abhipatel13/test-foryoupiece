'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Package, 
  Award, 
  AlertTriangle,
  RefreshCw,
  Calendar,
  Target,
  Zap,
  CheckCircle,
  XCircle,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react'
import { useAnalyticsDashboard } from '@/hooks/useAnalytics'
import { SalesPerformanceTable } from '@/components/admin/analytics/SalesPerformanceTable'
import { RecommendationsPanel } from '@/components/admin/analytics/RecommendationsPanel'
import { PerformanceCharts } from '@/components/admin/analytics/PerformanceCharts'

export default function AnalyticsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState(30)
  const { data, isLoading, error, refetch } = useAnalyticsDashboard(selectedPeriod)

  const handlePeriodChange = (value: string) => {
    setSelectedPeriod(parseInt(value))
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num)
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-600 mb-2">Analytics Error</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={refetch} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Data-driven insights for best seller management
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <Select value={selectedPeriod.toString()} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-40">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 3 months</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={refetch} variant="outline" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : formatCurrency(data.summary.totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              From {formatNumber(data.summary.totalProducts)} products
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Best Sellers</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : data.summary.currentBestSellers}
            </div>
            <p className="text-xs text-muted-foreground">
              Active best seller products
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recommended Changes</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : data.summary.recommendedChanges}
            </div>
            <p className="text-xs text-muted-foreground">
              AI-powered suggestions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : data.summary.performanceDiscrepancies}
            </div>
            <p className="text-xs text-muted-foreground">
              Misaligned best sellers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Sales Performance</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Performers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Top Revenue Performers
                </CardTitle>
                <CardDescription>
                  Products generating the most revenue in the selected period
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-secondary/50 rounded animate-pulse">
                        <div className="h-4 bg-secondary rounded w-32"></div>
                        <div className="h-4 bg-secondary rounded w-20"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.salesPerformance?.analytics.slice(0, 5).map((product, index) => (
                      <div key={product.product_id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge variant={index < 3 ? 'default' : 'secondary'}>
                            #{index + 1}
                          </Badge>
                          <div>
                            <p className="font-medium">{product.name_en}</p>
                            <p className="text-sm text-muted-foreground">{product.sku}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(product.total_revenue)}</p>
                          <p className="text-sm text-muted-foreground">
                            {product.total_units_sold} units
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
                <CardDescription>
                  Common analytics tasks and recommendations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  <Button variant="outline" className="justify-start h-auto p-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div className="text-left">
                        <p className="font-medium">Apply Top Recommendations</p>
                        <p className="text-sm text-muted-foreground">
                          Auto-apply high-confidence suggestions
                        </p>
                      </div>
                    </div>
                  </Button>
                  
                  <Button variant="outline" className="justify-start h-auto p-4">
                    <div className="flex items-center gap-3">
                      <BarChart3 className="h-5 w-5 text-blue-600" />
                      <div className="text-left">
                        <p className="font-medium">Export Analytics Report</p>
                        <p className="text-sm text-muted-foreground">
                          Download detailed performance data
                        </p>
                      </div>
                    </div>
                  </Button>
                  
                  <Button variant="outline" className="justify-start h-auto p-4">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-orange-600" />
                      <div className="text-left">
                        <p className="font-medium">Review Performance Issues</p>
                        <p className="text-sm text-muted-foreground">
                          Check misaligned best sellers
                        </p>
                      </div>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance">
          <SalesPerformanceTable 
            data={data.salesPerformance?.analytics || []}
            isLoading={isLoading}
            period={selectedPeriod}
          />
        </TabsContent>

        <TabsContent value="recommendations">
          <RecommendationsPanel 
            recommendations={data.recommendations?.recommendations || []}
            summary={data.recommendations?.summary}
            isLoading={isLoading}
            onApplyRecommendations={refetch}
          />
        </TabsContent>

        <TabsContent value="insights">
          <PerformanceCharts 
            salesData={data.salesPerformance?.analytics || []}
            isLoading={isLoading}
            period={selectedPeriod}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
