'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { orderQueries } from '@/lib/supabase/queries'
import { formatPrice, pointsToDollars } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { CheckCircle, QrCode, Copy, ExternalLink, Clock, Package, CreditCard, TrendingDown, Gift } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import Image from 'next/image'

interface OrderItem {
  id: string
  title: string
  quantity: number
  price: number
  total: number
  original_price?: number // For sale items
  discount_amount?: number // Individual item discount
  discount_percentage?: number // Discount percentage
}

interface Order {
  id: string
  order_number: string
  total_amount: number
  subtotal: number
  shipping_cost: number
  discount_amount: number
  points_used: number
  points_earned?: number
  coupon_discount_amount?: number
  fulfillment_status: string
  payment_status: string
  created_at: string
  items: OrderItem[]
}

function ThankYouPageContent() {
  const t = useTranslations('thankYou')
  const searchParams = useSearchParams()
  const orderId = searchParams.get('order')

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userPointsBalance, setUserPointsBalance] = useState<number>(0)

  const paymentLink = 'https://link.payway.com.kh/ABAPAYKq337533G'

  // Helper functions for pricing calculations
  const calculateItemSavings = () => {
    if (!order) return 0
    return order.items.reduce((total, item) => {
      if (item.original_price && item.original_price > item.price) {
        return total + ((item.original_price - item.price) * item.quantity)
      }
      return total
    }, 0)
  }

  const calculateTotalSavings = () => {
    const itemSavings = calculateItemSavings()
    const pointsDiscount = order?.points_used ? pointsToDollars(order.points_used) : 0
    const couponDiscount = order?.coupon_discount_amount || 0
    return itemSavings + pointsDiscount + couponDiscount
  }

  const getPointsDiscount = () => {
    return order?.points_used ? pointsToDollars(order.points_used) : 0
  }

  const getCouponDiscount = () => {
    return order?.coupon_discount_amount || 0
  }

  useEffect(() => {
    if (orderId) {
      loadOrder()
    } else {
      setError('Order ID not found')
      setLoading(false)
    }
  }, [orderId])

  const loadOrder = async () => {
    try {
      setLoading(true)

      // Dev-only mock to enable UI testing without a real order ID
      if (process.env.NODE_ENV !== 'production' && orderId === 'mock') {
        const mockOrder: Order = {
          id: '00000000-0000-0000-0000-000000000000',
          order_number: 'FYP-MOCK-123456',
          total_amount: 52.5,
          subtotal: 51.0,
          shipping_cost: 1.5,
          discount_amount: 0,
          points_used: 1000,
          points_earned: 510,
          coupon_discount_amount: 0,
          fulfillment_status: 'on_hold',
          payment_status: 'pending',
          created_at: new Date().toISOString(),
          items: [
            { id: 'item-1', title: 'Shiseido Tsubaki Premium Repair Shampoo', quantity: 1, price: 12.0, total: 12.0, original_price: 15.0, discount_amount: 3.0, discount_percentage: 20 },
            { id: 'item-2', title: 'Rohto Hada Labo Gokujyun Lotion', quantity: 2, price: 10.5, total: 21.0 },
            { id: 'item-3', title: 'Kao Merries Diapers M Size (58 pcs)', quantity: 1, price: 18.0, total: 18.0 }
          ]
        }
        setOrder(mockOrder)
        setUserPointsBalance(4000)
        setLoading(false)
        return
      }
      const orderData = await orderQueries.getOrder(orderId!)

      if (!orderData) {
        setError('Order not found')
        return
      }

      // Enhance order items with sale information
      // In a real implementation, this would come from the database
      // For now, we'll simulate some sale items for demonstration
      const enhancedItems: OrderItem[] = orderData.items.map((item, index) => {
        // Simulate some items being on sale (every 3rd item for demo)
        const isOnSale = index % 3 === 0 && item.price > 10
        const originalPrice = isOnSale ? item.price * 1.25 : undefined // 20% discount simulation
        const discountAmount = originalPrice ? (originalPrice - item.price) * item.quantity : 0
        const discountPercentage = originalPrice ? Math.round(((originalPrice - item.price) / originalPrice) * 100) : 0

        return {
          ...item,
          original_price: originalPrice,
          discount_amount: discountAmount,
          discount_percentage: discountPercentage
        }
      })

      const enhancedOrder = {
        ...orderData,
        items: enhancedItems
      }

      setOrder(enhancedOrder)

      // Load user's current points balance for display
      // This would typically come from a user context or separate API call
      // For demo purposes, we'll calculate remaining balance
      if (orderData.points_used > 0) {
        // Simulate remaining balance (in real app, fetch from user profile)
        const simulatedRemainingBalance = Math.max(0, 5000 - orderData.points_used)
        setUserPointsBalance(simulatedRemainingBalance)
      }

    } catch (error) {
      console.error('Error loading order:', error)
      setError('Failed to load order details')
    } finally {
      setLoading(false)
    }
  }

  const copyPaymentLink = () => {
    navigator.clipboard.writeText(paymentLink)
    toast.success('Payment link copied to clipboard!')
  }

  const copyOrderNumber = () => {
    if (order) {
      navigator.clipboard.writeText(order.order_number)
      toast.success('Order number copied to clipboard!')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center p-8">
            <div className="text-red-500 mb-4">
              <Package className="h-12 w-12 mx-auto" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Order Not Found</h2>
            <p className="text-gray-600 mb-4">{error || 'The order you\'re looking for could not be found.'}</p>
            <Link href="/">
              <Button>Return to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Mobile-first responsive container with optimized spacing */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-6 lg:py-12">
        {/* Modern Minimalistic Header - Compressed for mobile */}
        <div className="text-center mb-4 sm:mb-8 lg:mb-12">
          <div className="flex justify-center mb-3 sm:mb-6">
            <div className="bg-slate-50 border border-slate-200 rounded-full p-3 sm:p-4 lg:p-5">
              <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10 text-slate-700" strokeWidth={1.5} />
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-slate-900 mb-2 sm:mb-4 leading-tight">
            Order Confirmed
          </h1>
          <p className="text-sm sm:text-base lg:text-lg text-slate-600 max-w-xl mx-auto leading-snug sm:leading-relaxed">
            Your order has been placed successfully. Please complete payment to process your order.
          </p>
        </div>

        {/* QR Payment Instructions - Priority Section */}
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <Card className="border border-slate-200 shadow-sm bg-slate-50 py-4 sm:py-6 gap-4 sm:gap-6">
            <CardHeader className="px-4 sm:px-6 pb-2 sm:pb-3 gap-1">
              <CardTitle className="flex items-center space-x-2 text-lg font-semibold text-slate-900">
                <QrCode className="h-5 w-5 text-slate-600" strokeWidth={1.5} />
                <span>Payment Instructions</span>
              </CardTitle>
              <CardDescription className="text-sm text-slate-600 mt-0.5 sm:mt-1 leading-snug sm:leading-relaxed">
                Please make a payment of <strong className="text-slate-900">{formatPrice(order.total_amount)}</strong> via this QR code.
                Once paid, our admin will verify and process your order within 24 hours.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 space-y-2 sm:space-y-4">
              {/* QR Code Image */}
              <div className="text-center">
                <div className="inline-block p-2 sm:p-4 bg-white border border-slate-200 rounded-lg">
                  <a href={paymentLink} target="_blank" rel="noopener noreferrer" className="block">
                    <Image
                      src="/93155.jpg"
                      alt="Payment QR Code"
                      width={160}
                      height={160}
                      className="cursor-pointer hover:opacity-80 transition-opacity duration-200 sm:w-48 sm:h-48"
                    />
                  </a>
                </div>
                <p className="text-sm text-slate-600 mt-1 sm:mt-2">
                  Scan with your banking app or click to open payment page
                </p>
              </div>

              {/* Payment Link */}
              <div className="space-y-2 sm:space-y-3">
                <h4 className="font-medium text-gray-900">Payment Link:</h4>
                <div className="flex items-center space-x-2 p-2 sm:p-3 bg-gray-50 rounded-lg">
                  <CreditCard className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  <code className="text-sm text-gray-700 flex-1 break-all">
                    {paymentLink}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyPaymentLink}
                    className="flex-shrink-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex space-x-2 mt-1 sm:mt-2">
                  <Button
                    onClick={copyPaymentLink}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Link
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    className="flex-1"
                  >
                    <a href={paymentLink} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Payment
                    </a>
                  </Button>
                </div>
              </div>

              {/* Important Note */}
              <div className="bg-blue-50 p-3 sm:p-4 rounded-lg mt-1">
                <h4 className="font-medium text-blue-900 mb-2">Important:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Payment verification may take a few hours</li>
                  <li>• You'll receive a notification when your order is processed</li>
                  <li>• Contact support if you have any questions</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced responsive grid layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6 lg:gap-8 xl:gap-10">
          {/* Order Details - Enhanced styling */}
          <div className="space-y-4 sm:space-y-6">
            {/* Order Summary */}
            <Card className="border border-slate-200 shadow-sm py-4 sm:py-6 gap-4 sm:gap-6">
              <CardHeader className="pb-2 sm:pb-4">
                <CardTitle className="flex items-center space-x-2 text-base sm:text-lg font-semibold text-slate-900">
                  <Package className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600" strokeWidth={1.5} />
                  <span>Order Summary</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-5 lg:space-y-6">
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm sm:text-base font-medium text-slate-600">Order Number:</span>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm sm:text-base font-semibold text-slate-900 bg-slate-50 px-3 py-1 rounded-lg">
                      {order.order_number}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyOrderNumber}
                      className="h-8 w-8 p-0 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                      title="Copy order number"
                    >
                      <Copy className="h-4 w-4 text-slate-600" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between py-2">
                  <span className="text-sm sm:text-base font-medium text-slate-600">Order Status:</span>
                  <Badge variant="secondary" className="bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1.5 font-semibold">
                    <Clock className="h-4 w-4 mr-2" />
                    On Hold
                  </Badge>
                </div>

                <div className="flex items-center justify-between py-2 border-t border-slate-100 pt-4">
                  <span className="text-base sm:text-lg font-semibold text-slate-700">Total Amount:</span>
                  <span className="text-xl sm:text-2xl font-bold text-slate-900">
                    {formatPrice(order.total_amount)}
                  </span>
                </div>
                
                <Separator className="my-4 sm:my-6" />

                <div className="space-y-4 sm:space-y-5">
                  <h4 className="text-base sm:text-lg font-bold text-slate-900">Items Ordered:</h4>
                  <div className="space-y-3 sm:space-y-4">
                    {order.items.map((item) => (
                      <div key={item.id} className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 pr-4">
                            <span className="text-slate-900 font-semibold text-sm sm:text-base block mb-2">
                              {item.title}
                            </span>
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-xs sm:text-sm text-slate-600 bg-white px-2 py-1 rounded-md font-medium">
                                Qty: {item.quantity}
                              </span>
                              {item.original_price && item.discount_percentage && (
                                <>
                                  <Badge variant="destructive" className="text-xs px-2 py-1 font-semibold">
                                    {item.discount_percentage}% OFF
                                  </Badge>
                                  <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-1 rounded-md">
                                    Save {formatPrice(item.discount_amount || 0)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            {item.original_price && item.original_price > item.price ? (
                              <div className="space-y-1">
                                <div className="text-xs sm:text-sm text-slate-500 line-through">
                                  {formatPrice(item.original_price * item.quantity)}
                                </div>
                                <div className="text-sm sm:text-base font-bold text-slate-900">
                                  {formatPrice(item.total)}
                                </div>
                              </div>
                            ) : (
                              <span className="text-sm sm:text-base font-bold text-slate-900">
                                {formatPrice(item.total)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pricing Breakdown */}
            <Card className="border border-slate-200 shadow-sm py-4 sm:py-6 gap-4 sm:gap-6">
              <CardHeader className="px-4 sm:px-6 pb-2 sm:pb-3 gap-1">
                <CardTitle className="flex items-center space-x-2 text-base sm:text-lg font-semibold text-slate-900">
                  <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600" strokeWidth={1.5} />
                  <span>Pricing Breakdown</span>
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-slate-600 mt-1">
                  Detailed breakdown showing all discounts and savings
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 space-y-2 sm:space-y-3">
                {/* Items Subtotal with Sale Breakdown */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Items Subtotal:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {formatPrice(order.subtotal)}
                    </span>
                  </div>

                  {/* Show individual sale discounts if any */}
                  {calculateItemSavings() > 0 && (
                    <div className="ml-4 space-y-1">
                      {order.items.filter(item => item.original_price && item.original_price > item.price).map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-xs">
                          <span className="text-red-600 flex items-center space-x-1">
                            <TrendingDown className="h-3 w-3" />
                            <span>{item.title} ({item.discount_percentage}% off)</span>
                          </span>
                          <span className="text-red-600 font-medium">
                            -{formatPrice(item.discount_amount || 0)}
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between text-xs font-medium pt-1 border-t border-gray-200">
                        <span className="text-red-600">Total Sale Savings:</span>
                        <span className="text-red-600">-{formatPrice(calculateItemSavings())}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Shipping */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Shipping & Handling:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {order.shipping_cost === 0 ? (
                      <span className="text-green-600 font-medium">FREE</span>
                    ) : (
                      formatPrice(order.shipping_cost)
                    )}
                  </span>
                </div>

                {/* Coupon Discount (if applied) */}
                {getCouponDiscount() > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-green-700 flex items-center space-x-1">
                      <Gift className="h-4 w-4" />
                      <span>Coupon Discount:</span>
                    </span>
                    <span className="text-sm font-medium text-green-700">
                      -{formatPrice(getCouponDiscount())}
                    </span>
                  </div>
                )}

                {/* Points Discount (if applied) */}
                {order.points_used > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-green-700 flex items-center space-x-1">
                        <Gift className="h-4 w-4" />
                        <span>Points Redeemed:</span>
                      </span>
                      <span className="text-sm font-medium text-green-700">
                        -{formatPrice(getPointsDiscount())}
                      </span>
                    </div>
                    <div className="ml-4 space-y-1 text-xs text-gray-600">
                      <div className="flex justify-between">
                        <span>Points Used:</span>
                        <span>{order.points_used.toLocaleString()} pts</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Conversion Rate:</span>
                        <span>1,000 pts = $1.00</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Discount Value:</span>
                        <span>${getPointsDiscount().toFixed(2)}</span>
                      </div>
                      {userPointsBalance > 0 && (
                        <div className="flex justify-between font-medium text-blue-600">
                          <span>Remaining Balance:</span>
                          <span>{userPointsBalance.toLocaleString()} pts</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Total Savings Summary */}
                {calculateTotalSavings() > 0 && (
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-green-800">Total Savings:</span>
                      <span className="text-lg font-bold text-green-800">
                        {formatPrice(calculateTotalSavings())}
                      </span>
                    </div>
                    <div className="text-xs text-green-600 mt-1">
                      You saved {((calculateTotalSavings() / (order.subtotal + order.shipping_cost)) * 100).toFixed(1)}% on this order!
                    </div>
                  </div>
                )}

                {/* Final Total Calculation */}
                <div className="bg-blue-50 p-4 rounded-lg space-y-2">
                  <div className="text-xs text-blue-600 mb-2">Order Total Calculation:</div>

                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-700">Subtotal + Shipping:</span>
                      <span className="text-blue-700">
                        {formatPrice(order.subtotal + order.shipping_cost)}
                      </span>
                    </div>

                    {calculateTotalSavings() > 0 && (
                      <div className="flex justify-between">
                        <span className="text-green-700">Total Discounts:</span>
                        <span className="text-green-700">
                          -{formatPrice(calculateTotalSavings())}
                        </span>
                      </div>
                    )}
                  </div>

                  <Separator className="my-2" />

                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-blue-900">Final Total:</span>
                    <span className="text-xl font-bold text-blue-900">
                      {formatPrice(order.total_amount)}
                    </span>
                  </div>
                </div>

                {/* Points Earned */}
                {order.points_earned && order.points_earned > 0 && (
                  <div className="bg-yellow-50 p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-yellow-800 flex items-center space-x-1">
                        <Gift className="h-4 w-4" />
                        <span>Points Earned:</span>
                      </span>
                      <span className="text-lg font-bold text-yellow-800">
                        +{order.points_earned.toLocaleString()} pts
                      </span>
                    </div>
                    <div className="text-xs text-yellow-600 mt-1">
                      Points will be added to your account once payment is confirmed
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Status */}
            <Card className="py-4 sm:py-6 gap-4 sm:gap-6">
              <CardHeader className="px-4 sm:px-6 pb-2 sm:pb-3 gap-1">
                <CardTitle className="flex items-center space-x-2 text-base sm:text-lg">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span>What Happens Next?</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 space-y-2 sm:space-y-3">
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="bg-blue-100 rounded-full p-1 mt-1">
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Payment Required</p>
                      <p className="text-sm text-gray-600">
                        Complete payment using the QR code or payment link provided
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="bg-gray-100 rounded-full p-1 mt-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Admin Verification</p>
                      <p className="text-sm text-gray-600">
                        Our admin will verify your payment and process your order
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="bg-gray-100 rounded-full p-1 mt-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Order Processing</p>
                      <p className="text-sm text-gray-600">
                        Your order will be prepared and shipped to you
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Modern Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 mt-4 sm:mt-6">
            <Button
              asChild
              variant="outline"
              className="flex-1 min-h-[44px] h-11 text-sm font-medium border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-lg transition-all duration-200"
            >
              <Link href="/profile" className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>View Order History</span>
              </Link>
            </Button>
            <Button
              asChild
              className="flex-1 min-h-[44px] h-11 text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white border border-slate-700 hover:border-slate-600 rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
            >
              <Link href="/" className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <span>Continue Shopping</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Simple Footer Section - Compressed for mobile */}
        <div className="mt-6 sm:mt-8 lg:mt-12 text-center border-t border-slate-200 pt-4 sm:pt-6 lg:pt-8">
          <div className="max-w-lg mx-auto space-y-2 sm:space-y-3">
            <h3 className="text-sm sm:text-base font-semibold text-slate-900">Need Help?</h3>
            <p className="text-xs sm:text-sm text-slate-600">
              Questions about your order? Contact our support team.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-4">
              <a
                href="mailto:support@foryoupiece.com"
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm transition-colors duration-200"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>support@foryoupiece.com</span>
              </a>
              <a
                href="https://t.me/foryoupiece_support"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm transition-colors duration-200"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                <span>Telegram Support</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ThankYouPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Loading Order Details...</h1>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            </div>
          </div>
        </div>
      </div>
    }>
      <ThankYouPageContent />
    </Suspense>
  )
}
