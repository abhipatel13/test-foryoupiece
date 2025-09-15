import { Database } from '@/lib/supabase/database.types'

// Database types
export type CouponRow = Database['public']['Tables']['coupons']['Row']
export type CouponInsert = Database['public']['Tables']['coupons']['Insert']
export type CouponUpdate = Database['public']['Tables']['coupons']['Update']
export type CouponUsageRow = Database['public']['Tables']['coupon_usage']['Row']
export type CouponUsageInsert = Database['public']['Tables']['coupon_usage']['Insert']

// Enums
export type CouponDiscountType = Database['public']['Enums']['coupon_discount_type']
export type CouponStatus = Database['public']['Enums']['coupon_status']

// Business logic interfaces
export interface Coupon {
  id: string
  code: string
  name: string
  description?: string
  discountType: CouponDiscountType
  discountValue: number
  totalUsageLimit?: number
  perUserUsageLimit?: number
  currentUsageCount: number
  allowedUserIds?: string[]
  minimumOrderAmount?: number
  startsAt: Date
  expiresAt?: Date
  status: CouponStatus
  createdBy?: string
  metadata: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface CouponUsage {
  id: string
  couponId: string
  userId: string
  orderId: string
  discountAmount: number
  orderTotalBeforeDiscount: number
  usedAt: Date
}

// Validation interfaces
export interface CouponValidationResult {
  isValid: boolean
  errorMessage?: string
  couponId?: string
  discountAmount?: number
}

export interface CouponApplicationResult {
  success: boolean
  errorMessage?: string
  discountAmount?: number
  coupon?: Coupon
}

// Targeting options
export type UserRankTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'

export interface CouponTargetingOptions {
  tiers?: UserRankTier[] // By User Ranking
  recentlySignedUpDays?: number // Users who registered within last N days
  mostPurchasedTopN?: number // Top N by total_spent
  mostPurchasedMinTotalSpent?: number // Minimum total_spent threshold ($)
  recentlyPurchasedDays?: number // Users who purchased within last N days
}

// Form interfaces for admin
export interface CouponFormData {
  code: string
  name: string
  description?: string
  discountType: CouponDiscountType
  discountValue: number
  totalUsageLimit?: number
  perUserUsageLimit?: number
  allowedUserIds?: string[]
  minimumOrderAmount?: number
  startsAt: Date
  expiresAt?: Date
  status: CouponStatus
  targeting?: CouponTargetingOptions
}

// Statistics interface for admin
export interface CouponStatistics {
  totalCoupons: number
  activeCoupons: number
  expiredCoupons: number
  totalUsage: number
  totalDiscountGiven: number
  topCoupons: Array<{
    id: string
    code: string
    name: string
    usageCount: number
    totalDiscount: number
  }>
}

// Cart integration interfaces
export interface AppliedCoupon {
  id: string
  code: string
  name: string
  discountType: CouponDiscountType
  discountValue: number
  discountAmount: number
  minimumOrderAmount?: number
}

export interface CouponValidationRequest {
  code: string
  userId: string
  orderTotal: number
}

// API response interfaces
export interface CouponListResponse {
  success: boolean
  data?: Coupon[]
  error?: string
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface CouponResponse {
  success: boolean
  data?: Coupon
  error?: string
}

export interface CouponValidationResponse {
  success: boolean
  data?: CouponValidationResult
  error?: string
}

export interface CouponUsageResponse {
  success: boolean
  data?: CouponUsage[]
  error?: string
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface CouponStatisticsResponse {
  success: boolean
  data?: CouponStatistics
  error?: string
}

// Utility functions type definitions
export interface CouponUtils {
  formatDiscountValue: (discountType: CouponDiscountType, discountValue: number) => string
  calculateDiscountAmount: (discountType: CouponDiscountType, discountValue: number, orderTotal: number) => number
  isExpired: (expiresAt?: Date) => boolean
  isActive: (coupon: Coupon) => boolean
  canUserUseCoupon: (coupon: Coupon, userId: string) => boolean
  getRemainingUses: (coupon: Coupon) => number | null
  formatExpirationDate: (expiresAt?: Date) => string
}

// Error types
export enum CouponErrorType {
  INVALID_CODE = 'INVALID_CODE',
  EXPIRED = 'EXPIRED',
  INACTIVE = 'INACTIVE',
  USAGE_LIMIT_EXCEEDED = 'USAGE_LIMIT_EXCEEDED',
  USER_LIMIT_EXCEEDED = 'USER_LIMIT_EXCEEDED',
  USER_NOT_ELIGIBLE = 'USER_NOT_ELIGIBLE',
  MINIMUM_ORDER_NOT_MET = 'MINIMUM_ORDER_NOT_MET',
  NOT_YET_VALID = 'NOT_YET_VALID',
  ALREADY_APPLIED = 'ALREADY_APPLIED',
  SYSTEM_ERROR = 'SYSTEM_ERROR'
}

export interface CouponError {
  type: CouponErrorType
  message: string
  details?: Record<string, any>
}

// Admin filter and sort options
export interface CouponFilters {
  status?: CouponStatus
  discountType?: CouponDiscountType
  search?: string
  createdBy?: string
  expiresAfter?: Date
  expiresBefore?: Date
}

export interface CouponSortOptions {
  field: 'code' | 'name' | 'created_at' | 'expires_at' | 'current_usage_count' | 'discount_value'
  direction: 'asc' | 'desc'
}

export interface CouponListRequest {
  page?: number
  limit?: number
  filters?: CouponFilters
  sort?: CouponSortOptions
}

// Conversion utilities
export const convertCouponRowToCoupon = (row: CouponRow): Coupon => ({
  id: row.id,
  code: row.code,
  name: row.name,
  description: row.description || undefined,
  discountType: row.discount_type,
  discountValue: row.discount_value,
  totalUsageLimit: row.total_usage_limit || undefined,
  perUserUsageLimit: row.per_user_usage_limit || undefined,
  currentUsageCount: row.current_usage_count,
  allowedUserIds: row.allowed_user_ids ? JSON.parse(JSON.stringify(row.allowed_user_ids)) : undefined,
  minimumOrderAmount: row.minimum_order_amount || undefined,
  startsAt: new Date(row.starts_at),
  expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
  status: row.status,
  createdBy: row.created_by || undefined,
  metadata: row.metadata as Record<string, any>,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at)
})

export const convertCouponUsageRowToCouponUsage = (row: CouponUsageRow): CouponUsage => ({
  id: row.id,
  couponId: row.coupon_id,
  userId: row.user_id,
  orderId: row.order_id,
  discountAmount: row.discount_amount,
  orderTotalBeforeDiscount: row.order_total_before_discount,
  usedAt: new Date(row.used_at)
})

export const convertCouponFormDataToCouponInsert = (formData: CouponFormData, createdBy?: string): CouponInsert => {
  // Map targeting to DB metadata schema and tier fields
  const targeting = formData.targeting
  const hasTiers = targeting?.tiers && targeting.tiers.length > 0
  const metadata: Record<string, any> = {}
  if (targeting) {
    metadata.targeting = {
      ...(targeting.recentlySignedUpDays ? { recently_signed_up_days: targeting.recentlySignedUpDays } : {}),
      ...(targeting.mostPurchasedTopN ? { most_purchased_top_n: targeting.mostPurchasedTopN } : {}),
      ...(targeting.mostPurchasedMinTotalSpent ? { most_purchased_min_total_spent: targeting.mostPurchasedMinTotalSpent } : {}),
      ...(targeting.recentlyPurchasedDays ? { recently_purchased_days: targeting.recentlyPurchasedDays } : {})
    }
  }

  return {
    code: formData.code.toUpperCase().trim(),
    name: formData.name.trim(),
    description: formData.description?.trim() || null,
    discount_type: formData.discountType,
    discount_value: formData.discountValue,
    total_usage_limit: formData.totalUsageLimit || null,
    per_user_usage_limit: formData.perUserUsageLimit || null,
    allowed_user_ids: formData.allowedUserIds && formData.allowedUserIds.length > 0
      ? JSON.parse(JSON.stringify(formData.allowedUserIds))
      : null,
    minimum_order_amount: formData.minimumOrderAmount || null,
    starts_at: formData.startsAt.toISOString(),
    expires_at: formData.expiresAt?.toISOString() || null,
    status: formData.status,
    created_by: createdBy || null,
    // Extensions for targeting
    ...(hasTiers ? { is_tier_specific: true as any } : {}),
    ...(hasTiers ? { tier_restrictions: JSON.parse(JSON.stringify(targeting!.tiers)) as any } : {}),
    ...(targeting ? { metadata: metadata as any } : {})
  } as CouponInsert
}
