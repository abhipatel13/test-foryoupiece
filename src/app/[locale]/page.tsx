'use client'
// Test compilation
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ProductCard } from '@/components/product/product-card'
import { productQueries } from '@/lib/supabase/queries'
import { ShoppingBag, Users, Star, Zap, Globe, Shield, ChevronLeft, ChevronRight, ArrowRight, TrendingUp, Percent, Clock, Eye, Heart, Award } from 'lucide-react';
import { RecommendationEngine, getEnhancedDealsProducts } from '@/lib/recommendation-engine';
import { useBoxHeroCategories } from '@/hooks/use-boxhero-categories';
import { useCategoryImages } from '@/hooks/use-category-images';
import { useTrendingProducts } from '@/presentation/hooks/useTrendingProducts';
import { useHomepageBestSellers } from '@/presentation/hooks/useBestSellerProducts';
import { useSSRSafeAuth } from '@/lib/hooks/use-ssr-safe-auth';
import { sortProductsByStockPriority } from '@/lib/utils';

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

export default function HomePage() {
  const t = useTranslations('navigation')
  const { user } = useSSRSafeAuth()
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [dealsProducts, setDealsProducts] = useState<Product[]>([])
  const [recentlyAddedProducts, setRecentlyAddedProducts] = useState<Product[]>([])
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [recommendationsLoading, setRecommendationsLoading] = useState(true)
  const [firefoxRefreshKey, setFirefoxRefreshKey] = useState(0)

  // Use the new trending products system
  const { data: trendingData, isLoading: trendingLoading, error: trendingError } = useTrendingProducts(10)

  // Use the best seller products system
  const { data: bestSellerData, isLoading: bestSellerLoading, error: bestSellerError } = useHomepageBestSellers()

  // Fetch real categories from BoxHero inventory system
  const { categories: boxHeroCategories, loading: categoriesLoading } = useBoxHeroCategories()

  // Fetch random category images with ultra-fast loading
  const {
    images: categoryImages,
    loading: imagesLoading,
    cached,
    progressiveState,
    onImageLoad
  } = useCategoryImages()

  // Force display categories after maximum wait time (prevents stuck loading)
  useEffect(() => {
    if (!categoriesLoading && boxHeroCategories.length > 0) {
      const maxWaitTimeout = setTimeout(() => {
        console.log('🚀 Maximum category wait time reached, ensuring display');
        // Categories should already be visible, this is just a safety net
      }, 8000); // 8 seconds maximum wait

      return () => clearTimeout(maxWaitTimeout);
    }
  }, [categoriesLoading, boxHeroCategories.length]);

  // Optimized image preloading - only preload when categories are about to be displayed
  useEffect(() => {
    // Only preload images in production and when categories are actually being displayed
    if (process.env.NODE_ENV === 'production' && categoryImages.images) {
      const imagesToPreload = Object.values(categoryImages.images).filter(Boolean);

      // Use requestIdleCallback for non-blocking preloading
      const preloadWhenIdle = () => {
        imagesToPreload.slice(0, 3).forEach(src => { // Only preload first 3 images
          const img = new Image();
          img.src = src!;
        });
      };

      if ('requestIdleCallback' in window) {
        requestIdleCallback(preloadWhenIdle);
      } else {
        setTimeout(preloadWhenIdle, 100);
      }
    }
  }, [categoryImages.images]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        // Firefox-specific cache busting and error handling
        const isFirefox = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('firefox')

        if (isFirefox) {
          console.log('🦊 Firefox detected: Implementing cache-busting for deals data')
          // Clear any potential cached state for Firefox
          setDealsProducts([])
          setAllProducts([])
          setRecentlyAddedProducts([])
          // Force component refresh for Firefox
          setFirefoxRefreshKey(prev => prev + 1)
        }

        // Get recently added products which we know contains products with discounts
        const allProductsForDeals = await productQueries.getRecentlyAddedProducts(50)
        console.log(`🎯 Home Page: Fetched ${allProductsForDeals.length} recently added products for deals analysis`)

        // Firefox-specific validation
        if (isFirefox && (!allProductsForDeals || allProductsForDeals.length === 0)) {
          console.warn('🦊 Firefox: No products fetched, retrying...')
          // Retry once for Firefox
          const retryProducts = await productQueries.getRecentlyAddedProducts(50)
          if (retryProducts && retryProducts.length > 0) {
            console.log('🦊 Firefox: Retry successful')
          }
        }

        // Apply global stock-priority sorting to all products
        const sortedProducts = sortProductsByStockPriority(allProductsForDeals, (a, b) => {
          // Preserve original order as secondary sort
          return 0
        })

        setAllProducts(sortedProducts)

        // Apply smart recommendation algorithms for deals
        const userBehavior = RecommendationEngine.generateSimulatedUserBehavior(sortedProducts)

        // Get enhanced deals and discounts (includes sale prices and enhanced loyalty points)
        const deals = getEnhancedDealsProducts(sortedProducts, 5)

        // Firefox-specific deals validation
        if (isFirefox) {
          console.log(`🦊 Firefox: Processing ${deals.length} deals products`)
          if (deals.length === 0) {
            console.warn('🦊 Firefox: No deals found, this might indicate a caching issue')
          }
        }

        setDealsProducts(deals)

        // Get recently added products from BoxHero sync
        const recentlyAdded = await productQueries.getRecentlyAddedProducts(5)
        const sortedRecentlyAdded = sortProductsByStockPriority(recentlyAdded, (a, b) => {
          // Preserve recently added order as secondary sort
          return 0
        })
        setRecentlyAddedProducts(sortedRecentlyAdded)

      } catch (error) {
        console.error('Error fetching products:', error)
        // Firefox-specific error handling
        const isFirefox = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('firefox')
        if (isFirefox) {
          console.error('🦊 Firefox: Product fetching failed, clearing cache and retrying...')
          // Force a clean state for Firefox
          setDealsProducts([])
          setAllProducts([])
          setRecentlyAddedProducts([])
        }
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [])

  // Separate effect for personalized recommendations
  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        setRecommendationsLoading(true)

        // Build API URL with user context
        const params = new URLSearchParams()
        params.set('limit', '5') // Home page shows 5 recommendations
        params.set('include_discounts', 'true')
        params.set('exclude_purchased', 'true')

        if (user?.id) {
          params.set('user_id', user.id)
        }

        const response = await fetch(`/api/recommendations?${params.toString()}`)
        const data = await response.json()

        if (data.success) {
          setRecommendedProducts(data.data || [])
          console.log('✅ Fetched personalized recommendations:', {
            count: data.data?.length || 0,
            algorithm: data.meta?.algorithm,
            hasUserHistory: data.meta?.hasUserHistory
          })
        } else {
          console.error('❌ Failed to fetch recommendations:', data.error)
          // Fallback to empty array
          setRecommendedProducts([])
        }

      } catch (error) {
        console.error('❌ Error fetching recommendations:', error)
        setRecommendedProducts([])
      } finally {
        setRecommendationsLoading(false)
      }
    }

    fetchRecommendations()
  }, [user?.id]) // Re-fetch when user changes

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile-First Hero Banner */}
      <section className="bg-gradient-to-r from-primary/5 via-secondary to-accent/5 border-b border-border">
        <div className="desktop-container py-4 sm:py-6 lg:py-8 xl:py-10">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4 sm:gap-6 lg:gap-8">
            {/* Mobile-Optimized Branding & Value Proposition */}
            <div className="text-center lg:text-left max-w-full lg:max-w-none">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-foreground mb-2 sm:mb-3 lg:mb-4 leading-tight">
                Premium Quality Products
              </h1>
              <p className="text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed">
                Authentic quality • Fast shipping • Trusted by 10,000+ customers
              </p>
            </div>

            {/* Mobile-Optimized Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto lg:flex-shrink-0">
              <Button asChild className="modern-button-primary w-full sm:w-auto px-6 py-3 text-base font-semibold touch-manipulation">
                <Link href="/en/products">
                  Shop Now
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full sm:w-auto px-6 py-3 text-base font-medium touch-manipulation">
                <Link href="/en/products?featured=true">
                  View Featured
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile-First Product Layout */}
      <div className="desktop-container py-4 sm:py-6 lg:py-8 xl:py-10">

        {/* 1. TRENDING PRODUCTS - Enhanced Mobile-First Design */}
        <section className="mb-8 sm:mb-10 lg:mb-12">
          <div className="mobile-section-header">
            <div className="mobile-section-title">
              <TrendingUp className="mobile-section-icon text-primary flex-shrink-0" />
              <h2 className="section-heading">Trending Now</h2>
              <Badge className="mobile-section-badge bg-red-500 text-white animate-pulse ml-2">HOT</Badge>
            </div>
            <Link
              href="/en/trending"
              className="mobile-view-all-link"
            >
              <span className="hidden sm:inline">View All</span>
              <span className="sm:hidden">View All</span>
              <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            </Link>
          </div>

          {trendingLoading ? (
            <div className="product-grid">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="modern-product-card p-3 sm:p-4 animate-pulse">
                  <div className="aspect-square bg-secondary rounded-lg mb-2 sm:mb-3"></div>
                  <div className="h-3 sm:h-4 bg-secondary rounded mb-1 sm:mb-2"></div>
                  <div className="h-2 sm:h-3 bg-secondary rounded mb-1 sm:mb-2"></div>
                  <div className="h-3 sm:h-4 bg-secondary rounded w-16 sm:w-20"></div>
                </div>
              ))}
            </div>
          ) : trendingError ? (
            <div className="text-center py-6 sm:py-8">
              <p className="text-muted-foreground text-sm sm:text-base">Unable to load trending products</p>
            </div>
          ) : (
            <div className="product-grid">
              {trendingData?.products?.map((product) => (
                <ProductCard
                  key={product.product_id}
                  product={{
                    id: product.product_id,
                    sku: product.sku,
                    name_en: product.name_en,
                    name_ja: product.name_ja,
                    price: product.price,
                    compare_at_price: product.compare_at_price,
                    images: product.images,
                    stock_quantity: product.stock_quantity,
                    is_featured: product.is_featured,
                    category_name: product.category_name
                  }}
                  locale="en"
                />
              ))}
            </div>
          )}
        </section>

        {/* 2. BEST SELLERS - Enhanced Mobile-First Design */}
        <section className="mb-12">
          <div className="mobile-section-header">
            <div className="mobile-section-title">
              <Award className="mobile-section-icon text-foreground/70 flex-shrink-0" />
              <h2 className="section-heading">Best Sellers</h2>
              <Badge className="mobile-section-badge bg-secondary text-secondary-foreground ml-2">Customer Favorites</Badge>
            </div>
            <Link
              href="/en/best-sellers"
              className="mobile-view-all-link"
            >
              <span className="hidden sm:inline">View All Best Sellers</span>
              <span className="sm:hidden">View All</span>
              <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            </Link>
          </div>

          {bestSellerLoading ? (
            <div className="product-grid-compact">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="modern-product-card p-4 animate-pulse loading-shimmer">
                  <div className="aspect-square bg-secondary rounded-lg mb-3"></div>
                  <div className="h-4 bg-secondary rounded mb-2"></div>
                  <div className="h-3 bg-secondary rounded mb-2"></div>
                  <div className="h-4 bg-secondary rounded w-20"></div>
                </div>
              ))}
            </div>
          ) : bestSellerError ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Unable to load best sellers</p>
            </div>
          ) : bestSellerData.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No best sellers available at the moment</p>
            </div>
          ) : (
            <div className="product-grid-compact">
              {bestSellerData.map((product) => (
                <div key={product.id} className="relative hover-lift">
                  {/* Minimalist Best Seller Ranking */}
                  <div className="absolute top-3 left-3 z-10">
                    <Badge className={`text-xs font-medium shadow-sm ${
                      product.best_seller_position === 1
                        ? 'bg-foreground text-background'
                        : product.best_seller_position === 2
                        ? 'bg-foreground/80 text-background'
                        : product.best_seller_position === 3
                        ? 'bg-foreground/60 text-background'
                        : 'bg-foreground/40 text-background'
                    }`}>
                      #{product.best_seller_position}
                    </Badge>
                  </div>
                  {/* Subtle emphasis for top performers */}
                  <div className={`${
                    product.best_seller_position <= 3
                      ? 'ring-1 ring-foreground/10'
                      : ''
                  } rounded-lg transition-all duration-200 hover:ring-1 hover:ring-foreground/20 modern-product-card`}>
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
        </section>

        {/* 3. DEALS AND DISCOUNTS - Enhanced Mobile-First Design */}
        <section className="mb-12" key={`deals-section-${firefoxRefreshKey}`}>
          <div className="mobile-section-header">
            <div className="mobile-section-title">
              <Percent className="mobile-section-icon text-primary flex-shrink-0" />
              <h2 className="section-heading">Deals and Discounts</h2>
              <Badge className="mobile-section-badge bg-primary/10 text-primary border-primary/20 ml-2">Up to 20% OFF</Badge>
            </div>
            <Link
              href="/en/products?deals=true"
              className="mobile-view-all-link"
            >
              <span className="hidden sm:inline">View All Deals</span>
              <span className="sm:hidden">View All</span>
              <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            </Link>
          </div>

          {loading ? (
            <div className="product-grid-compact" key={`deals-loading-${firefoxRefreshKey}`}>
              {[...Array(6)].map((_, i) => (
                <div key={i} className="modern-product-card p-4 animate-pulse loading-shimmer">
                  <div className="aspect-square bg-secondary rounded-lg mb-3"></div>
                  <div className="h-4 bg-secondary rounded mb-2"></div>
                  <div className="h-3 bg-secondary rounded mb-2"></div>
                  <div className="h-4 bg-secondary rounded w-20"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="product-grid-compact" key={`deals-products-${firefoxRefreshKey}`}>
              {dealsProducts.map((product) => (
                <div key={product.id} className="hover-lift modern-product-card">
                  <ProductCard product={product} locale="en" />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 4. RECENTLY ADDED - Enhanced Mobile-First Design */}
        <section className="mb-12">
          <div className="mobile-section-header">
            <div className="mobile-section-title">
              <Clock className="mobile-section-icon text-primary flex-shrink-0" />
              <h2 className="section-heading">Recently Added</h2>
              <Badge className="mobile-section-badge bg-green-100 text-green-800 ml-2">New Arrivals</Badge>
            </div>
            <Link
              href="/en/products?recently_added=true"
              className="mobile-view-all-link"
            >
              <span className="hidden sm:inline">See More</span>
              <span className="sm:hidden">See More</span>
              <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            </Link>
          </div>

          {loading ? (
            <div className="product-grid">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="modern-product-card p-4 animate-pulse loading-shimmer">
                  <div className="aspect-square bg-secondary rounded-lg mb-3"></div>
                  <div className="h-4 bg-secondary rounded mb-2"></div>
                  <div className="h-3 bg-secondary rounded mb-2"></div>
                  <div className="h-4 bg-secondary rounded w-20"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="product-grid">
              {recentlyAddedProducts.map((product) => (
                <div key={product.id} className="hover-lift modern-product-card">
                  <ProductCard product={product} locale="en" />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 5. RECOMMENDED FOR YOU - Enhanced Mobile-First Design */}
        <section className="mb-12">
          <div className="mobile-section-header">
            <div className="mobile-section-title">
              <Heart className="mobile-section-icon text-primary flex-shrink-0" />
              <h2 className="section-heading">Recommended for You</h2>
              <Badge className="mobile-section-badge bg-primary/10 text-primary ml-2">Personalized</Badge>
            </div>
            <Link
              href="/en/products?recommended=true"
              className="mobile-view-all-link"
            >
              <span className="hidden sm:inline">See More</span>
              <span className="sm:hidden">See More</span>
              <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            </Link>
          </div>

          {recommendationsLoading ? (
            <div className="product-grid">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="modern-product-card p-4 animate-pulse loading-shimmer">
                  <div className="aspect-square bg-secondary rounded-lg mb-3"></div>
                  <div className="h-4 bg-secondary rounded mb-2"></div>
                  <div className="h-3 bg-secondary rounded mb-2"></div>
                  <div className="h-4 bg-secondary rounded w-20"></div>
                </div>
              ))}
            </div>
          ) : recommendedProducts.length > 0 ? (
            <div className="product-grid">
              {recommendedProducts.map((product) => (
                <div key={product.id} className="hover-lift modern-product-card">
                  <ProductCard product={product} locale="en" />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No recommendations available at the moment.</p>
              <p className="text-sm text-muted-foreground mt-2">
                {user ? 'Start shopping to get personalized recommendations!' : 'Sign in to get personalized recommendations!'}
              </p>
            </div>
          )}
        </section>

        {/* BoxHero Categories - Real Inventory Data */}
        <section id="categories-section" className="mb-16">
          <div className="mb-8 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Shop by Category</h2>
            <p className="text-muted-foreground text-sm sm:text-base">Explore our authentic product categories</p>

            {/* Hidden Progressive Loading Indicator - Only for debugging, not visible to users */}
            {process.env.NODE_ENV === 'development' && !progressiveState.imagesLoaded && progressiveState.imageLoadingProgress > 0 && (
              <div className="mt-4 opacity-30">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Debug: Loading images...</span>
                  <div className="flex-1 bg-secondary rounded-full h-1 max-w-24">
                    <div
                      className="bg-primary h-1 rounded-full transition-all duration-300"
                      style={{ width: `${progressiveState.imageLoadingProgress}%` }}
                    />
                  </div>
                  <span>{Math.round(progressiveState.imageLoadingProgress)}%</span>
                </div>
              </div>
            )}
          </div>



          {categoriesLoading ? (
            // Show skeleton loading for categories (text content) - Mobile-first responsive grid
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-6">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="modern-product-card p-4 sm:p-6 text-center animate-pulse">
                  <div className="aspect-square bg-secondary rounded-xl mb-3 sm:mb-4"></div>
                  <div className="h-3 sm:h-4 bg-secondary rounded w-16 sm:w-20 mx-auto mb-2"></div>
                  <div className="h-2 sm:h-3 bg-secondary rounded w-12 sm:w-16 mx-auto"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-6">
              {boxHeroCategories.length > 0 ? boxHeroCategories.map((category) => {
                const categoryImage = categoryImages[category.slug];

                return (
                  <Link
                    key={category.slug}
                    href={`/en/products?category=${category.slug}`}
                    className="group"
                  >
                    <div className="modern-product-card p-3 sm:p-4 text-center group-hover:scale-105 transition-all duration-300 hover:shadow-lg">
                      {/* Progressive Loading: Show text content immediately */}
                      <div className="aspect-square rounded-xl mb-3 sm:mb-4 overflow-hidden bg-gradient-to-br from-secondary to-accent relative">
                        {categoryImage ? (
                          <Image
                            src={categoryImage}
                            alt={`${category.name} products`}
                            width={150}
                            height={150}
                            sizes="(max-width: 768px) 120px, (max-width: 1024px) 140px, 150px"
                            className={`w-full h-full object-cover group-hover:scale-110 transition-all duration-300 ${
                              progressiveState.loadedImages.has(category.slug)
                                ? 'opacity-100'
                                : 'opacity-0'
                            }`}
                            priority={true} // Enable priority for faster loading
                            quality={60} // Further reduced quality for speed
                            placeholder="blur"
                            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
                            loading="eager" // Force eager loading
                            onLoad={() => onImageLoad(category.slug)}
                            onError={(e) => {
                              // Fallback to emoji if image fails to load
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                parent.innerHTML = `<div class="w-full h-full flex items-center justify-center"><span class="text-4xl">${category.emoji}</span></div>`;
                              }
                              onImageLoad(category.slug); // Mark as loaded even on error
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-4xl">{category.emoji}</span>
                          </div>
                        )}
                      </div>
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-1 text-sm sm:text-base line-clamp-2">
                        {category.name}
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {category.count} items
                      </p>
                    </div>
                  </Link>
                );
              }) : (
                // Fallback static categories if API fails
                <div className="col-span-full text-center py-8">
                  <p className="text-muted-foreground mb-4">Categories temporarily unavailable</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-6">
                    {[
                      { name: 'Hair', count: 347, slug: 'hair', emoji: '💇' },
                      { name: 'Bath & Body', count: 189, slug: 'bath-body', emoji: '🛁' },
                      { name: 'Skincare', count: 163, slug: 'skincare', emoji: '✨' },
                      { name: 'Health & Personal Care', count: 59, slug: 'health-personal-care', emoji: '🏥' },
                      { name: 'Food & Beverage', count: 40, slug: 'food-beverage', emoji: '🍽️' },
                      { name: 'Makeup', count: 53, slug: 'makeup', emoji: '💄' },
                      { name: 'Home', count: 36, slug: 'home', emoji: '🏠' }
                    ].map((category) => (
                      <Link
                        key={category.slug}
                        href={`/en/products?category=${category.slug}`}
                        className="group"
                      >
                        <div className="modern-product-card p-3 sm:p-4 text-center group-hover:scale-105 transition-all duration-300 hover:shadow-lg">
                          <div className="aspect-square rounded-xl mb-3 sm:mb-4 overflow-hidden bg-gradient-to-br from-secondary to-accent relative">
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-3xl sm:text-4xl">{category.emoji}</span>
                            </div>
                          </div>
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-1 text-sm sm:text-base line-clamp-2">
                            {category.name}
                          </h3>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            {category.count} items
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>


      </div>

      {/* Features Section - Modern */}
      <section className="bg-secondary/50 py-20">
        <div className="desktop-container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">Why Choose Foryoupiece?</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Experience premium Japanese products with our commitment to authenticity, quality, and exceptional customer service.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center group">
              <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 transition-colors">
                <Shield className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">Secure Shopping</h3>
              <p className="text-muted-foreground leading-relaxed">
                Enterprise-grade security with encrypted transactions and comprehensive data protection for peace of mind.
              </p>
            </div>

            <div className="text-center group">
              <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 transition-colors">
                <Star className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">Loyalty Rewards</h3>
              <p className="text-muted-foreground leading-relaxed">
                Earn points with every purchase and unlock exclusive tier benefits, discounts, and early access to new products.
              </p>
            </div>

            <div className="text-center group">
              <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 transition-colors">
                <Globe className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">Direct Japan Shipping</h3>
              <p className="text-muted-foreground leading-relaxed">
                Products sourced directly from Japanese drug stores with multiple fast delivery options. Worldwide shipping coming soon.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
