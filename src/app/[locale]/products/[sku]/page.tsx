'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useSSRSafeAuth } from '@/lib/hooks/use-ssr-safe-auth'
import { useSSRSafeCartStore } from '@/lib/store/ssr-safe-cart-store'
import { useBehaviorTracking } from '@/lib/hooks/use-behavior-tracking'
import { useWishlist } from '@/lib/hooks/use-wishlist'
import { productQueries } from '@/lib/supabase/queries'
import { formatPrice, slugify } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProductCard } from '@/components/product/product-card'
import {
  Heart,
  ShoppingCart,
  Truck,
  Shield,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  MapPin,
  Check,
  AlertCircle,
  Star,
  Play,
  ZoomIn
} from 'lucide-react'
import { toast } from 'sonner'

interface Product {
  id: string
  sku: string
  name_en: string
  name_ja: string
  description_en: string | null
  description_ja: string | null
  short_description_en: string | null
  short_description_ja: string | null
  price: number
  compare_at_price: number | null
  points_rate: number | null
  images: string[]
  videos?: string[]
  media_order?: string[]
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

export default function ProductDetailPage() {
  const params = useParams()
  const t = useTranslations('products')
  const { isAuthenticated } = useSSRSafeAuth()
  const { addItem } = useSSRSafeCartStore()
  const { trackProductView, isReady } = useBehaviorTracking()
  const { toggleWishlist, isInWishlist } = useWishlist()

  const [product, setProduct] = useState<Product | null>(null)
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null)
  const [isImageZoomed, setIsImageZoomed] = useState(false)

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true)
        const sku = params.sku as string

        if (!sku) {
          setError('Product SKU not found')
          return
        }

        const productData = await productQueries.getProductBySku(sku)

        if (!productData) {
          setError('Product not found')
          return
        }

        setProduct(productData)

        // Fetch related products from the same category
        if (productData.category) {
          const related = await productQueries.getProducts({
            category_id: productData.category.id,
            is_active: true,
            limit: 6
          })
          setRelatedProducts(related.filter(p => p.id !== productData.id))
        }
      } catch (err) {
        console.error('Error fetching product:', err)
        setError('Failed to load product')
      } finally {
        setLoading(false)
      }
    }

    fetchProduct()
  }, [params.sku])

  // Track product view when auth is ready and product is loaded
  useEffect(() => {
    if (isReady && product) {
      trackProductView(product.id, {
        source: 'product_detail_page',
        sku: product.sku,
        category: product.category?.name_en,
        brand: product.brand,
        price: product.price
      })
    }
  }, [isReady, product, trackProductView])

  const handleAddToCart = async () => {
    if (!product) return

    const success = await addItem({
      id: product.id,
      sku: product.sku,
      name: product.name_en,
      price: product.price,
      originalPrice: product.compare_at_price || undefined,
      image: product.images[0] || '/placeholder-product.jpg',
      quantity: quantity,
      variant: selectedVariant || undefined,
      stockQuantity: product.stock_quantity,
      points_rate: product.points_rate || 1.00
    }, product.stock_quantity)

    if (success) {
      toast.success(`Added ${quantity} ${product.name_en} to cart`)
    } else {
      // Stock validation failed - show appropriate message
      if (product.stock_quantity === 1) {
        toast.error('You can only buy 1 of this item')
      } else if (product.stock_quantity <= 0) {
        toast.error('This item is currently out of stock')
      } else {
        toast.error(`You can only buy up to ${product.stock_quantity} of this item`)
      }
    }
  }

  const handleWishlist = async () => {
    if (product) {
      await toggleWishlist(product.id, selectedVariant || undefined)
    }
  }

  // Calculate discount percentage
  const discountPercentage = (product?.compare_at_price && product.compare_at_price > product.price)
    ? Math.round(((product.compare_at_price - product.price) / product.compare_at_price) * 100)
    : null

  // Mixed media with custom order when available
  const extractYouTubeId = (input: string): string | null => {
    try {
      if (!input) return null
      const raw = String(input).trim()

      // Handle iframe embed code by extracting src attribute
      if (/^<iframe[\s\S]*?>/i.test(raw) || raw.toLowerCase().includes('<iframe')) {
        const match = raw.match(/src=["']([^"']+)["']/i)
        if (match && match[1]) {
          return extractYouTubeId(match[1])
        }
      }

      const maybeUrl = raw.startsWith('//') ? `https:${raw}` : raw
      const u = new URL(maybeUrl)
      const host = u.hostname

      if (host.includes('youtu.be')) {
        const id = u.pathname.replace(/^\//, '').split('/')[0]
        return id || null
      }

      if (host.includes('youtube.com') || host.includes('youtube-nocookie.com')) {
        if (u.pathname === '/watch') return u.searchParams.get('v')
        if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2] || null
        if (u.pathname.startsWith('/shorts/')) {
          const id = u.pathname.split('/')[2] || u.pathname.replace('/shorts/', '')
          return (id || '').split('?')[0] || null
        }
      }

      return null
    } catch {
      return null
    }
  }
  const mediaItems = product ? (() => {
    const videos = product.videos || []
    const images = product.images || []
    const ordered: Array<{ kind: 'image' | 'video'; url: string; id?: string }> = []
    const seen = new Set<string>()

    if (product.media_order && product.media_order.length > 0) {
      for (const url of product.media_order) {
        if (videos.includes(url)) {
          ordered.push({ kind: 'video', url, id: extractYouTubeId(url) || undefined })
          seen.add(url)
        } else if (images.includes(url)) {
          ordered.push({ kind: 'image', url })
          seen.add(url)
        }
      }
    }

    // Backward-compat fallback: videos first, then images (for any not yet seen)
    for (const url of videos) if (!seen.has(url)) ordered.push({ kind: 'video', url, id: extractYouTubeId(url) || undefined })
    for (const url of images) if (!seen.has(url)) ordered.push({ kind: 'image', url })

    return ordered
  })() : []


  if (loading) {
    return (
      <div className="bg-background min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-screen-2xl">
          <div className="animate-pulse">
            {/* Breadcrumb skeleton */}
            <div className="h-4 bg-muted rounded w-64 mb-8"></div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Image skeleton */}
              <div className="space-y-4">
                <div className="aspect-square bg-muted rounded-lg"></div>
                <div className="flex space-x-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="w-20 h-20 bg-muted rounded-lg"></div>
                  ))}
                </div>
              </div>

              {/* Product info skeleton */}
              <div className="space-y-6">
                <div className="h-8 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="space-y-2">
                  <div className="h-10 bg-muted rounded w-1/3"></div>
                  <div className="h-4 bg-muted rounded w-1/4"></div>
                </div>
                <div className="h-16 bg-muted rounded"></div>
                <div className="h-12 bg-muted rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="bg-background min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto text-center p-8">
            <div className="mb-6">
              <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h1 className="text-2xl font-semibold text-foreground mb-2">Product Not Found</h1>
              <p className="text-muted-foreground">
                The product you're looking for doesn't exist or may have been removed.
              </p>
            </div>
            <div className="space-y-3">
              <Button asChild className="w-full">
                <Link href="/en/products">
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Browse All Products
                </Link>
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link href="/">
                  Go to Homepage
                </Link>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen">
      {/* Enhanced Breadcrumb */}
      <div className="bg-card border-b border-border">
        <div className="container mx-auto px-4 py-4 max-w-screen-2xl">
          <nav className="text-sm text-muted-foreground">
            <Link href="/" className="accessible-link">Home</Link>
            <span className="mx-2">›</span>
            <Link href="/en/products" className="accessible-link">Products</Link>
            {product.category && (
              <>
                <span className="mx-2">›</span>
                <Link
                  href={`/en/products?category=${product.category.slug}`}
                  className="accessible-link"
                >
                  {product.category.name_en}
                </Link>
              </>
            )}
            <span className="mx-2">›</span>
            <span className="text-foreground font-medium truncate">
              {product.name_en}
            </span>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 lg:py-6 xl:py-8 max-w-screen-2xl">
        {/* Main Product Section - Enterprise Desktop Optimized */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 lg:gap-8 xl:gap-12 mb-16 lg:mb-12 xl:mb-16">
          {/* Enhanced Product Images Gallery - Enterprise Desktop Optimized */}
          <div className="space-y-4 lg:space-y-3 xl:space-y-4">
            {/* Main Image with Navigation - Compact Desktop */}
            <div className="relative aspect-square bg-white rounded-2xl lg:rounded-xl overflow-hidden border-2 border-gray-100 group shadow-lg hover:shadow-xl transition-all duration-300">
              {mediaItems.length > 0 ? (
                <>
                  {mediaItems[selectedImageIndex].kind === 'image' ? (
                    <Image
                      src={mediaItems[selectedImageIndex].url}
                      alt={product.name_en}
                      width={600}
                      height={600}
                      className={`w-full h-full object-contain p-4 sm:p-8 transition-transform duration-300 ${
                        isImageZoomed ? 'scale-150 cursor-zoom-out' : 'cursor-zoom-in'
                      }`}
                      onClick={() => setIsImageZoomed(!isImageZoomed)}
                    />
                  ) : (
                    (() => {
                      const current = mediaItems[selectedImageIndex]
                      const videoId = current.id || extractYouTubeId(current.url) || ''
                      if (!videoId) {
                        // Fallback: show clickable thumbnail if ID could not be parsed
                        const thumb = `https://i.ytimg.com/vi/${(current.url || '').split('v=')[1] || ''}/hqdefault.jpg`
                        return (
                          <a
                            href={current.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full h-full flex items-center justify-center bg-black/5"
                            aria-label="Open video on YouTube"
                          >
                            {thumb ? (<img src={thumb} alt={product.name_en} className="w-full h-full object-cover" />) : (
                              <span className="text-gray-500">Watch on YouTube</span>
                            )}
                          </a>
                        )
                      }
                      return (
                        <iframe
                          key={videoId}
                          src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&playsinline=1`}
                          className="w-full h-full"
                          loading="lazy"
                          referrerPolicy="strict-origin-when-cross-origin"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                          title={product.name_en}
                        />
                      )
                    })()
                  )}

                  {/* Image Navigation Arrows - Enhanced for Mobile */}
                  {mediaItems.length > 1 && (
                    <>
                      <button
                        onClick={() => setSelectedImageIndex(
                          selectedImageIndex === 0 ? mediaItems.length - 1 : selectedImageIndex - 1
                        )}
                        className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-2 sm:p-3 shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer hover:scale-110"
                      >
                        <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                      </button>
                      <button
                        onClick={() => setSelectedImageIndex(
                          selectedImageIndex === mediaItems.length - 1 ? 0 : selectedImageIndex + 1
                        )}
                        className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-2 sm:p-3 shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer hover:scale-110"
                      >
                        <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
                      </button>
                    </>
                  )}

                  {/* Zoom Icon - Enhanced */}
                  <div className="absolute top-2 sm:top-4 right-2 sm:right-4 bg-white/90 rounded-full p-2 sm:p-3 opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg">
                    <ZoomIn className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>

                  {/* Image Counter - Enhanced */}
                  {mediaItems.length > 1 && (
                    <div className="absolute bottom-2 sm:bottom-4 right-2 sm:right-4 bg-black/80 text-white px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium">
                      {selectedImageIndex + 1} / {mediaItems.length}
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <ShoppingCart className="h-16 w-16 sm:h-24 sm:w-24" />
                </div>
              )}
            </div>

            {/* Enhanced Thumbnail Images - Mobile Optimized */}
            {mediaItems.length > 1 && (
              <div className="flex space-x-2 sm:space-x-3 overflow-x-auto pb-2 scrollbar-hide">
                {mediaItems.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImageIndex(index)}
                    className={`flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-xl border-2 overflow-hidden transition-all duration-200 cursor-pointer ${
                      selectedImageIndex === index
                        ? 'border-black shadow-lg scale-105 ring-2 ring-black/20'
                        : 'border-gray-200 hover:border-gray-400 hover:shadow-md'
                    }`}
                  >
                    {item.kind === 'image' ? (
                      <Image
                        src={item.url}
                        alt={`${product.name_en} ${index + 1}`}
                        width={96}
                        height={96}
                        className="w-full h-full object-contain p-1 sm:p-2"
                      />
                    ) : (
                      <div className="relative w-full h-full">
                        <img
                          src={item.id ? `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg` : ''}
                          alt={`${product.name_en} video ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-black/70 rounded-full p-1.5">
                            <Play className="h-4 w-4 text-white" />
                          </div>
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Enhanced Product Information - Mobile-First Enterprise Design */}
          <div className="space-y-6 lg:space-y-8">
            {/* Brand - Enhanced */}
            {product.brand && (
              <div>
                <Link
                  href={`/en/brands/${slugify(product.brand)}`}
                  className="text-blue-600 hover:text-blue-800 text-sm font-semibold transition-colors duration-200 cursor-pointer hover:underline"
                >
                  Visit the {product.brand} Store
                </Link>
              </div>
            )}

            {/* Product Title - Mobile Optimized */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground leading-tight">
              {product.name_en}
            </h1>

            {/* Category Badge - Enhanced */}
            {product.category && (
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <Badge
                  variant="secondary"
                  className="px-3 py-1.5 text-sm font-semibold bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors duration-200 cursor-pointer"
                >
                  {product.category.name_en}
                </Badge>
                {product.is_featured && (
                  <Badge className="px-3 py-1.5 text-sm font-semibold bg-black text-white hover:bg-gray-800 transition-colors duration-200">
                    Featured
                  </Badge>
                )}
              </div>
            )}

            {/* Enhanced Pricing Display - Mobile Optimized */}
            <div className="space-y-4 p-4 sm:p-6 bg-gray-50 rounded-2xl border-2 border-gray-100 hover:border-gray-200 transition-all duration-200">
              <div className="flex flex-col sm:flex-row sm:items-baseline space-y-2 sm:space-y-0 sm:space-x-4">
                <span className="text-3xl sm:text-4xl font-bold text-foreground">
                  {formatPrice(product.price)}
                </span>
                {product.compare_at_price && product.compare_at_price > product.price && (
                  <div className="flex items-center space-x-3">
                    <span className="text-lg sm:text-xl text-muted-foreground line-through">
                      {formatPrice(product.compare_at_price)}
                    </span>
                    {discountPercentage && discountPercentage <= 20 && (
                      <Badge className="bg-red-100 text-red-800 hover:bg-red-200 font-bold px-3 py-1 text-sm transition-colors duration-200">
                        {discountPercentage}% OFF
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {/* Savings Display */}
              {product.compare_at_price && product.compare_at_price > product.price && (
                <div className="text-base text-green-700 font-semibold bg-green-50 px-3 py-2 rounded-lg">
                  You save {formatPrice(product.compare_at_price - product.price)}
                </div>
              )}

              {/* Points Display - Amazon-like */}
              <div className="flex items-center space-x-2 text-base bg-orange-50 px-3 py-2 rounded-lg border border-orange-200">
                <Star className="h-5 w-5 text-orange-600 flex-shrink-0" />
                <span className="text-orange-700 font-semibold">
                  Earn {product.points_rate || 1}% back in points
                </span>
                <span className="text-orange-600 text-sm">
                  ({Math.floor(product.price * (product.points_rate || 1) * 10)} points)
                </span>
              </div>


            </div>

            <Separator />

            {/* Enhanced Stock Status - Enterprise UI with Critical Inventory Warnings Only */}
            <div className="space-y-3">
              {product.stock_quantity === 1 ? (
                <div className="flex items-center p-4 bg-red-50 border border-red-200 rounded-xl transition-all duration-200 hover:shadow-sm">
                  <AlertCircle className="h-5 w-5 mr-3 text-red-600 flex-shrink-0" />
                  <div>
                    <span className="font-semibold text-red-800">1 left</span>
                    <p className="text-sm text-red-600 mt-0.5">Order soon to secure this item</p>
                  </div>
                </div>
              ) : product.stock_quantity === 2 ? (
                <div className="flex items-center p-4 bg-orange-50 border border-orange-200 rounded-xl transition-all duration-200 hover:shadow-sm">
                  <AlertCircle className="h-5 w-5 mr-3 text-orange-600 flex-shrink-0" />
                  <div>
                    <span className="font-semibold text-orange-800">Few left</span>
                    <p className="text-sm text-orange-600 mt-0.5">Limited availability</p>
                  </div>
                </div>
              ) : product.stock_quantity >= 3 ? (
                <div className="flex items-center p-4 bg-green-50 border border-green-200 rounded-xl transition-all duration-200 hover:shadow-sm">
                  <Check className="h-5 w-5 mr-3 text-green-600 flex-shrink-0" />
                  <div>
                    <span className="font-semibold text-green-800">Fast delivery</span>
                    <p className="text-sm text-green-600 mt-0.5">Ready to ship immediately</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center p-4 bg-blue-50 border border-blue-200 rounded-xl transition-all duration-200 hover:shadow-sm">
                  <AlertCircle className="h-5 w-5 mr-3 text-blue-600 flex-shrink-0" />
                  <div>
                    <span className="font-semibold text-blue-800">Available for preorder</span>
                    <p className="text-sm text-blue-600 mt-0.5">Secure your item now</p>
                  </div>
                </div>
              )}
            </div>

            {/* Enterprise-Grade Quantity Selector */}
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <span className="text-base font-semibold text-foreground">Quantity:</span>
                <div className="flex items-center border-2 border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="h-12 px-4 rounded-none hover:bg-secondary transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="px-6 py-3 bg-background border-x border-border min-w-[80px] text-center font-semibold text-lg">
                    {quantity}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setQuantity(quantity + 1)}
                    disabled={quantity >= product.stock_quantity}
                    className="h-12 px-4 rounded-none hover:bg-secondary transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Enterprise-Grade Add to Cart Section */}
              <div className="space-y-4">
                <Button
                  onClick={handleAddToCart}
                  className="w-full bg-black hover:bg-gray-800 text-white h-16 text-lg font-semibold rounded-xl transition-all duration-200 hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed"
                  disabled={product.stock_quantity <= 0}
                >
                  <ShoppingCart className="h-6 w-6 mr-3" />
                  {product.stock_quantity <= 0 ? 'Preorder Now' : 'Add to Cart'}
                </Button>

                <Button
                  variant="outline"
                  onClick={handleWishlist}
                  className={`
                    w-full h-14 text-base font-medium rounded-xl
                    transition-all duration-300 ease-out
                    hover:shadow-lg active:shadow-md
                    transform hover:scale-[1.02] active:scale-[0.98]
                    focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2
                    touch-manipulation
                    ${product && isInWishlist(product.id, selectedVariant || undefined)
                      ? 'border-2 border-red-300 bg-red-50 hover:bg-red-100 hover:border-red-400 text-red-700'
                      : 'border-2 border-gray-300 hover:border-red-300 hover:bg-red-50 text-gray-700 hover:text-red-600'
                    }
                    group/wishlist-detail
                  `}
                  aria-label={product && isInWishlist(product.id, selectedVariant || undefined)
                    ? `Remove ${product.name_en} from wishlist`
                    : `Add ${product.name_en} to wishlist`
                  }
                >
                  <Heart className={`
                    h-5 w-5 mr-3 transition-all duration-300 ease-out
                    group-hover/wishlist-detail:scale-110
                    ${product && isInWishlist(product.id, selectedVariant || undefined)
                      ? 'text-red-500 fill-red-500 drop-shadow-sm'
                      : 'text-gray-600 group-hover/wishlist-detail:text-red-500'
                    }
                  `} />
                  <span className="font-semibold">
                    {product && isInWishlist(product.id, selectedVariant || undefined)
                      ? '❤️ Saved to Wishlist'
                      : 'Save for Later'
                    }
                  </span>
                </Button>
              </div>
            </div>

            {/* Enhanced Features - Enterprise Design */}
            <div className="space-y-6 pt-8 border-t-2 border-gray-100">
              <h3 className="text-xl font-bold text-foreground">Why choose Foryoupiece?</h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-start p-4 bg-white rounded-xl border-2 border-gray-100 hover:border-gray-200 hover:shadow-md transition-all duration-200 cursor-pointer">
                  <Truck className="h-6 w-6 mr-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-foreground text-base">Fast delivery</span>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">Quick and reliable shipping to get your products to you as soon as possible</p>
                  </div>
                </div>
                <div className="flex items-start p-4 bg-white rounded-xl border-2 border-gray-100 hover:border-gray-200 hover:shadow-md transition-all duration-200 cursor-pointer">
                  <Shield className="h-6 w-6 mr-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-foreground text-base">Secure transaction</span>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">Your payment information is protected with enterprise-grade security</p>
                  </div>
                </div>
                <div className="flex items-start p-4 bg-white rounded-xl border-2 border-gray-100 hover:border-gray-200 hover:shadow-md transition-all duration-200 cursor-pointer">
                  <RotateCcw className="h-6 w-6 mr-4 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-foreground text-base">Easy returns</span>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">Hassle-free return policy with simple and convenient process</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Product Details Tabs - Enterprise Design */}
        <Card className="mb-12 shadow-lg border-2 border-gray-100 rounded-2xl overflow-hidden">
          <Tabs defaultValue="description" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-16 bg-gray-50 border-b-2 border-gray-100">
              <TabsTrigger
                value="description"
                className="text-base font-semibold h-full rounded-none data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-black data-[state=active]:text-black transition-all duration-200 cursor-pointer hover:bg-white/50"
              >
                Product Description
              </TabsTrigger>
              <TabsTrigger
                value="specifications"
                className="text-base font-semibold h-full rounded-none data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-black data-[state=active]:text-black transition-all duration-200 cursor-pointer hover:bg-white/50"
              >
                Specifications
              </TabsTrigger>
            </TabsList>

            <TabsContent value="description" className="p-8">
              <div className="prose max-w-none">
                <h3 className="text-2xl font-semibold mb-8 text-foreground">About this item</h3>
                {/* Priority: 1. Short Description, 2. Full Description, 3. Fallback */}
                {product.short_description_en ? (
                  <div className="space-y-6">
                    {/* Display short description */}
                    <div className="text-muted-foreground leading-relaxed">
                      {product.short_description_en.split('\n').map((paragraph, index) => (
                        paragraph.trim() && (
                          <p key={index} className="text-lg leading-8 text-gray-700 mb-4">
                            {paragraph}
                          </p>
                        )
                      ))}
                    </div>

                    {/* If there's also a full description, show it as additional details */}
                    {product.description_en && (
                      <div className="mt-8 pt-6 border-t border-gray-200">
                        <h4 className="text-lg font-semibold text-foreground mb-4">Additional Details</h4>
                        <div className="text-muted-foreground leading-relaxed space-y-4">
                          {product.description_en.split('\n').map((paragraph, index) => (
                            paragraph.trim() && (
                              <p key={index} className="text-base leading-7 text-gray-600">
                                {paragraph}
                              </p>
                            )
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : product.description_en ? (
                  <div className="text-muted-foreground leading-relaxed space-y-6">
                    {product.description_en.split('\n').map((paragraph, index) => (
                      paragraph.trim() && (
                        <p key={index} className="text-lg leading-8 text-gray-700">
                          {paragraph}
                        </p>
                      )
                    ))}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Fallback content when no descriptions are available */}
                    <div className="bg-gray-50 p-6 rounded-xl border">
                      <p className="text-lg leading-8 text-gray-700 font-medium">
                        {product.name_en}
                      </p>
                      {product.brand && (
                        <p className="text-base text-gray-600 mt-3">
                          From {product.brand}
                        </p>
                      )}
                    </div>

                    {/* Additional product information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                      <div className="bg-white p-6 rounded-xl border shadow-sm">
                        <h4 className="font-semibold text-foreground mb-3 flex items-center">
                          <Shield className="h-5 w-5 mr-2 text-green-600" />
                          Quality Assurance
                        </h4>
                        <p className="text-gray-600 text-sm leading-6">
                          All our products are carefully selected and quality-tested to ensure you receive only the best.
                        </p>
                      </div>

                      <div className="bg-white p-6 rounded-xl border shadow-sm">
                        <h4 className="font-semibold text-foreground mb-3 flex items-center">
                          <Truck className="h-5 w-5 mr-2 text-blue-600" />
                          Fast Shipping
                        </h4>
                        <p className="text-gray-600 text-sm leading-6">
                          Quick and reliable delivery to get your products to you as soon as possible.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="specifications" className="p-8">
              <div className="space-y-8">
                <h3 className="text-2xl font-semibold text-foreground">Product Details</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    {product.brand && (
                      <div className="flex justify-between items-center py-4 border-b border-border hover:bg-gray-50 transition-colors duration-200 rounded-lg px-2">
                        <span className="font-semibold text-foreground text-base">Brand:</span>
                        <span className="text-muted-foreground font-medium">{product.brand}</span>
                      </div>
                    )}
                    {product.category && (
                      <div className="flex justify-between items-center py-4 border-b border-border hover:bg-gray-50 transition-colors duration-200 rounded-lg px-2">
                        <span className="font-semibold text-foreground text-base">Category:</span>
                        <span className="text-muted-foreground font-medium">{product.category.name_en}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center py-4 border-b border-border hover:bg-gray-50 transition-colors duration-200 rounded-lg px-2">
                      <span className="font-semibold text-foreground text-base">Availability:</span>
                      <span className={`font-semibold ${
                        product.stock_quantity === 1 ? 'text-red-600' :
                        product.stock_quantity === 2 ? 'text-orange-600' :
                        product.stock_quantity >= 3 ? 'text-green-600' : 'text-blue-600'
                      }`}>
                        {product.stock_quantity === 1 ? '1 left' :
                         product.stock_quantity === 2 ? 'Few left' :
                         product.stock_quantity >= 3 ? 'Fast delivery' : 'Available for preorder'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </Card>

        {/* Enhanced Related Products - Enterprise Design */}
        {relatedProducts.length > 0 && (
          <Card className="p-6 lg:p-8 shadow-lg border-2 border-gray-100 rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 space-y-4 sm:space-y-0">
              <div>
                <h2 className="text-2xl lg:text-3xl font-bold text-foreground">You might also like</h2>
                <p className="text-muted-foreground mt-2 text-base">Similar products from the same category</p>
              </div>
              <Link
                href={`/en/products${product.category ? `?category=${product.category.id}` : ''}`}
                className="text-blue-600 hover:text-blue-800 font-semibold text-base transition-colors duration-200 cursor-pointer hover:underline flex items-center"
              >
                View all
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </div>

            {/* Enhanced Grid Layout for Optimal Button Visibility */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-5 lg:gap-6 xl:gap-7">
              {relatedProducts.slice(0, 6).map((relatedProduct) => (
                <div
                  key={relatedProduct.id}
                  className="
                    transform hover:scale-[1.03] transition-all duration-300 ease-out
                    hover:z-10 relative
                    focus-within:scale-[1.03] focus-within:z-10
                  "
                >
                  <ProductCard
                    product={relatedProduct}
                    locale="en"
                  />
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
