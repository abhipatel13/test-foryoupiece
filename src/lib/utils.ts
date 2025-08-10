import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(price)
}

export function calculateDiscountPercentage(originalPrice: number, salePrice: number): number {
  if (originalPrice <= salePrice) return 0
  return Math.round(((originalPrice - salePrice) / originalPrice) * 100)
}

export function calculateSavings(originalPrice: number, salePrice: number, quantity: number = 1): number {
  if (originalPrice <= salePrice) return 0
  return (originalPrice - salePrice) * quantity
}

export function isOnSale(originalPrice?: number, currentPrice?: number): boolean {
  return !!(originalPrice && currentPrice && originalPrice > currentPrice)
}

/**
 * Generate a unique key for cart items to prevent React key duplication errors
 * @param id - Product ID
 * @param variant - Product variant (optional)
 * @returns Unique key string
 */
export function generateCartItemKey(id: string, variant?: string | null): string {
  return `${id}-${variant || 'default'}`
}

/**
 * Generate a unique key for any item with optional variant
 * @param id - Item ID
 * @param variant - Item variant (optional)
 * @param prefix - Optional prefix for the key
 * @returns Unique key string
 */
export function generateItemKey(id: string, variant?: string | null, prefix?: string): string {
  const baseKey = `${id}-${variant || 'default'}`
  return prefix ? `${prefix}-${baseKey}` : baseKey
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) {
    return 'N/A'
  }

  try {
    const dateObj = new Date(date)

    // Check if the date is valid
    if (isNaN(dateObj.getTime())) {
      console.warn('Invalid date value:', date)
      return 'Invalid Date'
    }

    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(dateObj)
  } catch (error) {
    console.error('Error formatting date:', error, 'Date value:', date)
    return 'Invalid Date'
  }
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) {
    return 'N/A'
  }

  try {
    const dateObj = new Date(date)

    // Check if the date is valid
    if (isNaN(dateObj.getTime())) {
      console.warn('Invalid datetime value:', date)
      return 'Invalid Date'
    }

    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(dateObj)
  } catch (error) {
    console.error('Error formatting datetime:', error, 'Date value:', date)
    return 'Invalid Date'
  }
}

export function generateOrderId(): string {
  const timestamp = Date.now().toString(36)
  const randomStr = Math.random().toString(36).substring(2, 8)
  return `FYP-${timestamp}-${randomStr}`.toUpperCase()
}

/**
 * Calculate points based on amount and product-specific points rate
 * @param amount - Purchase amount in dollars
 * @param pointsRate - Points rate percentage (e.g., 1.00 = 1%, 5.00 = 5%)
 * @returns Points earned (based on user requirements: $50 at 1% = 500 points)
 */
export function calculatePoints(amount: number, pointsRate: number = 1.00): number {
  // Based on user requirements: $50 at 1% rate should give 500 points
  // This means: amount * pointsRate * 10 (treating pointsRate as the percentage value)
  // Formula: amount * pointsRate * 10
  return Math.floor(amount * pointsRate * 10)
}

/**
 * Calculate points for multiple items with different rates
 * @param items - Array of {amount: number, pointsRate: number}
 * @returns Total points earned
 */
export function calculateOrderPoints(items: Array<{amount: number, pointsRate?: number}>): number {
  return items.reduce((total, item) => {
    return total + calculatePoints(item.amount, item.pointsRate || 1.00)
  }, 0)
}

/**
 * Get user tier/rank based on total points earned (annual reset)
 * @param totalPointsEarned - Total points earned this year
 * @returns User tier
 */
export function getTierFromPoints(totalPointsEarned: number): string {
  if (totalPointsEarned >= 50000) return 'diamond'
  if (totalPointsEarned >= 35000) return 'platinum'
  if (totalPointsEarned >= 15000) return 'gold'
  if (totalPointsEarned >= 5000) return 'silver'
  return 'bronze'
}

/**
 * Get the correct user tier from profile data, prioritizing calculated tier over stored tier
 * This ensures consistent tier display across all UI components
 * @param profile - User profile data
 * @returns Correct user tier
 */
export function getCorrectUserTier(profile: any): string {
  if (!profile) return 'bronze'

  // Use total_points_earned to calculate the correct tier
  const totalPointsEarned = profile.total_points_earned || 0
  return getTierFromPoints(totalPointsEarned)
}

/**
 * Get tier requirements and benefits
 */
export function getTierInfo() {
  return {
    bronze: { minPoints: 0, name: 'Bronze', color: '#CD7F32' },
    silver: { minPoints: 5000, name: 'Silver', color: '#C0C0C0' },
    gold: { minPoints: 15000, name: 'Gold', color: '#FFD700' },
    platinum: { minPoints: 35000, name: 'Platinum', color: '#E5E4E2' },
    diamond: { minPoints: 50000, name: 'Diamond', color: '#B9F2FF' }
  }
}

/**
 * Get tier hierarchy level for comparison
 * @param tier - Tier name
 * @returns Numeric level for comparison (higher = better tier)
 */
export function getTierLevel(tier: string): number {
  const tierLevels: Record<string, number> = {
    bronze: 1,
    silver: 2,
    gold: 3,
    platinum: 4,
    diamond: 5
  }
  return tierLevels[tier] || 1
}

/**
 * Compare two tiers to determine if there's an upgrade
 * @param oldTier - Previous tier
 * @param newTier - New tier
 * @returns True if newTier is higher than oldTier
 */
