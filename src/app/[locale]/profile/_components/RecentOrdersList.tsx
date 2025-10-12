'use client'

import { FC } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Eye, ShoppingBag, Package, Calendar } from 'lucide-react';
import { formatDate, formatPrice } from '@/lib/utils';

interface Order {
  id: string
  order_number: string
  total_amount: number
  payment_status: string
  fulfillment_status: string
  created_at: string
  items: Array<{ id: string; title: string; quantity: number; price: number; total: number; }>
}

interface RecentOrdersListProps {
    orders: Order[];
    isLoading: boolean;
}

export const RecentOrdersList: FC<RecentOrdersListProps> = ({ orders, isLoading }) => {
    return (
        <Card role="region" aria-labelledby="orders-title">
            <CardHeader className="pb-4 h-[80px] sm:h-auto">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle id="orders-title" className="text-lg">Recent Orders</CardTitle>
                        <CardDescription>Your latest purchases</CardDescription>
                    </div>
                    <Link href="/en/orders">
                        <Button variant="outline" size="sm" className="min-h-[44px]"><Eye className="h-4 w-4 mr-2" />View All</Button>
                    </Link>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center space-x-4">
                            <Skeleton className="h-12 w-12 rounded" />
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-4 w-[250px]" />
                                <Skeleton className="h-4 w-[200px]" />
                            </div>
                        </div>
                        ))}
                    </div>
                ) : orders.length === 0 ? (
                    <div className="text-center py-8">
                        <ShoppingBag className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No orders yet</h3>
                        <p className="text-gray-500 mb-4">Start shopping to see your orders here</p>
                        <Link href="/en"><Button className="min-h-[44px]">Start Shopping</Button></Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {orders.map((order) => (
                        <div key={order.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                    <Package className="h-4 w-4 text-gray-400" />
                                    <span className="font-medium text-sm">#{order.order_number}</span>
                                    <Badge variant={order.fulfillment_status === 'completed' ? 'default' : order.fulfillment_status === 'processing' ? 'secondary' : 'outline'}>
                                        {order.fulfillment_status}
                                    </Badge>
                                </div>
                                <span className="text-sm font-medium">{formatPrice(order.total_amount)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm text-gray-500">
                                <div className="flex items-center space-x-1">
                                    <Calendar className="h-3 w-3" />
                                    <span>{formatDate(order.created_at)}</span>
                                </div>
                                <span>{order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}</span>
                            </div>
                        </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};