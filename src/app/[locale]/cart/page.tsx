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

function Countdown({ endsAt }: { endsAt: string }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const end = new Date(endsAt).getTime()
  const diff = Math.max(0, end - now)
  const hrs = Math.floor(diff / 3_600_000)
  const mins = Math.floor((diff % 3_600_000) / 60_000)
  const secs = Math.floor((diff % 60_000) / 1000)
  return <span className="text-[11px] text-green-700/80">Ends in {hrs}h {mins}m {secs}s</span>
}

export default function CartPage() {
  const t = useTranslations('cart')
  const { profile } = useSSRSafeAuth()
  // Use SSR-safe cart store to prevent SSR errors
  const {
    items,
    isLoading,
    isInitialized,
    updateQuantity,
    removeItem,
    clearCart,
    getTotal,
    getItemCount,
    getTotalQuantity,
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
    isStockValidationNeeded,
    // shipping helpers
    getShippingCalculation,
    calculateShipping,
  } = useSSRSafeCartStore()
  const shippingCalculation = getShippingCalculation()
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

  // Ensure shipping reflects current active events on mount and when cart/coupon changes
  useEffect(() => {
    calculateShipping()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, appliedCoupon?.code])

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
  const itemCount = getItemCount() // Number of unique items
  const totalQuantity = getTotalQuantity() // Total quantity of all items
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



  // Show loading if cart is loading or not yet initialized
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
              <Button asChild className="amazon-button-primary w-auto sm:w-auto min-h-[44px] h-11 px-4 py-2">
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
    <div className="bg-gray-50 min-h-screen cart-mobile-compact">
      {/* Breadcrumb - Mobile Responsive */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3 max-w-screen-2xl">
          <div className="text-xs sm:text-sm text-gray-600">
            <Link href="/" className="hover:text-gray-900">Home</Link>
            {' > '}
            <span className="text-gray-900">Shopping Cart</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6 max-w-screen-2xl">
        {/* Amazon-Style Urgency Banner */}
        {itemCount > 0 && (
          <div className="mb-2 sm:mb-6 bg-orange-50 border-l-4 border-orange-400 p-1.5 sm:p-3 rounded-r-lg">
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

        {/* Enhanced Header - Mobile Optimized */}
        <div className="mb-2 sm:mb-4 lg:mb-6">
          <h1 className="text-base sm:text-xl lg:text-2xl font-semibold text-gray-900 mb-0.5 sm:mb-2">Shopping Cart</h1>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-0.5 sm:space-y-0">
            <p className="text-sm sm:text-base text-gray-600">
              {totalQuantity} {totalQuantity === 1 ? 'item' : 'items'} in your cart
            </p>
            {totalSavings > 0 && (
              <div className="text-xs sm:text-sm font-medium text-green-700 bg-green-50 px-2 sm:px-3 py-1 rounded-full">
                You're saving {formatPrice(totalSavings)}!
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 sm:gap-4 lg:gap-8">
          {/* Left Side - Cart Items and Key Actions (3/4 width on desktop) */}
          <div className="lg:col-span-3 space-y-2 sm:space-y-4 lg:space-y-6">
            {/* Cart Items Section - Mobile Optimized Layout */}
            <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 overflow-visible lg:overflow-hidden">
              {/* Clean Header - Mobile Optimized */}
              <div className="p-2 sm:p-4 lg:p-6 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between min-w-0">
                  <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                    <div className="cart-touch-target md:touch-target-44 inline-flex items-center justify-center">
                      <Checkbox aria-label="Select all items" className="cart-checkbox" />
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-gray-900">Select all items</span>
                    <span className="text-xs text-gray-500 bg-gray-200 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
                      {totalQuantity} {totalQuantity === 1 ? 'item' : 'items'}
                    </span>
                    {stockValidationResult?.hasIssues && (
                      <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-full font-medium">
                        Stock issues detected
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={performStockValidation}
                      disabled={isValidatingStock}
                      aria-label={isValidatingStock ? 'Checking stock availability' : 'Check stock availability for all items'}
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-xs sm:text-sm px-2 sm:px-2 lg:px-3 py-2 sm:py-2 rounded-lg transition-all duration-200 font-medium min-h-[40px] h-9 md:min-h-[44px] md:h-10 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${isValidatingStock ? 'animate-spin' : ''}`} />
                      <span className="hidden sm:inline">{isValidatingStock ? 'Checking...' : 'Check Stock'}</span>
                      <span className="sm:hidden text-xs">{isValidatingStock ? 'Check...' : 'Stock'}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearCart}
                      aria-label="Clear all items from cart"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs sm:text-sm px-2 sm:px-2 lg:px-3 py-2 sm:py-2 rounded-lg transition-all duration-200 font-medium min-h-[40px] h-9 md:min-h-[44px] md:h-10 focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                    >
                      <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">Clear Cart</span>
                      <span className="sm:hidden text-xs">Clear</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Improved Cart Items Layout - Optimized Mobile Spacing */}
              <div className="divide-y divide-gray-100">
                {items.map((item) => (
                  <div key={generateCartItemKey(item.id, item.variant)} className="p-2 sm:p-3 lg:p-6 hover:bg-gray-50 transition-all duration-200">
                    <div className="flex flex-col sm:flex-row sm:items-start space-y-1.5 sm:space-y-0 sm:space-x-3">
                      {/* Left Section: Checkbox and Image */}
                      <div className="flex items-start space-x-2 sm:contents">
                        {/* Checkbox - Mobile Optimized with Touch Target */}
                        <div className="pt-0.5 sm:pt-2">
                          <div className="cart-touch-target md:touch-target-44 inline-flex items-center justify-center">
                            <Checkbox className="cart-checkbox" />
                          </div>
                        </div>

                        {/* Enhanced Product Image - Mobile Optimized */}
                        <div className="relative w-12 h-12 sm:w-20 sm:h-20 lg:w-32 lg:h-32 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                          <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            className="object-contain p-1 sm:p-1"
                            sizes="(max-width: 640px) 48px, (max-width: 1024px) 96px, 128px"
                          />
                        </div>

                        {/* Product Information - Mobile Optimized */}
                        <div className="flex-1 min-w-0 sm:contents">
                          <div className="space-y-0.5 sm:space-y-2 sm:flex-1 sm:min-w-0">
                            {/* Product Name - Mobile Optimized */}
                            <h3 className="text-[13px] sm:text-base lg:text-lg font-semibold text-gray-900 line-clamp-2 leading-snug">
                              {item.name}
                            </h3>

                            {/* Stock Status - Dynamic Design */}
                            <div className="flex items-center space-x-1.5">
                              {(() => {
                                const status = item.stockStatus || 'in_stock'
                                const message = item.stockMessage || 'In stock'
                                const stockQuantity = item.stockQuantity || 0

                                if (status === 'out_of_stock') {
                                  return (
                                    <div className="flex items-center text-xs text-red-700 font-medium bg-red-50 px-1.5 py-0.5 rounded-md">
                                      <AlertTriangle className="w-3 h-3 mr-2" />
                                      <span>Out of Stock</span>
                                    </div>
                                  )
                                } else if (status === 'insufficient_stock') {
                                  return (
                                    <div className="flex items-center text-xs text-orange-700 font-medium bg-orange-50 px-1.5 py-0.5 rounded-md">
                                      <AlertTriangle className="w-3 h-3 mr-2" />
                                      <span>{message}</span>
                                    </div>
                                  )
                                } else if (status === 'low_stock') {
                                  return (
                                    <div className="flex items-center text-xs text-yellow-700 font-medium bg-yellow-50 px-1.5 py-0.5 rounded-md">
                                      <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
                                      <span>{message}</span>
                                    </div>
                                  )
                                } else {
                                  return (
                                    <div className="flex items-center text-xs text-green-700 font-medium bg-green-50 px-1.5 py-0.5 rounded-md">
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
                              <div className="text-[11px] text-gray-600">
                                <span className="font-medium">Variant:</span> {item.variant}
                              </div>
                            )}

                            {/* Gift Option - Subtle */}
                            <div className="flex items-center space-x-1.5 text-xs text-gray-500">
                              <Checkbox className="cart-checkbox" />
                              <Gift className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                              <span>This is a gift</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Amazon-Style Actions and Price Section */}
                      <div className="cart-item-row grid grid-cols-[1fr_auto] items-start gap-x-2 gap-y-1 sm:flex sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        {/* Actions Section - Streamlined */}
                        <div className="cart-item-actions flex flex-col space-y-1 sm:space-y-2">
                          {/* Quantity Selector - Enterprise Accessibility */}
                          <div className="bg-gray-50 p-1.5 sm:p-2 rounded-lg overflow-x-hidden min-w-[140px]">
                            <div className="flex items-center justify-between mb-0">
                              <label htmlFor={`quantity-${item.id}-${item.variant || 'default'}`} className="text-xs sm:text-sm font-medium text-gray-700">
                                Quantity
                              </label>
                              {item.stockQuantity && item.stockQuantity <= 5 && (
                                <span className="text-xs text-orange-600 font-medium" role="status" aria-live="polite">
                                  Max: {item.stockQuantity}
                                </span>
                              )}
                            </div>
                            <Select
                              value={item.quantity.toString()}
                              onValueChange={(value) => handleQuantityChange(item.id, parseInt(value), item.variant)}
                            >
                              <SelectTrigger
                                id={`quantity-${item.id}-${item.variant || 'default'}`}
                                aria-label={`Change quantity for ${item.name}`}
                                className="self-start w-16 sm:w-20 h-8 sm:h-9 text-xs sm:text-sm border-gray-300 rounded-md shadow-sm hover:border-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 touch-target-sm md:touch-target-44"
                              >
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
                          <div className="flex items-center gap-2 sm:gap-4 text-sm">
                            {/* Primary Action - Delete */}
                            <button
                              onClick={() => handleRemoveItem(item.id, item.variant)}
                              aria-label={`Remove ${item.name} from cart`}
                              className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 px-2 sm:px-3 py-1.5 sm:py-1.5 rounded-md font-medium transition-all duration-200 min-h-[36px] h-8 md:min-h-[44px] md:h-9 focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                            >
                              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                              <span className="hidden sm:inline">Delete</span>
                            </button>

                            {/* Secondary Action - Save for Later */}
                            <button
                              aria-label={`Save ${item.name} for later`}
                              className="flex items-center gap-1 text-gray-600 hover:text-gray-800 hover:bg-gray-50 px-2 sm:px-3 py-1.5 sm:py-1.5 rounded-md font-medium transition-all duration-200 min-h-[36px] h-8 md:min-h-[44px] md:h-9 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                            >
                              <Heart className="h-3 w-3 sm:h-4 sm:w-4" />
                              <span className="hidden sm:inline">Save</span>
                            </button>
                          </div>
                        </div>

                        {/* Enhanced Price Display - Amazon Style */}
                        <div className="cart-price-col self-start sm:self-auto text-right sm:text-right sm:min-w-[120px] min-w-0">
                          {/* Total Price for Quantity */}
                          <div className="text-[15px] sm:text-xl font-bold text-gray-900 mb-0.5 lg:mb-1">
                            {formatPrice(item.price * item.quantity)}
                          </div>

                          {/* Price Breakdown (mobile compact) */}
                          <div className="lg:hidden space-y-0.5">
                            {item.originalPrice && item.originalPrice > item.price ? (
                              <>
                                <div className="flex items-center justify-end gap-1 text-[11px] text-gray-600 whitespace-nowrap">
                                  <span className="line-through text-gray-500">{formatPrice(item.originalPrice)} ea</span>
                                  <span className="text-gray-400">•</span>
                                  <span className="font-medium text-gray-800">{formatPrice(item.price)} ea</span>
                                  {item.quantity > 1 && (
                                    <>
                                      <span className="text-gray-400">•</span>
                                      <span className="text-gray-500">{item.quantity} × {formatPrice(item.price)}</span>
                                    </>
                                  )}
                                </div>
                                <div className="flex items-center justify-end gap-1">
                                  <span className="inline-block bg-red-100 text-red-800 text-[10px] font-medium px-1.5 py-0.5 rounded-full">
                                    {Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)}% OFF
                                  </span>
                                  <span className="text-green-700 text-[11px] font-medium">
                                    Save {formatPrice((item.originalPrice - item.price) * item.quantity)}
                                  </span>
                                </div>
                              </>
                            ) : (
                              <div className="flex items-center justify-end gap-1 text-[11px] text-gray-600 whitespace-nowrap">
                                <span>{formatPrice(item.price)} ea</span>
                                {item.quantity > 1 && (
                                  <>
                                    <span className="text-gray-400">•</span>
                                    <span className="text-gray-500">{item.quantity} × {formatPrice(item.price)}</span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Price Breakdown (desktop unchanged) */}
                          <div className="hidden lg:block text-sm space-y-0.5">
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

                          {/* Quantity Indicator (desktop only) */}
                          <div className="hidden lg:block">
                            {item.quantity > 1 && (
                              <div className="text-xs text-gray-500 mt-2">
                                {item.quantity} × {formatPrice(item.price)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile-Only: Coupon and Points Section - Moved BEFORE Order Summary */}
            <div className="lg:hidden space-y-2 sm:space-y-4">
              {/* Mobile Coupon Input */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 sm:p-4">
                <CouponInput
                  orderTotal={finalTotal}
                  appliedCoupon={appliedCoupon || undefined}
                  onCouponApplied={applyCoupon}
                  onCouponRemoved={removeCoupon}
                />
              </div>

              {/* Mobile Points Redemption */}
              {profile && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 sm:p-4">
                  <PointsRedemption
                    userPointsBalance={profile.points_balance || 0}
                    onPointsChange={(points) => {
                      // Points are automatically updated in the cart store
                    }}
                  />
                </div>
              )}
            </div>

            {/* Prominent Order Total and Checkout Section - Mobile Optimized */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200">
              <div className="p-2 sm:p-4 lg:p-6">
                {/* Order Summary Header */}
                <div className="mb-2 sm:mb-4">
                  <h2 className="text-base sm:text-xl font-semibold text-gray-900">Order Summary</h2>
                </div>

                {/* Order Breakdown - Mobile Optimized */}
                <div className="space-y-1.5 sm:space-y-3 mb-3 sm:mb-6">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Subtotal ({totalQuantity} {totalQuantity === 1 ? 'item' : 'items'})</span>
                    <span className="text-gray-900 font-medium">{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                  {/* Free Shipping EVENT details */}
                  {(() => {
                    const calc = getShippingCalculation?.()
                    if (calc?.freeShippingReason === 'event' && calc?.eventContext) {
                      return (
                        <div className="mt-2 text-xs text-green-700 bg-green-50 border border-green-200 p-2 rounded-md">
                          <div className="font-semibold">Free Shipping EVENT</div>
                          <div className="text-green-700/90">{calc.eventContext.title}</div>
                          {calc.eventContext.ends_at && (
                            <Countdown endsAt={calc.eventContext.ends_at} />
                          )}
                        </div>
                      )
                    }
                    return null
                  })()}

                    <span className="text-gray-600">Shipping</span>
                    <span className="text-gray-900 font-medium">
                      {(() => { const calc = shippingCalculation || getShippingCalculation?.(); if (shippingFee === 0) { if (calc?.freeShippingReason === 'permanent_tier') return 'Diamond Rank Free Delivery'; if (calc?.freeShippingReason === 'quantity') return 'FREE (4+ items)'; if (calc?.freeShippingReason === 'event' && calc?.eventContext?.title) return `FREE (Event: ${calc.eventContext.title})`; if (calc?.freeShippingReason === 'coupon') return 'FREE (Coupon applied)'; return 'FREE'; } return formatPrice(shippingFee); })()}
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

                {/* MINIMALISTIC FINAL TOTAL - Mobile Optimized */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 sm:p-4 lg:p-5 mb-4 sm:mb-6">
                  <div className="text-center">
                    <div className="text-sm font-medium mb-1 sm:mb-2 text-slate-600">
                      Total to Pay
                    </div>
                    <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900">
                      {formatPrice(finalTotalWithCouponAndPoints)}
                    </div>
                    <div className="text-xs sm:text-sm text-slate-500 mt-1">
                      Final amount at checkout
                    </div>
                  </div>
                </div>

                {/* MOBILE-OPTIMIZED CHECKOUT BUTTON - Enterprise-level sizing and design */}
                {stockValidationResult?.canCheckout === false ? (
                  <div className="space-y-3">
                    <Button
                      disabled
                      className="group relative w-full min-h-[40px] h-11 sm:h-12 md:min-h-[44px] md:h-12 text-sm sm:text-base font-semibold bg-gray-100 text-gray-400 border border-gray-200 rounded-lg shadow-sm cursor-not-allowed mb-2"
                    >
                      <div className="flex items-center justify-center gap-2 px-4 py-2">
                        <AlertTriangle className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
                        <div className="flex flex-col items-center">
                          <span className="font-semibold text-gray-400 leading-tight text-sm sm:text-base">
                            Cannot Proceed to Checkout
                          </span>
                          <span className="text-xs sm:text-sm lg:text-base text-gray-400 mt-0.5">
                            Please resolve stock issues
                          </span>
                        </div>
                      </div>
                    </Button>
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 sm:p-4" role="alert" aria-live="polite">
                      <div className="flex items-start space-x-2 sm:space-x-3">
                        <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm sm:text-base text-orange-800">
                          <p className="font-semibold mb-1">Stock Issues Detected</p>
                          <p className="leading-relaxed">Some items in your cart are out of stock or have insufficient quantity. Please update your cart or remove unavailable items to continue.</p>
                          <button
                            onClick={performStockValidation}
                            className="mt-2 text-orange-700 hover:text-orange-800 font-medium underline focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 rounded"
                          >
                            Check stock again
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Button asChild className="group relative w-full min-h-[40px] h-11 sm:h-12 md:min-h-[44px] md:h-12 text-sm sm:text-base font-semibold bg-black hover:bg-gray-800 text-white border border-black rounded-lg shadow-sm hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 mb-4">
                    <Link href="/en/checkout" className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2">
                      {/* Icon - Hidden on very small screens */}
                      <CreditCard className="hidden xs:block h-3 w-3 sm:h-4 sm:w-4 text-white" strokeWidth={1.5} />

                      {/* Text content - Optimized for mobile */}
                      <div className="flex flex-col items-center">
                        <span className="font-semibold text-white leading-tight text-sm sm:text-base">
                          Proceed to Checkout
                        </span>
                        <span className="text-xs sm:text-sm text-gray-200 font-medium">
                          Pay {formatPrice(finalTotalWithCouponAndPoints)}
                        </span>
                      </div>

                      {/* Arrow indicator - Hidden on very small screens */}
                      <svg className="hidden xs:block h-3 w-3 sm:h-4 sm:w-4 text-gray-300 group-hover:text-white group-hover:translate-x-0.5 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </Link>
                  </Button>
                )}

                {/* Enhanced Security Notice - Enterprise UX */}
                <div className="flex items-center justify-center text-xs sm:text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                  <Shield className="h-3 w-3 sm:h-4 sm:w-4 mr-2 text-green-600" />
                  <span className="font-medium">Secure checkout with 256-bit SSL encryption</span>
                </div>
              </div>
            </div>
          </div>



          {/* Simplified Right Sidebar - Hidden on mobile/tablet for better UX */}
          <div className="hidden lg:block lg:col-span-1">
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
                    {(() => {
                      const calc = getShippingCalculation?.()
                      if (shippingFee === 0) {
                        if (calc?.freeShippingReason === 'permanent_tier') {
                          return <span className="text-green-700 font-medium">Diamond Rank Free Delivery</span>
                        }
                        if (calc?.freeShippingReason === 'quantity') {
                          return <span className="text-green-700 font-medium">FREE Delivery (4+ items)</span>
                        }
                        if (calc?.freeShippingReason === 'event') {
                          return <span className="text-green-700 font-medium">{`FREE Delivery (Event${calc?.eventContext?.title ? `: ${calc.eventContext.title}` : ''})`}</span>
                        }
                        if (calc?.freeShippingReason === 'coupon') {
                          return <span className="text-green-700 font-medium">FREE Delivery (Coupon applied)</span>
                        }
                        return <span className="text-green-700 font-medium">FREE Delivery</span>
                      }
                      return <span>Add {Math.max(0, 4 - totalQuantity)} more for FREE delivery</span>
                    })()}
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

                {/* Gift Option - Enhanced UX */}
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                  <Checkbox id="gift-option" aria-describedby="gift-description" className="cart-checkbox" />
                  <Gift className="h-4 w-4 text-gray-500" />
                  <label htmlFor="gift-option" className="text-sm text-gray-700 cursor-pointer flex-1">
                    <span className="font-medium">This order contains a gift</span>
                    <span id="gift-description" className="block text-xs text-gray-500 mt-0.5">
                      Gift wrapping and message options will be available at checkout
                    </span>
                  </label>
                </div>

                {/* Desktop-Only: Coupon Input - Hidden on mobile, moved to main flow */}
                <div className="hidden lg:block lg:border-t lg:border-gray-200 lg:pt-4">
                  <CouponInput
                    orderTotal={finalTotal}
                    appliedCoupon={appliedCoupon || undefined}
                    onCouponApplied={applyCoupon}
                    onCouponRemoved={removeCoupon}
                  />
                </div>

                {/* Desktop-Only: Points Redemption - Hidden on mobile, moved to main flow */}
                {profile && (
                  <div className="hidden lg:block lg:border-t lg:border-gray-200 lg:pt-4">
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
                      <span>Items ({totalQuantity}):</span>
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

        {/* Mobile-Optimized Continue Shopping Section */}
        <div className="mt-6 sm:mt-8 lg:mt-10">
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-3 sm:p-4 lg:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1">Need more items?</h3>
                <p className="text-xs sm:text-sm text-gray-600">Continue shopping to discover more products</p>
              </div>
              <Button asChild variant="outline" className="w-auto sm:w-auto min-h-[40px] h-10 md:min-h-[44px] md:h-11 px-4 py-2 self-start">
                <Link href="/en/products" className="flex items-center justify-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="text-sm sm:text-base">Continue Shopping</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile-Optimized Recommendations Section - Collapsible on mobile */}
        <div className="mt-6 sm:mt-8 lg:mt-12">
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-3 sm:p-4 lg:p-6">
            <div className="flex items-center justify-between mb-4 lg:mb-6">
              <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900">
                <span className="hidden sm:inline">Customers who bought items in your cart also bought</span>
                <span className="sm:hidden">You might also like</span>
              </h2>
              <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800 text-sm">
                <span className="hidden sm:inline">View all</span>
                <span className="sm:hidden">More</span>
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3 lg:gap-4">
              {/* Placeholder for recommended products - Show fewer on mobile */}
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-2 sm:p-3 lg:p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="aspect-square bg-gray-200 rounded-lg mb-2 sm:mb-3"></div>
                  <div className="h-2 sm:h-3 bg-gray-200 rounded mb-1 sm:mb-2"></div>
                  <div className="h-2 sm:h-3 bg-gray-200 rounded mb-1 sm:mb-2 w-3/4"></div>
                  <div className="h-3 sm:h-4 bg-gray-200 rounded w-12 sm:w-16"></div>
                </div>
              ))}
              {/* Show additional items only on larger screens */}
              <div className="hidden md:block">
                {[...Array(2)].map((_, i) => (
                  <div key={i + 4} className="bg-gray-50 border border-gray-200 rounded-lg p-2 sm:p-3 lg:p-4 hover:shadow-md transition-shadow cursor-pointer">
                    <div className="aspect-square bg-gray-200 rounded-lg mb-2 sm:mb-3"></div>
                    <div className="h-2 sm:h-3 bg-gray-200 rounded mb-1 sm:mb-2"></div>
                    <div className="h-2 sm:h-3 bg-gray-200 rounded mb-1 sm:mb-2 w-3/4"></div>
                    <div className="h-3 sm:h-4 bg-gray-200 rounded w-12 sm:w-16"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
