'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  useTrendingProducts, 
  useRefreshTrendingProducts, 
  useAdminTrendingProducts,
  useManageTrendingProducts 
} from '@/presentation/hooks/useTrendingProducts'
import { 
  TrendingUp, 
  RefreshCw, 
  Settings, 
  Plus, 
  Trash2, 
  Edit, 
  Clock,
  Star,
  Zap,
  BarChart3
} from 'lucide-react'
import { toast } from 'sonner'

export default function AdminTrendingProductsPage() {
  const [selectedTab, setSelectedTab] = useState('overview')
  const [newProductId, setNewProductId] = useState('')
  
  const { 
    data: trendingData, 
    isLoading: trendingLoading, 
    refetch: refetchTrending 
  } = useTrendingProducts(50, true)
  
  const refreshMutation = useRefreshTrendingProducts()
  const { addProduct, updateProduct, removeProduct } = useManageTrendingProducts()

  const handleRefresh = async () => {
    try {
      await refreshMutation.mutateAsync({ 
        refresh_type: 'manual',
        user_id: 'admin' // Replace with actual admin user ID
      })
      refetchTrending()
      toast.success('Trending products refreshed successfully')
    } catch (error) {
      toast.error('Failed to refresh trending products')
      console.error('Refresh error:', error)
    }
  }

  const handleAddManualProduct = async () => {
    if (!newProductId) {
      toast.error('Please provide product ID')
      return
    }

    try {
      await addProduct.mutateAsync({
        product_id: newProductId,
        // position removed, backend will auto-assign a compatibility position
        user_id: 'admin' // Replace with actual admin user ID
      } as any)
      setNewProductId('')
      toast.success('Product added to trending successfully')
    } catch (error) {
      toast.error('Failed to add product to trending')
      console.error('Add product error:', error)
    }
  }

  const handleRemoveProduct = async (trendingId: string) => {
    try {
      await removeProduct.mutateAsync(trendingId)
      toast.success('Product removed from trending')
    } catch (error) {
      toast.error('Failed to remove product')
      console.error('Remove product error:', error)
    }
  }

  const groupedProducts = {
    top_selling: trendingData?.products?.filter(p => p.algorithm_category === 'top_selling') || [],
    recently_added: trendingData?.products?.filter(p => p.algorithm_category === 'recently_added') || [],
    random_stock: trendingData?.products?.filter(p => p.algorithm_category === 'random_stock') || [],
    manual: trendingData?.products?.filter(p => p.selection_type === 'manual') || []
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">Trending Products Management</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              onClick={handleRefresh}
              disabled={refreshMutation.isPending}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
              Refresh Algorithm
            </Button>
          </div>
        </div>
        
        <p className="text-muted-foreground mt-2">
          Manage algorithm-selected and manually-curated trending products
        </p>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="algorithm">Algorithm Products</TabsTrigger>
          <TabsTrigger value="manual">Manual Products</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Trending</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{trendingData?.count || 0}</div>
                <p className="text-xs text-muted-foreground">Active products</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  Top Selling
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{groupedProducts.top_selling.length}</div>
                <p className="text-xs text-muted-foreground">Algorithm selected</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-green-500" />
                  Recently Added
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{groupedProducts.recently_added.length}</div>
                <p className="text-xs text-muted-foreground">New arrivals</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Edit className="h-4 w-4 text-purple-500" />
                  Manual
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{groupedProducts.manual.length}</div>
                <p className="text-xs text-muted-foreground">Hand-picked</p>
              </CardContent>
            </Card>
          </div>

          {/* Last Refresh Info */}
          {trendingData?.stats?.lastRefresh && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Last Algorithm Refresh
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {new Date(trendingData.stats.lastRefresh.created_at).toLocaleString()}
                    </p>
                    <Badge variant="outline" className="mt-1">
                      {trendingData.stats.lastRefresh.refresh_type}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {trendingData.stats.lastRefresh.products_changed} products changed
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Algorithm Products Tab */}
        <TabsContent value="algorithm" className="space-y-6">
          {trendingLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <div className="space-y-6">
              {/* Top Selling */}
              {groupedProducts.top_selling.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Star className="h-5 w-5 text-yellow-500" />
                      Top Selling Products
                    </CardTitle>
                    <CardDescription>
                      Algorithm-selected based on sales performance and trending score
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {groupedProducts.top_selling.map((product) => (
                        <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">#{product.product_position}</Badge>
                            <div>
                              <p className="font-medium">{product.name_en}</p>
                              <p className="text-sm text-muted-foreground">
                                SKU: {product.sku} • Score: {product.trending_score} • Sales: {product.sales_count}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-yellow-100 text-yellow-800">Top Seller</Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRemoveProduct(product.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recently Added */}
              {groupedProducts.recently_added.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-green-500" />
                      Recently Added Products
                    </CardTitle>
                    <CardDescription>
                      New products added to inventory within the last 30 days
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {groupedProducts.recently_added.map((product) => (
                        <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">#{product.product_position}</Badge>
                            <div>
                              <p className="font-medium">{product.name_en}</p>
                              <p className="text-sm text-muted-foreground">
                                SKU: {product.sku} • Stock: {product.stock_quantity}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-green-100 text-green-800">New</Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRemoveProduct(product.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Random Stock */}
              {groupedProducts.random_stock.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-blue-500" />
                      Random In-Stock Products
                    </CardTitle>
                    <CardDescription>
                      Randomly selected products to provide variety and discovery
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {groupedProducts.random_stock.map((product) => (
                        <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">#{product.product_position}</Badge>
                            <div>
                              <p className="font-medium">{product.name_en}</p>
                              <p className="text-sm text-muted-foreground">
                                SKU: {product.sku} • Stock: {product.stock_quantity}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-blue-100 text-blue-800">Random</Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRemoveProduct(product.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Manual Products Tab */}
        <TabsContent value="manual" className="space-y-6">
          {/* Add Manual Product */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add Manual Trending Product
              </CardTitle>
              <CardDescription>
                Manually add products to override algorithm selections
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="product-id">Product ID</Label>
                  <Input
                    id="product-id"
                    placeholder="Enter product UUID"
                    value={newProductId}
                    onChange={(e) => setNewProductId(e.target.value)}
                  />
                </div>
              </div>
              <Button 
                onClick={handleAddManualProduct}
                disabled={addProduct.isPending}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </CardContent>
          </Card>

          {/* Manual Products List */}
          {groupedProducts.manual.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Edit className="h-5 w-5 text-purple-500" />
                  Manual Trending Products
                </CardTitle>
                <CardDescription>
                  Hand-picked products that override algorithm selections
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {groupedProducts.manual.map((product) => (
                    <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">#{product.product_position}</Badge>
                        <div>
                          <p className="font-medium">{product.name_en}</p>
                          <p className="text-sm text-muted-foreground">
                            SKU: {product.sku} • Stock: {product.stock_quantity}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-purple-100 text-purple-800">Manual</Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRemoveProduct(product.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Algorithm Settings
              </CardTitle>
              <CardDescription>
                Configure the trending products algorithm parameters
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Settings management will be implemented in the next phase.
                <br />
                Current settings are managed via the database.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
