import { SHIPPING_CONFIG } from '@/shared/constants'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export interface ShippingCalculationResult {
  shippingFee: number
  isFreeShipping: boolean
  freeShippingReason: 'quantity' | 'coupon' | 'permanent_tier' | 'event' | 'none'
  message?: string
  eventContext?: {
    id: string
    title: string
    description?: string | null
    starts_at: string
    ends_at?: string | null
    type: 'free_shipping'
  }
}

export interface ShippingOptions {
  itemCount: number
  userId?: string
  appliedCouponCode?: string
}

export class ShippingService {
  private serviceClient: any = null

  private getServiceClient() {
    if (!this.serviceClient) {
      // Only create service client on server side
      if (typeof window === 'undefined') {
        try {
          this.serviceClient = createServiceRoleClient()
          if (!this.serviceClient) {
            console.error('Failed to create service role client in ShippingService')
          }
        } catch (error) {
          console.error('Error initializing ShippingService:', error)
          this.serviceClient = null
        }
      } else {
        console.warn('ShippingService should only be used on server side')
        return null
      }
    }
    return this.serviceClient
  }

  /**
   * Calculate shipping fee with tier-based free shipping support
   */
  async calculateShipping(options: ShippingOptions): Promise<ShippingCalculationResult> {
    const { itemCount, userId, appliedCouponCode } = options

    try {
      // 0. Check active free shipping EVENTS first
      const event = await this.getActiveFreeShippingEvent()
      if (event) {
        return {
          shippingFee: 0,
          isFreeShipping: true,
          freeShippingReason: 'event',
          message: `Free Shipping EVENT: ${event.title}`,
          eventContext: {
            id: event.id,
            title: event.title,
            description: event.description,
            starts_at: event.starts_at,
            ends_at: event.ends_at,
            type: 'free_shipping'
          }
        }
      }

      // 1. Check quantity-based free shipping (4+ items)
      if (itemCount >= SHIPPING_CONFIG.FREE_SHIPPING_THRESHOLD) {
        return {
          shippingFee: 0,
          isFreeShipping: true,
          freeShippingReason: 'quantity',
          message: `Free shipping for ${itemCount} items (4+ items qualify)`
        }
      }

      // 2. Check permanent free shipping for Diamond tier users
      if (userId) {
        const permanentFreeShipping = await this.checkPermanentFreeShipping(userId)
        if (permanentFreeShipping) {
          return {
            shippingFee: 0,
            isFreeShipping: true,
            freeShippingReason: 'permanent_tier',
            message: 'Free shipping - Diamond tier privilege'
          }
        }
      }

      // 3. Check coupon-based free shipping
      if (appliedCouponCode && userId) {
        const couponFreeShipping = await this.checkCouponFreeShipping(appliedCouponCode, userId)
        if (couponFreeShipping) {
          return {
            shippingFee: 0,
            isFreeShipping: true,
            freeShippingReason: 'coupon',
            message: `Free shipping - ${appliedCouponCode} coupon applied`
          }
        }
      }

      // 4. Default shipping fee
      return {
        shippingFee: SHIPPING_CONFIG.STANDARD_FEE,
        isFreeShipping: false,
        freeShippingReason: 'none',
        message: `Standard shipping fee: $${SHIPPING_CONFIG.STANDARD_FEE}`
      }

    } catch (error) {
      console.error('Error calculating shipping:', error)
      // Fallback to standard shipping calculation
      return {
        shippingFee: itemCount >= SHIPPING_CONFIG.FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_CONFIG.STANDARD_FEE,
        isFreeShipping: itemCount >= SHIPPING_CONFIG.FREE_SHIPPING_THRESHOLD,
        freeShippingReason: itemCount >= SHIPPING_CONFIG.FREE_SHIPPING_THRESHOLD ? 'quantity' : 'none'
      }
    }
  }