export function isTierUpgrade(oldTier: string, newTier: string): boolean {
  return getTierLevel(newTier) > getTierLevel(oldTier)
}

/**
 * Get tier-specific styling for UI components
 * @param tier - User tier
 * @returns Styling object with colors and CSS classes
 */
export function getTierStyling(tier: string) {
  const tierInfo = getTierInfo()
  const tierData = tierInfo[tier as keyof typeof tierInfo] || tierInfo.bronze

  const stylingMap = {
    bronze: {
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
      textColor: 'text-amber-700',
      bgColor: 'bg-amber-50',
      iconColor: 'text-amber-600',
      premiumBadgeClass: 'bg-amber-100 text-amber-800 border-amber-200'
    },
    silver: {
      badgeClass: 'bg-gray-100 text-gray-800 border-gray-300',
      textColor: 'text-gray-700',
      bgColor: 'bg-gray-50',
      iconColor: 'text-gray-600',
      premiumBadgeClass: 'bg-gray-100 text-gray-800 border-gray-300'
    },
    gold: {
      badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      textColor: 'text-yellow-700',
      bgColor: 'bg-yellow-50',
      iconColor: 'text-yellow-600',
      premiumBadgeClass: 'bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 border-yellow-300 shadow-sm'
    },
    platinum: {
      badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
      textColor: 'text-slate-700',
      bgColor: 'bg-slate-50',
      iconColor: 'text-slate-600',
      premiumBadgeClass: 'bg-gradient-to-r from-slate-100 to-slate-200 text-slate-800 border-slate-300 shadow-md'
    },
    diamond: {
      badgeClass: 'bg-gradient-to-r from-blue-100 via-cyan-100 to-blue-100 text-blue-900 border-blue-300 shadow-lg ring-2 ring-blue-200 ring-opacity-50',
      textColor: 'text-blue-800',
      bgColor: 'bg-gradient-to-br from-blue-50 to-cyan-50',
      iconColor: 'text-blue-700',
      premiumBadgeClass: 'bg-gradient-to-r from-blue-100 via-cyan-100 to-blue-100 text-blue-900 border-blue-300 shadow-lg ring-2 ring-blue-200 ring-opacity-50 animate-pulse'
    }
  }

  return {
    ...tierData,
    ...stylingMap[tier as keyof typeof stylingMap] || stylingMap.bronze
  }
}

/**
 * Convert points to dollar value (1000 points = $1)
 * @param points - Points amount
 * @returns Dollar value
 */
export function pointsToDollars(points: number): number {
  return points / 1000
}

/**
 * Global product sorting enhancement - prioritizes in-stock items
 * Primary sort: In-stock items first, then out-of-stock/pre-order items
 * Secondary sort: Maintains existing sorting logic within each group
 *
 * @param products - Array of products to sort
 * @param secondarySort - Optional secondary sorting function to apply within stock groups
 * @returns Sorted array with in-stock items prioritized
 */
export function sortProductsByStockPriority<T extends { stock_quantity: number }>(
  products: T[],
  secondarySort?: (a: T, b: T) => number
): T[] {
  if (!products || products.length === 0) {
    return products
  }

  // Check if ALL products are out of stock - if so, return original order
  const hasInStockItems = products.some(product => product.stock_quantity > 0)
  if (!hasInStockItems) {
    console.log('🔄 All products out of stock - maintaining original order')
    return secondarySort ? [...products].sort(secondarySort) : products
  }

  // Separate products into in-stock and out-of-stock groups
  const inStockProducts = products.filter(product => product.stock_quantity > 0)
  const outOfStockProducts = products.filter(product => product.stock_quantity <= 0)

  // Apply secondary sorting within each group if provided
  if (secondarySort) {
    inStockProducts.sort(secondarySort)
    outOfStockProducts.sort(secondarySort)
  }

  // Combine: in-stock first, then out-of-stock
  const sortedProducts = [...inStockProducts, ...outOfStockProducts]

  console.log(`📦 Stock-priority sorting applied: ${inStockProducts.length} in-stock, ${outOfStockProducts.length} out-of-stock`)

  return sortedProducts
}

/**
 * Determine if a product is in stock
 * @param product - Product with stock_quantity
 * @returns Boolean indicating if product is in stock
 */
export function isProductInStock(product: { stock_quantity: number }): boolean {
  return product.stock_quantity > 0
}

/**
 * Get stock status display text for a product
 * @param stockQuantity - Current stock quantity
 * @returns Stock status text for display
 */
export function getStockStatusText(stockQuantity: number): string {
  if (stockQuantity <= 0) return 'Available for preorder'
  if (stockQuantity === 1) return '1 left'
  if (stockQuantity === 2) return 'Few left'
  return 'Fast delivery'
}

/**
 * Get stock status color class for styling
 * @param stockQuantity - Current stock quantity
 * @returns CSS color class for stock status
 */
export function getStockStatusColor(stockQuantity: number): string {
  if (stockQuantity <= 0) return 'text-blue-600'
  if (stockQuantity === 1) return 'text-red-600'
  if (stockQuantity === 2) return 'text-orange-600'
  return 'text-green-600'
}

/**
 * Convert dollars to points (for display purposes)
 * @param dollars - Dollar amount
 * @returns Points equivalent
 */
export function dollarsToPoints(dollars: number): number {
  return dollars * 1000
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validatePhone(phone: string): boolean {
  // Basic phone validation - can be enhanced based on requirements
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''))
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
