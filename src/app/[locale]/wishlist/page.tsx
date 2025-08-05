'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useSSRSafeAuth } from '@/lib/hooks/use-ssr-safe-auth'
import { useSSRSafeCartStore } from '@/lib/store/ssr-safe-cart-store'
import { useWishlist } from '@/lib/hooks/use-wishlist'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Heart,
  ShoppingCart,
  Trash2,
  Package,
  ArrowLeft,
  Star,
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'

interface WishlistItem {
  id: string
  created_at: string
  product: {
    id: string
    name_en: string
    description_en: string
    price: number
    compare_at_price?: number
    sku: string
    images: string[]
    stock_quantity: number
    is_active: boolean
    category?: {
      id: string
      name_en: string
      slug: string
    }
  }
  variant?: {
    id: string
    name: string
    price_adjustment: number
    sku_suffix: string
  }
}

export default function WishlistPage() {
  const t = useTranslations('wishlist')
  const { user, isAuthenticated, loading: authLoading } = useSSRSafeAuth()
  const { addItem } = useSSRSafeCartStore()
  const { items: wishlistItems, loading, removeFromWishlist } = useWishlist()

  const [removingItems, setRemovingItems] = useState<Set<string>>(new Set())

  const handleRemoveFromWishlist = async (productId: string, variantId?: string) => {
    setRemovingItems(prev => new Set(prev).add(productId))

    try {
      await removeFromWishlist(productId, variantId)
    } finally {
      setRemovingItems(prev => {
        const newSet = new Set(prev)
        newSet.delete(productId)
        return newSet
      })
    }
  }

  const addToCart = async (item: WishlistItem) => {
    const product = item.product
    const variant = item.variant
    
    // Calculate final price
    const finalPrice = variant 
      ? product.price + variant.price_adjustment 
      : product.price

    const success = addItem({
      id: product.id,
      name: product.name_en,
      price: finalPrice,
      image: product.images[0] || '',
      sku: variant ? `${product.sku}-${variant.sku_suffix}` : product.sku,
      stock_quantity: product.stock_quantity,
      variant_id: variant?.id,
      variant_name: variant?.name
    }, 1)

    if (success) {
      toast.success(`${product.name_en} added to cart`)
    } else {
      if (product.stock_quantity <= 0) {
        toast.error('This item is currently out of stock')
      } else {
        toast.error('Unable to add item to cart')
      }
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price)
  }

  const calculateDiscount = (price: number, comparePrice?: number) => {
    if (!comparePrice || comparePrice <= price) return null
    return Math.round(((comparePrice - price) / comparePrice) * 100)
  }

  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-80" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <Heart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-4">Please log in to view your wishlist</h1>
          <p className="text-gray-600 mb-8">You need to be logged in to access your saved items.</p>
          <Button asChild>
            <Link href="/en/auth/login">Log In</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Your Wishlist</h1>
            <p className="text-gray-600">
              {loading ? 'Loading...' : `${wishlistItems.length} saved items`}
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/en/products">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Continue Shopping
            </Link>
          </Button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-80" />
            ))}
          </div>
        ) : wishlistItems.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {wishlistItems.map((item) => {
              const product = item.product
              const variant = item.variant
              const finalPrice = variant ? product.price + variant.price_adjustment : product.price
              const discount = calculateDiscount(finalPrice, product.compare_at_price)
              const isRemoving = removingItems.has(product.id)

              return (
                <Card key={item.id} className="group hover:shadow-lg transition-shadow">
                  <CardContent className="p-0">
                    {/* Product Image */}
                    <div className="relative aspect-square overflow-hidden rounded-t-lg">
                      <Link href={`/en/products/${product.sku}`}>
                        <Image
                          src={product.images[0] || '/placeholder-product.jpg'}
                          alt={product.name_en}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </Link>
                      
                      {/* Discount Badge */}
                      {discount && (
                        <Badge className="absolute top-1 left-1 sm:top-2 sm:left-2 bg-red-500 text-white text-xs">
                          -{discount}%
                        </Badge>
                      )}

                      {/* Remove Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-1 right-1 sm:top-2 sm:right-2 h-7 w-7 sm:h-8 sm:w-8 p-0 bg-white/90 hover:bg-white shadow-md rounded-full"
                        onClick={() => handleRemoveFromWishlist(product.id, variant?.id)}
                        disabled={isRemoving}
                        aria-label="Remove from wishlist"
                      >
                        <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 text-gray-600" />
                      </Button>
                    </div>

                    {/* Product Info */}
                    <div className="p-2 sm:p-3 md:p-4">
                      <Link href={`/en/products/${product.sku}`}>
                        <h3 className="font-medium text-gray-900 mb-1 sm:mb-2 line-clamp-2 hover:text-primary transition-colors text-sm sm:text-base">
                          {product.name_en}
                          {variant && <span className="text-xs sm:text-sm text-gray-500"> - {variant.name}</span>}
                        </h3>
                      </Link>

                      {/* Category */}
                      {product.category && (
                        <p className="text-xs sm:text-sm text-gray-500 mb-1 sm:mb-2">{product.category.name_en}</p>
                      )}

                      {/* Price */}
                      <div className="flex items-center space-x-1 sm:space-x-2 mb-2 sm:mb-3">
                        <span className="text-base sm:text-lg font-bold text-gray-900">
                          {formatPrice(finalPrice)}
                        </span>
                        {product.compare_at_price && product.compare_at_price > finalPrice && (
                          <span className="text-xs sm:text-sm text-gray-500 line-through">
                            {formatPrice(product.compare_at_price)}
                          </span>
                        )}
                      </div>

                      {/* Stock Status */}
                      {product.stock_quantity <= 0 ? (
                        <div className="flex items-center text-red-600 text-xs sm:text-sm mb-2 sm:mb-3">
                          <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          Out of Stock
                        </div>
                      ) : product.stock_quantity <= 5 && (
                        <div className="flex items-center text-orange-600 text-xs sm:text-sm mb-2 sm:mb-3">
                          <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          Only {product.stock_quantity} left
                        </div>
                      )}

                      {/* Actions */}
                      <Button
                        className="w-full h-8 sm:h-10 text-xs sm:text-sm"
                        onClick={() => addToCart(item)}
                        disabled={product.stock_quantity <= 0 || !product.is_active}
                      >
                        <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        {product.stock_quantity <= 0 ? 'Out of Stock' : 'Add to Cart'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <Heart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">Your wishlist is empty</h3>
            <p className="text-gray-600 mb-6">Save items you love to buy them later</p>
            <Button asChild>
              <Link href="/en/products">
                <Package className="h-4 w-4 mr-2" />
                Start Shopping
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
