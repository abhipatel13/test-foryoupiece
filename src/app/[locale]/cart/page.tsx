'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useCartStore } from '@/lib/store/cart-store'
import { useAuth } from '@/lib/hooks/use-auth'
import { formatPrice, generateCartItemKey } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ShoppingBag, Minus, Plus, Trash2, ArrowLeft, CreditCard, Heart, Gift, Truck, Shield, Star } from 'lucide-react'
import { toast } from 'sonner'
import { PointsRedemption } from '@/components/cart/points-redemption'
import { CouponInput } from '@/components/cart/coupon-input'

export default function CartPage() {
  const t = useTranslations('cart')
  const { profile } = useAuth()
  const {
    items,
    updateQuantity,
    removeItem,
    clearCart,
    getTotal,
    getItemCount,
    getShippingFee,
    getTotalSavings,
    getFinalTotal,
    getFinalTotalWithPoints,
    getPointsDiscount,
    getTotalPointsEarned,
    pointsToRedeem,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    getCouponDiscount,
    getFinalTotalWithCouponAndPoints
  } = useCartStore()
  const [isUpdating, setIsUpdating] = useState<string | null>(null)

  const handleQuantityChange = async (itemId: string, newQuantity: number, variant?: string) => {
    if (newQuantity < 1) return

    setIsUpdating(itemId)
    try {
      const success = await updateQuantity(itemId, newQuantity, variant)
      if (success) {
        toast.success('Cart updated')
      } else {
        // Find the item to get stock info for better error message
        const item = items.find(i => i.id === itemId && i.variant === variant)
        if (item?.stockQuantity) {
          if (item.stockQuantity === 1) {
            toast.error('You can only buy 1 of this item')
          } else {
            toast.error(`You can only buy up to ${item.stockQuantity} of this item`)
          }
        } else {
          toast.error('Not enough stock available')
        }
      }
    } catch (error) {
      toast.error('Failed to update cart')
    } finally {
      setIsUpdating(null)
    }
  }

  const handleRemoveItem = async (itemId: string, variant?: string) => {
    try {
      await removeItem(itemId, variant)
      toast.success('Item removed from cart')
    } catch (error) {
      toast.error('Failed to remove item')
    }
  }

  const handleClearCart = () => {
    clearCart()
    toast.success('Cart cleared')
  }

  // New calculation logic - no tax, fixed shipping with free shipping threshold
  const subtotal = getTotal()
  const shippingFee = getShippingFee()
  const totalSavings = getTotalSavings()
  const finalTotal = getFinalTotal()
  const itemCount = getItemCount()
  const totalPointsEarned = getTotalPointsEarned()
  const couponDiscount = getCouponDiscount()
  const finalTotalWithCouponAndPoints = getFinalTotalWithCouponAndPoints()

  if (items.length === 0) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-screen-2xl">
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-white rounded-lg p-12">
              <ShoppingBag className="h-24 w-24 mx-auto text-gray-300 mb-6" />
              <h1 className="text-2xl font-medium text-gray-900 mb-4">Your cart is empty</h1>
              <p className="text-gray-600 mb-8">
                Looks like you haven't added any items to your cart yet.
              </p>
              <Button asChild className="amazon-button-primary">
                <Link href="/en/products">
                  Continue Shopping
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-3 max-w-screen-2xl">
          <div className="text-sm text-gray-600">
            <Link href="/" className="hover:text-gray-900">Home</Link>
            {' > '}
            <span className="text-gray-900">Shopping Cart</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-screen-2xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-medium text-gray-900 mb-2">Shopping Cart</h1>
          <p className="text-gray-600">
            {getItemCount()} {getItemCount() === 1 ? 'item' : 'items'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Cart Items - Amazon Style */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm">
              {/* Select All Header */}
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Checkbox />
                  <span className="text-sm">Select all items</span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleClearCart} className="text-red-600 hover:text-red-700">
                  Delete
                </Button>
              </div>

              {/* Cart Items */}
              <div className="divide-y">
                {items.map((item) => (
                  <div key={generateCartItemKey(item.id, item.variant)} className="p-4">
                    <div className="flex items-start space-x-4">
                      {/* Checkbox */}
                      <div className="pt-2">
                        <Checkbox />
                      </div>

                      {/* Product Image */}
                      <div className="relative w-24 h-24 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-contain p-2"
                          sizes="96px"
                        />
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium text-gray-900 line-clamp-2">
                            {item.name}
                          </h3>

                          {/* Stock Status */}
                          <div className="flex items-center text-sm text-green-700">
                            <span>In Stock</span>
                          </div>

                          {/* Gift Option */}
                          <div className="flex items-center space-x-2 text-sm">
                            <Checkbox />
                            <Gift className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-600">This is a gift</span>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center space-x-4 text-sm">
                            {/* Quantity Selector */}
                            <div className="flex items-center space-x-2">
                              <span className="text-gray-600">Qty:</span>
                              <Select
                                value={item.quantity.toString()}
                                onValueChange={(value) => handleQuantityChange(item.id, parseInt(value), item.variant)}
                              >
                                <SelectTrigger className="w-16 h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {[...Array(Math.min(item.stockQuantity || 10, 10))].map((_, i) => (
                                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                                      {i + 1}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {/* Stock limit message */}
                              {item.stockQuantity && item.stockQuantity <= 5 && (
                                <span className="text-xs text-orange-600">
                                  Max: {item.stockQuantity}
                                </span>
                              )}
                            </div>

                            <Separator orientation="vertical" className="h-4" />

                            <button
                              onClick={() => handleRemoveItem(item.id, item.variant)}
                              className="text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              Delete
                            </button>

                            <Separator orientation="vertical" className="h-4" />

                            <button className="text-blue-600 hover:text-blue-800 hover:underline">
                              Save for later
                            </button>

                            <Separator orientation="vertical" className="h-4" />

                            <button className="text-blue-600 hover:text-blue-800 hover:underline">
                              Compare with similar items
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Price */}
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900">
                          {formatPrice(item.price * item.quantity)}
                        </div>
                        <div className="text-sm space-y-1">
                          {item.originalPrice && item.originalPrice > item.price ? (
                            <>
                              <div className="text-gray-500 line-through">
                                {formatPrice(item.originalPrice)} each
                              </div>
                              <div className="text-green-700 font-medium">
                                {formatPrice(item.price)} each
                              </div>
                              <div className="text-red-600 text-xs">
                                You save {formatPrice((item.originalPrice - item.price) * item.quantity)}
                                {' '}({Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)}% OFF)
                              </div>
                            </>
                          ) : (
                            <div className="text-gray-600">
                              {formatPrice(item.price)} each
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Order Summary - Amazon Style */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-4 sticky top-4">
              <div className="space-y-4">
                {/* Shipping Banner */}
                {shippingFee === 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded p-3">
                    <div className="flex items-center text-green-700">
                      <Truck className="h-4 w-4 mr-2" />
                      <span className="text-sm font-medium">
                        Your order qualifies for FREE Delivery (4+ items)
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <div className="flex items-center text-blue-700">
                      <Truck className="h-4 w-4 mr-2" />
                      <span className="text-sm font-medium">
                        Add {4 - itemCount} more item{4 - itemCount !== 1 ? 's' : ''} for FREE Delivery
                      </span>
                    </div>
                  </div>
                )}

                {/* Subtotal */}
                <div className="text-lg">
                  <span className="text-gray-700">Subtotal ({itemCount} items): </span>
                  <span className="font-bold">{formatPrice(subtotal)}</span>
                </div>

                {/* Total Savings */}
                {totalSavings > 0 && (
                  <div className="text-sm text-green-700 font-medium">
                    Total Savings: {formatPrice(totalSavings)}
                  </div>
                )}

                {/* Points Earned Display */}
                {totalPointsEarned > 0 && (
                  <div className="flex items-center space-x-2 text-sm bg-orange-50 px-3 py-2 rounded-lg border border-orange-200">
                    <Star className="h-4 w-4 text-orange-600 flex-shrink-0" />
                    <span className="text-orange-700 font-medium">
                      You will earn {totalPointsEarned.toLocaleString()} points with this order
                    </span>
                    <span className="text-orange-600 text-xs">
                      (${(totalPointsEarned / 1000).toFixed(2)} value)
                    </span>
                  </div>
                )}

                {/* Gift Option */}
                <div className="flex items-center space-x-2">
                  <Checkbox />
                  <Gift className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">This order contains a gift</span>
                </div>

                {/* Coupon Input */}
                <CouponInput
                  orderTotal={finalTotal}
                  appliedCoupon={appliedCoupon || undefined}
                  onCouponApplied={applyCoupon}
                  onCouponRemoved={removeCoupon}
                />

                {/* Points Redemption */}
                {profile && (
                  <PointsRedemption
                    userPointsBalance={profile.points_balance || 0}
                    onPointsChange={(points) => {
                      // Points are automatically updated in the cart store
                    }}
                  />
                )}

                {/* Proceed to Checkout */}
                <Button asChild className="w-full amazon-button-primary h-12">
                  <Link href="/en/checkout">
                    Proceed to checkout
                  </Link>
                </Button>

                <Separator />

                {/* Order Details */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Items:</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">Shipping & handling:</span>
                    <span>
                      {shippingFee === 0 ? (
                        <span className="text-green-700">FREE</span>
                      ) : (
                        formatPrice(shippingFee)
                      )}
                    </span>
                  </div>

                  {totalSavings > 0 && (
                    <div className="flex justify-between text-green-700">
                      <span>Total Savings:</span>
                      <span>-{formatPrice(totalSavings)}</span>
                    </div>
                  )}

                  {/* Points Discount */}
                  {pointsToRedeem > 0 && (
                    <div className="flex justify-between text-orange-600">
                      <span>Points Discount ({pointsToRedeem.toLocaleString()} pts):</span>
                      <span>-{formatPrice(getPointsDiscount())}</span>
                    </div>
                  )}

                  {/* Coupon Discount */}
                  {appliedCoupon && couponDiscount > 0 && (
                    <div className="flex justify-between text-blue-600">
                      <span>Coupon Discount ({appliedCoupon.code}):</span>
                      <span>-{formatPrice(couponDiscount)}</span>
                    </div>
                  )}

                  <Separator />

                  <div className="flex justify-between text-lg font-bold text-red-600">
                    <span>Order total:</span>
                    <span>
                      {formatPrice(
                        (appliedCoupon && couponDiscount > 0) || pointsToRedeem > 0
                          ? finalTotalWithCouponAndPoints
                          : finalTotal
                      )}
                    </span>
                  </div>
                </div>

                {/* Security Features */}
                <div className="space-y-2 text-xs text-gray-600">
                  <div className="flex items-center">
                    <Shield className="h-3 w-3 mr-2" />
                    <span>Secure transaction</span>
                  </div>
                  <div className="flex items-center">
                    <Truck className="h-3 w-3 mr-2" />
                    <span>Fast delivery</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recommendations Section */}
        <div className="mt-12">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-medium mb-6">Customers who bought items in your cart also bought</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {/* Placeholder for recommended products */}
              {[...Array(6)].map((_, i) => (
                <div key={i} className="amazon-product-card bg-gray-50 p-4">
                  <div className="aspect-square bg-gray-200 rounded-lg mb-3"></div>
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
