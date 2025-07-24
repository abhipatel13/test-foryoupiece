'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { productQueries, categoryQueries } from '@/lib/supabase/queries'
import { ProductCard } from '@/components/product/product-card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Pagination } from '@/components/ui/pagination'
import { Search, Filter, Grid, List, ChevronDown, SlidersHorizontal } from 'lucide-react'

interface Product {
  id: string
  sku: string
  name_en: string
  name_ja: string
  description_en: string | null
  description_ja: string | null
  price: number
  compare_at_price: number | null
  images: string[]
  brand: string | null
  stock_quantity: number
  stock_status: string
  is_featured: boolean
  category: {
    id: string
    name_en: string
    name_ja: string
    slug: string
  } | null
}

interface Category {
  id: string
  name_en: string
  name_ja: string
  slug: string
}

export default function ProductsPage() {
  const t = useTranslations('products')
  const searchParams = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState('featured')
  const [priceRange, setPriceRange] = useState([0, 500]) // USD range instead of Yen
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)

  // Check if this is a "recently added" view
  const isRecentlyAddedView = searchParams.get('recently_added') === 'true'

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [itemsPerPage] = useState(50)
  const [paginationInfo, setPaginationInfo] = useState({
    startItem: 0,
    endItem: 0,
    hasMore: false,
    hasPrevious: false
  })

  // Brands state - will be loaded from actual product data
  const [brands, setBrands] = useState<string[]>([])

  // Load brands from products
  useEffect(() => {
    const loadBrands = async () => {
      try {
        // Fetch unique brands from products
        const response = await fetch('/api/products/brands')
        if (response.ok) {
          const data = await response.json()
          setBrands(data.brands || [])
        }
      } catch (error) {
        console.error('Failed to load brands:', error)
        // Fallback brands from BoxHero synced data
        setBrands(['Shiseido', 'Tsubaki', 'Botanist', 'Ululis', 'Honey', 'Diane'])
      }
    }
    loadBrands()
  }, [])

  // Handle URL parameters for category filtering and pagination
  useEffect(() => {
    const categoryParam = searchParams.get('category')
    const pageParam = searchParams.get('page')

    if (categoryParam) {
      setSelectedCategory(categoryParam)
    }

    if (pageParam) {
      setCurrentPage(parseInt(pageParam))
    } else {
      setCurrentPage(1)
    }
  }, [searchParams])

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    // Update URL with new page parameter
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())
    window.history.pushState({}, '', `?${params.toString()}`)
    // Scroll to top when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    loadData()
  }, [selectedCategory, currentPage])

  const loadData = async () => {
    try {
      setLoading(true)

      // Load categories
      const categoriesData = await categoryQueries.getCategories()
      setCategories(categoriesData)

      // Build API URL with pagination and category filtering
      const params = new URLSearchParams()
      params.set('limit', itemsPerPage.toString())
      params.set('page', currentPage.toString())

      if (selectedCategory) {
        params.set('category', selectedCategory)
      }

      // Add recently_added parameter if this is a recently added view
      if (isRecentlyAddedView) {
        params.set('recently_added', 'true')
      }

      const apiUrl = `/api/products?${params.toString()}`

      const response = await fetch(apiUrl)
      if (!response.ok) {
        throw new Error('Failed to fetch products')
      }
      const apiData = await response.json()
      if (!apiData.success) {
        throw new Error(apiData.error || 'Failed to fetch products')
      }

      setProducts(apiData.data)

      // Update pagination info
      if (apiData.pagination) {
        setTotalItems(apiData.pagination.total)
        setTotalPages(apiData.pagination.totalPages)
        setPaginationInfo({
          startItem: apiData.pagination.startItem,
          endItem: apiData.pagination.endItem,
          hasMore: apiData.pagination.hasMore,
          hasPrevious: apiData.pagination.hasPrevious
        })
      }

    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-4" />
          <div className="flex flex-wrap gap-2 mb-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-24" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="aspect-square w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error: {error}</p>
          <Button onClick={loadData}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="text-sm text-gray-600">
            <span>Home</span> &gt; <span className="text-gray-900">
              {isRecentlyAddedView ? 'Recently Added' :
               selectedCategory ? categories.find(c => c.slug === selectedCategory)?.name_en || 'Products' : 'Products'}
            </span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-screen-2xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-medium text-gray-900 mb-2">
            {isRecentlyAddedView ? 'Recently Added Products' : 'Products'}
          </h1>
          <p className="text-gray-600">
            {isRecentlyAddedView ? (
              `${products.length} recently added products (sorted by newest first)`
            ) : totalItems > 0 ? (
              <>
                Showing {paginationInfo.startItem}-{paginationInfo.endItem} of {totalItems} results
                {selectedCategory && ` in ${categories.find(c => c.slug === selectedCategory)?.name_en}`}
              </>
            ) : (
              `${products.length} results ${selectedCategory ? `in ${categories.find(c => c.slug === selectedCategory)?.name_en}` : ''}`
            )}
          </p>
        </div>

        {/* Sort and Filter Bar */}
        <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filters
            </Button>

            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Sort by:</span>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="featured">Featured</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
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

        {/* Main Content */}
        <div className="flex gap-6">
          {/* Sidebar Filters - Amazon Style */}
          <aside className={`w-64 space-y-6 ${showFilters ? 'block' : 'hidden lg:block'}`}>
            {/* Categories Filter */}
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="font-medium text-gray-900 mb-3">Categories</h3>
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <Checkbox
                    checked={selectedCategory === null}
                    onCheckedChange={() => setSelectedCategory(null)}
                  />
                  <span className="text-sm">All Categories</span>
                </label>
                {categories.map((category) => (
                  <label key={category.id} className="flex items-center space-x-2 cursor-pointer">
                    <Checkbox
                      checked={selectedCategory === category.slug}
                      onCheckedChange={() => setSelectedCategory(category.slug)}
                    />
                    <span className="text-sm">{category.name_en}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Price Range Filter */}
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="font-medium text-gray-900 mb-3">Price Range</h3>
              <div className="space-y-4">
                <Slider
                  value={priceRange}
                  onValueChange={setPriceRange}
                  max={500}
                  step={10}
                  className="w-full"
                />
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>${priceRange[0]}</span>
                  <span>${priceRange[1]}</span>
                </div>
              </div>
            </div>

            {/* Brand Filter */}
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="font-medium text-gray-900 mb-3">Brand</h3>
              <div className="space-y-2">
                {brands.map((brand) => (
                  <label key={brand} className="flex items-center space-x-2 cursor-pointer">
                    <Checkbox
                      checked={selectedBrands.includes(brand)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedBrands([...selectedBrands, brand])
                        } else {
                          setSelectedBrands(selectedBrands.filter(b => b !== brand))
                        }
                      }}
                    />
                    <span className="text-sm">{brand}</span>
                  </label>
                ))}
              </div>
            </div>


          </aside>

          {/* Products Grid */}
          <main className="flex-1">

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="amazon-product-card bg-white p-4 animate-pulse">
                    <div className="aspect-square bg-gray-200 rounded-lg mb-3"></div>
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-20"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`grid gap-4 ${
                viewMode === 'grid'
                  ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                  : 'grid-cols-1'
              }`}>
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    locale="en"
                  />
                ))}
              </div>
            )}

            {!loading && products.length === 0 && (
              <div className="text-center py-12 bg-white rounded-lg">
                <p className="text-gray-500 text-lg">No products found.</p>
                <p className="text-gray-400 text-sm mt-2">Try adjusting your filters or search terms.</p>
              </div>
            )}

            {/* Pagination */}
            {!loading && totalPages > 1 && (
              <div className="mt-8">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  itemsPerPage={itemsPerPage}
                  onPageChange={handlePageChange}
                  className="bg-white p-4 rounded-lg shadow-sm"
                />
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
