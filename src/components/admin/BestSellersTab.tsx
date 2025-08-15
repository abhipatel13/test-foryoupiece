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
  Star,
  DollarSign,
  Package,
  GripVertical,
  Trash2,
  Plus,
  RefreshCw,
  Filter,
  ArrowUp,
  ArrowDown,
  Crown,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface BestSellerProduct {
  id: string
  sku: string
  name_en: string
  price: number
  compare_at_price?: number
  stock_quantity: number
  is_active: boolean
  is_best_seller: boolean
  best_seller_position: number
  position: number
  images: string[]
  has_discount: boolean
  discount_percentage: number
  categories?: {
    name_en: string
    slug: string
  }
}

interface BestSellersTabProps {
  onCountChange: (count: number) => void
}

interface AllProduct {
  id: string
  sku: string
  name_en: string
  price: number
  stock_quantity: number
  is_active: boolean
  is_best_seller: boolean
  images: string[]
}

export default function BestSellersTab({ onCountChange }: BestSellersTabProps) {
  const [products, setProducts] = useState<BestSellerProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('position_asc')
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [draggedItem, setDraggedItem] = useState<string | null>(null)

  // Add to Best Sellers Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [allProducts, setAllProducts] = useState<AllProduct[]>([])
  const [modalLoading, setModalLoading] = useState(false)
  const [modalSearchTerm, setModalSearchTerm] = useState('')
  const [selectedNewProducts, setSelectedNewProducts] = useState<string[]>([])

  // Fetch best seller products
  const fetchBestSellerProducts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        search: searchTerm,
        sort: sortBy,
        limit: '50'
      })

      const response = await fetch(`/api/admin/product-categories/best-sellers?${params}`)
      const data = await response.json()

      if (data.success) {
        setProducts(data.data)
        onCountChange(data.data.length)
      } else {
        toast.error('Failed to load best seller products')
        console.error('Error:', data.error)
      }
    } catch (error) {
      console.error('Error fetching best seller products:', error)
      toast.error('Failed to load best seller products')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBestSellerProducts()
  }, [searchTerm, sortBy])

  // Handle bulk remove from best sellers
  const handleBulkRemoveBestSeller = async () => {
    if (selectedProducts.length === 0) {
      toast.error('Please select products to remove from best sellers')
      return
    }

    try {
      const response = await fetch('/api/admin/product-categories/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'remove_best_seller',
          product_ids: selectedProducts
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success(`Removed ${data.summary.success} products from best sellers`)
        setSelectedProducts([])
        fetchBestSellerProducts()
      } else {
        toast.error('Failed to remove from best sellers')
      }
    } catch (error) {
      console.error('Error removing from best sellers:', error)
      toast.error('Failed to remove from best sellers')
    }
  }

  // Handle position update
  const handlePositionUpdate = async (productId: string, newPosition: number) => {
    try {
      const response = await fetch('/api/admin/product-categories/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'reorder_best_sellers',
          product_ids: [],
          data: {
            best_seller_positions: { [productId]: newPosition }
          }
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Position updated successfully')
        fetchBestSellerProducts()
      } else {
        toast.error('Failed to update position')
      }
    } catch (error) {
      console.error('Error updating position:', error)
      toast.error('Failed to update position')
    }
  }

  // Handle individual best seller toggle
  const handleToggleBestSeller = async (productId: string, currentStatus: boolean) => {
    try {
      const response = await fetch('/api/admin/product-categories/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: currentStatus ? 'remove_best_seller' : 'set_best_seller',
          product_ids: [productId],
          data: currentStatus ? {} : { start_position: products.length + 1 }
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success(currentStatus ? 'Removed from best sellers' : 'Added to best sellers')
        fetchBestSellerProducts()
      } else {
        toast.error(`Failed to ${currentStatus ? 'remove from' : 'add to'} best sellers`)
      }
    } catch (error) {
      console.error('Error toggling best seller status:', error)
      toast.error('Failed to update best seller status')
    }
  }

  // Fetch all products for the add modal
  const fetchAllProducts = async () => {
    try {
      setModalLoading(true)
      const params = new URLSearchParams({
        limit: '100'
      })

      const response = await fetch(`/api/admin/products?${params}`)
      const data = await response.json()

      if (data.success) {
        // Filter out products that are already best sellers
        const nonBestSellers = data.data.filter((product: AllProduct) => !product.is_best_seller)
        setAllProducts(nonBestSellers)
      } else {
        toast.error('Failed to load products')
        console.error('Error:', data.error)
      }
    } catch (error) {
      console.error('Error fetching all products:', error)
      toast.error('Failed to load products')
    } finally {
      setModalLoading(false)
    }
  }

  // Handle adding selected products to best sellers
  const handleAddToBestSellers = async () => {
    if (selectedNewProducts.length === 0) {
      toast.error('Please select products to add')
      return
    }

    try {
      const response = await fetch('/api/admin/product-categories/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'set_best_seller',
          product_ids: selectedNewProducts,
          data: { start_position: products.length + 1 }
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success(`Added ${data.summary.success} products to best sellers`)
        setSelectedNewProducts([])
        setIsAddModalOpen(false)
        fetchBestSellerProducts()
      } else {
        toast.error('Failed to add products to best sellers')
      }
    } catch (error) {
      console.error('Error adding to best sellers:', error)
      toast.error('Failed to add products to best sellers')
    }
  }

  // Handle drag and drop
  const handleDragStart = (productId: string) => {
    setDraggedItem(productId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, targetProductId: string) => {
    e.preventDefault()
    
    if (!draggedItem || draggedItem === targetProductId) {
      setDraggedItem(null)
      return
    }

    const draggedProduct = products.find(p => p.id === draggedItem)
    const targetProduct = products.find(p => p.id === targetProductId)

    if (!draggedProduct || !targetProduct) {
      setDraggedItem(null)
      return
    }

    // Swap positions
    const newPositions = {
      [draggedItem]: targetProduct.position,
      [targetProductId]: draggedProduct.position
    }

    // Update positions via API
    fetch('/api/admin/product-categories/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'reorder_best_sellers',
        product_ids: [],
        data: { best_seller_positions: newPositions }
      })
    }).then(response => response.json())
      .then(data => {
        if (data.success) {
          toast.success('Positions updated successfully')
          fetchBestSellerProducts()
        } else {
          toast.error('Failed to update positions')
        }
      })
      .catch(error => {
        console.error('Error updating positions:', error)
        toast.error('Failed to update positions')
      })

    setDraggedItem(null)
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

  const getPositionBadgeColor = (position: number) => {
    if (position <= 3) return 'default' // Gold, Silver, Bronze
    if (position <= 10) return 'secondary'
    return 'outline'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        Loading best seller products...
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <Label htmlFor="sort">Sort By</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="position_asc">Position (1-10 first)</SelectItem>
                  <SelectItem value="position_desc">Position (10-1 first)</SelectItem>
                  <SelectItem value="name_asc">Name A-Z</SelectItem>
                  <SelectItem value="name_desc">Name Z-A</SelectItem>
                  <SelectItem value="price_desc">Highest Price</SelectItem>
                  <SelectItem value="price_asc">Lowest Price</SelectItem>
                  <SelectItem value="stock_desc">Highest Stock</SelectItem>
                  <SelectItem value="stock_asc">Lowest Stock</SelectItem>
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
              <Button onClick={handleBulkRemoveBestSeller} variant="outline" size="sm">
                <Trash2 className="h-4 w-4 mr-1" />
                Remove from Best Sellers
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
              <Star className="h-5 w-5" />
              Best Seller Products ({products.length})
            </span>
            <div className="flex items-center gap-2">
              <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogTrigger asChild>
                  <Button onClick={fetchAllProducts} size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Products
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
                  <DialogHeader>
                    <DialogTitle>Add Products to Best Sellers</DialogTitle>
                    <DialogDescription>
                      Select products to add to your best sellers list
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    {/* Search */}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                          placeholder="Search products..."
                          value={modalSearchTerm}
                          onChange={(e) => setModalSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    {/* Products List */}
                    <div className="border rounded-lg max-h-96 overflow-y-auto">
                      {modalLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                          Loading products...
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">
                                <Checkbox
                                  checked={selectedNewProducts.length === allProducts.filter(p =>
                                    p.name_en.toLowerCase().includes(modalSearchTerm.toLowerCase()) ||
                                    p.sku.toLowerCase().includes(modalSearchTerm.toLowerCase())
                                  ).length && allProducts.length > 0}
                                  onCheckedChange={(checked) => {
                                    const filteredProducts = allProducts.filter(p =>
                                      p.name_en.toLowerCase().includes(modalSearchTerm.toLowerCase()) ||
                                      p.sku.toLowerCase().includes(modalSearchTerm.toLowerCase())
                                    )
                                    if (checked) {
                                      setSelectedNewProducts(filteredProducts.map(p => p.id))
                                    } else {
                                      setSelectedNewProducts([])
                                    }
                                  }}
                                />
                              </TableHead>
                              <TableHead>Product</TableHead>
                              <TableHead>Price</TableHead>
                              <TableHead>Stock</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {allProducts
                              .filter(product =>
                                product.name_en.toLowerCase().includes(modalSearchTerm.toLowerCase()) ||
                                product.sku.toLowerCase().includes(modalSearchTerm.toLowerCase())
                              )
                              .map((product) => (
                                <TableRow key={product.id}>
                                  <TableCell>
                                    <Checkbox
                                      checked={selectedNewProducts.includes(product.id)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setSelectedNewProducts(prev => [...prev, product.id])
                                        } else {
                                          setSelectedNewProducts(prev => prev.filter(id => id !== product.id))
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
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <span className="font-semibold">${product.price.toFixed(2)}</span>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={product.stock_quantity > 0 ? 'default' : 'destructive'}>
                                      {product.stock_quantity > 0 ? `${product.stock_quantity} in stock` : 'Out of stock'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={product.is_active ? 'default' : 'secondary'}>
                                      {product.is_active ? 'Active' : 'Inactive'}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="text-sm text-gray-500">
                        {selectedNewProducts.length} products selected
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={handleAddToBestSellers}
                          disabled={selectedNewProducts.length === 0}
                        >
                          Add to Best Sellers
                        </Button>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Button onClick={fetchBestSellerProducts} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
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
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow 
                    key={product.id}
                    draggable
                    onDragStart={() => handleDragStart(product.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, product.id)}
                    className={draggedItem === product.id ? 'opacity-50' : ''}
                  >
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
                      <GripVertical className="h-4 w-4 text-gray-400 cursor-grab" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={getPositionBadgeColor(product.position)}>
                          #{product.position}
                        </Badge>
                        {product.position <= 3 && (
                          <Crown className="h-4 w-4 text-yellow-500" />
                        )}
                      </div>
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
                          {product.has_discount && (
                            <Badge variant="secondary" className="text-xs bg-red-100 text-red-800 ml-1">
                              {product.discount_percentage}% OFF
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
                      <Badge variant={getStockBadgeColor(product.stock_quantity)}>
                        {getStockText(product.stock_quantity)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={product.is_active ? 'default' : 'secondary'}>
                          {product.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePositionUpdate(product.id, Math.max(1, product.position - 1))}
                          disabled={product.position <= 1}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePositionUpdate(product.id, product.position + 1)}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleBestSeller(product.id, true)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Remove from best sellers"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No best seller products found</p>
              <p className="text-sm">Products marked as best sellers will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
