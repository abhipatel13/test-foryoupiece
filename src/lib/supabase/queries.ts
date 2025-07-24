import { createClient } from './client'
import { createClient as createServerClient } from './server'
import { Database } from './database.types'
import { cache, cacheKeys } from '@/lib/utils/cache'

type Tables = Database['public']['Tables']
type Enums = Database['public']['Enums']

// User queries
const userQueries = {
  async getProfile(userId: string) {
    // Check cache first
    const cacheKey = cacheKeys.userProfile(userId)
    const cachedProfile = cache.get(cacheKey)
    if (cachedProfile) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Profile loaded from cache for userId:', userId)
      }
      return cachedProfile
    }

    const supabase = createClient()
    if (process.env.NODE_ENV === 'development') {
      console.log('Querying user profile for userId:', userId)
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Database error in getProfile:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          userId: userId
        })
      }
      throw error
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('Profile query result:', data)
    }

    if (!data) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Profile query returned null/undefined data')
      }
      throw new Error('Profile not found')
    }

    // Cache the result for 5 minutes
    cache.set(cacheKey, data, 5 * 60 * 1000)

    return data
  },

  async updateProfile(userId: string, updates: Tables['users']['Update']) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async createProfile(profile: Tables['users']['Insert']) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('users')
      .insert(profile)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async getPointTransactions(userId: string, limit = 50) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('point_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    return data
  }
}

// Product queries
const productQueries = {
  async getProducts(filters?: {
    category_id?: string
    is_featured?: boolean
    is_active?: boolean
    limit?: number
    offset?: number
  }) {
    const supabase = createClient()
    let query = supabase
      .from('products')
      .select(`
        *,
        category:categories(*)
      `)

    if (filters?.category_id) {
      query = query.eq('category_id', filters.category_id)
    }
    if (filters?.is_featured !== undefined) {
      query = query.eq('is_featured', filters.is_featured)
    }
    if (filters?.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active)
    }

    query = query.order('created_at', { ascending: false })

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1)
    }

    const { data, error } = await query
    if (error) throw error
    return data
  },

  async getProduct(id: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(*),
        variants:product_variants(*)
      `)
      .eq('id', id)
      .eq('is_active', true)
      .single()
    
    if (error) throw error
    return data
  },

  async getProductBySku(sku: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(*),
        variants:product_variants(*)
      `)
      .eq('sku', sku)
      .eq('is_active', true)
      .single()

    if (error) throw error
    return data
  },

  async getRecentlyAddedProducts(limit: number = 10) {
    const supabase = createClient()

    // Get products that were recently synced from BoxHero or recently created
    // Priority: 1) Recently synced from BoxHero, 2) Recently created products
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(*)
      `)
      .eq('is_active', true)
      .order('boxhero_last_sync_at', { ascending: false, nullsLast: true }) // Most recently synced first, nulls last
      .order('created_at', { ascending: false }) // Then by creation date
      .limit(limit)

    if (error) {
      console.error('Error fetching recently added products:', error)
      throw error
    }

    console.log(`📦 Retrieved ${data?.length || 0} recently added products (sorted by sync date, then creation date)`)
    return data || []
  },

  async searchProducts(query: string, limit = 20) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(*)
      `)
      .or(`name_en.ilike.%${query}%,name_ja.ilike.%${query}%,description_en.ilike.%${query}%,description_ja.ilike.%${query}%`)
      .eq('is_active', true)
      .limit(limit)
    
    if (error) throw error
    return data
  }
}

// Category queries
const categoryQueries = {
  async getCategories() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
    
    if (error) throw error
    return data
  },

  async getCategory(id: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single()
    
    if (error) throw error
    return data
  },

  async getCategoryBySlug(slug: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()
    
    if (error) throw error
    return data
  }
}

