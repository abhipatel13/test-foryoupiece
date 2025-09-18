'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { formatPrice, formatDateTime } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft,
  Package,
  User,
  MapPin,
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  Eye,
  Download,
  Mail,
  Phone,
  MessageCircle
} from 'lucide-react'
import { toast } from 'sonner'

interface OrderItem {
  id: string
  product_id: string
  product_name: string
  product_sku: string
  product_image_url: string | null
  quantity: number
  cancelled_quantity?: number
  unit_price: number
  total_price: number
}

interface OrderDetails {
  id: string
  order_number: string
  customer_email: string
  customer_name: string | null
  customer_phone: string | null
  aba_bank_name: string | null
  special_notes: string | null
  shipping_address: {
    firstName?: string
    lastName?: string
    first_name?: string
    last_name?: string
    address1?: string
    address2?: string
    address_line_1?: string
    address_line_2?: string
    city?: string
    postal_code?: string
    country?: string
  } | null
  billing_address: {
    firstName?: string
    lastName?: string
    first_name?: string
    last_name?: string
    address1?: string
    address2?: string
    address_line_1?: string
    address_line_2?: string
    city?: string
    postal_code?: string
    country?: string
  } | null
  total_amount: number
  subtotal: number
  shipping_cost: number
  tax_amount: number
  discount_amount: number
  coupon_discount_amount: number
  points_used: number
  points_earned: number
  payment_status: string
  fulfillment_status: string
  payment_method: string
  created_at: string
  updated_at: string
  order_items: OrderItem[]
  coupon_info: {
    id: string
    code: string
    discount_type: string
    discount_value: number
  } | null
  user: {
    first_name: string | null
    last_name: string | null
    email: string
    phone: string | null
    telegram_username: string | null
    telegram_id?: number | null
  } | null
}

