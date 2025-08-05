'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { 
  Gift, 
  Award, 
  Star, 
  Truck, 
  Crown, 
  Gem,
  Calendar,
  CheckCircle,
  Clock,
  ExternalLink,
  Info
} from 'lucide-react'
import { TierRewardHistory } from '@/lib/services/tier-rewards-service'
import { getTierStyling, getTierFromPoints, formatPrice } from '@/lib/utils'
import { toast } from 'sonner'
import { authFetch } from '@/lib/utils/auth-interceptor'

interface TierRewardsDisplayProps {
  userId: string
  userProfile: any
}

interface TierInfo {
  current: string
  next: string | null
  currentPoints: number
  nextThreshold: number | null
  progress: number
}

const rewardTypeIcons = {
  points_bonus: Gift,
  free_shipping_coupon: Truck,
  gift_notification: Gift,
  permanent_free_shipping: Truck,
  exclusive_access: Crown
}

const rewardTypeNames = {
  points_bonus: 'Bonus Points',
  free_shipping_coupon: 'Free Shipping Coupon',
  gift_notification: 'Gift Reward',
  permanent_free_shipping: 'Permanent Free Shipping',
  exclusive_access: 'Exclusive Access'
}

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  awarded: 'bg-green-100 text-green-800 border-green-200',
  claimed: 'bg-blue-100 text-blue-800 border-blue-200',
  expired: 'bg-gray-100 text-gray-800 border-gray-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200'
}

