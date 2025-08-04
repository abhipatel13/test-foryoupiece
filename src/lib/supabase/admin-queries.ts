import { createServiceRoleClient } from './service-role'
import { createClient } from './client'
import { Database } from './database.types'
import { cache, cacheKeys } from '@/lib/utils/cache'

type Tables = Database['public']['Tables']
type Enums = Database['public']['Enums']

// Admin queries - SERVER SIDE ONLY
export const adminQueries = {
  async getAdminUser(userId: string) {
    console.log('🔍 getAdminUser: Starting query for userId:', userId)

    // Check cache first
    const cacheKey = cacheKeys.adminUser(userId)
    const cachedAdmin = cache.get(cacheKey)
    if (cachedAdmin) {
      console.log('✅ getAdminUser: Found cached admin:', cachedAdmin)
      return cachedAdmin
    }

    console.log('🔍 getAdminUser: No cache found, querying database...')
    const supabase = createClient()
    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    console.log('🔍 getAdminUser: Database query result:', { data, error })

    if (error && error.code !== 'PGRST116') {
      console.log('❌ getAdminUser: Database error:', error)
      throw error
    }

    // Cache the result for 10 minutes (admin status doesn't change frequently)
    cache.set(cacheKey, data, 10 * 60 * 1000)

    console.log('✅ getAdminUser: Returning result:', data)
    return data
  },

  async getDashboardStats() {
    // REAL-TIME DASHBOARD - NO CACHING for fresh data
    console.log('📊 Fetching REAL-TIME dashboard stats (no cache)...');

    const supabase = createClient()

    // Get total orders
    const { count: totalOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })

    // Get total revenue - Fixed column name from 'total' to 'total_amount'
    const { data: revenueData } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('payment_status', 'verified')

    const totalRevenue = revenueData?.reduce((sum, order) => sum + order.total_amount, 0) || 0

    // Get total products
    const { count: totalProducts } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })

    // Get total users
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })

    // Get pending orders
    const { count: pendingOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('payment_status', 'pending')

    // Get low stock products
    const { count: lowStockProducts } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('stock_status', 'low_stock')

    // Get recent orders
    const { data: recentOrders } = await supabase
      .from('orders')
      .select(`
        *,
        user:users(first_name, last_name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(5)

    // Get top products
    const { data: topProducts } = await supabase
      .from('products')
      .select('*')
      .eq('is_featured', true)
      .limit(5)

    const stats = {
      totalOrders: totalOrders || 0,
      totalRevenue,
      totalProducts: totalProducts || 0,
      totalUsers: totalUsers || 0,
      pendingOrders: pendingOrders || 0,
      lowStockProducts: lowStockProducts || 0,
      recentOrders: recentOrders || [],
      topProducts: topProducts || [],
      timestamp: new Date().toISOString()
    }

    console.log('✅ REAL-TIME dashboard stats compiled (no cache):', {
      totalOrders: stats.totalOrders,
      pendingOrders: stats.pendingOrders,
      totalProducts: stats.totalProducts,
      lowStockProducts: stats.lowStockProducts,
      timestamp: stats.timestamp
    });

    return stats
  },

  async getOrders(filters?: {
    status?: string
    search?: string
    limit?: number
    offset?: number
  }) {
    const supabase = createServiceRoleClient()
    let query = supabase
      .from('orders')
      .select(`
        *,
        user:users(first_name, last_name, email),
        items:order_items(*)
      `)

    if (filters?.status && filters.status !== 'all') {
      // Handle fulfillment status filters
      if (['on_hold', 'processing', 'shipped', 'delivered', 'cancelled'].includes(filters.status)) {
        query = query.eq('fulfillment_status', filters.status)
      } else {
        // Handle payment status filters
        query = query.eq('payment_status', filters.status)
      }
    }

    if (filters?.search) {
      query = query.or(`order_number.ilike.%${filters.search}%,user.first_name.ilike.%${filters.search}%,user.last_name.ilike.%${filters.search}%,user.email.ilike.%${filters.search}%`)
    }

    query = query
      .order('created_at', { ascending: false })
      .range(filters?.offset || 0, (filters?.offset || 0) + (filters?.limit || 50) - 1)

    const { data, error, count } = await query

    if (error) throw error

    return { orders: data || [], total: count || 0 }
  },

  async updateOrderStatus(orderId: string, updates: {
    payment_status?: string
    fulfillment_status?: string
  }) {
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .select()
      .single()

    if (error) throw error
    return data
  }
}
