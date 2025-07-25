'use client'

import { useState } from 'react'
import { ProductCard } from '@/components/product/product-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Award, Filter, Grid, List, ChevronDown } from 'lucide-react'
import { useBestSellerProducts } from '@/presentation/hooks/useBestSellerProducts'

export default function BestSellersPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showTopTierOnly, setShowTopTierOnly] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 24

  const { 
    data: bestSellerData, 
    isLoading, 
    error, 
    pagination,
    refetch 
  } = useBestSellerProducts({ 
    limit: itemsPerPage, 
    page: currentPage,
    topTierOnly: showTopTierOnly 
  })

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleTopTierFilter = () => {
    setShowTopTierOnly(!showTopTierOnly)
    setCurrentPage(1) // Reset to first page when filter changes
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <Award className="h-8 w-8 text-amber-600" />
                <div>
                  <h1 className="text-3xl font-bold text-foreground">Best Sellers</h1>
                  <p className="text-muted-foreground mt-1">
                    Customer favorites that keep selling out
                  </p>
                </div>
              </div>
              <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-sm">
                Customer Favorites
              </Badge>
            </div>
            
            {/* View Mode Toggle */}
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant={showTopTierOnly ? 'default' : 'outline'}
              onClick={toggleTopTierFilter}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              {showTopTierOnly ? 'Top 10 Only' : 'All Best Sellers'}
              <ChevronDown className="h-4 w-4" />
            </Button>
            
            {pagination && (
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, pagination.total)} of {pagination.total} products
              </div>
            )}
          </div>
          
          {pagination && pagination.total > 0 && (
            <div className="text-sm text-muted-foreground">
              Page {currentPage} of {pagination.totalPages}
            </div>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className={`grid gap-6 ${
            viewMode === 'grid' 
              ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6' 
              : 'grid-cols-1'
          }`}>
            {[...Array(itemsPerPage)].map((_, i) => (
              <div key={i} className="modern-product-card p-4 animate-pulse">
                <div className="aspect-square bg-secondary rounded-lg mb-3"></div>
                <div className="h-4 bg-secondary rounded mb-2"></div>
                <div className="h-3 bg-secondary rounded mb-2"></div>
                <div className="h-4 bg-secondary rounded w-20"></div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <div className="text-red-500 mb-4">
              <Award className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-lg font-medium">Unable to load best sellers</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button onClick={refetch} variant="outline">
              Try Again
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && bestSellerData.length === 0 && (
          <div className="text-center py-12">
            <Award className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              No best sellers found
            </h3>
            <p className="text-muted-foreground mb-4">
              {showTopTierOnly 
                ? "No top tier best sellers available at the moment." 
                : "No best sellers available at the moment."
              }
            </p>
            {showTopTierOnly && (
              <Button onClick={toggleTopTierFilter} variant="outline">
                View All Best Sellers
              </Button>
            )}
          </div>
        )}

        {/* Products Grid/List */}
        {!isLoading && !error && bestSellerData.length > 0 && (
          <div className={`grid gap-6 ${
            viewMode === 'grid' 
              ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6' 
              : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
          }`}>
            {bestSellerData.map((product) => (
              <div key={product.id} className="relative">
                {/* Best Seller Position Badge */}
                <div className="absolute top-2 left-2 z-10">
                  <Badge className={`shadow-lg ${
                    product.best_seller_position <= 3 
                      ? 'bg-amber-500 text-white' 
                      : product.best_seller_position <= 10
                      ? 'bg-amber-400 text-white'
                      : 'bg-amber-300 text-amber-900'
                  }`}>
                    #{product.best_seller_position}
                  </Badge>
                </div>
                
                {/* Special styling for top 10 */}
                <div className={`${
                  product.best_seller_position <= 10 
                    ? 'ring-2 ring-amber-400 ring-offset-2' 
                    : ''
                } rounded-lg`}>
                  <ProductCard
                    product={{
                      id: product.id,
                      sku: product.sku,
                      name_en: product.name_en,
                      name_ja: product.name_ja,
                      description_en: product.description_en,
                      description_ja: product.description_ja,
                      price: product.price,
                      compare_at_price: product.compare_at_price,
                      images: product.images,
                      brand: product.brand,
                      stock_quantity: product.stock_quantity,
                      stock_status: product.stock_status,
                      is_featured: product.is_featured,
                      category: product.category
                    }}
                    locale="en"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              variant="outline"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={!pagination.hasPrev}
            >
              Previous
            </Button>
            
            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                const pageNum = Math.max(1, Math.min(
                  pagination.totalPages - 4,
                  Math.max(1, currentPage - 2)
                )) + i
                
                if (pageNum > pagination.totalPages) return null
                
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === currentPage ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePageChange(pageNum)}
                  >
                    {pageNum}
                  </Button>
                )
              })}
            </div>
            
            <Button
              variant="outline"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!pagination.hasNext}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
