'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { adminQueries } from '@/lib/supabase/queries'
import { formatPrice, formatDateTime } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Search,
  Filter,
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  Package,
  Truck,
  Download,
  X
} from 'lucide-react'
import { toast } from 'sonner'

interface Order {
  id: string
  order_number: string
  customer_email: string
  total_amount: number
  payment_status: string
  fulfillment_status: string
  created_at: string
  items_count: number
}

export default function AdminOrdersPage() {
  const searchParams = useSearchParams()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all')
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    loadOrders()
  }, [statusFilter])

  const loadOrders = async () => {
    try {
      console.log('📋 Loading admin orders via API...')
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (searchTerm) params.append('search', searchTerm)

      const response = await fetch(`/api/admin/orders?${params.toString()}`)
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to load orders')
      }

      console.log('✅ Admin orders loaded successfully:', result.orders.length, 'orders')
      setOrders(result.orders)
    } catch (error) {
      console.error('❌ Error loading admin orders:', error)
      toast.error('Failed to load orders')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (orderId: string, newStatus: string, type: 'payment' | 'fulfillment') => {
    setUpdating(orderId)
    try {
      console.log('📝 Updating order status via API:', { orderId, newStatus, type })

      const response = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
          status: newStatus,
          statusType: type
        })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to update order status')
      }

      // Update local state
      setOrders(orders.map(order =>
        order.id === orderId
          ? {
              ...order,
              [type === 'payment' ? 'payment_status' : 'fulfillment_status']: newStatus
            }
          : order
      ))

      console.log('✅ Order status updated successfully')
      toast.success(`Order ${type} status updated successfully`)
    } catch (error) {
      console.error('❌ Error updating order status:', error)
      toast.error('Failed to update order status')
    } finally {
      setUpdating(null)
    }
  }

  // New streamlined completion function
  const handleCompleteOrder = async (orderId: string) => {
    setUpdating(orderId)
    try {
      console.log('📝 Completing order via streamlined process:', orderId)

      const response = await fetch('/api/admin/orders/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to complete order')
      }

      // Update local state with shipped order (on the way)
      setOrders(orders.map(order =>
        order.id === orderId
          ? {
              ...order,
              payment_status: 'completed',
              fulfillment_status: 'shipped'
            }
          : order
      ))

      toast.success('Order shipped successfully! Package is on the way.')
    } catch (error) {
      console.error('Error completing order:', error)
      toast.error('Failed to complete order')
    } finally {
      setUpdating(null)
    }
  }

  // New order cancellation function
  const handleCancelOrder = async (orderId: string) => {
    setUpdating(orderId)
    try {
      console.log('📝 Cancelling order:', orderId)

      const response = await fetch('/api/admin/orders/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to cancel order')
      }

      // Update local state with cancelled order
      setOrders(orders.map(order =>
        order.id === orderId
          ? {
              ...order,
              fulfillment_status: 'cancelled'
            }
          : order
      ))

      toast.success('Order cancelled successfully! Points have been refunded.')
    } catch (error) {
      console.error('Error cancelling order:', error)
      toast.error('Failed to cancel order')
    } finally {
      setUpdating(null)
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

  const filteredOrders = orders.filter(order =>
    order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer_email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="flex space-x-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-600">Manage and track customer orders</p>
        </div>
        <Button>
          <Download className="h-4 w-4 mr-2" />
          Export Orders
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by order number or customer email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Orders</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="pending">Pending Payment</SelectItem>
                <SelectItem value="verified">Payment Verified</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={loadOrders} variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <Card>
        <CardHeader>
          <CardTitle>Orders ({filteredOrders.length})</CardTitle>
          <CardDescription>
            {statusFilter === 'all' ? 'All orders' : `Orders with ${statusFilter} status`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredOrders.length > 0 ? (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <div key={order.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-2">
                        <h3 className="font-semibold">#{order.order_number}</h3>
                        <Badge className={getStatusColor(order.payment_status)}>
                          {getStatusIcon(order.payment_status)}
                          <span className="ml-1 capitalize">{order.payment_status}</span>
                        </Badge>
                        <Badge className={getStatusColor(order.fulfillment_status)}>
                          {getStatusIcon(order.fulfillment_status)}
                          <span className="ml-1 capitalize">{order.fulfillment_status}</span>
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                        <div>
                          <p><strong>Customer:</strong> {order.customer_email}</p>
                          <p><strong>Items:</strong> {order.items_count}</p>
                        </div>
                        <div>
                          <p><strong>Total:</strong> {formatPrice(order.total_amount)}</p>
                          <p><strong>Date:</strong> {formatDateTime(order.created_at)}</p>
                        </div>
                        <div className="flex flex-col space-y-2">
                          {/* Streamlined Order Completion - Single Click */}
                          {(order.fulfillment_status === 'on_hold' ||
                            order.payment_status === 'pending' ||
                            (order.payment_status === 'verified' && order.fulfillment_status === 'pending') ||
                            order.fulfillment_status === 'processing') &&
                            order.fulfillment_status !== 'shipped' &&
                            order.fulfillment_status !== 'delivered' &&
                            order.fulfillment_status !== 'cancelled' && (
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                onClick={() => handleCompleteOrder(order.id)}
                                disabled={updating === order.id}
                                className="bg-green-600 hover:bg-green-700 flex-1"
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Mark as Completed
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleCancelOrder(order.id)}
                                disabled={updating === order.id}
                                className="flex-1"
                              >
                                <X className="h-3 w-3 mr-1" />
                                Cancel Order
                              </Button>
                            </div>
                          )}

                          {/* Shipped Orders (On the Way) - Can be marked as delivered */}
                          {order.fulfillment_status === 'shipped' && (
                            <div className="space-y-2">
                              <div className="text-sm text-blue-600 font-medium">
                                🚚 Order Shipped (On the Way)
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStatusUpdate(order.id, 'delivered', 'fulfillment')}
                                disabled={updating === order.id}
                                className="w-full"
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Mark as Delivered
                              </Button>
                            </div>
                          )}

                          {/* Delivered Orders */}
                          {order.fulfillment_status === 'delivered' && (
                            <div className="text-sm text-green-600 font-medium">
                              ✅ Order Delivered
                            </div>
                          )}

                          {/* Cancelled Orders */}
                          {order.fulfillment_status === 'cancelled' && (
                            <div className="text-sm text-red-600 font-medium">
                              ❌ Order Cancelled
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/en/fyponly-admin/orders/${order.id}`}>
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
              <p className="text-gray-500">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Orders will appear here when customers make purchases.'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
