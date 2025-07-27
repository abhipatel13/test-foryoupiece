import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { getTierFromPoints } from '@/lib/utils'

export interface TierReward {
  id: string
  tier_level: string
  reward_type: 'points_bonus' | 'free_shipping_coupon' | 'gift_notification' | 'permanent_free_shipping' | 'exclusive_access'
  reward_value: number
  reward_description: string
  is_active: boolean
}

export interface TierRewardHistory {
  id: string
  user_id: string
  tier_level: string
  reward_type: string
  reward_value: number
  reward_description: string
  status: 'pending' | 'awarded' | 'claimed' | 'expired' | 'cancelled'
  coupon_id?: string
  coupon_code?: string
  point_transaction_id?: string
  awarded_at: string
  expires_at?: string
}

export interface TierUpgradeResult {
  success: boolean
  oldTier: string
  newTier: string
  rewardsAwarded: TierRewardHistory[]
  errors: string[]
}

export class TierRewardsService {
  private serviceClient: any

  constructor() {
    try {
      this.serviceClient = createServiceRoleClient()
      if (!this.serviceClient) {
        console.error('Failed to create service role client in TierRewardsService')
      }
    } catch (error) {
      console.error('Error initializing TierRewardsService:', error)
      this.serviceClient = null
    }
  }

  // Define tier rewards configuration
  private static TIER_REWARDS: Record<string, TierReward[]> = {
    silver: [
      {
        id: 'silver-free-shipping',
        tier_level: 'silver',
        reward_type: 'free_shipping_coupon',
        reward_value: 0,
        reward_description: 'Free shipping coupon for reaching Silver tier',
        is_active: true
      }
    ],
    gold: [
      {
        id: 'gold-points-bonus',
        tier_level: 'gold',
        reward_type: 'points_bonus',
        reward_value: 10000,
        reward_description: '10,000 bonus points for reaching Gold tier',
        is_active: true
      },
      {
        id: 'gold-free-shipping',
        tier_level: 'gold',
        reward_type: 'free_shipping_coupon',
        reward_value: 0,
        reward_description: 'Free shipping coupon for reaching Gold tier',
        is_active: true
      }
    ],
    platinum: [
      {
        id: 'platinum-points-bonus',
        tier_level: 'platinum',
        reward_type: 'points_bonus',
        reward_value: 20000,
        reward_description: '20,000 bonus points for reaching Platinum tier',
        is_active: true
      },
      {
        id: 'platinum-gift-notification',
        tier_level: 'platinum',
        reward_type: 'gift_notification',
        reward_value: 50,
        reward_description: '$50 gift notification for reaching Platinum tier',
        is_active: true
      }
    ],
    diamond: [
      {
        id: 'diamond-permanent-free-shipping',
        tier_level: 'diamond',
        reward_type: 'permanent_free_shipping',
        reward_value: 0,
        reward_description: 'Permanent free shipping privilege for Diamond tier',
        is_active: true
      },
      {
        id: 'diamond-gift-notification',
        tier_level: 'diamond',
        reward_type: 'gift_notification',
        reward_value: 100,
        reward_description: '$100 end-of-year bundle pack for Diamond tier',
        is_active: true
      },
      {
        id: 'diamond-exclusive-access',
        tier_level: 'diamond',
        reward_type: 'exclusive_access',
        reward_value: 0,
        reward_description: 'Access to exclusive deals for Diamond tier',
        is_active: true
      }
    ]
  }

