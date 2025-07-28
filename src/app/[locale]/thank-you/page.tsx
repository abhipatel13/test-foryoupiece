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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-green-100 rounded-full p-3">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Thank You for Your Order!</h1>
          <p className="text-lg text-gray-600">
            Your order has been placed successfully and is currently on hold for payment verification.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order Details */}
          <div className="space-y-6">
            {/* Order Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Package className="h-5 w-5" />
                  <span>Order Summary</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Order Number:</span>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm">{order.order_number}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyOrderNumber}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Order Status:</span>
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                    <Clock className="h-3 w-3 mr-1" />
                    On Hold
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Amount:</span>
                  <span className="text-lg font-semibold text-gray-900">
                    {formatPrice(order.total_amount)}
                  </span>
                </div>
                
                <Separator />
                
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Items Ordered:</h4>
                  {order.items.map((item) => (
                    <div key={item.id} className="space-y-1">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <span className="text-gray-900 font-medium">
                            {item.title} × {item.quantity}
                          </span>
                          {item.original_price && item.discount_percentage && (
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant="destructive" className="text-xs px-2 py-0.5">
                                {item.discount_percentage}% OFF
                              </Badge>
                              <span className="text-xs text-green-600 font-medium">
                                Save {formatPrice(item.discount_amount || 0)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          {item.original_price && item.original_price > item.price ? (
                            <div className="space-y-1">
                              <div className="text-xs text-gray-500 line-through">
                                {formatPrice(item.original_price * item.quantity)}
                              </div>
                              <div className="text-sm font-medium text-gray-900">
                                {formatPrice(item.total)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm font-medium text-gray-900">
                              {formatPrice(item.total)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Enhanced Pricing Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CreditCard className="h-5 w-5" />
                  <span>Pricing Breakdown</span>
                </CardTitle>
                <CardDescription>
                  Detailed breakdown showing all discounts and savings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>What Happens Next?</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
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

          {/* Payment Instructions */}
          <div className="space-y-6">
            {/* QR Code Payment */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <QrCode className="h-5 w-5" />
                  <span>Payment Instructions</span>
                </CardTitle>
                <CardDescription>
                  Please make a payment of <strong>{formatPrice(order.total_amount)}</strong> via this QR code. 
                  Once paid, admin will check and process your order.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* QR Code Image */}
                <div className="text-center">
                  <div className="inline-block p-4 bg-white border-2 border-gray-200 rounded-lg">
                    <a href={paymentLink} target="_blank" rel="noopener noreferrer">
                      <Image
                        src="/93155.jpg"
                        alt="Payment QR Code"
                        width={192}
                        height={192}
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                      />
                    </a>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    Scan with your banking app or click to open payment page
                  </p>
                </div>

                {/* Payment Link */}
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Payment Link:</h4>
                  <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
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
                  
                  <div className="flex space-x-2">
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
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Important:</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Payment verification may take a few hours</li>
                    <li>• You'll receive a notification when your order is processed</li>
                    <li>• Contact support if you have any questions</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex space-x-4">
              <Button asChild variant="outline" className="flex-1">
                <Link href="/profile">
                  View Order History
                </Link>
              </Button>
              <Button asChild className="flex-1">
                <Link href="/">
                  Continue Shopping
                </Link>
              </Button>
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
