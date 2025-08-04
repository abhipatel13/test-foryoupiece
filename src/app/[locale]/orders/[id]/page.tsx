'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { orderQueries } from '@/lib/supabase/queries'
import { formatPrice, formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import Image from 'next/image'
import { SHIPPING_CONFIG } from '@/shared/constants'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { CheckCircle, Package, Truck, MapPin, CreditCard, ArrowLeft, QrCode, ExternalLink, Copy } from 'lucide-react'

interface Order {
  id: string
  order_number: string
  total_amount: number
  subtotal?: number
  shipping_cost?: number
  discount_amount?: number
  points_used?: number
  payment_status: string
  fulfillment_status: string
  created_at: string
  shipping_address: any
  items: any[]
}

export default function OrderDetailsPage() {
  const params = useParams()
  const t = useTranslations('orders')
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Payment link - same as used in thank-you page
  const paymentLink = 'https://link.payway.com.kh/ABAPAYKq337533G'

  // Helper function to copy payment link
  const copyPaymentLink = () => {
    navigator.clipboard.writeText(paymentLink)
    toast.success('Payment link copied to clipboard!')
  }

  // Helper function to check if order needs payment
  const needsPayment = (order: Order) => {
    return order.payment_status === 'pending' || order.payment_status === 'on_hold'
  }

  useEffect(() => {
    if (params.id) {
      loadOrder(params.id as string)
    }
  }, [params.id])

  const loadOrder = async (orderId: string) => {
    try {
      const orderData = await orderQueries.getOrder(orderId)
      setOrder(orderData)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'shipped': return 'bg-blue-100 text-blue-800'
      case 'delivered': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified': return <CheckCircle className="h-4 w-4" />
      case 'shipped': return <Truck className="h-4 w-4" />
      case 'delivered': return <Package className="h-4 w-4" />
      default: return <Package className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Order not found</h1>
          <p className="text-gray-600 mb-8">{error || 'The order you are looking for does not exist.'}</p>
          <Button asChild>
            <Link href="/orders">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Orders
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Order #{order.order_number}</h1>
              <p className="text-gray-600">Placed on {formatDateTime(order.created_at)}</p>
            </div>
            <Button asChild variant="outline">
              <Link href="/en/orders">
                <ArrowLeft className="h-4 w-4 mr-2" />
                All Orders
              </Link>
            </Button>
          </div>

          {/* Order Success Message */}
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <h3 className="text-lg font-semibold text-green-900">Order Confirmed!</h3>
                  <p className="text-green-700">
                    Thank you for your order. We'll send you shipping confirmation when your items are on the way.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Order Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Package className="h-5 w-5" />
                <span>Order Status</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Payment Status</span>
                <Badge className={getStatusColor(order.payment_status)}>
                  {getStatusIcon(order.payment_status)}
                  <span className="ml-1 capitalize">{order.payment_status}</span>
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Fulfillment Status</span>
                <Badge className={getStatusColor(order.fulfillment_status)}>
                  {getStatusIcon(order.fulfillment_status)}
                  <span className="ml-1 capitalize">{order.fulfillment_status}</span>
                </Badge>
              </div>
              
              {needsPayment(order) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Complete Payment
                  </h4>
                  <p className="text-sm text-blue-800 mb-4">
                    Your order is waiting for payment. Complete your payment of <strong>{formatPrice(order.total_amount)}</strong> to process your order.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      asChild
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                      <a href={paymentLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Pay Now
                      </a>
                    </Button>
                    <Button
                      onClick={copyPaymentLink}
                      variant="outline"
                      className="flex-1"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Payment Link
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Shipping Address */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MapPin className="h-5 w-5" />
                <span>Shipping Address</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-1">
                <p className="font-medium">
                  {order.shipping_address.firstName} {order.shipping_address.lastName}
                </p>
                <p>{order.shipping_address.address1}</p>
                {order.shipping_address.address2 && (
                  <p>{order.shipping_address.address2}</p>
                )}
                <p>
                  {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.postalCode}
                </p>
                <p>{order.shipping_address.country}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Section - Only show for pending/on hold orders */}
        {needsPayment(order) && (
          <Card className="mb-8 border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-blue-900">
                <QrCode className="h-5 w-5" />
                <span>Complete Your Payment</span>
              </CardTitle>
              <CardDescription className="text-blue-700">
                Your order is waiting for payment verification. Complete your payment to process your order.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Payment Amount */}
              <div className="text-center p-4 bg-white rounded-lg border border-blue-200">
                <div className="text-2xl font-bold text-gray-900">
                  {formatPrice(order.total_amount)}
                </div>
                <div className="text-sm text-gray-600">Total Amount Due</div>
              </div>

              {/* QR Code */}
              <div className="text-center">
                <div className="inline-block p-4 bg-white border border-blue-200 rounded-lg">
                  <a href={paymentLink} target="_blank" rel="noopener noreferrer" className="block">
                    <Image
                      src="/93155.jpg"
                      alt="Payment QR Code"
                      width={160}
                      height={160}
                      className="cursor-pointer hover:opacity-80 transition-opacity duration-200"
                    />
                  </a>
                </div>
                <p className="text-sm text-blue-700 mt-2">
                  Scan with your banking app or click to open payment page
                </p>
              </div>

              {/* Payment Link */}
              <div className="space-y-3">
                <h4 className="font-medium text-blue-900">Payment Link:</h4>
                <div className="flex items-center space-x-2 p-3 bg-white rounded-lg border border-blue-200">
                  <CreditCard className="h-4 w-4 text-blue-600 flex-shrink-0" />
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
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  asChild
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <a href={paymentLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Complete Payment
                  </a>
                </Button>
                <Button
                  onClick={copyPaymentLink}
                  variant="outline"
                  className="flex-1 border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Payment Link
                </Button>
              </div>

              {/* Payment Instructions */}
              <div className="bg-white p-4 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2">Payment Instructions:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Scan the QR code with your banking app or click "Complete Payment"</li>
                  <li>• Enter the exact amount: <strong>{formatPrice(order.total_amount)}</strong></li>
                  <li>• Use order number <strong>{order.order_number}</strong> as reference</li>
                  <li>• Payment verification may take a few hours</li>
                  <li>• You'll receive a notification when your order is processed</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order Items */}
        <Card>
          <CardHeader>
            <CardTitle>Order Items</CardTitle>
            <CardDescription>
              {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {order.items.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium">{item.title}</h4>
                    {item.variant_title && (
                      <p className="text-sm text-gray-500">{item.variant_title}</p>
                    )}
                    <p className="text-sm text-gray-500">SKU: {item.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatPrice(item.price)} × {item.quantity}</p>
                    <p className="text-lg font-bold">{formatPrice(item.total)}</p>
                  </div>
                </div>
              ))}
            </div>

            <Separator className="my-6" />

            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatPrice(order.subtotal || (order.total_amount - (order.shipping_cost || SHIPPING_CONFIG.STANDARD_FEE)))}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>
                  {(order.shipping_cost || SHIPPING_CONFIG.STANDARD_FEE) === 0 ? (
                    <span className="text-green-700">FREE</span>
                  ) : (
                    formatPrice(order.shipping_cost || SHIPPING_CONFIG.STANDARD_FEE)
                  )}
                </span>
              </div>
              {/* Points Discount (if applied) */}
              {order.points_used > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Points Discount ({order.points_used.toLocaleString()} pts)</span>
                  <span>-{formatPrice(order.discount_amount || 0)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatPrice(order.total_amount)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4">
          <Button asChild className="flex-1">
            <Link href="/products">
              Continue Shopping
            </Link>
          </Button>
          <Button variant="outline" className="flex-1">
            Contact Support
          </Button>
        </div>
      </div>
    </div>
  )
}