export default function AdminOrderDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string

  const [order, setOrder] = useState<OrderDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [cancelInputs, setCancelInputs] = useState<Record<string, number>>({})
  const [keepStockOut, setKeepStockOut] = useState(false)


  useEffect(() => {
    if (orderId) {
      loadOrderDetails()
    }
  }, [orderId])

  const loadOrderDetails = async () => {
    try {
      console.log('📋 Loading order details for ID:', orderId)

      const response = await fetch(`/api/admin/orders/${orderId}`)
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to load order details')
      }

      console.log('✅ Order details loaded successfully:', result.order)
      setOrder(result.order)
    } catch (error) {
      console.error('❌ Error loading order details:', error)
      toast.error('Failed to load order details')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (newStatus: string, type: 'payment' | 'fulfillment') => {
    if (!order) return

    setUpdating(true)
    try {
      console.log('📝 Updating order status:', { orderId, newStatus, type })

      const response = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: order.id,
          status: newStatus,
          statusType: type
        })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to update order status')
      }

      // Update local state
      setOrder(prev => prev ? {
        ...prev,
        [type === 'payment' ? 'payment_status' : 'fulfillment_status']: newStatus
      } : null)

      console.log('✅ Order status updated successfully')
      toast.success(`Order ${type} status updated successfully`)
    } catch (error) {
      console.error('❌ Error updating order status:', error)
      toast.error('Failed to update order status')
    } finally {
      setUpdating(false)
    }
  }

  // Cancel order (for confirmed orders)
  const handleCancelOrder = async () => {
    if (!order) return
    setUpdating(true)
    try {
      const res = await fetch('/api/admin/orders/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id })
      })
      const result = await res.json()
      if (!result.success) throw new Error(result.error || 'Failed to cancel order')

      setOrder(prev => (prev ? { ...prev, fulfillment_status: 'cancelled' } : prev))
      toast.success('Order cancelled successfully')
    } catch (e) {
      console.error('Failed to cancel order', e)
      toast.error('Failed to cancel order')
    } finally {
      setUpdating(false)
    }
  }

  const computeRefundPreview = () => {
    if (!order) return { amount: 0, points: 0 }
    let amount = 0
    for (const it of order.order_items) {
      const req = Math.max(0, Math.min(
        cancelInputs[it.id] || 0,
        Math.max(0, it.quantity - (it.cancelled_quantity || 0))
      ))
      if (req > 0 && it.quantity > 0) {
        const unit = Number(it.total_price) / Number(it.quantity)
        amount += unit * req
      }
    }
    const pointsCap = Math.max(0, Number(order.points_used || 0))
    const points = Math.min(pointsCap, Math.round(amount * 1000))
    return { amount, points }
  }

  const handleCancelSelected = async () => {
    if (!order) return
    const payloadItems = Object.entries(cancelInputs)
      .map(([orderItemId, qty]) => ({ orderItemId, quantity: Number(qty || 0) }))
      .filter((x) => x.quantity > 0)
    if (payloadItems.length === 0) {
      toast.error('Select at least one item/quantity to cancel')
      return
    }

    setUpdating(true)
    try {
      const res = await fetch('/api/admin/orders/cancel-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, items: payloadItems, keepStockOut })
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result?.error || 'Failed to cancel items')

      toast.success('Selected items cancelled successfully')
      setCancelInputs({})
      await loadOrderDetails()
    } catch (e) {
      console.error('Partial cancel failed', e)
      toast.error('Failed to cancel selected items')
    } finally {
      setUpdating(false)
    }
  }


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'on_hold': return 'bg-orange-100 text-orange-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'shipped': return 'bg-blue-100 text-blue-800'
      case 'delivered': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-gray-100 text-gray-800'
      case 'processing': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified': return <CheckCircle className="h-3 w-3" />
      case 'pending': return <Clock className="h-3 w-3" />
      case 'on_hold': return <Clock className="h-3 w-3" />
      case 'failed': return <XCircle className="h-3 w-3" />
      case 'shipped': return <Truck className="h-3 w-3" />
      case 'delivered': return <Package className="h-3 w-3" />
      case 'processing': return <Package className="h-3 w-3" />
      default: return <Clock className="h-3 w-3" />
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-32" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Order not found</h3>
        <p className="text-gray-500 mb-4">The order you're looking for doesn't exist or has been deleted.</p>
        <Button asChild>
          <Link href="/en/fyponly-admin/orders">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Orders
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button asChild variant="outline" size="sm">
            <Link href="/en/fyponly-admin/orders">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Orders
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Order #{order.order_number}</h1>
            <p className="text-gray-600">Created on {formatDateTime(order.created_at)}</p>
            <p className="text-gray-700 mt-1 flex items-center gap-2">
              {order.user?.telegram_username ? (
                <>
                  <MessageCircle className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">@{order.user.telegram_username}</span>
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">{order.customer_email}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge className={getStatusColor(order.payment_status)}>
            {getStatusIcon(order.payment_status)}
            <span className="ml-1 capitalize">{order.payment_status}</span>
          </Badge>
          <Badge className={getStatusColor(order.fulfillment_status)}>
            {getStatusIcon(order.fulfillment_status)}
            <span className="ml-1 capitalize">{order.fulfillment_status}</span>
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Items ({order.order_items.length})
              </CardTitle>
              <CardDescription>
                Products included in this order
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.order_items.map((item) => (
                  <div key={item.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                    <div className="relative h-16 w-16 flex-shrink-0">
                      {item.product_image_url ? (
                        <Image
                          src={item.product_image_url}
                          alt={item.product_name}
                          fill
                          className="object-cover rounded-md"
                        />
                      ) : (
                        <div className="h-16 w-16 bg-gray-100 rounded-md flex items-center justify-center">
                          <Package className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">{item.product_name}</h4>
                      {item.variant_title && (
                        <p className="text-sm text-gray-500">Variant: {item.variant_title}</p>
                      )}
                      <p className="text-sm text-gray-500">SKU: {item.product_sku}</p>
                      <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                      {(item.cancelled_quantity ?? 0) > 0 && (
                        <p className="text-xs text-red-600">Cancelled: {item.cancelled_quantity}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{formatPrice(item.total_price)}</p>
                      <p className="text-sm text-gray-500">{formatPrice(item.unit_price)} each</p>
                      {order.payment_status === 'verified' && (['pending','on_hold','processing','shipped'].includes(order.fulfillment_status)) && (
                        <div className="mt-2 flex items-center justify-end gap-2">
                          <label className="text-xs text-gray-500">Cancel</label>
                          <input
                            type="number"
                            min={0}
                            max={Math.max(0, item.quantity - (item.cancelled_quantity ?? 0))}
                            value={Math.min(
                              Math.max(0, cancelInputs[item.id] ?? 0),
                              Math.max(0, item.quantity - (item.cancelled_quantity ?? 0))
                            )}
                            onChange={(e) => {
                              const v = Number(e.target.value)
                              setCancelInputs((prev) => ({ ...prev, [item.id]: v }))
                            }}
                            className="w-20 h-9 border rounded px-2 text-right"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {(order.payment_status === 'verified' && ['pending','on_hold','processing','shipped'].includes(order.fulfillment_status)) && (
                <div className="mt-4 border-t pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={keepStockOut}
                        onChange={(e) => setKeepStockOut(e.target.checked)}
                      />
                      Do not restore stock for cancelled items
                    </label>
                    {(() => { const p = computeRefundPreview(); return (
                      <div className="text-sm text-gray-700">
                        Refund preview: <span className="font-semibold">{formatPrice(p.amount)}</span>
                        {p.points > 0 && (<span> | Points: <span className="font-semibold">{p.points}</span> pts</span>)}
                      </div>
                    )})()}
                  </div>
                  <Button
                    onClick={handleCancelSelected}
                    disabled={updating || !Object.values(cancelInputs).some(v => Number(v) > 0)}
                    variant="destructive"
                    className="w-full"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel Selected Items
                  </Button>
                </div>
              )}

            </CardContent>
          </Card>

          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Contact Details */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Contact Details</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">Name:</span>
                    <span>{order.customer_name || 'Not provided'}</span>
                  </div>

                  {/* Email - Always show prominently */}
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">Email:</span>
                    <span className="text-blue-600 font-medium">{order.customer_email}</span>
                  </div>

                  {/* User Profile Email (if different from order email) */}
                  {order.user?.email && order.user.email !== order.customer_email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">Profile Email:</span>
                      <span className="text-blue-600">{order.user.email}</span>
                    </div>
                  )}

                  {order.customer_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">Phone:</span>
                      <span>{order.customer_phone}</span>
                    </div>
                  )}

                  {/* Telegram Information - Enhanced Display */}
                  {order.user?.telegram_username || order.user?.telegram_id ? (
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageCircle className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-blue-900">Telegram Contact</span>
                      </div>
                      <div className="space-y-1 text-sm">
                        {order.user.telegram_username && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Username:</span>
                            <span className="text-blue-700 font-medium">@{order.user.telegram_username}</span>
                          </div>
                        )}
                        {order.user.telegram_id && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Telegram ID:</span>
                            <span className="text-blue-700 font-mono">{order.user.telegram_id}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-gray-400" />
                        <span className="font-medium text-gray-600">Telegram Contact</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">Customer has not connected Telegram account</p>
                    </div>
                  )}

                  {order.aba_bank_name && (
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">ABA Bank Name:</span>
                      <span>{order.aba_bank_name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Shipping Address */}
              {order.shipping_address && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Shipping Address</h4>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        {/* Handle different address field formats */}
                        {(order.shipping_address.address1 || order.shipping_address.address_line_1) && (
                          <p>{order.shipping_address.address1 || order.shipping_address.address_line_1}</p>
                        )}
                        {(order.shipping_address.address2 || order.shipping_address.address_line_2) && (
                          <p>{order.shipping_address.address2 || order.shipping_address.address_line_2}</p>
                        )}
                        {order.shipping_address.city && (
                          <p>
                            {order.shipping_address.city}
                            {order.shipping_address.postal_code && `, ${order.shipping_address.postal_code}`}
                          </p>
                        )}
                        {order.shipping_address.country && (
                          <p>{order.shipping_address.country}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Billing Address */}
              {order.billing_address && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Billing Address</h4>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        {(order.billing_address.address1 || order.billing_address.address_line_1) && (
                          <p>{order.billing_address.address1 || order.billing_address.address_line_1}</p>
                        )}
                        {(order.billing_address.address2 || order.billing_address.address_line_2) && (
                          <p>{order.billing_address.address2 || order.billing_address.address_line_2}</p>
                        )}
                        {order.billing_address.city && (
                          <p>
                            {order.billing_address.city}
                            {order.billing_address.postal_code && `, ${order.billing_address.postal_code}`}
                          </p>
                        )}
                        {order.billing_address.country && (
                          <p>{order.billing_address.country}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Special Notes */}
              {order.special_notes && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Special Notes</h4>
                  <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                    <p>{order.special_notes}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Shipping</span>
                <span>{formatPrice(order.shipping_cost)}</span>
              </div>
              {order.tax_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Tax</span>
                  <span>{formatPrice(order.tax_amount)}</span>
                </div>
              )}

              {/* Discount Information */}
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>💸 Discount</span>
                  <span>-{formatPrice(order.discount_amount)}</span>
                </div>
              )}

              {/* Coupon Information */}
              {order.coupon_discount_amount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>🎫 Coupon {order.coupon_info?.code ? `(${order.coupon_info.code})` : ''}</span>
                  <span>-{formatPrice(order.coupon_discount_amount)}</span>
                </div>
              )}

              {/* Points Used */}
              {order.points_used > 0 && (
                <div className="flex justify-between text-sm text-blue-600">
                  <span>⭐ Points Used ({order.points_used} pts)</span>
                  <span>-{formatPrice(order.points_used / 1000)}</span>
                </div>
              )}

              <Separator />
              <div className="flex justify-between font-medium">
                <span>Total</span>
                <span>{formatPrice(order.total_amount)}</span>
              </div>

              {/* Points Earned */}
              {order.points_earned > 0 && (
                <div className="flex justify-between text-sm text-blue-600 pt-2 border-t">
                  <span>⭐ Points Earned</span>
                  <span>{order.points_earned} pts</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-600">Payment Method</p>
                <p className="text-sm">{order.payment_method || 'QR Code Payment'}</p>
              </div>
              {order.aba_bank_name && (
                <div>
                  <p className="text-sm font-medium text-gray-600">ABA Bank Name</p>
                  <p className="text-sm">{order.aba_bank_name}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-600">Payment Status</p>
                <Badge className={getStatusColor(order.payment_status)}>
                  {getStatusIcon(order.payment_status)}
                  <span className="ml-1 capitalize">{order.payment_status}</span>
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Order Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Order Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Payment Actions */}
              {order.payment_status === 'pending' && (
                <Button
                  onClick={() => handleStatusUpdate('verified', 'payment')}
                  disabled={updating}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Verify Payment
                </Button>
              )}

              {/* Fulfillment Actions */}
              {order.fulfillment_status === 'on_hold' && (
                <Button
                  onClick={() => handleStatusUpdate('processing', 'fulfillment')}
                  disabled={updating}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  <Package className="h-4 w-4 mr-2" />
                  Start Processing
                </Button>
              )}


              {order.payment_status === 'verified' && ['pending','on_hold','processing','shipped'].includes(order.fulfillment_status) && (
                <Button
                  onClick={handleCancelOrder}
                  disabled={updating}
                  variant="destructive"
                  className="w-full"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel Order
                </Button>
              )}

              {(order.fulfillment_status === 'processing' || order.fulfillment_status === 'pending') && (
                <Button
                  onClick={() => handleStatusUpdate('shipped', 'fulfillment')}
                  disabled={updating}
                  variant="outline"
                  className="w-full"
                >
                  <Truck className="h-4 w-4 mr-2" />
                  Mark as Shipped
                </Button>
              )}

              {order.fulfillment_status === 'shipped' && (
                <Button
                  onClick={() => handleStatusUpdate('delivered', 'fulfillment')}
                  disabled={updating}
                  variant="outline"
                  className="w-full"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark as Delivered
                </Button>
              )}

              <Separator />

              <Button variant="outline" className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Download Invoice
              </Button>
            </CardContent>
          </Card>

          {/* Order Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Order Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                  <div className="text-sm">
                    <p className="font-medium">Order Created</p>
                    <p className="text-gray-500">{formatDateTime(order.created_at)}</p>
                  </div>
                </div>
                {order.payment_status === 'verified' && (
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    <div className="text-sm">
                      <p className="font-medium">Payment Verified</p>
                      <p className="text-gray-500">{formatDateTime(order.updated_at)}</p>
                    </div>
                  </div>
                )}
                {order.fulfillment_status === 'processing' && (
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                    <div className="text-sm">
                      <p className="font-medium">Processing Started</p>
                      <p className="text-gray-500">{formatDateTime(order.updated_at)}</p>
                    </div>
                  </div>
                )}
                {order.fulfillment_status === 'shipped' && (
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 bg-purple-500 rounded-full"></div>
                    <div className="text-sm">
                      <p className="font-medium">Order Shipped</p>
                      <p className="text-gray-500">{formatDateTime(order.updated_at)}</p>
                    </div>
                  </div>
                )}
                {order.fulfillment_status === 'delivered' && (
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    <div className="text-sm">
                      <p className="font-medium">Order Delivered</p>
                      <p className="text-gray-500">{formatDateTime(order.updated_at)}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
