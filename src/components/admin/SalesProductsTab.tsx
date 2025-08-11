'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  Search, 
  Percent, 
  DollarSign, 
  Package, 
  Edit3,
  Trash2,
  Plus,
  RefreshCw,
  Filter,
  Download
} from 'lucide-react'
import { toast } from 'sonner'

interface SalesProduct {
  id: string
  sku: string
  name_en: string
  price: number
  compare_at_price: number
  discount_amount: number
  discount_percentage: number
  savings: number
  points_rate: number
  points_earned: number
  has_discount: boolean
  has_high_points: boolean
  stock_quantity: number
  is_active: boolean
  images: string[]
  categories?: {
    name_en: string
    slug: string
  }
}

interface SalesProductsTabProps {
  onCountChange: (count: number) => void
}

export default function SalesProductsTab({ onCountChange }: SalesProductsTabProps) {
  const [products, setProducts] = useState<SalesProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [discountFilter, setDiscountFilter] = useState({ min: 0, max: 100 })
  const [sortBy, setSortBy] = useState('discount_desc')
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [bulkDiscountPercentage, setBulkDiscountPercentage] = useState(10)
  const [editingProduct, setEditingProduct] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<{ price: number; compare_at_price: number }>({ price: 0, compare_at_price: 0 })

  // Fetch sales products
  const fetchSalesProducts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        search: searchTerm,
        discount_min: discountFilter.min.toString(),
        discount_max: discountFilter.max.toString(),
        sort: sortBy,
        limit: '50'
      })

      const response = await fetch(`/api/admin/product-categories/sales?${params}`)
      const data = await response.json()

      if (data.success) {
        setProducts(data.data)
        onCountChange(data.data.length)
      } else {
        toast.error('Failed to load sales products')
        console.error('Error:', data.error)
      }
    } catch (error) {
      console.error('Error fetching sales products:', error)
      toast.error('Failed to load sales products')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSalesProducts()
  }, [searchTerm, discountFilter, sortBy])

  // Handle bulk discount application
  const handleBulkDiscount = async () => {
    if (selectedProducts.length === 0) {
      toast.error('Please select products to apply discount')
      return
    }

    if (bulkDiscountPercentage <= 0 || bulkDiscountPercentage >= 100) {
      toast.error('Please enter a valid discount percentage (1-99)')
      return
    }

    try {
      const response = await fetch('/api/admin/product-categories/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'apply_discount',
          product_ids: selectedProducts,
          data: { discount_percentage: bulkDiscountPercentage }
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success(`Applied ${bulkDiscountPercentage}% discount to ${data.summary.success} products`)
        setSelectedProducts([])
        fetchSalesProducts()
      } else {
        toast.error('Failed to apply bulk discount')
      }
    } catch (error) {
      console.error('Error applying bulk discount:', error)
      toast.error('Failed to apply bulk discount')
    }
  }

  // Handle bulk discount removal
  const handleBulkRemoveDiscount = async () => {
    if (selectedProducts.length === 0) {
      toast.error('Please select products to remove discount')
      return
    }

    try {
      const response = await fetch('/api/admin/product-categories/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'remove_discount',
          product_ids: selectedProducts
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success(`Removed discount from ${data.summary.success} products`)
        setSelectedProducts([])
        fetchSalesProducts()
      } else {
        toast.error('Failed to remove bulk discount')
      }
    } catch (error) {
      console.error('Error removing bulk discount:', error)
      toast.error('Failed to remove bulk discount')
    }
  }

  // Handle individual product edit
  const handleEditProduct = async (productId: string) => {
    try {
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: editValues.price,
          compare_at_price: editValues.compare_at_price
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Product updated successfully')
        setEditingProduct(null)
        fetchSalesProducts()
      } else {
        toast.error('Failed to update product')
      }
    } catch (error) {
      console.error('Error updating product:', error)
      toast.error('Failed to update product')
    }
  }

  // Handle select all/none
  const handleSelectAll = () => {
    if (selectedProducts.length === products.length) {
      setSelectedProducts([])
    } else {
      setSelectedProducts(products.map(p => p.id))
    }
  }

  const getStockBadgeColor = (stock: number) => {
    if (stock <= 0) return 'destructive'
    if (stock <= 5) return 'secondary'
    return 'default'
  }

  const getStockText = (stock: number) => {
    if (stock <= 0) return 'Out of Stock'
    if (stock === 1) return '1 left'
    if (stock <= 5) return 'Limited stock'
    return `${stock} in stock`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        Loading sales products...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search Products</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Search by name or SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="discount-min">Min Discount %</Label>
              <Input
                id="discount-min"
                type="number"
                min="0"
                max="100"
                value={discountFilter.min}
                onChange={(e) => setDiscountFilter(prev => ({ ...prev, min: parseInt(e.target.value) || 0 }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discount-max">Max Discount %</Label>
              <Input
                id="discount-max"
                type="number"
                min="0"
                max="100"
                value={discountFilter.max}
                onChange={(e) => setDiscountFilter(prev => ({ ...prev, max: parseInt(e.target.value) || 100 }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sort">Sort By</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discount_desc">Highest Discount</SelectItem>
                  <SelectItem value="discount_asc">Lowest Discount</SelectItem>
                  <SelectItem value="savings_desc">Highest Savings</SelectItem>
                  <SelectItem value="points_desc">Highest Points Rate</SelectItem>
                  <SelectItem value="points_asc">Lowest Points Rate</SelectItem>
                  <SelectItem value="name_asc">Name A-Z</SelectItem>
                  <SelectItem value="price_desc">Highest Price</SelectItem>
                  <SelectItem value="price_asc">Lowest Price</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedProducts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Bulk Actions ({selectedProducts.length} selected)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="bulk-discount">Apply Discount %:</Label>
                <Input
                  id="bulk-discount"
                  type="number"
                  min="1"
                  max="99"
                  value={bulkDiscountPercentage}
                  onChange={(e) => setBulkDiscountPercentage(parseInt(e.target.value) || 10)}
                  className="w-20"
                />
                <Button onClick={handleBulkDiscount} size="sm">
                  <Percent className="h-4 w-4 mr-1" />
                  Apply
                </Button>
              </div>
              
              <Button onClick={handleBulkRemoveDiscount} variant="outline" size="sm">
                <Trash2 className="h-4 w-4 mr-1" />
                Remove Discounts
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Sales & Discount Products ({products.length})
            </span>
            <Button onClick={fetchSalesProducts} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {products.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedProducts.length === products.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Points Rate</TableHead>
                  <TableHead>Savings/Rewards</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedProducts.includes(product.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedProducts(prev => [...prev, product.id])
                          } else {
                            setSelectedProducts(prev => prev.filter(id => id !== product.id))
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {product.images?.[0] && (
                          <img 
                            src={product.images[0]} 
                            alt={product.name_en}
                            className="w-10 h-10 object-cover rounded"
                          />
                        )}
                        <div>
                          <div className="font-medium">{product.name_en}</div>
                          <div className="text-sm text-gray-500">{product.sku}</div>
                          {product.categories && (
                            <Badge variant="outline" className="text-xs">
                              {product.categories.name_en}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold">${product.price.toFixed(2)}</span>
                        {product.has_discount && product.compare_at_price && (
                          <span className="text-sm text-gray-500 line-through">
                            ${product.compare_at_price.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {product.has_discount ? (
                        <Badge variant="secondary" className="bg-red-100 text-red-800">
                          {product.discount_percentage}% OFF
                        </Badge>
                      ) : (
                        <span className="text-sm text-gray-500">No discount</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className={product.has_high_points ? 'font-medium text-blue-600' : 'font-medium text-gray-600'}>
                          {product.points_rate}%
                        </span>
                        {product.has_high_points && (
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                            High Reward
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        {product.has_discount && (
                          <span className="font-medium text-green-600">
                            ${product.savings.toFixed(2)} saved
                          </span>
                        )}
                        <span className="text-sm text-blue-600">
                          {product.points_earned} points
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStockBadgeColor(product.stock_quantity)}>
                        {getStockText(product.stock_quantity)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingProduct(product.id)
                            setEditValues({
                              price: product.price,
                              compare_at_price: product.compare_at_price
                            })
                          }}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Percent className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No sales or high-reward products found</p>
              <p className="text-sm">Products with discounts (compare_at_price &gt; price) or high points rates (&gt;1%) will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
