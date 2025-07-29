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
      className="modern-product-card p-3 sm:p-4 lg:p-6 group relative w-full min-w-0"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link href={`/en/products/${product.sku}`} className="block" onClick={handleProductClick}>
        {/* Product Image - Mobile-First Responsive */}
        <div className="relative aspect-square mb-3 sm:mb-4 bg-secondary rounded-lg sm:rounded-xl overflow-hidden">
          {product.images.length > 0 ? (
            <Image
              src={product.images[0]}
              alt={productName}
              fill
              className={`object-contain p-3 sm:p-4 lg:p-6 transition-all duration-300 ${
                isHovered ? 'scale-110' : 'scale-100'
              } ${imageLoading ? 'blur-sm' : 'blur-0'}`}
              onLoad={() => setImageLoading(false)}
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <Package className="h-8 w-8 sm:h-12 sm:w-12 lg:h-16 lg:w-16" />
            </div>
          )}

          {/* Professional badges - Mobile Optimized */}
          <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex flex-col space-y-1">
            {/* Discount Percentage */}
            {discountPercentage && (
              <Badge className="bg-primary text-primary-foreground text-xs font-medium shadow-sm px-1.5 py-0.5 sm:px-2 sm:py-1">
                -{discountPercentage}% OFF
              </Badge>
            )}

            {/* Critical Stock Indicator - Only show for very low stock */}
            {product.stock_quantity === 1 && (
              <Badge className="bg-red-100 text-red-800 text-xs font-medium shadow-sm px-1.5 py-0.5 sm:px-2 sm:py-1">
                1 left
              </Badge>
            )}
            {product.stock_quantity === 2 && (
              <Badge className="bg-orange-100 text-orange-800 text-xs font-medium shadow-sm px-1.5 py-0.5 sm:px-2 sm:py-1">
                Few left
              </Badge>
            )}

            {/* Featured Badge */}
            {product.is_featured && (
              <Badge className="bg-primary/10 text-primary text-xs font-medium shadow-sm border border-primary/20 px-1.5 py-0.5 sm:px-2 sm:py-1">
                Featured
              </Badge>
            )}

            {/* Free Shipping Badge - Hide on very small screens */}
            {product.price >= 3500 && (
              <Badge className="bg-green-100 text-green-800 text-xs font-medium shadow-sm px-1.5 py-0.5 sm:px-2 sm:py-1 hidden xs:block">
                Free Shipping
              </Badge>
            )}
          </div>

          {/* Professional Quick Actions - Mobile Responsive */}
          <div className={`absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-3 sm:right-3 transition-all duration-300 ${
            isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}>
            <Button
              onClick={handleAddToCart}
              className="w-full modern-button-primary text-xs sm:text-sm h-8 sm:h-10 shadow-lg"
              disabled={product.stock_quantity <= 0}
            >
              {product.stock_quantity <= 0 ? (
                <span className="hidden sm:inline">Available for preorder</span>
              ) : (
                <span className="hidden sm:inline">Add to Cart</span>
              )}
              {product.stock_quantity <= 0 ? (
                <span className="sm:hidden">Preorder</span>
              ) : (
                <span className="sm:hidden">Add</span>
              )}
            </Button>
          </div>
        </div>

        {/* Product Information - Mobile-First Responsive */}
        <div className="space-y-2 sm:space-y-3">
          {/* Brand - Hide on very small screens */}
          {product.brand && (
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium hidden xs:block">
              {product.brand}
            </p>
          )}

          {/* Product Name - Mobile Optimized */}
          <h3 className="text-xs sm:text-sm font-medium line-clamp-2 text-foreground group-hover:text-primary transition-colors leading-tight sm:leading-relaxed">
            {productName}
          </h3>

          {/* Price - Mobile-First Professional Style */}
          <div className="space-y-1">
            <div className="flex items-baseline space-x-1 sm:space-x-2">
              <span className="text-sm sm:text-lg font-bold text-foreground">
                {formatPrice(product.price)}
              </span>
              {product.compare_at_price && product.compare_at_price > product.price && (
                <span className="text-xs sm:text-sm text-muted-foreground line-through">
                  {formatPrice(product.compare_at_price)}
                </span>
              )}
              {discountPercentage && (
                <span className="text-xs font-medium text-primary hidden sm:inline">
                  Save {formatPrice(product.compare_at_price - product.price)}
                </span>
              )}
            </div>

            {/* Points Display - Mobile Optimized */}
            <div className="flex items-center space-x-1 text-xs">
              <span className="text-orange-600 font-medium">
                {product.points_rate || 1}%
              </span>
              <span className="text-muted-foreground">back in points</span>
            </div>
          </div>

          {/* Stock Status - Mobile Responsive */}
          {product.stock_quantity === 1 && (
            <p className="text-xs text-red-600 font-medium">
              1 left
            </p>
          )}
          {product.stock_quantity === 2 && (
            <p className="text-xs text-orange-600 font-medium">
              Few left
            </p>
          )}
          {product.stock_quantity > 2 && (
            <p className="text-xs text-green-600 font-medium">
              Fast delivery
            </p>
          )}
          {product.stock_quantity <= 0 && (
            <p className="text-xs text-blue-600 font-medium">
              Available for preorder
            </p>
          )}
        </div>

      </Link>

      {/* Wishlist Button - Mobile Responsive */}
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2 sm:top-3 sm:right-3 h-7 w-7 sm:h-9 sm:w-9 p-0 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-background/80 hover:bg-background shadow-sm backdrop-blur-sm rounded-full"
        onClick={handleWishlist}
      >
        <Heart className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground hover:text-primary" />
      </Button>
    </div>
  )
}
