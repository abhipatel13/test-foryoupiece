'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Tags, 
  Percent, 
  Star, 
  TrendingUp,
  Package,
  DollarSign
} from 'lucide-react'
import SalesProductsTab from '@/components/admin/SalesProductsTab'
import BestSellersTab from '@/components/admin/BestSellersTab'
import RecommendationsTab from '@/components/admin/RecommendationsTab'

export default function ProductCategoriesPage() {
  const [activeTab, setActiveTab] = useState('sales')
  const [salesCount, setSalesCount] = useState(0)
  const [bestSellersCount, setBestSellersCount] = useState(0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Tags className="h-6 w-6" />
            Product Categories
          </h1>
          <p className="text-gray-600">
            Manage sales, discounts, and best seller products in one place
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sales & Discounts</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salesCount}</div>
            <p className="text-xs text-muted-foreground">
              Products with active discounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Best Sellers</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bestSellersCount}</div>
            <p className="text-xs text-muted-foreground">
              Products marked as best sellers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue Impact</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0</div>
            <p className="text-xs text-muted-foreground">
              From categorized products
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+12%</div>
            <p className="text-xs text-muted-foreground">
              Conversion rate improvement
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Product Category Management</CardTitle>
          <CardDescription>
            Manage your sales, discount, and best seller products with specialized tools
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="sales" className="flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Sales & Discounts
                {salesCount > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {salesCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="best-sellers" className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                Best Sellers
                {bestSellersCount > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {bestSellersCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="recommendations" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Recommendations
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sales" className="mt-6">
              <SalesProductsTab
                onCountChange={setSalesCount}
              />
            </TabsContent>

            <TabsContent value="best-sellers" className="mt-6">
              <BestSellersTab
                onCountChange={setBestSellersCount}
              />
            </TabsContent>

            <TabsContent value="recommendations" className="mt-6">
              <RecommendationsTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
