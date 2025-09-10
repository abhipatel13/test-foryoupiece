import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { 
  Coupon, 
  CouponUsage, 
  CouponValidationResult, 
  CouponApplicationResult,
  CouponFormData,
  CouponStatistics,
  CouponFilters,
  CouponSortOptions,
  CouponListRequest,
  CouponErrorType,
  CouponError,
  convertCouponRowToCoupon,
  convertCouponUsageRowToCouponUsage,
  convertCouponFormDataToCouponInsert
} from '@/types/coupon'

export class CouponService {
  private serviceClient: any = null

  private getServiceClient() {
    if (!this.serviceClient) {
      // Only create service client on server side
      if (typeof window === 'undefined') {
        try {
          this.serviceClient = createServiceRoleClient()
          if (!this.serviceClient) {
            console.error('Failed to create service role client in CouponService')
          }
        } catch (error) {
          console.error('Error initializing CouponService:', error)
          this.serviceClient = null
        }
      } else {
        console.warn('CouponService should only be used on server side')
        return null
      }
    }
    return this.serviceClient
  }

  /**
   * Validate a coupon code for a specific user and order total
   */
  async validateCoupon(code: string, userId: string, orderTotal: number): Promise<CouponValidationResult> {
    try {
      console.log('🎫 Validating coupon:', { code, userId, orderTotal })

      const serviceClient = this.getServiceClient()
      if (!serviceClient) {
        throw new Error('Service client not available')
      }

      // Use the database function for validation
      const { data, error } = await serviceClient
        .rpc('validate_coupon_usage', {
          p_coupon_code: code.toUpperCase().trim(),
          p_user_id: userId,
          p_order_total: orderTotal
        })

      if (error) {
        console.error('❌ Coupon validation error:', error)
        return {
          isValid: false,
          errorMessage: 'System error during validation'
        }
      }

      const result = data?.[0]
      if (!result) {
        return {
          isValid: false,
          errorMessage: 'Invalid coupon code'
        }
      }

      console.log('✅ Coupon validation result:', result)
      return {
        isValid: result.is_valid,
        errorMessage: result.error_message || undefined,
        couponId: result.coupon_id || undefined,
        discountAmount: result.discount_amount || undefined
      }
    } catch (error: any) {
      console.error('❌ Coupon validation failed:', error)
      return {
        isValid: false,
        errorMessage: 'System error during validation'
      }
    }
  }

  /**
   * Apply a coupon to an order
   */
  async applyCouponToOrder(
    code: string,
    userId: string,
    orderId: string,
    orderTotal: number
  ): Promise<CouponApplicationResult> {
    try {
      console.log('🎫 Applying coupon to order:', { code, userId, orderId, orderTotal })

      const serviceClient = this.getServiceClient()
      if (!serviceClient) {
        throw new Error('Service client not available')
      }

      // Use the database function for application
      const { data, error } = await serviceClient
        .rpc('apply_coupon_to_order', {
          p_coupon_code: code.toUpperCase().trim(),
          p_user_id: userId,
          p_order_id: orderId,
          p_order_total: orderTotal
        })

      if (error) {
        console.error('❌ Coupon application error:', error)
        return {
          success: false,
          errorMessage: 'System error during coupon application'
        }
      }

      const result = data?.[0]
      if (!result) {
        return {
          success: false,
          errorMessage: 'Failed to apply coupon'
        }
      }

      console.log('✅ Coupon application result:', result)

      if (!result.success) {
        return {
          success: false,
          errorMessage: result.error_message
        }
      }

      // Get the coupon details for the response
      const coupon = await this.getCouponByCode(code)

      return {
        success: true,
        discountAmount: result.discount_amount,
        coupon: coupon || undefined
      }


    } catch (error: any) {
      console.error('❌ Coupon application failed:', error)
      return {
        success: false,
        errorMessage: 'System error during coupon application'
      }
    }
  }

