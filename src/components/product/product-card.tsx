'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useCartStore } from '@/lib/store/cart-store'
import { useBehaviorTracking } from '@/lib/hooks/use-behavior-tracking'
import { formatPrice } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Heart, ShoppingCart, Eye, Package } from 'lucide-react'
import { toast } from 'sonner'

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

interface ProductCardProps {
  product: Product
  locale?: string
}

export function ProductCard({ product, locale = 'en' }: ProductCardProps) {
  const t = useTranslations('products')
  const { addItem } = useCartStore()
  const { trackProductView, isReady } = useBehaviorTracking()
  const [isHovered, setIsHovered] = useState(false)
  const [imageLoading, setImageLoading] = useState(true)

  const productName = product.name_en
  const categoryName = product.category?.name_en || null

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (product.stock_quantity <= 0) {
      toast.error('Product is out of stock')
      return
    }

    const success = await addItem({
      id: product.id,
      name: productName,
      price: product.price,
      originalPrice: product.compare_at_price || undefined,
      quantity: 1,
      image: product.images[0] || '/placeholder-product.jpg',
      sku: product.sku,
      variant: undefined, // No variant selection in product cards
      stockQuantity: product.stock_quantity,
      points_rate: product.points_rate || 1.00
    }, product.stock_quantity)

    if (success) {
      toast.success(`${productName} added to cart`)
    } else {
      // Stock validation failed - show appropriate message
      if (product.stock_quantity === 1) {
        toast.error('You can only buy 1 of this item')
      } else {
        toast.error(`You can only buy up to ${product.stock_quantity} of this item`)
      }
    }
  }

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // TODO: Implement wishlist functionality
    toast.success('Added to wishlist')
  }

  const handleProductClick = () => {
    // Track product view when user clicks on product card (only if auth is ready)
    if (isReady) {
      trackProductView(product.id, {
        source: 'product_card',
        sku: product.sku,
        category: product.category?.name_en,
        brand: product.brand,
        price: product.price
      })
    }
  }

  const discountPercentage = product.compare_at_price && product.compare_at_price > product.price
    ? Math.round(((product.compare_at_price - product.price) / product.compare_at_price) * 100)
    : null

  return (
    <div
      className="group relative w-full h-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* COMPLETELY REDESIGNED: Professional E-commerce Card */}
      <div className="modern-product-card h-full flex flex-col bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-300">

        {/* Product Image Container - Fixed 1:1 Aspect Ratio */}
        <div className="relative aspect-square bg-gray-50 rounded-t-lg overflow-hidden flex-shrink-0">
          <Link
            href={`/en/products/${product.sku}`}
            className="relative block w-full h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            onClick={handleProductClick}
            aria-label={`View ${productName}`}
          >
            {product.images.length > 0 ? (
              <Image
                src={product.images[0]}
                alt={productName}
                fill
                className={`object-cover transition-all duration-300 ${
                  isHovered ? 'scale-105' : 'scale-100'
                } ${imageLoading ? 'blur-sm' : 'blur-0'}`}
                onLoad={() => setImageLoading(false)}
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <Package className="h-12 w-12" />
              </div>
            )}
          </Link>

          {/* FIXED: Professional Badge Positioning - Semi-transparent Background */}
          {discountPercentage && (
            <div className="absolute top-2 left-2 z-10">
              <Badge className="bg-red-500/90 text-white text-xs font-bold shadow-lg px-2 py-1 rounded backdrop-blur-sm">
                -{discountPercentage}% OFF
              </Badge>
            </div>
          )}

          {/* Stock Indicators - Integrated into Card Body (not overlay) */}
          {(product.stock_quantity === 1 || product.stock_quantity === 2) && (
            <div className="absolute top-2 right-2 z-10">
              <Badge className={`text-xs font-medium shadow-lg px-2 py-1 rounded backdrop-blur-sm ${
                product.stock_quantity === 1
                  ? 'bg-red-100/90 text-red-800'
                  : 'bg-orange-100/90 text-orange-800'
              }`}>
                {product.stock_quantity === 1 ? '1 left' : 'Few left'}
              </Badge>
            </div>
          )}

          {/* Wishlist Button - Desktop Only */}
          <Button
            variant="ghost"
            size="sm"
            className="absolute bottom-2 right-2 h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-white/90 hover:bg-white shadow-md rounded-full z-10 hidden sm:flex items-center justify-center"
            onClick={handleWishlist}
            aria-label={`Add ${productName} to wishlist`}
          >
            <Heart className="h-3.5 w-3.5 text-gray-600 hover:text-red-500" />
          </Button>
        </div>

        {/* REDESIGNED: Content Section with Proper Hierarchy */}
        <div className="flex-1 flex flex-col p-4">

          {/* Brand - Consistent Typography */}
          {product.brand && (
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1 truncate">
              {product.brand}
            </p>
          )}

          {/* Product Title - 2 Lines Max with Ellipsis */}
          <Link href={`/en/products/${product.sku}`} onClick={handleProductClick}>
            <h3 className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors mb-2 line-clamp-2 leading-tight min-h-[2.5rem]">
              {productName}
            </h3>
          </Link>

          {/* Price Section - Bold and Prominent */}
          <div className="mb-2">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-lg font-bold text-gray-900">
                {formatPrice(product.price)}
              </span>
              {product.compare_at_price && product.compare_at_price > product.price && (
                <>
                  <span className="text-sm text-gray-500 line-through">
                    {formatPrice(product.compare_at_price)}
                  </span>
                  <span className="text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                    Save {formatPrice(product.compare_at_price - product.price)}
                  </span>
                </>
              )}
            </div>

            {/* Points Display - Smaller, Muted Text */}
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <span className="text-orange-600 font-medium">
                {product.points_rate || 1}%
              </span>
              <span>back in points</span>
            </div>
          </div>

          {/* Stock Status - Integrated into Card Body */}
          <div className="text-xs font-medium mb-3">
            {product.stock_quantity === 1 && (
              <span className="text-red-600">Only 1 left</span>
            )}
            {product.stock_quantity === 2 && (
              <span className="text-orange-600">Only 2 left</span>
            )}
            {product.stock_quantity > 2 && (
              <span className="text-green-600">Fast delivery</span>
            )}
            {product.stock_quantity <= 0 && (
              <span className="text-blue-600">Available for preorder</span>
            )}
          </div>

          {/* FIXED: Standardized Add to Cart Button - Bottom Positioned */}
          <div className="mt-auto">
            <Button
              onClick={handleAddToCart}
              className="w-full bg-black hover:bg-gray-800 text-white font-semibold text-sm h-11 shadow-sm hover:shadow-md transition-all duration-200 rounded-md flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed touch-target-44"
              disabled={product.stock_quantity <= 0}
              aria-label={product.stock_quantity <= 0 ? `Preorder ${productName}` : `Add ${productName} to cart`}
            >
              <ShoppingCart className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">
                {product.stock_quantity <= 0 ? 'Preorder' : 'Add to Cart'}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