export default function TierRewardsDisplay({ userId, userProfile }: TierRewardsDisplayProps) {
  const [rewards, setRewards] = useState<TierRewardHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [tierInfo, setTierInfo] = useState<TierInfo | null>(null)
  const [lastLoadedUserId, setLastLoadedUserId] = useState<string | null>(null)

  useEffect(() => {
    // Only load rewards if userId changed to prevent duplicate API calls
    if (userId && userId !== lastLoadedUserId) {
      console.log('🔄 TierRewardsDisplay: Loading rewards for new userId:', userId)
      loadRewards()
      setLastLoadedUserId(userId)
    }
  }, [userId, lastLoadedUserId])

  useEffect(() => {
    // Calculate tier info when userProfile changes
    if (userProfile) {
      calculateTierInfo()
    }
  }, [userProfile])

  const loadRewards = async () => {
    try {
      console.log('🔍 TierRewardsDisplay: Starting loadRewards for userId:', userId)

      // Check if we have a valid userId
      if (!userId) {
        console.log('❌ TierRewardsDisplay: No userId provided')
        return
      }

      const apiUrl = `/api/user/tier-rewards?userId=${userId}`
      console.log('📡 TierRewardsDisplay: Making API request to:', apiUrl)

      // Retry logic for development 404 errors (Next.js compilation issues)
      let response: Response;
      let lastError: Error | null = null;
      const maxRetries = 3;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          response = await authFetch(apiUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include' // Include cookies for authentication
          })

          console.log(`📡 TierRewardsDisplay: API response (attempt ${attempt}):`, {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers: Object.fromEntries(response.headers.entries())
          })

          // If successful or non-404 error, break out of retry loop
          if (response.ok || response.status !== 404) {
            break;
          }

          // If 404 and not last attempt, wait and retry
          if (response.status === 404 && attempt < maxRetries) {
            console.log(`🔄 Tier rewards API returned 404, retrying... (${attempt}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
            continue;
          }

          // If 404 on last attempt, throw error
          const errorData = await response.json().catch(() => ({}))
          console.log('❌ TierRewardsDisplay: API error response:', errorData)
          throw new Error(`Failed to fetch tier rewards: ${response.status} - ${errorData.error || response.statusText}`)
        } catch (error) {
          lastError = error as Error;
          if (attempt === maxRetries) {
            throw lastError;
          }
          console.log(`🔄 Tier rewards API error on attempt ${attempt}, retrying...`, error);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }

      if (!response!.ok) {
        const errorData = await response!.json().catch(() => ({}))
        console.log('❌ TierRewardsDisplay: API error response:', errorData)
        throw new Error(`Failed to fetch tier rewards: ${response!.status} - ${errorData.error || response!.statusText}`)
      }

      const data = await response.json()
      console.log('✅ TierRewardsDisplay: API success response:', {
        hasRewards: !!data.rewards,
        rewardsCount: data.rewards?.length || 0
      })

      setRewards(data.rewards || [])
    } catch (error) {
      console.error('❌ TierRewardsDisplay: Error loading tier rewards:', error)
      toast.error('Failed to load tier rewards')
    } finally {
      setLoading(false)
    }
  }

  const calculateTierInfo = () => {
    if (!userProfile) return

    const totalPointsEarned = userProfile.total_points_earned || 0
    const currentTier = getTierFromPoints(totalPointsEarned)
    
    const tierThresholds = {
      bronze: { next: 'silver', nextPoints: 5000 },
      silver: { next: 'gold', nextPoints: 15000 },
      gold: { next: 'platinum', nextPoints: 35000 },
      platinum: { next: 'diamond', nextPoints: 50000 },
      diamond: { next: null, nextPoints: null }
    }

    const currentTierInfo = tierThresholds[currentTier as keyof typeof tierThresholds]
    const progress = currentTierInfo.nextPoints 
      ? Math.min((totalPointsEarned / currentTierInfo.nextPoints) * 100, 100)
      : 100

    setTierInfo({
      current: currentTier,
      next: currentTierInfo.next,
      currentPoints: totalPointsEarned,
      nextThreshold: currentTierInfo.nextPoints,
      progress
    })
  }

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'diamond': return <Gem className="h-5 w-5" />
      case 'platinum': return <Crown className="h-5 w-5" />
      case 'gold': return <Award className="h-5 w-5" />
      case 'silver': return <Star className="h-5 w-5" />
      default: return <Star className="h-5 w-5" />
    }
  }

  const getRewardIcon = (rewardType: string) => {
    const IconComponent = rewardTypeIcons[rewardType as keyof typeof rewardTypeIcons] || Gift
    return <IconComponent className="h-4 w-4" />
  }

  const formatRewardValue = (reward: TierRewardHistory) => {
    switch (reward.reward_type) {
      case 'points_bonus':
        return `${reward.reward_value.toLocaleString()} points (${formatPrice(reward.reward_value / 1000)})`
      case 'gift_notification':
        return `$${reward.reward_value} gift ${reward.tier_level === 'diamond' ? 'bundle pack' : 'credit'}`
      case 'free_shipping_coupon':
        return 'Free shipping on next order'
      case 'permanent_free_shipping':
        return 'Free shipping on all future orders'
      case 'exclusive_access':
        return 'Access to exclusive deals and early releases'
      default:
        return reward.reward_description
    }
  }

  const handleRewardClick = (reward: TierRewardHistory) => {
    if (reward.coupon_code) {
      // Copy coupon code to clipboard
      navigator.clipboard.writeText(reward.coupon_code)
      toast.success(`Coupon code ${reward.coupon_code} copied to clipboard!`)
    } else if (reward.reward_type === 'gift_notification') {
      toast.info('Contact customer service to redeem your gift reward')
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Gift className="h-5 w-5" />
            <span>Tier Rewards</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Current Tier Status */}
      {tierInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              {getTierIcon(tierInfo.current)}
              <span>Current Tier Status</span>
            </CardTitle>
            <CardDescription>
              Your loyalty tier and progress to the next level
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getTierStyling(tierInfo.current).bgColor}`}>
                  {getTierIcon(tierInfo.current)}
                </div>
                <div>
                  <Badge className={getTierStyling(tierInfo.current).premiumBadgeClass || getTierStyling(tierInfo.current).badgeClass}>
                    {tierInfo.current.toUpperCase()} TIER
                  </Badge>
                  <p className="text-sm text-gray-600 mt-1">
                    {tierInfo.currentPoints.toLocaleString()} points earned
                  </p>
                </div>
              </div>
            </div>

            {tierInfo.next && tierInfo.nextThreshold && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress to {tierInfo.next.toUpperCase()}</span>
                  <span>{tierInfo.currentPoints.toLocaleString()} / {tierInfo.nextThreshold.toLocaleString()}</span>
                </div>
                <Progress value={tierInfo.progress} className="h-2" />
                <p className="text-xs text-gray-500">
                  {(tierInfo.nextThreshold - tierInfo.currentPoints).toLocaleString()} points to next tier
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tier Rewards History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Gift className="h-5 w-5 text-purple-500" />
            <span>Your Tier Rewards</span>
          </CardTitle>
          <CardDescription>
            Rewards you've earned for reaching loyalty tiers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rewards.length === 0 ? (
            <div className="text-center py-8">
              <Gift className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No tier rewards yet</p>
              <p className="text-sm text-gray-400">Keep earning points to unlock tier rewards!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {rewards.map((reward) => (
                <div
                  key={reward.id}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                    reward.coupon_code || reward.reward_type === 'gift_notification'
                      ? 'cursor-pointer hover:shadow-md hover:border-blue-300'
                      : ''
                  }`}
                  onClick={() => handleRewardClick(reward)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getTierStyling(reward.tier_level).bgColor}`}>
                        {getRewardIcon(reward.reward_type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <Badge className={getTierStyling(reward.tier_level).badgeClass}>
                            {reward.tier_level.toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className={statusColors[reward.status]}>
                            {reward.status.toUpperCase()}
                          </Badge>
                        </div>
                        <h4 className="font-medium text-gray-900">
                          {rewardTypeNames[reward.reward_type as keyof typeof rewardTypeNames]}
                        </h4>
                        <p className="text-sm text-gray-600 mb-2">
                          {formatRewardValue(reward)}
                        </p>
                        {reward.coupon_code && (
                          <div className="flex items-center space-x-2">
                            <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">
                              {reward.coupon_code}
                            </code>
                            <ExternalLink className="h-3 w-3 text-gray-400" />
                          </div>
                        )}
                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3" />
                            <span>Awarded {new Date(reward.awarded_at).toLocaleDateString()}</span>
                          </div>
                          {reward.expires_at && (
                            <div className="flex items-center space-x-1">
                              <Clock className="h-3 w-3" />
                              <span>Expires {new Date(reward.expires_at).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