  /**
   * Check for tier upgrades and award rewards
   */
  async checkAndAwardTierUpgrade(userId: string): Promise<TierUpgradeResult> {
    try {
      if (!this.serviceClient) {
        throw new Error('Service client not available')
      }

      // Get user's current data
      const { data: userData, error: userError } = await this.serviceClient
        .from('users')
        .select('id, tier_level, total_points_earned, points_balance')
        .eq('id', userId)
        .single()

      if (userError || !userData) {
        throw new Error(`Failed to get user data: ${userError?.message}`)
      }

      const oldTier = userData.tier_level || 'bronze'
      const newTier = getTierFromPoints(userData.total_points_earned || 0)

      // If no tier upgrade, return early
      if (newTier <= oldTier) {
        return {
          success: true,
          oldTier,
          newTier,
          rewardsAwarded: [],
          errors: []
        }
      }

      console.log(`🎉 Tier upgrade detected for user ${userId}: ${oldTier} → ${newTier}`)

      // Update user's tier
      const { error: updateError } = await this.serviceClient
        .from('users')
        .update({ 
          tier_level: newTier,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) {
        throw new Error(`Failed to update user tier: ${updateError.message}`)
      }

      // Award tier rewards
      const rewardsAwarded: TierRewardHistory[] = []
      const errors: string[] = []

      // Get rewards for the new tier
      const tierRewards = TierRewardsService.TIER_REWARDS[newTier] || []

      for (const reward of tierRewards) {
        try {
          const rewardResult = await this.awardTierReward(userId, reward)
          if (rewardResult) {
            rewardsAwarded.push(rewardResult)
          }
        } catch (error: any) {
          console.error(`Failed to award reward ${reward.id}:`, error)
          errors.push(`Failed to award ${reward.reward_description}: ${error.message}`)
        }
      }

      console.log(`✅ Tier upgrade complete: ${rewardsAwarded.length} rewards awarded, ${errors.length} errors`)

      // Create tier promotion notification
      try {
        await this.createTierPromotionNotification(userId, oldTier, newTier, rewardsAwarded)
      } catch (notificationError: any) {
        console.error('Failed to create tier promotion notification:', notificationError)
        errors.push(`Failed to create tier promotion notification: ${notificationError.message}`)
      }

      return {
        success: true,
        oldTier,
        newTier,
        rewardsAwarded,
        errors
      }

    } catch (error: any) {
      console.error('Error in checkAndAwardTierUpgrade:', error)
      return {
        success: false,
        oldTier: 'bronze',
        newTier: 'bronze',
        rewardsAwarded: [],
        errors: [error.message]
      }
    }
  }

  /**
   * Award bonus points to user (separate from tier ranking calculations)
   */
  private async awardPointsBonus(userId: string, reward: TierReward): Promise<string> {
    try {
      // Create points transaction for bonus points
      const { data: transaction, error: transactionError } = await this.serviceClient
        .from('point_transactions')
        .insert({
          user_id: userId,
          points: reward.reward_value,
          transaction_type: 'bonus',
          reference_type: 'tier_reward',
          description: `Tier reward: ${reward.reward_description}`
        })
        .select()
        .single()

      if (transactionError) {
        throw new Error(`Failed to create points transaction: ${transactionError.message}`)
      }

      // Update user's points balance (but NOT total_points_earned to avoid affecting tier calculations)
      const { error: updateError } = await this.serviceClient
        .rpc('update_user_points', {
          p_user_id: userId,
          p_points: reward.reward_value
        })

      if (updateError) {
        throw new Error(`Failed to update user points balance: ${updateError.message}`)
      }

      console.log(`💰 Awarded ${reward.reward_value} bonus points to user ${userId}`)
      return transaction.id

    } catch (error: any) {
      console.error('Error awarding points bonus:', error)
      throw error
    }
  }

  /**
   * Award a specific tier reward
   */
  private async awardTierReward(userId: string, reward: TierReward): Promise<TierRewardHistory | null> {
    try {
      // Check if user already received this reward
      const existingReward = await this.checkExistingReward(userId, reward.tier_level, reward.reward_type)
      if (existingReward) {
        console.log(`User ${userId} already has reward ${reward.id}`)
        return null
      }

      let couponId: string | null = null
      let couponCode: string | null = null
      let pointTransactionId: string | null = null

      // Process different reward types
      switch (reward.reward_type) {
        case 'points_bonus':
          pointTransactionId = await this.awardPointsBonus(userId, reward)
          break
        
        case 'free_shipping_coupon':
          const couponResult = await this.createFreeShippingCoupon(userId, reward)
          couponId = couponResult.couponId
          couponCode = couponResult.couponCode
          break
        
        case 'permanent_free_shipping':
          await this.enablePermanentFreeShipping(userId)
          break
        
        case 'gift_notification':
          await this.createGiftNotification(userId, reward)
          break

        case 'exclusive_access':
          await this.createExclusiveAccessNotification(userId, reward)
          break
        
        default:
          throw new Error(`Unknown reward type: ${reward.reward_type}`)
      }

      // Create reward history record in database
      const { data: rewardHistoryData, error: historyError } = await this.serviceClient
        .from('tier_reward_history')
        .insert({
          user_id: userId,
          tier_level: reward.tier_level,
          reward_type: reward.reward_type,
          reward_value: reward.reward_value,
          reward_description: reward.reward_description,
          status: 'awarded',
          coupon_id: couponId,
          point_transaction_id: pointTransactionId,
          awarded_at: new Date().toISOString()
        })
        .select()
        .single()

      if (historyError) {
        throw new Error(`Failed to create reward history: ${historyError.message}`)
      }

      const rewardHistory: TierRewardHistory = {
        id: rewardHistoryData.id,
        user_id: userId,
        tier_level: reward.tier_level,
        reward_type: reward.reward_type,
        reward_value: reward.reward_value,
        reward_description: reward.reward_description,
        status: 'awarded',
        coupon_id: couponId || undefined,
        coupon_code: couponCode || undefined,
        point_transaction_id: pointTransactionId || undefined,
        awarded_at: rewardHistoryData.awarded_at
      }

      console.log(`🎁 Awarded tier reward: ${reward.reward_description} to user ${userId}`)
      return rewardHistory

    } catch (error: any) {
      console.error(`Error awarding tier reward ${reward.id}:`, error)
      throw error
    }
  }

  /**
   * Create tier promotion notification
   */
  private async createTierPromotionNotification(
    userId: string,
    oldTier: string,
    newTier: string,
    rewardsAwarded: TierRewardHistory[]
  ): Promise<void> {
    try {
      if (!this.serviceClient) {
        throw new Error('Service client not available')
      }

      // Create tier promotion notification title and message
      const tierNames = {
        bronze: 'Bronze',
        silver: 'Silver',
        gold: 'Gold',
        platinum: 'Platinum',
        diamond: 'Diamond'
      }

      const tierEmojis = {
        bronze: '🥉',
        silver: '🥈',
        gold: '🥇',
        platinum: '💎',
        diamond: '💠'
      }

      const title = `🎉 Tier Promotion: Welcome to ${tierEmojis[newTier as keyof typeof tierEmojis]} ${tierNames[newTier as keyof typeof tierNames]} Tier!`

      // Build rewards summary
      let rewardsSummary = ''
      const pointsRewards = rewardsAwarded.filter(r => r.reward_type === 'points_bonus')
      const couponRewards = rewardsAwarded.filter(r => r.reward_type === 'free_shipping_coupon')
      const giftRewards = rewardsAwarded.filter(r => r.reward_type === 'gift_notification')
      const permanentShipping = rewardsAwarded.find(r => r.reward_type === 'permanent_free_shipping')
      const exclusiveAccess = rewardsAwarded.find(r => r.reward_type === 'exclusive_access')

      const rewards = []

      if (pointsRewards.length > 0) {
        const totalPoints = pointsRewards.reduce((sum, r) => sum + r.reward_value, 0)
        rewards.push(`💰 ${totalPoints.toLocaleString()} bonus points (worth $${(totalPoints / 1000).toFixed(2)})`)
      }

      if (couponRewards.length > 0) {
        rewards.push(`🚚 Free shipping coupon (valid for 1 year)`)
      }

      if (giftRewards.length > 0) {
        giftRewards.forEach(gift => {
          rewards.push(`🎁 $${gift.reward_value} gift ${gift.tier_level === 'diamond' ? 'bundle pack' : 'credit'}`)
        })
      }

      if (permanentShipping) {
        rewards.push(`🚚 Permanent free shipping on all orders`)
      }

      if (exclusiveAccess) {
        rewards.push(`⭐ Access to exclusive deals and early product releases`)
      }

      const message = `Congratulations! You've been promoted from ${tierNames[oldTier as keyof typeof tierNames]} to ${tierNames[newTier as keyof typeof tierNames]} tier!\n\n🎁 Your tier rewards:\n${rewards.map(r => `• ${r}`).join('\n')}\n\nThank you for being a valued Foryoupiece customer!`

      // Create notification
      const { error: notificationError } = await this.serviceClient
        .from('notifications')
        .insert({
          user_id: userId,
          title,
          message,
          type: 'success',
          metadata: {
            tier_promotion: true,
            old_tier: oldTier,
            new_tier: newTier,
            rewards_count: rewardsAwarded.length,
            rewards_awarded: rewardsAwarded.map(r => ({
              type: r.reward_type,
              value: r.reward_value,
              description: r.reward_description,
              coupon_code: r.coupon_code
            }))
          }
        })

      if (notificationError) {
        console.error('Failed to create tier promotion notification:', notificationError)
        throw new Error(`Failed to create notification: ${notificationError.message}`)
      }

      console.log(`✅ Created tier promotion notification for user ${userId}: ${oldTier} → ${newTier}`)

    } catch (error: any) {
      console.error('Error creating tier promotion notification:', error)
      throw error
    }
  }

  /**
   * Create gift notification
   */
  private async createGiftNotification(userId: string, reward: TierReward): Promise<void> {
    try {
      if (!this.serviceClient) {
        throw new Error('Service client not available')
      }

      const title = reward.tier_level === 'diamond'
        ? '🎁 Diamond Tier Gift: $100 End-of-Year Bundle Pack!'
        : '🎁 Platinum Tier Gift: $50 Gift Credit!'

      const message = reward.tier_level === 'diamond'
        ? `Congratulations on reaching Diamond tier! You've earned a special $100 end-of-year bundle pack that will be delivered at the end of the year. This exclusive package contains premium items curated just for our Diamond members.`
        : `Congratulations on reaching Platinum tier! You've earned a $50 gift credit that can be used towards any purchase. Contact our customer service to redeem your gift credit.`

      const { error: notificationError } = await this.serviceClient
        .from('notifications')
        .insert({
          user_id: userId,
          title,
          message,
          type: 'success',
          metadata: {
            gift_notification: true,
            tier_level: reward.tier_level,
            gift_value: reward.reward_value,
            reward_type: reward.reward_type
          }
        })

      if (notificationError) {
        console.error('Failed to create gift notification:', notificationError)
        throw new Error(`Failed to create gift notification: ${notificationError.message}`)
      }

      console.log(`✅ Created gift notification for user ${userId}: ${reward.reward_description}`)

    } catch (error: any) {
      console.error('Error creating gift notification:', error)
      throw error
    }
  }

  /**
   * Create exclusive access notification
   */
  private async createExclusiveAccessNotification(userId: string, reward: TierReward): Promise<void> {
    try {
      if (!this.serviceClient) {
        throw new Error('Service client not available')
      }

      const title = '⭐ Diamond Tier: Exclusive Access Unlocked!'
      const message = `Welcome to Diamond tier! You now have exclusive access to:\n\n• Early access to new product releases\n• Special Diamond-only deals and discounts\n• Priority customer support\n• Exclusive member-only events and promotions\n\nKeep an eye on your notifications for exclusive offers coming your way!`

      const { error: notificationError } = await this.serviceClient
        .from('notifications')
        .insert({
          user_id: userId,
          title,
          message,
          type: 'success',
          metadata: {
            exclusive_access: true,
            tier_level: reward.tier_level,
            reward_type: reward.reward_type
          }
        })

      if (notificationError) {
        console.error('Failed to create exclusive access notification:', notificationError)
        throw new Error(`Failed to create exclusive access notification: ${notificationError.message}`)
      }

      console.log(`✅ Created exclusive access notification for user ${userId}: ${reward.reward_description}`)

    } catch (error: any) {
      console.error('Error creating exclusive access notification:', error)
      throw error
    }
  }

  /**
   * Check if user already has a specific reward
   */
  private async checkExistingReward(userId: string, tierLevel: string, rewardType: string): Promise<boolean> {
    try {
      const { data, error } = await this.serviceClient
        .from('tier_reward_history')
        .select('id')
        .eq('user_id', userId)
        .eq('tier_level', tierLevel)
        .eq('reward_type', rewardType)
        .in('status', ['awarded', 'claimed'])
        .limit(1)

      if (error) {
        console.error('Error checking existing reward:', error)
        return false
      }

      return data && data.length > 0
    } catch (error) {
      console.error('Error in checkExistingReward:', error)
      return false
    }
  }

  /**
   * Get user's tier rewards history from database
   */
  async getUserTierRewards(userId: string): Promise<TierRewardHistory[]> {
    try {
      // Check if service client is available
      if (!this.serviceClient) {
        console.error('Service client not available in getUserTierRewards')
        return []
      }

      const { data, error } = await this.serviceClient
        .from('tier_reward_history')
        .select(`
          id,
          tier_level,
          reward_type,
          reward_value,
          reward_description,
          status,
          awarded_at,
          expires_at,
          coupons!tier_reward_history_coupon_id_fkey (
            code
          )
        `)
        .eq('user_id', userId)
        .order('awarded_at', { ascending: false })

      if (error) {
        console.error('Error fetching user tier rewards:', error)
        return []
      }

      return (data || []).map(reward => ({
        id: reward.id,
        user_id: userId,
        tier_level: reward.tier_level,
        reward_type: reward.reward_type,
        reward_value: reward.reward_value || 0,
        reward_description: reward.reward_description,
        status: reward.status,
        coupon_code: (reward.coupons && typeof reward.coupons === 'object' && 'code' in reward.coupons) ? reward.coupons.code : undefined,
        awarded_at: reward.awarded_at,
        expires_at: reward.expires_at
      }))

    } catch (error: any) {
      console.error('Error in getUserTierRewards:', error)
      return []
    }
  }

}
