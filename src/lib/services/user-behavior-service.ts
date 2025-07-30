/**
 * User Behavior Tracking Service
 * Tracks and analyzes user behavior for personalized recommendations
 */

import { createClient } from '@/lib/supabase/client'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export interface UserPurchaseHistory {
  productId: string
  productName: string
  category: string
  brand?: string
  price: number
  quantity: number
  purchaseDate: string
  tags?: string[]
}

export interface UserBehaviorData {
  userId: string
  purchaseHistory: UserPurchaseHistory[]
  categoryPreferences: Record<string, number>
  brandPreferences: Record<string, number>
  priceRange: { min: number; max: number }
  preferredDiscounts: boolean
  searchHistory: string[]
  viewedProducts: string[]
  cartItems: string[]
}

export interface RecommendationContext {
  hasHistory: boolean
  totalPurchases: number
  favoriteCategories: string[]
  favoriteBrands: string[]
  averageOrderValue: number
  lastPurchaseDate?: string
}

export class UserBehaviorService {
  private supabase = createClient()
  private serviceClient = createServiceRoleClient()

  /**
   * Get user's purchase history from the last month
   */
  async getUserPurchaseHistory(userId: string, daysBack: number = 30): Promise<UserPurchaseHistory[]> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysBack)

      const { data: orders, error } = await this.serviceClient
        .from('orders')
        .select(`
          id,
          created_at,
          order_items (
            product_id,
            title,
            quantity,
            price,
            products (
              id,
              name_en,
              brand,
              price,
              category:categories(name_en, slug),
              tags
            )
          )
        `)
        .eq('user_id', userId)
        .eq('payment_status', 'verified')
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching purchase history:', error)
        return []
      }

      const purchaseHistory: UserPurchaseHistory[] = []

      orders?.forEach(order => {
        order.order_items?.forEach(item => {
          if (item.products) {
            purchaseHistory.push({
              productId: item.products.id,
              productName: item.products.name_en,
              category: item.products.category?.name_en || 'Uncategorized',
              brand: item.products.brand,
              price: item.price,
              quantity: item.quantity,
              purchaseDate: order.created_at,
              tags: item.products.tags || []
            })
          }
        })
      })

      return purchaseHistory
    } catch (error) {
      console.error('Error in getUserPurchaseHistory:', error)
      return []
    }
  }

  /**
   * Analyze user behavior and generate preferences
   */
  async analyzeUserBehavior(userId: string): Promise<UserBehaviorData> {
    const purchaseHistory = await this.getUserPurchaseHistory(userId)
    const categoryViews = await this.getUserCategoryViews(userId)

    // Calculate category preferences based on purchase frequency and recency
    const categoryPreferences: Record<string, number> = {}
    const brandPreferences: Record<string, number> = {}
    let totalSpent = 0
    let minPrice = Infinity
    let maxPrice = 0
    let hasDiscountPurchases = false

    purchaseHistory.forEach(purchase => {
      // Category preferences (weighted by quantity and recency)
      const daysSincePurchase = Math.floor(
        (Date.now() - new Date(purchase.purchaseDate).getTime()) / (1000 * 60 * 60 * 24)
      )
      const recencyWeight = Math.max(0.1, 1 - (daysSincePurchase / 30)) // More recent = higher weight
      const categoryScore = purchase.quantity * recencyWeight

      categoryPreferences[purchase.category] = 
        (categoryPreferences[purchase.category] || 0) + categoryScore

      // Brand preferences
      if (purchase.brand) {
        brandPreferences[purchase.brand] = 
          (brandPreferences[purchase.brand] || 0) + categoryScore
      }

      // Price analysis
      totalSpent += purchase.price * purchase.quantity
      minPrice = Math.min(minPrice, purchase.price)
      maxPrice = Math.max(maxPrice, purchase.price)

      // Check if user bought discounted items (simplified check)
      if (purchase.tags?.some(tag => 
        tag.toLowerCase().includes('sale') || 
        tag.toLowerCase().includes('discount') ||
        tag.toLowerCase().includes('deal')
      )) {
        hasDiscountPurchases = true
      }
    })

    // Enhance category preferences with browsing behavior
    // Add category view data to preferences (with lower weight than purchases)
    Object.entries(categoryViews).forEach(([categoryId, viewScore]) => {
      // Convert category ID to category name if needed
      // For now, use the ID directly - this could be enhanced with a category lookup
      const categoryKey = categoryId
      categoryPreferences[categoryKey] =
        (categoryPreferences[categoryKey] || 0) + (viewScore * 0.3) // 30% weight for views vs purchases
    })

    // Get cart items for current session
    const cartItems = await this.getCurrentCartItems(userId)

    return {
      userId,
      purchaseHistory,
      categoryPreferences,
      brandPreferences,
      priceRange: {
        min: minPrice === Infinity ? 0 : Math.max(0, minPrice * 0.7), // 30% below min
        max: maxPrice === 0 ? 10000 : maxPrice * 1.5 // 50% above max
      },
      preferredDiscounts: hasDiscountPurchases,
      searchHistory: await this.getUserSearchHistory(userId),
      viewedProducts: await this.getUserViewedProducts(userId),
      cartItems
    }
  }

  /**
   * Get current cart items for the user
   */
  private async getCurrentCartItems(userId: string): Promise<string[]> {
    try {
      const { data: cartItems, error } = await this.supabase
        .from('cart_items')
        .select('product_id')
        .eq('user_id', userId)

      if (error) {
        console.error('Error fetching cart items:', error)
        return []
      }

      return cartItems?.map(item => item.product_id) || []
    } catch (error) {
      console.error('Error in getCurrentCartItems:', error)
      return []
    }
  }

  /**
   * Get user's search history with enhanced analysis
   */
  private async getUserSearchHistory(userId: string): Promise<string[]> {
    try {
      // Get recent search history with more details
      const { data: searchHistory, error } = await this.serviceClient
        .from('user_search_history')
        .select(`
          search_query,
          search_category,
          results_count,
          created_at,
          clicked_product_id
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20) // Get more history for better analysis

      if (error) {
        console.error('Error fetching search history:', error)
        return []
      }

      // Process search history to extract meaningful terms
      const searchTerms: string[] = []
      const categoryBoosts: Record<string, number> = {}

      searchHistory?.forEach((item: any) => {
        const query = item.search_query?.toLowerCase().trim()
        if (query && query.length >= 2) {
          searchTerms.push(query)

          // Track category preferences from search
          if (item.search_category) {
            categoryBoosts[item.search_category] =
              (categoryBoosts[item.search_category] || 0) + 1
          }

          // Weight recent searches more heavily
          const daysSinceSearch = Math.floor(
            (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24)
          )
          if (daysSinceSearch <= 7) {
            searchTerms.push(query) // Add recent searches twice for higher weight
          }
        }
      })

      console.log(`📊 Processed ${searchTerms.length} search terms for user ${userId}`)
      return [...new Set(searchTerms)] // Remove duplicates while preserving weight
    } catch (error) {
      console.error('Error in getUserSearchHistory:', error)
      return []
    }
  }

  /**
   * Get user's viewed products from behavior tracking
   */
  private async getUserViewedProducts(userId: string): Promise<string[]> {
    try {
      const { data: viewedProducts, error } = await this.serviceClient
        .from('user_behavior_tracking')
        .select('product_id, created_at')
        .eq('user_id', userId)
        .eq('behavior_type', 'product_view')
        .not('product_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50) // Get last 50 viewed products

      if (error) {
        console.error('Error fetching viewed products:', error)
        return []
      }

      // Return unique product IDs in order of most recent views
      const uniqueProductIds = [...new Set(viewedProducts?.map(item => item.product_id) || [])]

      console.log(`📊 Found ${uniqueProductIds.length} unique viewed products for user ${userId}`)
      return uniqueProductIds
    } catch (error) {
      console.error('Error in getUserViewedProducts:', error)
      return []
    }
  }

  /**
   * Get user's category browsing behavior
   */
  private async getUserCategoryViews(userId: string): Promise<Record<string, number>> {
    try {
      const { data: categoryViews, error } = await this.serviceClient
        .from('user_behavior_tracking')
        .select('category_id, created_at')
        .eq('user_id', userId)
        .eq('behavior_type', 'category_view')
        .not('category_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100) // Get last 100 category views

      if (error) {
        console.error('Error fetching category views:', error)
        return {}
      }

      // Count category views with recency weighting
      const categoryViewCounts: Record<string, number> = {}

      categoryViews?.forEach(view => {
        const daysSinceView = Math.floor(
          (Date.now() - new Date(view.created_at).getTime()) / (1000 * 60 * 60 * 24)
        )
        const recencyWeight = Math.max(0.1, 1 - (daysSinceView / 30)) // More recent = higher weight

        categoryViewCounts[view.category_id] =
          (categoryViewCounts[view.category_id] || 0) + recencyWeight
      })

      console.log(`📊 Found category views for ${Object.keys(categoryViewCounts).length} categories`)
      return categoryViewCounts
    } catch (error) {
      console.error('Error in getUserCategoryViews:', error)
      return {}
    }
  }

  /**
   * Track user search behavior
   */
  async trackSearchBehavior(
    userId: string,
    searchQuery: string,
    category?: string,
    resultsCount?: number,
    clickedProductId?: string
  ): Promise<void> {
    try {
      await this.serviceClient
        .from('user_search_history')
        .insert({
          user_id: userId,
          search_query: searchQuery.trim(),
          search_category: category,
          results_count: resultsCount || 0,
          clicked_product_id: clickedProductId,
          search_source: 'header'
        })

      console.log('✅ Search behavior tracked successfully')
    } catch (error) {
      console.error('❌ Error tracking search behavior:', error)
    }
  }

  /**
   * Track general user behavior
   */
  async trackUserBehavior(
    userId: string,
    behaviorType: 'search' | 'product_view' | 'category_view' | 'cart_add' | 'cart_remove' | 'wishlist_add' | 'wishlist_remove' | 'purchase' | 'page_view',
    data: {
      productId?: string;
      categoryId?: string;
      searchQuery?: string;
      metadata?: Record<string, any>;
      sessionId?: string;
    }
  ): Promise<void> {
    try {
      await this.serviceClient
        .from('user_behavior_tracking')
        .insert({
          user_id: userId,
          session_id: data.sessionId || 'unknown',
          behavior_type: behaviorType,
          product_id: data.productId,
          category_id: data.categoryId,
          search_query: data.searchQuery,
          behavior_data: data.metadata || {}
        })

      console.log('✅ User behavior tracked:', behaviorType)
    } catch (error) {
      console.error('❌ Error tracking user behavior:', error)
    }
  }

  /**
   * Generate recommendation context for analytics
   */
  async getRecommendationContext(userId: string): Promise<RecommendationContext> {
    const behaviorData = await this.analyzeUserBehavior(userId)
    
    const favoriteCategories = Object.entries(behaviorData.categoryPreferences)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([category]) => category)

    const favoriteBrands = Object.entries(behaviorData.brandPreferences)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([brand]) => brand)

    const totalSpent = behaviorData.purchaseHistory.reduce(
      (sum, purchase) => sum + (purchase.price * purchase.quantity), 0
    )
    const totalPurchases = behaviorData.purchaseHistory.length
    const averageOrderValue = totalPurchases > 0 ? totalSpent / totalPurchases : 0

    const lastPurchaseDate = behaviorData.purchaseHistory.length > 0 
      ? behaviorData.purchaseHistory[0].purchaseDate 
      : undefined

    return {
      hasHistory: totalPurchases > 0,
      totalPurchases,
      favoriteCategories,
      favoriteBrands,
      averageOrderValue,
      lastPurchaseDate
    }
  }
}
