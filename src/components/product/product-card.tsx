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
      className="modern-product-card p-6 group relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link href={`/en/products/${product.sku}`} className="block" onClick={handleProductClick}>
        {/* Product Image */}
        <div className="relative aspect-square mb-4 bg-secondary rounded-xl overflow-hidden">
          {product.images.length > 0 ? (
            <Image
              src={product.images[0]}
              alt={productName}
              fill
              className={`object-contain p-6 transition-all duration-300 ${
                isHovered ? 'scale-110' : 'scale-100'
              } ${imageLoading ? 'blur-sm' : 'blur-0'}`}
              onLoad={() => setImageLoading(false)}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <Package className="h-16 w-16" />
            </div>
          )}

          {/* Professional badges */}
          <div className="absolute top-3 left-3 flex flex-col space-y-1">
            {/* Discount Percentage */}
            {discountPercentage && (
              <Badge className="bg-primary text-primary-foreground text-xs font-medium shadow-sm">
                -{discountPercentage}% OFF
              </Badge>
            )}

            {/* Critical Stock Indicator - Only show for very low stock */}
            {product.stock_quantity === 1 && (
              <Badge className="bg-red-100 text-red-800 text-xs font-medium shadow-sm">
                1 left
              </Badge>
            )}
            {product.stock_quantity === 2 && (
              <Badge className="bg-orange-100 text-orange-800 text-xs font-medium shadow-sm">
                Few left
              </Badge>
            )}

            {/* Featured Badge */}
            {product.is_featured && (
              <Badge className="bg-primary/10 text-primary text-xs font-medium shadow-sm border border-primary/20">
                Featured
              </Badge>
            )}

            {/* Free Shipping Badge */}
            {product.price >= 3500 && (
              <Badge className="bg-green-100 text-green-800 text-xs font-medium shadow-sm">
                Free Shipping
              </Badge>
            )}
          </div>

          {/* Professional Quick Actions */}
          <div className={`absolute bottom-3 left-3 right-3 transition-all duration-300 ${
            isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}>
            <Button
              onClick={handleAddToCart}
              className="w-full modern-button-primary text-sm h-10 shadow-lg"
              disabled={product.stock_quantity <= 0}
            >
              {product.stock_quantity <= 0 ? 'Available for preorder' : 'Add to Cart'}
            </Button>
          </div>
        </div>

        {/* Product Information - Modern Style */}
        <div className="space-y-3">
          {/* Brand */}
          {product.brand && (
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              {product.brand}
            </p>
          )}

          {/* Product Name */}
          <h3 className="text-sm font-medium line-clamp-2 text-foreground group-hover:text-primary transition-colors leading-relaxed">
            {productName}
          </h3>

          {/* Reviews removed - no longer displayed */}

          {/* Price - Professional Style */}
          <div className="space-y-1">
            <div className="flex items-baseline space-x-2">
              <span className="text-lg font-bold text-foreground">
                {formatPrice(product.price)}
              </span>
              {product.compare_at_price && product.compare_at_price > product.price && (
                <span className="text-sm text-muted-foreground line-through">
                  {formatPrice(product.compare_at_price)}
                </span>
              )}
              {discountPercentage && (
                <span className="text-xs font-medium text-primary">
                  Save {formatPrice(product.compare_at_price - product.price)}
                </span>
              )}
            </div>

            {/* Points Display - Amazon-like */}
            <div className="flex items-center space-x-1 text-xs">
              <span className="text-orange-600 font-medium">
                {product.points_rate || 1}%
              </span>
              <span className="text-muted-foreground">back in points</span>
            </div>
          </div>



          {/* Stock Status - Updated rules */}
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

      {/* Wishlist Button - Modern Style */}
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-3 right-3 h-9 w-9 p-0 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-background/80 hover:bg-background shadow-sm backdrop-blur-sm rounded-full"
        onClick={handleWishlist}
      >
        <Heart className="h-4 w-4 text-muted-foreground hover:text-primary" />
      </Button>
    </div>
  )
}
