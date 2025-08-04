/**
 * Simple in-memory cache utility for performance optimization
 */

interface CacheItem<T> {
  data: T
  timestamp: number
  ttl: number
}

class SimpleCache {
  private cache = new Map<string, CacheItem<any>>()
  private defaultTTL = 5 * 60 * 1000 // 5 minutes

  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    })
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key)
    
    if (!item) {
      return null
    }

    // Check if item has expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key)
      return null
    }

    return item.data as T
  }

  has(key: string): boolean {
    const item = this.cache.get(key)
    
    if (!item) {
      return false
    }

    // Check if item has expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  // Clean up expired items
  cleanup(): void {
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key)
      }
    }
  }

  // Get cache statistics
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }
}

// Export singleton instance
export const cache = new SimpleCache()

// Auto cleanup every 10 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    cache.cleanup()
  }, 10 * 60 * 1000)
}

// Cache key generators for common queries
export const cacheKeys = {
  userProfile: (userId: string) => `user_profile_${userId}`,
  adminUser: (userId: string) => `admin_user_${userId}`,
  dashboardStats: () => 'dashboard_stats',
  products: (filters?: any) => `products_${JSON.stringify(filters || {})}`,
  orders: (filters?: any) => `orders_${JSON.stringify(filters || {})}`,
}
