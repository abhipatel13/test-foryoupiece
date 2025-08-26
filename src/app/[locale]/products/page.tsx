'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { productQueries, categoryQueries } from '@/lib/supabase/queries'
import { useSSRSafeAuth } from '@/lib/hooks/use-ssr-safe-auth'
import { ProductCard } from '@/components/product/product-card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Pagination } from '@/components/ui/pagination'
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Search, Filter, Grid, List, ChevronDown, SlidersHorizontal, X } from 'lucide-react'

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

function ProductsPageContent() {
  const t = useTranslations('products')
  const searchParams = useSearchParams()
  const { user } = useSSRSafeAuth()
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

  // Check if this is a "recommended" view
  const isRecommendedView = searchParams.get('recommended') === 'true'

  // Check if this is a "deals" view
  const isDealsView = searchParams.get('deals') === 'true'

  // Check if this is a search view
  const searchQuery = searchParams.get('search')?.trim()
  const isSearchView = Boolean(searchQuery && searchQuery.length > 0)

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

  // Ensure mobile filter Sheet is closed when view changes to a mode that hides filters
  useEffect(() => {
    if (showFilters && (isRecommendedView || isSearchView || isDealsView)) {
      setShowFilters(false)
    }
  }, [showFilters, isRecommendedView, isSearchView, isDealsView])

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
  }, [selectedCategory, currentPage, user?.id, isRecommendedView, searchQuery, isDealsView])

  const loadData = async () => {
    try {
      setLoading(true)

      // Load categories (not needed for recommendations or deals view)
      if (!isRecommendedView && !isDealsView) {
        const categoriesData = await categoryQueries.getCategories()
        setCategories(categoriesData)
      }

      // Handle search view differently
      if (isSearchView) {
        // Use search API for search results
        const params = new URLSearchParams()
        params.set('q', searchQuery!)
        params.set('limit', itemsPerPage.toString())
        params.set('include_suggestions', 'false')
        params.set('include_history', 'false')

        if (selectedCategory) {
          params.set('category', selectedCategory)
        }

        if (user?.id) {
          params.set('user_id', user.id)
        }

        const response = await fetch(`/api/search?${params.toString()}`)
        const apiData = await response.json()

        if (!apiData.success) {
          throw new Error(apiData.error || 'Search failed')
        }

        setProducts(apiData.data.products || [])

        // Set pagination info for search results (no pagination for now)
        setPaginationInfo({
          startItem: 1,
          endItem: apiData.data.products?.length || 0,
          hasMore: false,
          hasPrevious: false
        })
        setTotalItems(apiData.data.products?.length || 0)
        setTotalPages(1)

      } else if (isRecommendedView) {
        // Use recommendations API for personalized results
        const params = new URLSearchParams()
        params.set('limit', '25') // Show 25 recommendations (between 20-30)
        params.set('include_discounts', 'true')
        params.set('exclude_purchased', 'true')

        if (user?.id) {
          params.set('user_id', user.id)
        }

        const response = await fetch(`/api/recommendations?${params.toString()}`)
        const apiData = await response.json()

        if (!apiData.success) {
          throw new Error(apiData.error || 'Failed to fetch recommendations')
        }

        setProducts(apiData.data || [])

        // Set pagination info for recommendations (no pagination needed)
        setPaginationInfo({
          startItem: 1,
          endItem: apiData.data?.length || 0,
          hasMore: false,
          hasPrevious: false
        })
        setTotalItems(apiData.data?.length || 0)
        setTotalPages(1)

      } else {
        // Regular products API for normal views
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

        // Add deals parameter if this is a deals view
        if (isDealsView) {
          params.set('deals', 'true')
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

        // Update pagination info for regular products
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
        <div className="w-full max-w-none px-1 sm:px-4 md:px-6 lg:container lg:mx-auto py-3">
          <div className="text-sm text-gray-600">
            <span>Home</span> &gt; <span className="text-gray-900">
              {isSearchView ? `Search Results for "${searchQuery}"` :
               isRecommendedView ? 'Recommended for You' :
               isRecentlyAddedView ? 'Recently Added' :
               isDealsView ? 'Deals and Discounts' :
               selectedCategory ? categories.find(c => c.slug === selectedCategory)?.name_en || 'Products' : 'Products'}
            </span>
          </div>
        </div>
      </div>

      <div className="w-full max-w-none px-1 sm:px-4 md:px-6 lg:container lg:mx-auto py-4 lg:py-6 lg:max-w-screen-2xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-medium text-gray-900 mb-2">
            {isSearchView ? `Search Results for "${searchQuery}"` :
             isRecommendedView ? 'Recommended for You' :
             isRecentlyAddedView ? 'Recently Added Products' :
             isDealsView ? 'Deals and Discounts' : 'Products'}
          </h1>
          <p className="text-gray-600">
            {isSearchView ? (
              `${products.length} products found for "${searchQuery}"`
            ) : isRecommendedView ? (
              user ?
                `${products.length} personalized recommendations based on your purchase history` :
                `${products.length} popular products (sign in for personalized recommendations)`
            ) : isRecentlyAddedView ? (
              `${products.length} recently added products (sorted by newest first)`
            ) : isDealsView ? (
              `${products.length} products with special discounts and enhanced loyalty points`
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

        {/* Sort and Filter Bar - Hidden for recommendations, search, and deals */}
        {!isRecommendedView && !isSearchView && !isDealsView && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center space-x-4 w-full sm:w-auto">
            {/* Mobile Filter Sheet */}
            <Sheet open={showFilters} onOpenChange={setShowFilters}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  className="lg:hidden min-h-[44px] px-4"
                >
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  Filters
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] sm:w-[320px] p-0">
                <SheetHeader className="p-4 border-b">
                  <SheetTitle>Filter Products</SheetTitle>
                  <SheetDescription>
                    Refine your search with these filters
                  </SheetDescription>
                </SheetHeader>
                <div className="flex flex-col h-full overflow-y-auto">
                  <div className="p-4 space-y-6">
                    {/* Categories Filter */}
                    <div>
                      <h3 className="font-medium text-gray-900 mb-3">Categories</h3>
                      <div className="space-y-3">
                        <label className="flex items-center space-x-3 cursor-pointer">
                          <Checkbox
                            checked={selectedCategory === null}
                            onCheckedChange={() => setSelectedCategory(null)}
                          />
                          <span className="text-sm">All Categories</span>
                        </label>
                        {categories.map((category) => (
                          <label key={category.id} className="flex items-center space-x-3 cursor-pointer">
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
                    <div>
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
                    <div>
                      <h3 className="font-medium text-gray-900 mb-3">Brand</h3>
                      <div className="space-y-3">
                        {brands.map((brand) => (
                          <label key={brand} className="flex items-center space-x-3 cursor-pointer">
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
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <div className="flex items-center space-x-2 flex-1 sm:flex-none">
              <span className="text-sm text-gray-600 hidden sm:inline">Sort by:</span>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full sm:w-48 min-h-[44px]">
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

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="min-h-[44px] min-w-[44px] px-3"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="min-h-[44px] min-w-[44px] px-3"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
        )}

        {/* Main Content */}
        <div className={`${isRecommendedView || isSearchView || isDealsView ? 'flex justify-center' : 'block lg:flex lg:gap-6'}`}>
          {/* Desktop Sidebar Filters - Hidden on mobile, only shown on desktop */}
          {!isRecommendedView && !isSearchView && !isDealsView && (
            <aside className="hidden lg:block w-64 space-y-6">
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
          )}

          {/* Products Grid */}
          <main className={`w-full ${isRecommendedView || isSearchView || isDealsView ? 'max-w-6xl mx-auto' : 'lg:flex-1'}`}>

            {loading ? (
              <div className="product-grid">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="modern-product-card bg-card p-4 animate-pulse">
                    <div className="aspect-square bg-muted rounded-lg mb-3"></div>
                    <div className="h-4 bg-muted rounded mb-2"></div>
                    <div className="h-3 bg-muted rounded mb-2"></div>
                    <div className="h-4 bg-muted rounded w-20"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`${
                viewMode === 'grid'
                  ? 'product-grid'
                  : 'grid grid-cols-1 gap-4'
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
                <p className="text-gray-500 text-lg">
                  {isSearchView ? `No products found for "${searchQuery}"` : 'No products found.'}
                </p>
                <p className="text-gray-400 text-sm mt-2">
                  {isSearchView ? 'Try different search terms or browse our categories.' : 'Try adjusting your filters or search terms.'}
                </p>
              </div>
            )}

            {/* Pagination - Hidden for recommendations, search, and deals */}
            {!loading && !isRecommendedView && !isSearchView && !isDealsView && totalPages > 1 && (
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

export default function ProductsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Loading Products...</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm p-4">
                  <Skeleton className="h-48 w-full mb-4" />
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    }>
      <ProductsPageContent />
    </Suspense>
  )
}