  /**
   * Check if user has permanent free shipping (Diamond tier)
   */
  private async checkPermanentFreeShipping(userId: string): Promise<boolean> {
    try {
      if (!this.serviceClient) {
        return false
      }

      const { data, error } = await this.serviceClient
        .from('users')
        .select('permanent_free_shipping')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error checking permanent free shipping:', error)
        return false
      }

      return data?.permanent_free_shipping === true
    } catch (error) {
      console.error('Error checking permanent free shipping:', error)
      return false
    }
  }

  /**
   * Check if applied coupon provides free shipping
   */
  private async checkCouponFreeShipping(couponCode: string, userId: string): Promise<boolean> {
    try {
      if (!this.serviceClient) {
        return false
      }

      const { data, error } = await this.serviceClient
        .from('coupons')
        .select('metadata, allowed_user_ids, status, expires_at')
        .eq('code', couponCode.toUpperCase().trim())
        .single()

      if (error || !data) {
        return false
      }

      // Check if coupon is active and not expired
      if (data.status !== 'active') {
        return false
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        return false
      }

      // Check if user is allowed to use this coupon
      if (data.allowed_user_ids) {
        const allowedUsers = Array.isArray(data.allowed_user_ids)
          ? data.allowed_user_ids
          : JSON.parse(data.allowed_user_ids as string)

        if (!allowedUsers.includes(userId)) {
          return false
        }
      }

      // Check if coupon has free shipping metadata
      const metadata = data.metadata as any
      return metadata?.free_shipping === true || metadata?.tier_reward === true

    } catch (error) {
      console.error('Error checking coupon free shipping:', error)
      return false
    }
  }

  /**
   * Helper to fetch an active free_shipping event (server or client fallback)
   */
  private async getActiveFreeShippingEvent(): Promise<{
    id: string
    title: string
    description?: string | null
    starts_at: string
    ends_at?: string | null
  } | null> {
    try {
      // Client-side fallback via API
      if (typeof window !== 'undefined') {
        try {
          const res = await fetch('/api/events/active?type=free_shipping', { cache: 'no-store' })
          const json = await res.json()
          const list = json?.data || []
          return list.length > 0 ? list[0] : null
        } catch (e) {
          // swallow and try server client below
        }
      }

      const client = this.getServiceClient()
      if (!client) return null

      const nowIso = new Date().toISOString()
      const { data, error } = await client
        .from('promotional_events')
        .select('id,title,description,starts_at,ends_at')
        .eq('event_type', 'free_shipping')
        .eq('is_active', true)
        .lte('starts_at', nowIso)
        .or('ends_at.is.null,ends_at.gte.' + nowIso)
        .order('starts_at', { ascending: false })
        .limit(1)

      if (error || !data || data.length === 0) return null
      return data[0]
    } catch (err) {
      console.error('Error checking active free shipping event:', err)
      return null
    }
  }

  /**
   * Get user's tier-specific coupons
   */
  async getUserTierCoupons(userId: string): Promise<Array<{
    code: string
    tier_level: string
    expires_at: string | null
    description: string
  }>> {
    try {
      if (!this.serviceClient) {
        return []
      }

      const { data, error } = await this.serviceClient
        .from('tier_specific_coupons')
        .select(`
          tier_level,
          coupons!inner (
            code,
            description,
            expires_at,
            status
          )
        `)
        .eq('user_id', userId)
        .eq('coupons.status', 'active')

      if (error) {
        console.error('Error fetching user tier coupons:', error)
        return []
      }

      return (data || []).map(item => ({
        code: item.coupons.code,
        tier_level: item.tier_level,
        expires_at: item.coupons.expires_at,
        description: item.coupons.description
      }))

    } catch (error) {
      console.error('Error fetching user tier coupons:', error)
      return []
    }
  }

  /**
   * Check if user qualifies for any shipping benefits
   */
  async getShippingBenefits(userId: string): Promise<{
    hasPermanentFreeShipping: boolean
    tierCoupons: Array<{
      code: string
      tier_level: string
      expires_at: string | null
      description: string
    }>
    currentTier: string
  }> {
    try {
      if (!this.serviceClient) {
        return {
          hasPermanentFreeShipping: false,
          tierCoupons: [],
          currentTier: 'bronze'
        }
      }

      // Get user's permanent free shipping status and tier
      const { data: userData, error: userError } = await this.serviceClient
        .from('users')
        .select('permanent_free_shipping, tier_level')
        .eq('id', userId)
        .single()


      if (userError) {
        console.error('Error fetching user shipping benefits:', userError)
        return {
          hasPermanentFreeShipping: false,
          tierCoupons: [],
          currentTier: 'bronze'
        }
      }

      // Get tier-specific coupons
      const tierCoupons = await this.getUserTierCoupons(userId)

      return {
        hasPermanentFreeShipping: userData?.permanent_free_shipping === true,
        tierCoupons,
        currentTier: userData?.tier_level || 'bronze'
      }

    } catch (error) {
      console.error('Error getting shipping benefits:', error)
      return {
        hasPermanentFreeShipping: false,
        tierCoupons: [],
        currentTier: 'bronze'
      }
    }
  }
}

// Export singleton instance
export const shippingService = new ShippingService()