// Cart queries
const cartQueries = {
  async getCartItems(userId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('cart_items')
      .select(`
        *,
        product:products(*),
        variant:product_variants(*)
      `)
      .eq('user_id', userId)
    
    if (error) throw error
    return data
  },

  async addToCart(item: Tables['cart_items']['Insert']) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('cart_items')
      .upsert(item, {
        onConflict: 'user_id,product_id,variant_id'
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async updateCartItem(id: string, updates: Tables['cart_items']['Update']) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('cart_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async removeFromCart(id: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  },

  async clearCart(userId: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', userId)
    
    if (error) throw error
  }
}

// Order queries
const orderQueries = {
  async getOrder(id: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*)
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  async getUserOrders(userId: string, limit: number = 10) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        total_amount,
        payment_status,
        fulfillment_status,
        created_at,
        items:order_items(
          id,
          title,
          quantity,
          price,
          total
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  },

  async createOrder(order: Tables['orders']['Insert'], items: Tables['order_items']['Insert'][]) {
    const supabase = createClient()

    console.log('📦 Creating order with stock reduction...')
    console.log('⚠️ Note: Points redemption should be handled by server-side API')

    // Start transaction
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert(order)
      .select()
      .single()

    if (orderError) throw orderError

    // Insert order items
    const itemsWithOrderId = items.map(item => ({
      ...item,
      order_id: orderData.id
    }))

    const { data: itemsData, error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsWithOrderId)
      .select()

    if (itemsError) throw itemsError

    // Reduce stock quantities for each ordered item
    console.log('📉 Reducing stock for ordered items...')
    for (const item of items) {
      try {
        // Get current product stock
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('stock_quantity, name_en')
          .eq('id', item.product_id)
          .single()

        if (productError) {
          console.error(`❌ Error fetching product ${item.product_id}:`, productError)
          continue
        }

        if (product) {
          const newStock = Math.max(0, product.stock_quantity - item.quantity)

          // Update stock quantity
          const { error: updateError } = await supabase
            .from('products')
            .update({ stock_quantity: newStock })
            .eq('id', item.product_id)

          if (updateError) {
            console.error(`❌ Error updating stock for ${item.product_id}:`, updateError)
          } else {
            console.log(`✅ Stock updated: ${product.name_en} - ${product.stock_quantity} → ${newStock} (ordered: ${item.quantity})`)
          }
        }
      } catch (error) {
        console.error(`❌ Error processing stock reduction for item ${item.product_id}:`, error)
      }
    }

    console.log('✅ Order created successfully with stock reduction')
    return { order: orderData, items: itemsData }
  }
}

// Admin queries
const adminQueries = {
  async getAdminUser(userId: string) {
    // Check cache first
    const cacheKey = cacheKeys.adminUser(userId)
    const cachedAdmin = cache.get(cacheKey)
    if (cachedAdmin) {
      return cachedAdmin
    }

    const supabase = createClient()
    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    // Cache the result for 10 minutes (admin status doesn't change frequently)
    cache.set(cacheKey, data, 10 * 60 * 1000)

    return data
  },

  async getDashboardStats() {
    // Check cache first - dashboard stats can be cached for 2 minutes
    const cacheKey = cacheKeys.dashboardStats()
    const cachedStats = cache.get(cacheKey)
    if (cachedStats) {
      return cachedStats
    }

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
      topProducts: topProducts || []
    }

    // Cache the stats for 2 minutes
    cache.set(cacheKey, stats, 2 * 60 * 1000)

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
      query = query.or(`order_number.ilike.%${filters.search}%,customer_email.ilike.%${filters.search}%`)
    }

    query = query.order('created_at', { ascending: false })

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  async updateOrderStatus(orderId: string, updates: {
    payment_status?: string,
    fulfillment_status?: string
  }) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async getProducts(filters?: {
    search?: string
    category?: string
    status?: string
    limit?: number
    offset?: number
  }) {
    const supabase = createClient()
    let query = supabase
      .from('products')
      .select(`
        *,
        category:categories(*)
      `)

    if (filters?.search) {
      query = query.or(`name_en.ilike.%${filters.search}%,name_ja.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`)
    }

    if (filters?.category && filters.category !== 'all') {
      query = query.eq('category_id', filters.category)
    }

    if (filters?.status && filters.status !== 'all') {
      query = query.eq('is_active', filters.status === 'active')
    }

    query = query.order('created_at', { ascending: false })

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  async updateProduct(productId: string, updates: Tables['products']['Update']) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', productId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async createProduct(product: Tables['products']['Insert']) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteProduct(productId: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)

    if (error) throw error
  }
}

// Notification queries
const notificationQueries = {
  async getUserNotifications(userId: string, limit = 20) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data
  },

  async getUnreadCount(userId: string) {
    const supabase = createClient()
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false)

    if (error) throw error
    return count || 0
  },

  async markAsRead(notificationId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async markAllAsRead(userId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)
      .select()

    if (error) throw error
    return data
  },

  async createNotification(notification: Tables['notifications']['Insert']) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('notifications')
      .insert(notification)
      .select()
      .single()

    if (error) throw error
    return data
  }
}

export { userQueries, productQueries, categoryQueries, cartQueries, orderQueries, adminQueries, notificationQueries }
