'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { orderQueries } from '@/lib/supabase/queries'
import { formatPrice } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { CheckCircle, QrCode, Copy, ExternalLink, Clock, Package, CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import Image from 'next/image'

interface Order {
  id: string
  order_number: string
  total_amount: number
  subtotal: number
  shipping_cost: number
  discount_amount: number
  points_used: number
  fulfillment_status: string
  payment_status: string
  created_at: string
  items: Array<{
    id: string
    title: string
    quantity: number
    price: number
    total: number
  }>
}

export default function ThankYouPage() {
  const t = useTranslations('thankYou')
  const searchParams = useSearchParams()
  const orderId = searchParams.get('order')
  
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const paymentLink = 'https://link.payway.com.kh/ABAPAYKq337533G'

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
      setOrder(orderData)
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
                
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-900">Items Ordered:</h4>
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {item.title} × {item.quantity}
                      </span>
                      <span className="text-gray-900">{formatPrice(item.total)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Pricing Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CreditCard className="h-5 w-5" />
                  <span>Pricing Breakdown</span>
                </CardTitle>
                <CardDescription>
                  Detailed breakdown of your order total
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Original Subtotal */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Items Subtotal:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatPrice(order.subtotal)}
                  </span>
                </div>

                {/* Shipping */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Shipping & Handling:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatPrice(order.shipping_cost)}
                  </span>
                </div>

                {/* Points Discount (if applied) */}
                {order.points_used > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-green-700">
                      Points Discount ({order.points_used.toLocaleString()} pts):
                    </span>
                    <span className="text-sm font-medium text-green-700">
                      -{formatPrice(order.discount_amount)}
                    </span>
                  </div>
                )}

                <Separator />

                {/* Before/After Comparison */}
                <div className="bg-blue-50 p-4 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-blue-800">
                      {order.points_used > 0 ? 'Original Total:' : 'Order Total:'}
                    </span>
                    <span className={`text-sm font-medium ${order.points_used > 0 ? 'text-blue-600 line-through' : 'text-blue-900'}`}>
                      {formatPrice((order.subtotal || 0) + (order.shipping_cost || 0))}
                    </span>
                  </div>

                  {order.points_used > 0 && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-blue-900">Final Total:</span>
                        <span className="text-lg font-bold text-blue-900">
                          {formatPrice(order.total_amount)}
                        </span>
                      </div>
                      <div className="text-center">
                        <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded">
                          You saved {formatPrice(order.discount_amount)} with {order.points_used.toLocaleString()} points!
                        </span>
                      </div>
                    </>
                  )}
                </div>
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
