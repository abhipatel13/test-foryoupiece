'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useSSRSafeAuth } from '@/lib/hooks/use-ssr-safe-auth'
import { orderQueries, notificationQueries } from '@/lib/supabase/queries'
import { formatPrice, formatDateTime } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { CheckCircle, Package, Truck, Clock, XCircle, Eye, Bell, BellOff } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface Order {
  id: string
  order_number: string
  total_amount: number
  payment_status: string
  fulfillment_status: string
  created_at: string
  items: Array<{
    id: string
    title: string
    quantity: number
    price: number
    total: number
  }>
}

interface Notification {
  id: string
  title: string
  message: string
  type: string
  read: boolean
  related_order_id: string | null
  created_at: string
}

export default function OrdersPage() {
  const t = useTranslations('orders')
  const { user, isAuthenticated, loading: authLoading } = useSSRSafeAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (isAuthenticated && user) {
      loadOrders()
      loadNotifications()
    }
  }, [isAuthenticated, user])

  const loadOrders = async () => {
    try {
      const ordersData = await orderQueries.getUserOrders(user!.id)
      setOrders(ordersData)
    } catch (error) {
      console.error('Error loading orders:', error)
      toast.error('Failed to load orders')
    } finally {
      setLoading(false)
    }
  }

  const loadNotifications = async () => {
    try {
      const [notificationsData, count] = await Promise.all([
        notificationQueries.getUserNotifications(user!.id, 10),
        notificationQueries.getUnreadCount(user!.id)
      ])
      setNotifications(notificationsData)
      setUnreadCount(count)
    } catch (error) {
      console.error('Error loading notifications:', error)
    }
  }

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      await notificationQueries.markAsRead(notificationId)
      setNotifications(notifications.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      ))
      setUnreadCount(Math.max(0, unreadCount - 1))
    } catch (error) {
      console.error('Error marking notification as read:', error)
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

  const getStatusText = (status: string) => {
    switch (status) {
      case 'on_hold': return 'On Hold'
      case 'processing': return 'Processing'
      default: return status.charAt(0).toUpperCase() + status.slice(1)
    }
  }

  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
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
          <h1 className="text-2xl font-bold mb-4">Please log in to view your orders</h1>
          <p className="text-gray-600 mb-8">You need to be logged in to access your order history.</p>
          <Button asChild>
            <Link href="/auth/login">Log In</Link>
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Orders</h1>
          <p className="text-gray-600">Track and manage your order history</p>
        </div>

        {/* Notifications */}
        {notifications.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <span>Recent Notifications</span>
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {unreadCount}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {notifications.slice(0, 3).map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      notification.read 
                        ? 'bg-gray-50 border-gray-200' 
                        : 'bg-blue-50 border-blue-200'
                    }`}
                    onClick={() => !notification.read && markNotificationAsRead(notification.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-gray-900">{notification.title}</h4>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDateTime(notification.created_at)}
                        </p>
                      </div>
                      {notification.related_order_id && (
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/en/orders/${notification.related_order_id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Orders List */}
        <Card>
          <CardHeader>
            <CardTitle>Order History</CardTitle>
            <CardDescription>
              {orders.length} {orders.length === 1 ? 'order' : 'orders'} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : orders.length > 0 ? (
              <div className="space-y-4">
                {orders.map((order) => (
                  <div key={order.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4 mb-2">
                          <h3 className="font-semibold">#{order.order_number}</h3>
                          <Badge className={getStatusColor(order.fulfillment_status)}>
                            {getStatusIcon(order.fulfillment_status)}
                            <span className="ml-1">{getStatusText(order.fulfillment_status)}</span>
                          </Badge>
                          <Badge className={getStatusColor(order.payment_status)}>
                            {getStatusIcon(order.payment_status)}
                            <span className="ml-1">{getStatusText(order.payment_status)}</span>
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                          <div>
                            <p><strong>Items:</strong> {order.items.length}</p>
                            <p><strong>Total:</strong> {formatPrice(order.total_amount)}</p>
                          </div>
                          <div>
                            <p><strong>Date:</strong> {formatDateTime(order.created_at)}</p>
                          </div>
                          <div>
                            {order.fulfillment_status === 'on_hold' && (
                              <p className="text-orange-600 text-sm">
                                <Clock className="h-3 w-3 inline mr-1" />
                                Awaiting payment verification
                              </p>
                            )}
                            {order.fulfillment_status === 'processing' && (
                              <p className="text-purple-600 text-sm">
                                <Package className="h-3 w-3 inline mr-1" />
                                Being prepared for shipment
                              </p>
                            )}
                            {order.fulfillment_status === 'shipped' && (
                              <p className="text-blue-600 text-sm">
                                <Truck className="h-3 w-3 inline mr-1" />
                                On the way to you
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/en/orders/${order.id}`}>
                            <Eye className="h-4 w-4 mr-1" />
                            View Details
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No orders yet</h3>
                <p className="text-gray-600 mb-4">You haven't placed any orders yet.</p>
                <Button asChild>
                  <Link href="/products">Start Shopping</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
