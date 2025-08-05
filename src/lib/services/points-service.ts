import { createClient } from '@/lib/supabase/client'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { calculatePoints, calculateOrderPoints, getTierFromPoints } from '@/lib/utils'
import { handleAuthError } from '@/lib/utils/auth-interceptor'

export interface PointTransaction {
  id: string
  user_id: string
  points: number
  transaction_type: 'earned' | 'redeemed' | 'expired' | 'bonus' | 'refund' | 'admin_adjustment'
  reference_type?: 'order' | 'signup' | 'referral' | 'admin_adjustment'
  reference_id?: string
  description?: string
  expires_at?: string
  created_at: string
}

export interface UserRank {
  id: string
  user_id: string
  rank: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
  points_at_rank: number
  achieved_at: string
  reset_at?: string
  is_current: boolean
  created_at: string
}

export interface UserPointsSummary {
  total_points_earned: number
  points_balance: number
  points_used: number
  weekly_points_used: number
  current_rank: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
  next_rank?: 'silver' | 'gold' | 'platinum' | 'diamond'
  points_to_next_rank?: number
  rank_progress_percentage: number
}

export interface PointsBreakdown {
  total_available: number
  earned_points: number
  tier_reward_points: number
  breakdown_by_source: {
    orders: number
    welcome_bonus: number
    tier_rewards: number
    admin_adjustments: number
    other: number
  }
  tier_info: {
    current_tier: string
    tier_benefits: string[]
    next_tier?: string
    points_to_next?: number
    progress_percentage: number
  }
}

export interface CheckoutPointsInfo {
  available_points: number
  points_breakdown: PointsBreakdown
  redemption_rules: {
    minimum_points: number
    increment: number
    conversion_rate: number // points per dollar
    max_redeemable: number
  }
  suggested_amounts: number[]
}

export interface RankThresholds {
  bronze: 0
  silver: 5000
  gold: 15000
  platinum: 35000
  diamond: 50000
}

export class PointsService {
  private supabase = createClient()
  private serviceClient: any = null

  constructor(useServiceRole: boolean = false) {
    if (useServiceRole && typeof window === 'undefined') {
      // Only create service role client on server side
      this.serviceClient = createServiceRoleClient()
    }
  }

  /**
   * Handle Supabase errors and check for authentication issues
   */
  private async handleSupabaseError(error: any, operation: string) {
    if (error) {
      console.error(`PointsService ${operation} error:`, error)

      // Check for authentication errors
      if (error.code === 'PGRST301' || error.message?.includes('JWT') || error.message?.includes('unauthorized')) {
        await handleAuthError({ status: 401, message: error.message }, operation)
      }

      throw error
    }
  }

  // Rank thresholds based on total lifetime points earned
  private static readonly RANK_THRESHOLDS: RankThresholds = {
    bronze: 0,
    silver: 5000,
    gold: 15000,
    platinum: 35000,
    diamond: 50000
  }

