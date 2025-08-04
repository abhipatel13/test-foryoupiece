'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getProductService } from '@/shared/utils/service-registry'
import { Product } from '@/domain/entities/Product'
import { formatPrice } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagination, calculatePagination } from '@/components/ui/pagination'
import {
  Search,
  Filter,
  Eye,
  Edit,
  Plus,
  Package,
  AlertTriangle,
  CheckCircle,
  Star,
  Settings
} from 'lucide-react'
import { toast } from 'sonner'
import { PointsRateModal } from '@/components/admin/points-rate-modal'

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [totalProducts, setTotalProducts] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(30) // Show 30 products per page
  const [selectedProducts, setSelectedProducts] = useState<{
    id: string
    name_en: string
    sku: string
    price: number
    points_rate?: number
  }[]>([])
  const [isPointsModalOpen, setIsPointsModalOpen] = useState(false)

  const productService = getProductService()

  // Reset to first page when filters change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1)
    }
  }, [statusFilter, searchTerm])

  // Load products when filters or page changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadProducts()
    }, searchTerm ? 300 : 0) // 300ms debounce for search, immediate for other changes

    return () => clearTimeout(timeoutId)
  }, [statusFilter, currentPage, searchTerm])

  const loadProducts = async () => {
    try {
      setLoading(true)

      const filters: any = {}
      const { offset } = calculatePagination(totalProducts, itemsPerPage, currentPage)

      if (statusFilter === 'active') {
        filters.isActive = true
      } else if (statusFilter === 'inactive') {
        filters.isActive = false
      } else if (statusFilter === 'featured') {
        filters.isFeatured = true
      } else if (statusFilter === 'low-stock') {
        // This will be handled by a separate method
        const result = await productService.getLowStockProducts(itemsPerPage)
        if (result.success) {
          setProducts(result.data)
          setTotalProducts(result.data.length)
        } else {
          toast.error('Failed to load low stock products')
        }
        return
      }

      if (searchTerm) {
        filters.searchQuery = searchTerm
      }

      const result = await productService.getProductsAdmin({
        searchQuery: filters.searchQuery,
        isActive: filters.isActive,
        isFeatured: filters.isFeatured,
        limit: itemsPerPage,
        offset: offset,
        sortBy: 'created_at',
        sortDirection: 'desc'
      })

      if (result.success) {
        setProducts(result.data.data)
        setTotalProducts(result.data.total)
      } else {
        toast.error('Failed to load products')
        console.error('Error loading products:', result.error)
      }
    } catch (error) {
      console.error('Error loading products:', error)
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    // Scroll to top when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSearch = () => {
    // Search now happens automatically when searchTerm changes
    // This function is kept for the button but does nothing
  }

  const getStatusColor = (product: Product) => {
    if (!product.isActive) return 'bg-gray-100 text-gray-800'
    if (product.isLowStock()) return 'bg-red-100 text-red-800'
    if (!product.isInStock()) return 'bg-yellow-100 text-yellow-800'
    return 'bg-green-100 text-green-800'
  }

  const getStatusText = (product: Product) => {
    if (!product.isActive) return 'Inactive'
    if (product.isLowStock()) return 'Few Left'
    if (!product.isInStock()) return 'Available for preorder'
    return 'In Stock'
  }

  const getStatusIcon = (product: Product) => {
    if (!product.isActive) return <AlertTriangle className="h-3 w-3" />
    if (product.isLowStock()) return <AlertTriangle className="h-3 w-3" />
    if (!product.isInStock()) return <AlertTriangle className="h-3 w-3" />
    return <CheckCircle className="h-3 w-3" />
  }

  // Remove client-side filtering since backend already handles search
  // The API call with searchQuery filter searches the full database
  const displayedProducts = products

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="flex space-x-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-600">Manage your product catalog</p>
        </div>
        <Button asChild>
          <Link href="/en/fyponly-admin/products/new">
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by product name or SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="featured">Featured</SelectItem>
                <SelectItem value="low-stock">Low Stock</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch} variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Products List */}
      <Card>
        <CardHeader>
          <CardTitle>Products ({totalProducts})</CardTitle>
          <CardDescription>
            {statusFilter === 'all' ? 'All products' : `Products filtered by ${statusFilter}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {displayedProducts.length > 0 ? (
            <div className="space-y-4">
              {displayedProducts.map((product) => (
                <div key={product.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-2">
                        <h3 className="font-semibold">{product.nameEn}</h3>
                        <Badge className={getStatusColor(product)}>
                          {getStatusIcon(product)}
                          <span className="ml-1">{getStatusText(product)}</span>
                        </Badge>
                        {product.isFeatured && (
                          <Badge variant="secondary">Featured</Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-sm text-gray-600">
                        <div>
                          <p><strong>SKU:</strong> {product.sku.value}</p>
                          <p><strong>Price:</strong> {product.price.format()}</p>
                        </div>
                        <div>
                          <p><strong>Stock:</strong> {product.stockQuantity}</p>
                          <p><strong>Low Stock Threshold:</strong> {product.lowStockThreshold}</p>
                        </div>
                        <div>
                          <p><strong>Category:</strong> {product.categoryId || 'Uncategorized'}</p>
                          <p><strong>Status:</strong> {product.isActive ? 'Active' : 'Inactive'}</p>
                        </div>
                        <div>
                          <p><strong>Points Rate:</strong>
                            <span className="inline-flex items-center ml-1">
                              <Star className="h-3 w-3 text-orange-600 mr-1" />
                              {(product as any).points_rate || 1}%
                            </span>
                          </p>
                          <p><strong>Points Earned:</strong> {Math.floor(product.price.value * ((product as any).points_rate || 1) * 10)} pts</p>
                        </div>
                        <div>
                          <p><strong>Created:</strong> {new Date(product.created_at).toLocaleDateString()}</p>
                          <p><strong>Updated:</strong> {new Date(product.updated_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/en/fyponly-admin/products/${product.id}`}>
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/en/fyponly-admin/products/${product.id}/edit`}>
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedProducts([{
                            id: product.id,
                            name_en: product.nameEn,
                            sku: product.sku.value,
                            price: product.price.value,
                            points_rate: (product as any).points_rate || 1.0
                          }])
                          setIsPointsModalOpen(true)
                        }}
                      >
                        <Star className="h-4 w-4 mr-1" />
                        Points
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
              <p className="text-gray-500">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Get started by adding your first product.'
                }
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <Button asChild className="mt-4">
                  <Link href="/fyponly-admin/products/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Product
                  </Link>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalProducts > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(totalProducts / itemsPerPage)}
          totalItems={totalProducts}
          itemsPerPage={itemsPerPage}
          onPageChange={handlePageChange}
          className="mt-6"
        />
      )}

      {/* Points Rate Modal */}
      <PointsRateModal
        isOpen={isPointsModalOpen}
        onClose={() => setIsPointsModalOpen(false)}
        products={selectedProducts}
        onUpdate={loadProducts}
      />
    </div>
  )
}
