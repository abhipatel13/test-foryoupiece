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
 * Convert points to dollar value (1000 points = $1)
 * @param points - Points amount
 * @returns Dollar value
 */
export function pointsToDollars(points: number): number {
  return points / 1000
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