  /**
   * Get a coupon by its code
   */
  async getCouponByCode(code: string): Promise<Coupon | null> {
    try {
      const serviceClient = this.getServiceClient()
      if (!serviceClient) {
        throw new Error('Service client not available')
      }

      const { data, error } = await serviceClient
        .from('coupons')
        .select('*')
        .eq('code', code.toUpperCase().trim())
        .single()

      if (error || !data) {
        return null
      }

      return convertCouponRowToCoupon(data)
    } catch (error: any) {
      console.error('❌ Failed to get coupon by code:', error)
      return null
    }
  }

  /**
   * Get a coupon by its ID
   */
  async getCouponById(id: string): Promise<Coupon | null> {
    try {
      const serviceClient = this.getServiceClient()
      if (!serviceClient) {
        throw new Error('Service client not available')
      }

      const { data, error } = await serviceClient
        .from('coupons')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) {
        return null
      }

      return convertCouponRowToCoupon(data)
    } catch (error: any) {
      console.error('❌ Failed to get coupon by ID:', error)
      return null
    }
  }

  /**
   * Create a new coupon
   */
  async createCoupon(formData: CouponFormData, createdBy?: string): Promise<Coupon | null> {
    try {
      console.log('🎫 Creating new coupon:', formData)

      const serviceClient = this.getServiceClient()
      if (!serviceClient) {
        throw new Error('Service client not available')
      }

      // Check if code already exists
      const existingCoupon = await this.getCouponByCode(formData.code)
      if (existingCoupon) {
        throw new Error('Coupon code already exists')
      }

      const insertData = convertCouponFormDataToCouponInsert(formData, createdBy)

      const { data, error } = await serviceClient
        .from('coupons')
        .insert(insertData)
        .select()
        .single()

      if (error) {
        console.error('❌ Failed to create coupon:', error)
        throw new Error(error.message)
      }

      console.log('✅ Coupon created successfully:', data.id)
      return convertCouponRowToCoupon(data)
    } catch (error: any) {
      console.error('❌ Coupon creation failed:', error)
      throw error
    }
  }

  /**
   * Update an existing coupon
   */
  async updateCoupon(id: string, formData: Partial<CouponFormData>): Promise<Coupon | null> {
    try {
      console.log('🎫 Updating coupon:', { id, formData })

      const serviceClient = this.getServiceClient()
      if (!serviceClient) {
        throw new Error('Service client not available')
      }

      // If code is being updated, check for duplicates
      if (formData.code) {
        const existingCoupon = await this.getCouponByCode(formData.code)
        if (existingCoupon && existingCoupon.id !== id) {
          throw new Error('Coupon code already exists')
        }
      }

      const updateData: any = {}
      
      if (formData.code) updateData.code = formData.code.toUpperCase().trim()
      if (formData.name) updateData.name = formData.name.trim()
      if (formData.description !== undefined) updateData.description = formData.description?.trim() || null
      if (formData.discountType) updateData.discount_type = formData.discountType
      if (formData.discountValue !== undefined) updateData.discount_value = formData.discountValue
      if (formData.totalUsageLimit !== undefined) updateData.total_usage_limit = formData.totalUsageLimit || null
      if (formData.perUserUsageLimit !== undefined) updateData.per_user_usage_limit = formData.perUserUsageLimit || null
      if (formData.allowedUserIds !== undefined) {
        updateData.allowed_user_ids = formData.allowedUserIds && formData.allowedUserIds.length > 0 
          ? JSON.parse(JSON.stringify(formData.allowedUserIds)) 
          : null
      }
      if (formData.minimumOrderAmount !== undefined) updateData.minimum_order_amount = formData.minimumOrderAmount || null
      if (formData.startsAt) updateData.starts_at = formData.startsAt.toISOString()
      if (formData.expiresAt !== undefined) updateData.expires_at = formData.expiresAt?.toISOString() || null
      if (formData.status) updateData.status = formData.status

      const { data, error } = await serviceClient
        .from('coupons')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('❌ Failed to update coupon:', error)
        throw new Error(error.message)
      }

      console.log('✅ Coupon updated successfully:', id)
      return convertCouponRowToCoupon(data)
    } catch (error: any) {
      console.error('❌ Coupon update failed:', error)
      throw error
    }
  }

  /**
   * Delete a coupon
   */
  async deleteCoupon(id: string): Promise<boolean> {
    try {
      console.log('🎫 Deleting coupon:', id)

      const serviceClient = this.getServiceClient()
      if (!serviceClient) {
        throw new Error('Service client not available')
      }

      // Delete coupon regardless of prior usage (usage records will cascade-delete)
      const { error } = await serviceClient
        .from('coupons')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('❌ Failed to delete coupon:', error)
        throw new Error(error.message)
      }

      console.log('✅ Coupon deleted successfully:', id)
      return true
    } catch (error: any) {
      console.error('❌ Coupon deletion failed:', error)
      throw error
    }
  }

  /**
   * List coupons with filtering, sorting, and pagination
   */
  async listCoupons(request: CouponListRequest = {}): Promise<{
    coupons: Coupon[]
    total: number
    page: number
    totalPages: number
  }> {
    try {
      console.log('🎫 Listing coupons:', request)

      const serviceClient = this.getServiceClient()
      if (!serviceClient) {
        throw new Error('Service client not available')
      }

      const { page = 1, limit = 20, filters = {}, sort } = request
      const offset = (page - 1) * limit

      let query = serviceClient.from('coupons').select('*', { count: 'exact' })

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status)
      }
      if (filters.discountType) {
        query = query.eq('discount_type', filters.discountType)
      }
      if (filters.search) {
        query = query.or(`code.ilike.%${filters.search}%,name.ilike.%${filters.search}%`)
      }
      if (filters.createdBy) {
        query = query.eq('created_by', filters.createdBy)
      }
      if (filters.expiresAfter) {
        query = query.gte('expires_at', filters.expiresAfter.toISOString())
      }
      if (filters.expiresBefore) {
        query = query.lte('expires_at', filters.expiresBefore.toISOString())
      }

      // Apply sorting
      if (sort) {
        query = query.order(sort.field, { ascending: sort.direction === 'asc' })
      } else {
        query = query.order('created_at', { ascending: false })
      }

      // Apply pagination
      query = query.range(offset, offset + limit - 1)

      const { data, error, count } = await query

      if (error) {
        console.error('❌ Failed to list coupons:', error)
        throw new Error(error.message)
      }

      const coupons = (data || []).map(convertCouponRowToCoupon)
      const total = count || 0
      const totalPages = Math.ceil(total / limit)

      console.log('✅ Coupons listed successfully:', { total, page, totalPages })
      return { coupons, total, page, totalPages }
    } catch (error: any) {
      console.error('❌ Failed to list coupons:', error)
      throw error
    }
  }

  /**
   * Get coupon usage statistics (optimized with parallel queries)
   */
  async getCouponStatistics(): Promise<CouponStatistics> {
    try {
      console.log('📊 Getting coupon statistics')

      const serviceClient = this.getServiceClient()
      if (!serviceClient) {
        throw new Error('Service client not available')
      }

      // Execute all queries in parallel for better performance
      const [
        { data: totalData },
        { data: usageData },
        { data: topCouponsData }
      ] = await Promise.all([
        // Get coupon counts by status
        serviceClient
          .from('coupons')
          .select('status'),

        // Get usage statistics
        serviceClient
          .from('coupon_usage')
          .select('discount_amount'),

        // Get top coupons with usage count
        serviceClient
          .from('coupons')
          .select('id, code, name, current_usage_count')
          .order('current_usage_count', { ascending: false })
          .limit(5)
      ])

      // Calculate statistics from the data
      const totalCoupons = totalData?.length || 0
      const activeCoupons = totalData?.filter(c => c.status === 'active').length || 0
      const expiredCoupons = totalData?.filter(c => c.status === 'expired').length || 0

      const totalUsage = usageData?.length || 0
      const totalDiscountGiven = usageData?.reduce((sum, usage) => sum + usage.discount_amount, 0) || 0

      // For top coupons, we'll use the current_usage_count which is already calculated
      const topCoupons = (topCouponsData || []).map(coupon => ({
        id: coupon.id,
        code: coupon.code,
        name: coupon.name,
        usageCount: coupon.current_usage_count,
        totalDiscount: 0 // We'll calculate this separately if needed
      }))

      const statistics: CouponStatistics = {
        totalCoupons,
        activeCoupons,
        expiredCoupons,
        totalUsage,
        totalDiscountGiven,
        topCoupons
      }

      console.log('✅ Coupon statistics retrieved:', statistics)
      return statistics
    } catch (error: any) {
      console.error('❌ Failed to get coupon statistics:', error)
      throw error
    }
  }

  /**
   * Get coupon usage history
   */
  async getCouponUsageHistory(
    couponId?: string,
    userId?: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    usage: CouponUsage[]
    total: number
    page: number
    totalPages: number
  }> {
    try {
      console.log('📊 Getting coupon usage history:', { couponId, userId, page, limit })

      const serviceClient = this.getServiceClient()
      if (!serviceClient) {
        throw new Error('Service client not available')
      }

      const offset = (page - 1) * limit

      let query = serviceClient
        .from('coupon_usage')
        .select('*', { count: 'exact' })

      if (couponId) {
        query = query.eq('coupon_id', couponId)
      }
      if (userId) {
        query = query.eq('user_id', userId)
      }

      query = query
        .order('used_at', { ascending: false })
        .range(offset, offset + limit - 1)

      const { data, error, count } = await query

      if (error) {
        console.error('❌ Failed to get coupon usage history:', error)
        throw new Error(error.message)
      }

      const usage = (data || []).map(convertCouponUsageRowToCouponUsage)
      const total = count || 0
      const totalPages = Math.ceil(total / limit)

      console.log('✅ Coupon usage history retrieved:', { total, page, totalPages })
      return { usage, total, page, totalPages }
    } catch (error: any) {
      console.error('❌ Failed to get coupon usage history:', error)
      throw error
    }
  }

  /**
   * Get user's coupon usage count for a specific coupon
   */
  async getUserCouponUsageCount(couponId: string, userId: string): Promise<number> {
    try {
      const serviceClient = this.getServiceClient()
      if (!serviceClient) {
        throw new Error('Service client not available')
      }

      const { data, error } = await serviceClient
        .from('coupon_usage')
        .select('id')
        .eq('coupon_id', couponId)
        .eq('user_id', userId)

      if (error) {
        console.error('❌ Failed to get user coupon usage count:', error)
        return 0
      }

      return data?.length || 0
    } catch (error: any) {
      console.error('❌ Failed to get user coupon usage count:', error)
      return 0
    }
  }

  /**
   * Utility function to calculate discount amount
   */
  calculateDiscountAmount(discountType: 'percentage' | 'fixed_amount', discountValue: number, orderTotal: number): number {
    if (discountType === 'percentage') {
      return Math.round((orderTotal * (discountValue / 100)) * 100) / 100
    } else {
      return Math.min(discountValue, orderTotal)
    }
  }

  /**
   * Utility function to format discount value for display
   */
  formatDiscountValue(discountType: 'percentage' | 'fixed_amount', discountValue: number): string {
    if (discountType === 'percentage') {
      return `${discountValue}%`
    } else {
      return `$${discountValue.toFixed(2)}`
    }
  }

  /**
   * Check if a coupon is expired
   */
  isExpired(expiresAt?: Date): boolean {
    if (!expiresAt) return false
    return new Date() > expiresAt
  }

  /**
   * Check if a coupon is currently active
   */
  isActive(coupon: Coupon): boolean {
    const now = new Date()
    return (
      coupon.status === 'active' &&
      now >= coupon.startsAt &&
      (!coupon.expiresAt || now <= coupon.expiresAt)
    )
  }
}

// Export singleton instance
export const couponService = new CouponService()
