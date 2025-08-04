'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useSSRSafeCartStore } from '@/lib/store/ssr-safe-cart-store'
import { useSSRSafeAuth } from '@/lib/hooks/use-ssr-safe-auth'
import { formatPrice, generateCartItemKey } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ShoppingBag, Minus, Plus, Trash2, ArrowLeft, CreditCard, Heart, Gift, Truck, Shield, Star, RefreshCw, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { PointsRedemption } from '@/components/cart/points-redemption'
import { CouponInput } from '@/components/cart/coupon-input'

export default function CartPage() {
  const t = useTranslations('cart')
  const { profile } = useSSRSafeAuth()
  const {
    items,
    isLoading,
    isInitialized,
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
    getFinalTotalWithCouponAndPoints,
    validateCartStock,
    refreshStockStatus,
    isStockValidationNeeded
  } = useSSRSafeCartStore()
  const [isUpdating, setIsUpdating] = useState<string | null>(null)
  const [isValidatingStock, setIsValidatingStock] = useState(false)
  const [stockValidationResult, setStockValidationResult] = useState<{
    hasIssues: boolean
    canCheckout: boolean
  } | null>(null)

  // Real-time stock validation
  const performStockValidation = async () => {
    if (items.length === 0) return

    setIsValidatingStock(true)
    try {
      const result = await validateCartStock()
      setStockValidationResult({
        hasIssues: result.hasIssues,
        canCheckout: result.canCheckout
      })

      if (result.hasIssues) {
        toast.warning('Some items in your cart have stock issues. Please review before checkout.')
      }
    } catch (error) {
      console.error('Stock validation failed:', error)
      toast.error('Failed to validate stock. Please refresh the page.')
    } finally {
      setIsValidatingStock(false)
    }
  }

  // Validate stock on page load and when items change
  useEffect(() => {
    if (items.length > 0 && isStockValidationNeeded()) {
      performStockValidation()
    } else if (items.length === 0) {
      // Reset stock validation when cart is empty
      setStockValidationResult(null)
    }
  }, [items.length])

  // Periodic stock validation (every 2 minutes)
  useEffect(() => {
    if (items.length === 0) return

    const interval = setInterval(() => {
      if (isStockValidationNeeded()) {
        performStockValidation()
      }
    }, 2 * 60 * 1000) // 2 minutes

    return () => clearInterval(interval)
  }, [items.length])

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

      // Trigger stock validation after item removal to update checkout button state
      setTimeout(() => {
        if (items.length > 0) {
          performStockValidation()
        } else {
          // Reset validation state if cart is now empty
          setStockValidationResult(null)
        }
      }, 200)
    } catch (error) {
      console.error('Failed to remove item:', error)
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
  const pointsDiscount = getPointsDiscount()
  const finalTotalWithCouponAndPoints = getFinalTotalWithCouponAndPoints()

  // Debug logging for calculations
  console.log('Cart calculations:', {
    subtotal,
    shippingFee,
    finalTotal,
    couponDiscount,
    pointsDiscount,
    pointsToRedeem,
    appliedCoupon: appliedCoupon?.code,
    finalTotalWithCouponAndPoints,
    isLoading,
    isInitialized,
    itemsLength: items.length
  })

  // Show loading state while cart is initializing to prevent flash of empty cart
  if (isLoading || !isInitialized) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-screen-2xl">
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-white rounded-lg p-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-6"></div>
              <h1 className="text-2xl font-medium text-gray-900 mb-4">Loading your cart...</h1>
              <p className="text-gray-600">
                Please wait while we load your cart items.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show empty cart only after initialization is complete
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
      {/* Breadcrumb - Mobile Responsive */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3 max-w-screen-2xl">
          <div className="text-xs sm:text-sm text-gray-600">
            <Link href="/" className="hover:text-gray-900">Home</Link>
            {' > '}
            <span className="text-gray-900">Shopping Cart</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-screen-2xl">
        {/* Amazon-Style Urgency Banner */}
        {itemCount > 0 && (
          <div className="mb-4 sm:mb-6 bg-orange-50 border-l-4 border-orange-400 p-3 sm:p-4 rounded-r-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-2 w-2 bg-orange-500 rounded-full animate-pulse"></div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-orange-800">
                  Items in your cart are reserved for a limited time
                </p>
                <p className="text-xs text-orange-700 mt-1">
                  Complete your purchase soon to secure these items
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Header - Mobile Responsive */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-900 mb-2">Shopping Cart</h1>
          <div className="flex items-center justify-between">
            <p className="text-sm sm:text-base text-gray-600">
              {getItemCount()} {getItemCount() === 1 ? 'item' : 'items'} in your cart
            </p>
            {totalSavings > 0 && (
              <div className="text-sm font-medium text-green-700 bg-green-50 px-3 py-1 rounded-full">
                You're saving {formatPrice(totalSavings)}!
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
          {/* Left Side - Cart Items and Key Actions (3/4 width on desktop) */}
          <div className="lg:col-span-3 space-y-6">
            {/* Cart Items Section - Improved Layout */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Clean Header */}
              <div className="p-4 sm:p-6 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Checkbox className="h-4 w-4" />
                    <span className="text-sm font-semibold text-gray-900">Select all items</span>
                    <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
                      {itemCount} {itemCount === 1 ? 'item' : 'items'}
                    </span>
                    {stockValidationResult?.hasIssues && (
                      <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-full font-medium">
                        Stock issues detected
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={performStockValidation}
                      disabled={isValidatingStock}
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-sm px-3 py-2 rounded-lg transition-all duration-200 font-medium"
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${isValidatingStock ? 'animate-spin' : ''}`} />
                      {isValidatingStock ? 'Checking...' : 'Check Stock'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearCart}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 text-sm px-4 py-2 rounded-lg transition-all duration-200 font-medium"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear Cart
                    </Button>
                  </div>
                </div>
              </div>

              {/* Improved Cart Items Layout */}
              <div className="divide-y divide-gray-100">
                {items.map((item) => (
                  <div key={generateCartItemKey(item.id, item.variant)} className="p-4 sm:p-6 hover:bg-gray-50 transition-all duration-200">
                    <div className="flex flex-col sm:flex-row sm:items-start space-y-4 sm:space-y-0 sm:space-x-5">
                      {/* Left Section: Checkbox and Image */}
                      <div className="flex items-start space-x-4 sm:contents">
                        {/* Checkbox */}
                        <div className="pt-2">
                          <Checkbox className="h-4 w-4" />
                        </div>

                        {/* Enhanced Product Image */}
                        <div className="relative w-20 h-20 sm:w-32 sm:h-32 lg:w-36 lg:h-36 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                          <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            className="object-contain p-2 sm:p-3"
                            sizes="(max-width: 640px) 80px, (max-width: 1024px) 128px, 144px"
                          />
                        </div>

                        {/* Product Information - Improved */}
                        <div className="flex-1 min-w-0 sm:contents">
                          <div className="space-y-3 sm:flex-1 sm:min-w-0">
                            {/* Product Name - More Prominent */}
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 line-clamp-2 leading-tight">
                              {item.name}
                            </h3>

                            {/* Stock Status - Dynamic Design */}
                            <div className="flex items-center space-x-3">
                              {(() => {
                                const status = item.stockStatus || 'in_stock'
                                const message = item.stockMessage || 'In stock'
                                const stockQuantity = item.stockQuantity || 0

                                if (status === 'out_of_stock') {
                                  return (
                                    <div className="flex items-center text-sm text-red-700 font-medium bg-red-50 px-2 py-1 rounded-md">
                                      <AlertTriangle className="w-3 h-3 mr-2" />
                                      <span>Out of Stock</span>
                                    </div>
                                  )
                                } else if (status === 'insufficient_stock') {
                                  return (
                                    <div className="flex items-center text-sm text-orange-700 font-medium bg-orange-50 px-2 py-1 rounded-md">
                                      <AlertTriangle className="w-3 h-3 mr-2" />
                                      <span>{message}</span>
                                    </div>
                                  )
                                } else if (status === 'low_stock') {
                                  return (
                                    <div className="flex items-center text-sm text-yellow-700 font-medium bg-yellow-50 px-2 py-1 rounded-md">
                                      <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
                                      <span>{message}</span>
                                    </div>
                                  )
                                } else {
                                  return (
                                    <div className="flex items-center text-sm text-green-700 font-medium bg-green-50 px-2 py-1 rounded-md">
                                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                                      <span>In Stock</span>
                                    </div>
                                  )
                                }
                              })()}

                              {/* Show last stock check time if available */}
                              {item.lastStockCheck && (
                                <span className="text-xs text-gray-500">
                                  Updated {new Date(item.lastStockCheck).toLocaleTimeString()}
                                </span>
                              )}
                            </div>

                            {/* Variant Info */}
                            {item.variant && (
                              <div className="text-xs text-gray-600">
                                <span className="font-medium">Variant:</span> {item.variant}
                              </div>
                            )}

                            {/* Gift Option - Subtle */}
                            <div className="flex items-center space-x-2 text-xs text-gray-500">
                              <Checkbox className="h-3 w-3" />
                              <Gift className="h-3 w-3" />
                              <span>This is a gift</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Amazon-Style Actions and Price Section */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between space-y-4 sm:space-y-0 sm:space-x-6">
                        {/* Actions Section - Streamlined */}
                        <div className="flex flex-col space-y-4">
                          {/* Quantity Selector - Clean Design */}
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">Quantity</span>
                              {item.stockQuantity && item.stockQuantity <= 5 && (
                                <span className="text-xs text-orange-600 font-medium">
                                  Max: {item.stockQuantity}
                                </span>
                              )}
                            </div>
                            <Select
                              value={item.quantity.toString()}
                              onValueChange={(value) => handleQuantityChange(item.id, parseInt(value), item.variant)}
                            >
                              <SelectTrigger className="w-full h-10 text-sm border-gray-300 rounded-md shadow-sm hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
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
                          </div>

                          {/* Streamlined Action Buttons - Enterprise UX */}
                          <div className="flex items-center gap-4 text-sm">
                            {/* Primary Action - Delete */}
                            <button
                              onClick={() => handleRemoveItem(item.id, item.variant)}
                              className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-md font-medium transition-all duration-200 min-h-[44px] sm:min-h-[36px]"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="hidden sm:inline">Delete</span>
                            </button>

                            {/* Secondary Action - Save for Later */}
                            <button className="flex items-center gap-1 text-gray-600 hover:text-gray-800 hover:bg-gray-50 px-3 py-2 rounded-md font-medium transition-all duration-200 min-h-[44px] sm:min-h-[36px]">
                              <Heart className="h-4 w-4" />
                              <span className="hidden sm:inline">Save</span>
                            </button>
                          </div>
                        </div>

                        {/* Enhanced Price Display - Amazon Style */}
                        <div className="text-right sm:text-right sm:min-w-[120px]">
                          {/* Total Price for Quantity */}
                          <div className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
                            {formatPrice(item.price * item.quantity)}
                          </div>

                          {/* Price Breakdown */}
                          <div className="text-sm space-y-1">
                            {item.originalPrice && item.originalPrice > item.price ? (
                              <>
                                {/* Original Price - Crossed Out */}
                                <div className="text-gray-500 line-through text-xs">
                                  {formatPrice(item.originalPrice)} each
                                </div>

                                {/* Current Price */}
                                <div className="text-green-700 font-semibold">
                                  {formatPrice(item.price)} each
                                </div>

                                {/* Savings Badge */}
                                <div className="inline-block bg-red-100 text-red-800 text-xs font-medium px-2 py-1 rounded-full">
                                  {Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)}% OFF
                                </div>

                                {/* Total Savings */}
                                <div className="text-green-700 text-xs font-medium">
                                  Save {formatPrice((item.originalPrice - item.price) * item.quantity)}
                                </div>
                              </>
                            ) : (
                              <div className="text-gray-600 font-medium">
                                {formatPrice(item.price)} each
                              </div>
                            )}
                          </div>

                          {/* Quantity Indicator */}
                          {item.quantity > 1 && (
                            <div className="text-xs text-gray-500 mt-2">
                              {item.quantity} × {formatPrice(item.price)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Prominent Order Total and Checkout Section - Improved UX */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200">
              <div className="p-4 sm:p-6">
                {/* Order Summary Header */}
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Order Summary</h2>
                </div>

                {/* Order Breakdown */}
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})</span>
                    <span className="text-gray-900 font-medium">{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Shipping</span>
                    <span className="text-gray-900 font-medium">
                      {shippingFee === 0 ? 'FREE' : formatPrice(shippingFee)}
                    </span>
                  </div>
                  {couponDiscount > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Coupon Discount</span>
                      <span className="text-green-600 font-medium">-{formatPrice(couponDiscount)}</span>
                    </div>
                  )}
                  {pointsDiscount > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Points Discount</span>
                      <span className="text-green-600 font-medium">-{formatPrice(pointsDiscount)}</span>
                    </div>
                  )}
                  {totalSavings > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-green-700 font-medium">Total Savings</span>
                      <span className="text-green-700 font-medium">-{formatPrice(totalSavings)}</span>
                    </div>
                  )}
                </div>

                {/* MINIMALISTIC FINAL TOTAL */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 sm:p-5 mb-6">
                  <div className="text-center">
                    <div className="text-sm font-medium mb-2 text-slate-600">
                      Total to Pay
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-slate-900">
                      {formatPrice(finalTotalWithCouponAndPoints)}
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      Final amount at checkout
                    </div>
                  </div>
                </div>

                {/* ENHANCED CHECKOUT BUTTON - Better sizing and responsive */}
                {stockValidationResult?.canCheckout === false ? (
                  <div className="space-y-3">
                    <Button
                      disabled
                      className="group relative w-full min-h-[44px] h-14 sm:h-16 lg:h-18 text-sm sm:text-base lg:text-lg font-semibold bg-gray-100 text-gray-400 border border-gray-200 rounded-lg shadow-sm cursor-not-allowed mb-2"
                    >
                      <div className="flex items-center justify-center gap-3 sm:gap-4 px-4 py-4 sm:py-5 lg:py-6">
                        <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-gray-400" strokeWidth={1.5} />
                        <div className="flex flex-col items-center">
                          <span className="font-semibold text-gray-400 leading-tight text-sm sm:text-base lg:text-lg">
                            Cannot Proceed to Checkout
                          </span>
                          <span className="text-xs sm:text-sm lg:text-base text-gray-400 mt-0.5">
                            Please resolve stock issues
                          </span>
                        </div>
                      </div>
                    </Button>
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <div className="flex items-start space-x-2">
                        <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-orange-800">
                          <p className="font-medium">Stock Issues Detected</p>
                          <p className="mt-1">Some items in your cart are out of stock or have insufficient quantity. Please update your cart or remove unavailable items to continue.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Button asChild className="group relative w-full min-h-[44px] h-14 sm:h-16 lg:h-18 text-sm sm:text-base lg:text-lg font-semibold bg-slate-50 hover:bg-slate-100 text-slate-900 border border-slate-200 hover:border-slate-300 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 mb-4">
                    <Link href="/en/checkout" className="flex items-center justify-center gap-3 sm:gap-4 px-4 py-4 sm:py-5 lg:py-6">
                      {/* Icon */}
                      <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-slate-600 group-hover:text-slate-700 transition-colors duration-200" strokeWidth={1.5} />

                      {/* Text content */}
                      <div className="flex flex-col items-center">
                        <span className="font-semibold text-slate-900 leading-tight text-sm sm:text-base lg:text-lg">
                          Proceed to Checkout
                        </span>
                        <span className="text-xs sm:text-sm lg:text-base text-slate-600 group-hover:text-slate-700 transition-colors duration-200 mt-0.5">
                          Pay {formatPrice(finalTotalWithCouponAndPoints)}
                        </span>
                      </div>

                      {/* Arrow indicator */}
                      <svg className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </Link>
                  </Button>
                )}

                {/* Security Notice */}
                <div className="flex items-center justify-center text-sm text-gray-600">
                  <Shield className="h-4 w-4 mr-2" />
                  <span>Secure checkout with 256-bit SSL encryption</span>
                </div>
              </div>
            </div>
          </div>

          {/* Simplified Right Sidebar - Additional Options */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 lg:sticky lg:top-4">
              {/* Simplified Header */}
              <div className="p-4 sm:p-5 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Additional Options</h2>
              </div>

              <div className="p-4 sm:p-5 space-y-4">
                {/* Simplified Shipping Info */}
                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center">
                    <Truck className="h-4 w-4 mr-2" />
                    {shippingFee === 0 ? (
                      <span className="text-green-700 font-medium">FREE Delivery (4+ items)</span>
                    ) : (
                      <span>Add {4 - itemCount} more for FREE delivery</span>
                    )}
                  </div>
                </div>

                {/* Simplified Points Earned */}
                {totalPointsEarned > 0 && (
                  <div className="text-sm text-gray-600 bg-orange-50 p-3 rounded-lg">
                    <div className="flex items-center">
                      <Star className="h-4 w-4 mr-2 text-orange-600" />
                      <span>Earn {totalPointsEarned.toLocaleString()} points (${(totalPointsEarned / 1000).toFixed(2)} value)</span>
                    </div>
                  </div>
                )}

                {/* Gift Option - Simplified */}
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <Checkbox />
                  <Gift className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-700">This order contains a gift</span>
                </div>

                {/* Coupon Input - Enhanced */}
                <div className="border-t border-gray-200 pt-4">
                  <CouponInput
                    orderTotal={finalTotal}
                    appliedCoupon={appliedCoupon || undefined}
                    onCouponApplied={applyCoupon}
                    onCouponRemoved={removeCoupon}
                  />
                </div>

                {/* Points Redemption - Enhanced */}
                {profile && (
                  <div className="border-t border-gray-200 pt-4">
                    <PointsRedemption
                      userPointsBalance={profile.points_balance || 0}
                      onPointsChange={(points) => {
                        // Points are automatically updated in the cart store
                      }}
                    />
                  </div>
                )}

                {/* Simplified Order Summary */}
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Quick Summary</h3>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Items ({itemCount}):</span>
                      <span>{formatPrice(subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Shipping:</span>
                      <span>{shippingFee === 0 ? 'FREE' : formatPrice(shippingFee)}</span>
                    </div>
                    {totalSavings > 0 && (
                      <div className="flex justify-between text-green-700">
                        <span>Savings:</span>
                        <span>-{formatPrice(totalSavings)}</span>
                      </div>
                    )}

                    {pointsToRedeem > 0 && (
                      <div className="flex justify-between text-orange-600">
                        <span>Points ({pointsToRedeem.toLocaleString()}):</span>
                        <span>-{formatPrice(getPointsDiscount())}</span>
                      </div>
                    )}
                    {appliedCoupon && couponDiscount > 0 && (
                      <div className="flex justify-between text-blue-600">
                        <span>Coupon ({appliedCoupon.code}):</span>
                        <span>-{formatPrice(couponDiscount)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Simplified Trust Signals */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="text-xs text-gray-600 space-y-1">
                    <div className="flex items-center">
                      <Shield className="h-3 w-3 mr-2" />
                      <span>Secure checkout</span>
                    </div>
                    <div className="flex items-center">
                      <Star className="h-3 w-3 mr-2" />
                      <span>Earn loyalty points</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Continue Shopping Section */}
        <div className="mt-8 sm:mt-10">
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Need more items?</h3>
                <p className="text-sm text-gray-600">Continue shopping to discover more products</p>
              </div>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href="/en/products" className="flex items-center justify-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Continue Shopping
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Enhanced Recommendations Section */}
        <div className="mt-8 sm:mt-12">
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                Customers who bought items in your cart also bought
              </h2>
              <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800">
                View all
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
              {/* Placeholder for recommended products */}
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="aspect-square bg-gray-200 rounded-lg mb-3"></div>
                  <div className="h-3 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded mb-2 w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