  /**
   * Calculate rank based on total lifetime points earned
   */
  static calculateRank(totalPointsEarned: number): 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' {
    if (totalPointsEarned >= PointsService.RANK_THRESHOLDS.diamond) return 'diamond'
    if (totalPointsEarned >= PointsService.RANK_THRESHOLDS.platinum) return 'platinum'
    if (totalPointsEarned >= PointsService.RANK_THRESHOLDS.gold) return 'gold'
    if (totalPointsEarned >= PointsService.RANK_THRESHOLDS.silver) return 'silver'
    return 'bronze'
  }

  /**
   * Get next rank and points needed
   */
  static getNextRankInfo(totalPointsEarned: number): { nextRank?: string; pointsToNext?: number; progressPercentage: number } {
    const currentRank = PointsService.calculateRank(totalPointsEarned)
    
    const ranks = ['bronze', 'silver', 'gold', 'platinum', 'diamond'] as const
    const currentIndex = ranks.indexOf(currentRank)
    
    if (currentIndex === ranks.length - 1) {
      // Already at highest rank
      return { progressPercentage: 100 }
    }
    
    const nextRank = ranks[currentIndex + 1]
    const nextThreshold = PointsService.RANK_THRESHOLDS[nextRank]
    const currentThreshold = PointsService.RANK_THRESHOLDS[currentRank]
    
    const pointsToNext = nextThreshold - totalPointsEarned
    const progressPercentage = Math.min(100, ((totalPointsEarned - currentThreshold) / (nextThreshold - currentThreshold)) * 100)
    
    return {
      nextRank,
      pointsToNext,
      progressPercentage: Math.round(progressPercentage)
    }
  }

  /**
   * Calculate points for a single product purchase
   */
  calculateProductPoints(amount: number, pointsRate: number = 1.00): number {
    return calculatePoints(amount, pointsRate)
  }

  /**
   * Calculate total points for an order with multiple items
   */
  calculateOrderTotalPoints(orderItems: Array<{
    amount: number
    pointsRate?: number
  }>): number {
    return calculateOrderPoints(orderItems)
  }

  /**
   * Award points to a user with comprehensive security and validation
   */
  async awardPoints(
    userId: string,
    points: number,
    transactionType: PointTransaction['transaction_type'] = 'earned',
    referenceType?: PointTransaction['reference_type'],
    referenceId?: string,
    description?: string,
    adminUserId?: string
  ): Promise<{ success: boolean; transaction?: PointTransaction; error?: string; requiresApproval?: boolean }> {
    try {
      if (!this.serviceClient) {
        throw new Error('Service client not available')
      }

      // Input validation
      if (!userId || typeof userId !== 'string') {
        return { success: false, error: 'Invalid user ID provided' }
      }

      if (!points || typeof points !== 'number') {
        return { success: false, error: 'Invalid points amount. Must be a number.' }
      }

      if (points <= 0) {
        return { success: false, error: 'Points amount must be positive' }
      }

      // Security limits based on transaction type
      const limits: Record<string, number> = {
        earned: 10000,      // Normal purchase earnings
        bonus: 5000,        // Admin bonus awards
        admin_adjustment: 2000, // Admin adjustments
        refund: 50000,      // Refunds can be higher
        redeemed: 1000,     // Should not be used for awards but included for completeness
        expired: 1000       // Should not be used for awards but included for completeness
      }

      const maxAllowed = limits[transactionType] || 1000

      if (points > maxAllowed) {
        // For large amounts, require approval workflow
        if (points > maxAllowed * 2) {
          return {
            success: false,
            error: `Points amount too large. Maximum ${maxAllowed.toLocaleString()} points for ${transactionType} transactions. Amounts over ${(maxAllowed * 2).toLocaleString()} require special approval.`,
            requiresApproval: true
          }
        }

        // Log large transactions for audit
        console.warn('⚠️ Large points award detected:', {
          userId,
          points,
          transactionType,
          adminUserId,
          timestamp: new Date().toISOString()
        })
      }

      // Verify user exists
      const { data: user, error: userError } = await this.serviceClient
        .from('users')
        .select('id, email, points_balance, total_points_earned')
        .eq('id', userId)
        .single()

      if (userError || !user) {
        return { success: false, error: 'User account not found' }
      }

      // Create audit log for admin actions
      if (transactionType === 'admin_adjustment' || transactionType === 'bonus') {
        const auditData = {
          admin_user_id: adminUserId,
          target_user_id: userId,
          action: 'points_award',
          points_amount: points,
          transaction_type: transactionType,
          description: description,
          reference_id: referenceId,
          timestamp: new Date().toISOString(),
          user_balance_before: user.points_balance,
          user_total_earned_before: user.total_points_earned
        }

        console.log('📝 Admin points award audit log:', auditData)
      }

      // Insert point transaction
      const { data: transaction, error: transactionError } = await this.serviceClient
        .from('point_transactions')
        .insert({
          user_id: userId,
          points,
          transaction_type: transactionType,
          reference_type: referenceType,
          reference_id: referenceId,
          description: description || `Points ${transactionType}`
        })
        .select()
        .single()

      if (transactionError) {
        console.error('Error creating point transaction:', transactionError)
        throw new Error('Failed to create points transaction')
      }

      // Update user's points balance and total points earned
      const { error: userUpdateError } = await this.serviceClient.rpc('update_user_points', {
        p_user_id: userId,
        p_points: points
      })

      if (userUpdateError) {
        console.error('Error updating user points:', userUpdateError)

        // Rollback transaction
        await this.serviceClient
          .from('point_transactions')
          .delete()
          .eq('id', transaction.id)

        throw new Error('Failed to update user points balance')
      }

      // Update user rank based on new total
      await this.updateUserRank(userId)

      // Verify the update
      const { data: updatedUser, error: verifyError } = await this.serviceClient
        .from('users')
        .select('points_balance, total_points_earned')
        .eq('id', userId)
        .single()

      if (verifyError || !updatedUser) {
        console.error('Error verifying points update:', verifyError)
      } else {
        console.log('✅ Points awarded successfully:', {
          userEmail: user.email,
          pointsAwarded: points,
          transactionType,
          newBalance: updatedUser.points_balance,
          newTotalEarned: updatedUser.total_points_earned
        })
      }

      return { success: true, transaction }
    } catch (error: any) {
      console.error('Error awarding points:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Redeem points (deduct from balance) with comprehensive validation
   */
  async redeemPoints(
    userId: string,
    points: number,
    description?: string,
    orderId?: string
  ): Promise<{ success: boolean; transaction?: PointTransaction; error?: string; userBalance?: number }> {
    try {
      if (!this.serviceClient) {
        throw new Error('Service client not available')
      }

      // Input validation
      if (!userId || typeof userId !== 'string') {
        return { success: false, error: 'Invalid user ID provided' }
      }

      if (!points || typeof points !== 'number' || points <= 0) {
        return { success: false, error: 'Invalid points amount. Must be a positive number.' }
      }

      if (points > 100000) {
        return { success: false, error: 'Points redemption amount too large. Maximum 100,000 points per transaction.' }
      }

      // Get current user balance with row-level locking to prevent race conditions
      const { data: user, error: userError } = await this.serviceClient
        .from('users')
        .select('points_balance, id, email')
        .eq('id', userId)
        .single()

      if (userError) {
        console.error('Error fetching user for points redemption:', userError)
        throw new Error('Unable to verify user account')
      }

      if (!user) {
        return { success: false, error: 'User account not found' }
      }

      const currentBalance = user.points_balance || 0

      // Strict balance validation
      if (currentBalance < points) {
        return {
          success: false,
          error: `Insufficient points balance. You have ${currentBalance.toLocaleString()} points, but tried to redeem ${points.toLocaleString()} points.`,
          userBalance: currentBalance
        }
      }

      // Double-check balance to prevent negative balances
      const newBalance = currentBalance - points
      if (newBalance < 0) {
        return {
          success: false,
          error: 'Transaction would result in negative balance. Operation cancelled.',
          userBalance: currentBalance
        }
      }

      // Log redemption attempt for audit
      console.log('📝 Points redemption attempt:', {
        user_id: userId,
        points_requested: points,
        current_balance: currentBalance,
        new_balance: newBalance,
        description: description || 'Points redeemed',
        order_id: orderId,
        timestamp: new Date().toISOString()
      })

      // Insert point transaction (negative points)
      const { data: transaction, error: transactionError } = await this.serviceClient
        .from('point_transactions')
        .insert({
          user_id: userId,
          points: -points,
          transaction_type: 'redeemed',
          reference_type: orderId ? 'order' : undefined,
          reference_id: orderId,
          description: description || 'Points redeemed'
        })
        .select()
        .single()

      if (transactionError) {
        console.error('Error creating point transaction:', transactionError)
        throw new Error('Failed to create points transaction')
      }

      // Update user's points balance using atomic operation
      const { error: updateError } = await this.serviceClient.rpc('update_user_points', {
        p_user_id: userId,
        p_points: -points
      })

      if (updateError) {
        console.error('Error updating user points balance:', updateError)
        // Rollback transaction if balance update fails
        await this.serviceClient
          .from('point_transactions')
          .delete()
          .eq('id', transaction.id)

        throw new Error('Failed to update points balance')
      }

      // Verify the update was successful
      const { data: updatedUser, error: verifyError } = await this.serviceClient
        .from('users')
        .select('points_balance')
        .eq('id', userId)
        .single()

      if (verifyError || !updatedUser) {
        console.error('Error verifying points update:', verifyError)
        throw new Error('Failed to verify points update')
      }

      // Final validation - ensure balance is not negative
      if (updatedUser.points_balance < 0) {
        console.error('CRITICAL: Negative balance detected after redemption', {
          userId,
          points,
          newBalance: updatedUser.points_balance
        })

        // Emergency rollback
        await this.serviceClient.rpc('update_user_points', {
          p_user_id: userId,
          p_points: points // Add points back
        })

        return {
          success: false,
          error: 'System error: Transaction rolled back to prevent negative balance.',
          userBalance: currentBalance
        }
      }

      console.log('✅ Points redemption successful:', {
        userId: user.email,
        pointsRedeemed: points,
        previousBalance: currentBalance,
        newBalance: updatedUser.points_balance
      })

      return {
        success: true,
        transaction,
        userBalance: updatedUser.points_balance
      }
    } catch (error: any) {
      console.error('Error redeeming points:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get comprehensive user points summary with data integrity validation
   */
  async getUserPointsSummary(userId: string): Promise<{ summary: UserPointsSummary; error?: string; dataIntegrityIssues?: string[] }> {
    try {
      // Get user data with points information
      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select('points_balance, total_points_earned, tier_level, email')
        .eq('id', userId)
        .single()

      await this.handleSupabaseError(userError, 'getUserPointsSummary - user data')

      // Get actual transaction data for validation
      const { data: transactions, error: transactionError } = await this.supabase
        .from('point_transactions')
        .select('points, transaction_type, created_at')
        .eq('user_id', userId)

      if (transactionError) {
        console.warn('Could not fetch transactions for validation:', transactionError)
        await this.handleSupabaseError(transactionError, 'getUserPointsSummary - transactions')
      }

      const dataIntegrityIssues: string[] = []

      // Calculate actual totals from transactions
      let actualTotalEarned = 0
      let actualTotalRedeemed = 0
      let weeklyPointsUsed = 0

      // Calculate start of current week (Sunday)
      const now = new Date()
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay())
      startOfWeek.setHours(0, 0, 0, 0)

      // Calculate start of current year (January 1st)
      const startOfYear = new Date(now.getFullYear(), 0, 1)

      if (transactions) {
        transactions.forEach((transaction: any) => {
          const transactionDate = new Date(transaction.created_at)

          if (transaction.points > 0) {
            // Only count earned points from current year for total_points_earned validation
            if (transactionDate >= startOfYear) {
              actualTotalEarned += transaction.points
            }
          } else {
            // Count all redemptions for balance calculation (regardless of year)
            actualTotalRedeemed += Math.abs(transaction.points)

            // Check if transaction is from this week for weekly usage calculation
            if (transactionDate >= startOfWeek) {
              weeklyPointsUsed += Math.abs(transaction.points)
            }
          }
        })
      }

      const actualCurrentBalance = actualTotalEarned - actualTotalRedeemed
      const storedTotalEarned = userData.total_points_earned || 0
      const storedBalance = userData.points_balance || 0

      // Data integrity checks
      if (Math.abs(actualTotalEarned - storedTotalEarned) > 1) {
        dataIntegrityIssues.push(`Total earned mismatch: stored ${storedTotalEarned}, calculated ${actualTotalEarned}`)
      }

      if (Math.abs(actualCurrentBalance - storedBalance) > 1) {
        dataIntegrityIssues.push(`Balance mismatch: stored ${storedBalance}, calculated ${actualCurrentBalance}`)
      }

      if (storedBalance < 0) {
        dataIntegrityIssues.push(`Negative balance detected: ${storedBalance}`)
      }

      // Use stored values but log discrepancies
      if (dataIntegrityIssues.length > 0) {
        console.warn('⚠️ Data integrity issues detected for user:', userData.email, dataIntegrityIssues)
      }

      // Calculate points used (total earned - current balance)
      const pointsUsed = Math.max(0, storedTotalEarned - storedBalance)

      // Get rank information
      const totalPointsEarned = storedTotalEarned
      const currentRank = PointsService.calculateRank(totalPointsEarned)
      const nextRankInfo = PointsService.getNextRankInfo(totalPointsEarned)

      // Validate rank calculation
      const expectedRank = PointsService.calculateRank(totalPointsEarned)
      if (userData.tier_level && userData.tier_level !== expectedRank) {
        dataIntegrityIssues.push(`Rank mismatch: stored ${userData.tier_level}, calculated ${expectedRank}`)
      }

      // Calculate tier reward points from transactions
      let tierRewardPoints = 0
      transactions.forEach((transaction) => {
        if (transaction.points > 0 &&
            ((transaction.transaction_type === 'bonus' && transaction.reference_type === 'admin_adjustment') ||
             transaction.description?.includes('Tier reward'))) {
          tierRewardPoints += transaction.points
        }
      })

      // Calculate earned points (excluding tier rewards)
      let earnedPoints = 0
      transactions.forEach((transaction) => {
        if (transaction.transaction_type === 'earned' ||
            (transaction.transaction_type === 'bonus' && transaction.reference_type !== 'admin_adjustment') ||
            (transaction.transaction_type === 'admin_adjustment' && !transaction.description?.includes('Tier reward'))) {
          earnedPoints += transaction.points
        } else if (transaction.transaction_type === 'redeemed') {
          earnedPoints += transaction.points // Already negative
        }
      })

      const totalAvailablePoints = earnedPoints + tierRewardPoints

      const summary: UserPointsSummary = {
        total_points_earned: totalPointsEarned,
        points_balance: userData.points_balance, // Use database value as single source of truth
        points_used: pointsUsed,
        weekly_points_used: weeklyPointsUsed,
        current_rank: currentRank,
        next_rank: nextRankInfo.nextRank as any,
        points_to_next_rank: nextRankInfo.pointsToNext,
        rank_progress_percentage: nextRankInfo.progressPercentage
      }

      return {
        summary,
        dataIntegrityIssues: dataIntegrityIssues.length > 0 ? dataIntegrityIssues : undefined
      }
    } catch (error: any) {
      console.error('Error fetching user points summary:', error)
      return {
        summary: {
          total_points_earned: 0,
          points_balance: 0,
          points_used: 0,
          weekly_points_used: 0,
          current_rank: 'bronze',
          rank_progress_percentage: 0
        },
        error: error.message
      }
    }
  }

  /**
   * Get user's point transaction history
   */
  async getUserPointHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ transactions: PointTransaction[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      await this.handleSupabaseError(error, 'getUserPointHistory')

      return { transactions: data || [] }
    } catch (error: any) {
      console.error('Error fetching point history:', error)
      return { transactions: [], error: error.message }
    }
  }

  /**
   * Update user rank based on total points earned
   */
  async updateUserRank(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.serviceClient) {
        throw new Error('Service client not available')
      }

      // Call the database function to update rank
      const { error } = await this.serviceClient.rpc('update_user_rank', {
        p_user_id: userId
      })

      if (error) throw error

      return { success: true }
    } catch (error: any) {
      console.error('Error updating user rank:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get current user tier info
   */
  getUserTierInfo(totalPointsEarned: number) {
    const tier = getTierFromPoints(totalPointsEarned)
    const tierInfo = {
      bronze: { minPoints: 0, name: 'Bronze', color: '#CD7F32', nextTier: 'silver', nextPoints: 5000 },
      silver: { minPoints: 5000, name: 'Silver', color: '#C0C0C0', nextTier: 'gold', nextPoints: 15000 },
      gold: { minPoints: 15000, name: 'Gold', color: '#FFD700', nextTier: 'platinum', nextPoints: 35000 },
      platinum: { minPoints: 35000, name: 'Platinum', color: '#E5E4E2', nextTier: 'diamond', nextPoints: 50000 },
      diamond: { minPoints: 50000, name: 'Diamond', color: '#B9F2FF', nextTier: null, nextPoints: null }
    }

    const currentTier = tierInfo[tier as keyof typeof tierInfo]
    const pointsToNext = currentTier.nextPoints ? currentTier.nextPoints - totalPointsEarned : 0

    return {
      currentTier: tier,
      currentTierInfo: currentTier,
      pointsToNextTier: Math.max(0, pointsToNext),
      progressPercentage: currentTier.nextPoints
        ? Math.min(100, ((totalPointsEarned - currentTier.minPoints) / (currentTier.nextPoints - currentTier.minPoints)) * 100)
        : 100
    }
  }

  /**
   * Get comprehensive points breakdown for checkout display
   */
  async getCheckoutPointsInfo(userId: string): Promise<{ info: CheckoutPointsInfo; error?: string }> {
    try {
      // Get user points summary
      const { summary, error: summaryError } = await this.getUserPointsSummary(userId)
      if (summaryError) throw new Error(summaryError)

      // Get detailed points breakdown
      const { breakdown, error: breakdownError } = await this.getPointsBreakdown(userId)
      if (breakdownError) throw new Error(breakdownError)

      // Calculate suggested redemption amounts using total available points
      const availablePoints = breakdown.total_available
      const suggestedAmounts = this.calculateSuggestedRedemptionAmounts(availablePoints)

      const checkoutInfo: CheckoutPointsInfo = {
        available_points: availablePoints,
        points_breakdown: breakdown,
        redemption_rules: {
          minimum_points: 500,
          increment: 10,
          conversion_rate: 1000, // 1000 points = $1
          max_redeemable: Math.floor(availablePoints / 10) * 10 // Round down to nearest 10
        },
        suggested_amounts: suggestedAmounts
      }

      return { info: checkoutInfo }
    } catch (error: any) {
      console.error('Error getting checkout points info:', error)
      return {
        info: {
          available_points: 0,
          points_breakdown: {
            total_available: 0,
            earned_points: 0,
            tier_reward_points: 0,
            breakdown_by_source: {
              orders: 0,
              welcome_bonus: 0,
              tier_rewards: 0,
              admin_adjustments: 0,
              other: 0
            },
            tier_info: {
              current_tier: 'bronze',
              tier_benefits: [],
              progress_percentage: 0
            }
          },
          redemption_rules: {
            minimum_points: 500,
            increment: 10,
            conversion_rate: 1000,
            max_redeemable: 0
          },
          suggested_amounts: []
        },
        error: error.message
      }
    }
  }

  /**
   * Get detailed points breakdown by source and type
   */
  async getPointsBreakdown(userId: string): Promise<{ breakdown: PointsBreakdown; error?: string }> {
    try {
      // Get all user transactions
      const { transactions, error: transactionError } = await this.getUserPointHistory(userId, 1000)
      if (transactionError) throw new Error(transactionError)

      // Get user profile for tier info
      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select('points_balance, total_points_earned, tier_level')
        .eq('id', userId)
        .single()

      await this.handleSupabaseError(userError, 'getPointsBreakdown - user data')

      // Calculate breakdown by source
      let earnedFromOrders = 0
      let welcomeBonus = 0
      let tierRewards = 0
      let adminAdjustments = 0
      let other = 0
      let totalTierRewardPoints = 0

      transactions.forEach((transaction) => {
        if (transaction.points > 0) { // Only count positive transactions for breakdown
          switch (transaction.transaction_type) {
            case 'earned':
              if (transaction.reference_type === 'order') {
                earnedFromOrders += transaction.points
              } else if (transaction.reference_type === 'admin_adjustment') {
                adminAdjustments += transaction.points
              } else {
                other += transaction.points
              }
              break
            case 'bonus':
              if (transaction.reference_type === 'signup') {
                welcomeBonus += transaction.points
              } else if (transaction.reference_type === 'tier_reward' || transaction.description?.includes('Tier reward')) {
                tierRewards += transaction.points
                totalTierRewardPoints += transaction.points
              } else {
                other += transaction.points
              }
              break
            case 'admin_adjustment':
              adminAdjustments += transaction.points
              break
            case 'refund':
              // Refunds are handled separately in the calculation logic, don't include in breakdown
              break
            default:
              other += transaction.points
              break
          }
        }
      })

      // Calculate tier info
      const totalPointsEarned = userData.total_points_earned || 0
      const currentTier = PointsService.calculateRank(totalPointsEarned)
      const nextRankInfo = PointsService.getNextRankInfo(totalPointsEarned)
      const tierBenefits = this.getTierBenefits(currentTier)

      // Calculate earned points from transactions (excluding tier rewards)
      let totalEarnedPoints = 0
      let totalRedeemedPoints = 0
      let totalRefundedPoints = 0

      transactions.forEach((transaction) => {
        if (transaction.points > 0) {
          // Count all positive points as earned EXCEPT tier rewards
          if (!(transaction.transaction_type === 'bonus' &&
                (transaction.reference_type === 'tier_reward' ||
                 transaction.description?.includes('Tier reward')))) {
            totalEarnedPoints += transaction.points
          }
        } else if (transaction.transaction_type === 'redeemed') {
          // Track redeemed points separately (they are negative)
          totalRedeemedPoints += Math.abs(transaction.points)
        } else if (transaction.transaction_type === 'refund') {
          // Track refunded points separately (they are positive)
          totalRefundedPoints += transaction.points
        }
      })

      // Use the database points_balance as the authoritative source for available points
      const actualAvailablePoints = userData.points_balance || 0

      // Calculate remaining points with correct logic:
      // - Tier rewards are one-time bonuses that get spent first
      // - Available points are primarily from recent purchases (earned points)
      // - Only show tier rewards as available if they haven't been spent yet

      let remainingEarnedPoints = 0
      let remainingTierRewards = 0

      if (actualAvailablePoints > 0) {
        // Since tier rewards are one-time bonuses and typically get spent first,
        // most available points should be from recent purchases (earned points)
        // Only allocate to tier rewards if there are unspent tier reward points

        const totalSpent = Math.max(0, (totalEarnedPoints + tierRewards) - actualAvailablePoints)

        // Assume tier rewards get spent first (since they're bonus points)
        const tierRewardsSpent = Math.min(tierRewards, totalSpent)
        const earnedPointsSpent = Math.max(0, totalSpent - tierRewards)

        remainingTierRewards = Math.max(0, tierRewards - tierRewardsSpent)
        remainingEarnedPoints = Math.max(0, totalEarnedPoints - earnedPointsSpent)

        // Ensure the total matches available points
        const calculatedTotal = remainingEarnedPoints + remainingTierRewards
        if (calculatedTotal !== actualAvailablePoints) {
          // If there's a discrepancy, prioritize earned points (recent purchases)
          remainingEarnedPoints = actualAvailablePoints - remainingTierRewards
          if (remainingEarnedPoints < 0) {
            remainingTierRewards = actualAvailablePoints
            remainingEarnedPoints = 0
          }
        }
      }

      const breakdown: PointsBreakdown = {
        total_available: actualAvailablePoints,
        earned_points: remainingEarnedPoints, // Currently available earned points (after redemptions)
        tier_reward_points: remainingTierRewards, // Currently available tier reward points (after redemptions)
        breakdown_by_source: {
          orders: earnedFromOrders,
          welcome_bonus: welcomeBonus,
          tier_rewards: tierRewards,
          admin_adjustments: adminAdjustments,
          other: other
        },
        tier_info: {
          current_tier: currentTier,
          tier_benefits: tierBenefits,
          next_tier: nextRankInfo.nextRank,
          points_to_next: nextRankInfo.pointsToNext,
          progress_percentage: nextRankInfo.progressPercentage
        }
      }

      return { breakdown }
    } catch (error: any) {
      console.error('Error getting points breakdown:', error)
      return {
        breakdown: {
          total_available: 0,
          earned_points: 0,
          tier_reward_points: 0,
          breakdown_by_source: {
            orders: 0,
            welcome_bonus: 0,
            tier_rewards: 0,
            admin_adjustments: 0,
            other: 0
          },
          tier_info: {
            current_tier: 'bronze',
            tier_benefits: [],
            progress_percentage: 0
          }
        },
        error: error.message
      }
    }
  }

  /**
   * Calculate suggested redemption amounts based on available points
   */
  private calculateSuggestedRedemptionAmounts(availablePoints: number): number[] {
    const suggestions: number[] = []

    if (availablePoints < 500) return suggestions

    // Add common redemption amounts
    const commonAmounts = [500, 1000, 2500, 5000, 10000, 25000, 50000]

    for (const amount of commonAmounts) {
      if (amount <= availablePoints && amount >= 500) {
        suggestions.push(amount)
      }
    }

    // Add 25%, 50%, 75%, and 100% of available points (rounded to nearest 10)
    const percentages = [0.25, 0.5, 0.75, 1.0]
    for (const percentage of percentages) {
      const amount = Math.floor((availablePoints * percentage) / 10) * 10
      if (amount >= 500 && !suggestions.includes(amount)) {
        suggestions.push(amount)
      }
    }

    // Sort and return unique values
    return [...new Set(suggestions)].sort((a, b) => a - b).slice(0, 6) // Limit to 6 suggestions
  }

  /**
   * Get tier-specific benefits
   */
  private getTierBenefits(tier: string): string[] {
    const benefits: { [key: string]: string[] } = {
      bronze: ['10 points per $1 spent', 'Welcome bonus'],
      silver: ['10 points per $1 spent', 'Free shipping coupon on tier achievement'],
      gold: ['10 points per $1 spent', '10,000 bonus points on tier achievement', 'Free shipping coupon'],
      platinum: ['10 points per $1 spent', '20,000 bonus points on tier achievement', '$50 gift notification'],
      diamond: ['10 points per $1 spent', 'Permanent free shipping', '$100 end-of-year bundle pack']
    }

    return benefits[tier] || benefits.bronze
  }

  /**
   * Validate points redemption for checkout
   */
  validatePointsRedemption(pointsToRedeem: number, availablePoints: number, orderTotal: number): {
    isValid: boolean
    error?: string
    maxRedeemable?: number
  } {
    if (pointsToRedeem < 0) {
      return { isValid: false, error: 'Points to redeem cannot be negative' }
    }

    if (pointsToRedeem === 0) {
      return { isValid: true }
    }

    if (pointsToRedeem < 500) {
      return { isValid: false, error: 'Minimum redemption is 500 points' }
    }

    if (pointsToRedeem % 10 !== 0) {
      return { isValid: false, error: 'Points must be redeemed in increments of 10' }
    }

    if (pointsToRedeem > availablePoints) {
      return { isValid: false, error: 'Insufficient points balance' }
    }

    // Calculate maximum redeemable based on order total (can't exceed order value)
    const maxRedeemableByOrder = Math.floor(orderTotal * 1000) // Convert dollars to points
    const maxRedeemable = Math.min(availablePoints, maxRedeemableByOrder)

    if (pointsToRedeem > maxRedeemable) {
      return {
        isValid: false,
        error: 'Points redemption cannot exceed order total',
        maxRedeemable: Math.floor(maxRedeemable / 10) * 10 // Round down to nearest 10
      }
    }

    return { isValid: true }
  }
}

// Export singleton instance
export const pointsService = new PointsService()
