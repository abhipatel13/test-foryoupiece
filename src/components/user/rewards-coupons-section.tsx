'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Info,
  Copy,
  Eye,
  EyeOff,
  Ticket
} from 'lucide-react'
import { TierRewardHistory } from '@/lib/services/tier-rewards-service'
import { getTierStyling, getTierFromPoints, formatPrice } from '@/lib/utils'
import { toast } from 'sonner'
import { authFetch } from '@/lib/utils/auth-interceptor'

interface RewardsCouponsProps {
  userId?: string
  userProfile?: any
}

interface UserCoupon {
  id: string
  code: string
  name: string
  description?: string
  discount_type: string
  discount_value: number
  expires_at?: string
  status: string
  usage_count: number
  per_user_usage_limit?: number
  total_usage_limit?: number
  current_usage_count?: number
  metadata?: any
}

export function RewardsCouponsSection({ userId, userProfile }: RewardsCouponsProps) {
  const [rewards, setRewards] = useState<TierRewardHistory[]>([])
  const [coupons, setCoupons] = useState<UserCoupon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCouponCodes, setShowCouponCodes] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (userId) {
      fetchRewardsAndCoupons()
    }
  }, [userId])

  const fetchRewardsAndCoupons = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch tier rewards (must include userId for authorization)
      const rewardsResponse = await authFetch(`/api/user/tier-rewards?userId=${userId}`)
      if (!rewardsResponse.ok) {
        throw new Error('Failed to fetch tier rewards')
      }
      const rewardsData = await rewardsResponse.json()
      setRewards(rewardsData.rewards || [])

      // Fetch user coupons
      const couponsResponse = await authFetch('/api/user/coupons')
      if (!couponsResponse.ok) {
        throw new Error('Failed to fetch user coupons')
      }
      const couponsData = await couponsResponse.json()
      setCoupons(couponsData.coupons || [])

    } catch (error: any) {
      // Capture in Sentry via global instrumentation; avoid noisy console
      setError(error.message || 'Failed to load rewards and coupons')
    } finally {
      setLoading(false)
    }
  }

  const calculateTierInfo = () => {
    if (!userProfile) return null

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

    return {
      current: currentTier,
      next: currentTierInfo.next,
      progress,
      pointsToNext: currentTierInfo.nextPoints ? Math.max(0, currentTierInfo.nextPoints - totalPointsEarned) : 0,
      totalPoints: totalPointsEarned
    }
  }

  const getTierIcon = (tier: string) => {
    const icons = {
      bronze: <Award className="h-5 w-5 text-amber-600" />,
      silver: <Star className="h-5 w-5 text-gray-500" />,
      gold: <Crown className="h-5 w-5 text-yellow-500" />,
      platinum: <Gem className="h-5 w-5 text-purple-500" />,
      diamond: <Gem className="h-5 w-5 text-blue-500" />
    }
    return icons[tier as keyof typeof icons] || icons.bronze
  }

  const getRewardIcon = (rewardType: string) => {
    const icons = {
      points_bonus: <Gift className="h-4 w-4 text-green-500" />,
      free_shipping_coupon: <Truck className="h-4 w-4 text-blue-500" />,
      gift_notification: <Gift className="h-4 w-4 text-purple-500" />,
      permanent_free_shipping: <Truck className="h-4 w-4 text-green-600" />,
      exclusive_access: <Star className="h-4 w-4 text-gold-500" />
    }
    return icons[rewardType as keyof typeof icons] || <Gift className="h-4 w-4" />
  }

  const formatRewardValue = (reward: TierRewardHistory) => {
    switch (reward.reward_type) {
      case 'points_bonus':
        return `${reward.reward_value.toLocaleString()} bonus points (worth $${(reward.reward_value / 1000).toFixed(2)})`
      case 'free_shipping_coupon':
        return 'Free shipping on your next order'
      case 'gift_notification':
        return `$${reward.reward_value} gift ${reward.tier_level === 'diamond' ? 'bundle pack' : 'credit'}`
      case 'permanent_free_shipping':
        return 'Free shipping on all future orders'
      case 'exclusive_access':
        return 'Access to exclusive deals and early releases'
      default:
        return reward.reward_description
    }
  }

  const formatDiscountValue = (coupon: UserCoupon) => {
    switch (coupon.discount_type) {
      case 'percentage':
        return `${coupon.discount_value}% off`
      case 'fixed_amount':
        return `$${coupon.discount_value.toFixed(2)} off`
      case 'free_shipping':
        return 'Free shipping'
      default:
        return `${coupon.discount_value} discount`
    }
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied to clipboard!`)
    } catch (error) {
      toast.error('Failed to copy to clipboard')
    }
  }

  const toggleCouponCodeVisibility = (couponId: string) => {
    setShowCouponCodes(prev => ({
      ...prev,
      [couponId]: !prev[couponId]
    }))
  }

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false
    return new Date(expiresAt) < new Date()
  }

  const isExpiringSoon = (expiresAt?: string) => {
    if (!expiresAt) return false
    const expiryDate = new Date(expiresAt)
    const now = new Date()
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0
  }

  // Enhanced coupon status checking
  const getCouponStatus = (coupon: UserCoupon) => {
    // First check the API status - this is the source of truth
    if (coupon.status === 'expired' || coupon.status === 'inactive') {
      return 'expired'
    }

    // Check if usage limit has been reached
    const actualUsageCount = coupon.current_usage_count || coupon.usage_count || 0
    if (coupon.per_user_usage_limit && actualUsageCount >= coupon.per_user_usage_limit) {
      return 'used_up'
    }

    // Check time-based expiration
    if (isExpired(coupon.expires_at)) {
      return 'expired'
    }

    // Check if expiring soon
    if (isExpiringSoon(coupon.expires_at)) {
      return 'expiring_soon'
    }

    return 'active'
  }

  const tierInfo = calculateTierInfo()

  const statusColors = {
    pending: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    awarded: 'text-green-600 bg-green-50 border-green-200',
    claimed: 'text-blue-600 bg-blue-50 border-blue-200',
    expired: 'text-gray-600 bg-gray-50 border-gray-200',
    cancelled: 'text-red-600 bg-red-50 border-red-200'
  }

  const rewardTypeNames = {
    points_bonus: 'Bonus Points',
    free_shipping_coupon: 'Free Shipping Coupon',
    gift_notification: 'Gift Reward',
    permanent_free_shipping: 'Permanent Free Shipping',
    exclusive_access: 'Exclusive Access'
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Gift className="h-5 w-5 text-purple-500" />
            <span>Rewards & Coupons</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Gift className="h-5 w-5 text-purple-500" />
            <span>Rewards & Coupons</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={fetchRewardsAndCoupons} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2">
          <Gift className="h-5 w-5 text-purple-500" />
          <span>Rewards & Coupons</span>
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Your tier rewards, active coupons, and loyalty benefits
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="coupons" className="w-full">
          <TabsList
            className="w-full flex flex-wrap items-stretch gap-2 p-1 h-auto overflow-visible justify-start"
            aria-label="Rewards and coupons tabs"
          >
            <TabsTrigger value="overview" className="min-h-[44px] h-auto px-3 sm:px-4 text-xs sm:text-sm leading-5 text-center whitespace-normal w-1/2 min-w-0 grow-0 sm:w-auto sm:whitespace-nowrap">Overview</TabsTrigger>
            <TabsTrigger value="rewards" className="min-h-[44px] h-auto px-3 sm:px-4 text-xs sm:text-sm leading-5 text-center whitespace-normal w-1/2 min-w-0 grow-0 sm:w-auto sm:whitespace-nowrap">Tier Rewards</TabsTrigger>
            <TabsTrigger value="coupons" className="min-h-[44px] h-auto px-3 sm:px-4 text-xs sm:text-sm leading-5 text-center whitespace-normal w-1/2 min-w-0 grow-0 sm:w-auto sm:whitespace-nowrap">Coupons</TabsTrigger>
            <TabsTrigger value="progress" className="min-h-[44px] h-auto px-3 sm:px-4 text-xs sm:text-sm leading-5 text-center whitespace-normal w-1/2 min-w-0 grow-0 sm:w-auto sm:whitespace-nowrap">Progress</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 focus:outline-none">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Current Tier Status */}
              {tierInfo && (
                <div className="p-4 sm:p-5 border rounded-lg">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getTierStyling(tierInfo.current).bgColor}`}>
                      {getTierIcon(tierInfo.current)}
                    </div>
                    <div>
                      <Badge className={getTierStyling(tierInfo.current).badgeClass}>
                        {tierInfo.current.toUpperCase()}
                      </Badge>
                      <p className="text-sm text-gray-600 mt-1">Current Tier</p>
                    </div>
                  </div>
                  {tierInfo.next && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress to {tierInfo.next}</span>
                        <span>{tierInfo.pointsToNext.toLocaleString()} points to go</span>
                      </div>
                      <Progress value={tierInfo.progress} className="h-2" />
                    </div>
                  )}
                </div>
              )}

              {/* Quick Stats */}
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-3">Quick Stats</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Active Rewards</span>
                    <span className="font-medium">{rewards.filter(r => r.status === 'awarded').length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Available Coupons</span>
                    <span className="font-medium">{coupons.filter(c => getCouponStatus(c) === 'active').length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Total Points Earned</span>
                    <span className="font-medium">{tierInfo?.totalPoints.toLocaleString() || '0'}</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="rewards" className="space-y-4">
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
                    className="p-4 rounded-lg border-2 transition-all duration-200"
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
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(reward.coupon_code!, 'Coupon code')}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                          {reward.expires_at && (
                            <div className="flex items-center space-x-1 mt-2">
                              <Calendar className="h-3 w-3 text-gray-400" />
                              <span className="text-xs text-gray-500">
                                Expires: {new Date(reward.expires_at).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="coupons" className="space-y-4">
            {coupons.length === 0 ? (
              <div className="text-center py-8">
                <Ticket className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No coupons available</p>
                <p className="text-sm text-gray-400">Coupons will appear here when you earn them!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {coupons.map((coupon) => {
                  const couponStatus = getCouponStatus(coupon)
                  const showCode = showCouponCodes[coupon.id]

                  // Determine styling based on status
                  const getStatusStyling = (status: string) => {
                    switch (status) {
                      case 'expired':
                        return {
                          containerClass: 'opacity-60 border-gray-300 bg-gray-50',
                          badgeVariant: 'secondary' as const,
                          badgeText: 'EXPIRED',
                          icon: <Clock className="h-3 w-3" />
                        }
                      case 'used_up':
                        return {
                          containerClass: 'opacity-60 border-gray-300 bg-gray-50',
                          badgeVariant: 'secondary' as const,
                          badgeText: 'USED',
                          icon: <CheckCircle className="h-3 w-3" />
                        }
                      case 'expiring_soon':
                        return {
                          containerClass: 'border-yellow-300 bg-yellow-50',
                          badgeVariant: 'destructive' as const,
                          badgeText: 'EXPIRES SOON',
                          icon: <Clock className="h-3 w-3" />
                        }
                      default:
                        return {
                          containerClass: 'border-green-200 bg-green-50',
                          badgeVariant: 'default' as const,
                          badgeText: 'ACTIVE',
                          icon: <Ticket className="h-3 w-3" />
                        }
                    }
                  }

                  const styling = getStatusStyling(couponStatus)

                  return (
                    <div
                      key={coupon.id}
                      className={`p-4 rounded-lg border-2 transition-all duration-200 ${styling.containerClass}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h4 className="font-medium text-gray-900">{coupon.name}</h4>
                            <Badge variant={styling.badgeVariant} className="flex items-center space-x-1">
                              {styling.icon}
                              <span>{styling.badgeText}</span>
                            </Badge>
                          </div>

                          <p className="text-sm text-gray-600 mb-3">
                            {formatDiscountValue(coupon)}
                          </p>

                          {coupon.description && (
                            <p className="text-xs text-gray-500 mb-3">{coupon.description}</p>
                          )}

                          <div className="flex items-center space-x-4 mb-3">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-500">Code:</span>
                              <div className="flex items-center space-x-2">
                                <code className={`px-2 py-1 bg-white rounded text-sm font-mono border ${
                                  showCode ? '' : 'blur-sm select-none'
                                } ${
                                  couponStatus === 'expired' || couponStatus === 'used_up' ? 'opacity-50' : ''
                                }`}>
                                  {showCode ? coupon.code : '••••••••'}
                                </code>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => toggleCouponCodeVisibility(coupon.id)}
                                  disabled={couponStatus === 'expired' || couponStatus === 'used_up'}
                                >
                                  {showCode ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                </Button>
                                {showCode && couponStatus !== 'expired' && couponStatus !== 'used_up' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => copyToClipboard(coupon.code, 'Coupon code')}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <div className="flex items-center space-x-4">
                              {coupon.expires_at && (
                                <div className="flex items-center space-x-1">
                                  <Calendar className="h-3 w-3" />
                                  <span>Expires: {new Date(coupon.expires_at).toLocaleDateString()}</span>
                                </div>
                              )}
                              {coupon.per_user_usage_limit && (
                                <div className="flex items-center space-x-1">
                                  <Info className="h-3 w-3" />
                                  <span>Used: {coupon.current_usage_count || coupon.usage_count || 0}/{coupon.per_user_usage_limit}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="progress" className="space-y-4">
            {tierInfo && (
              <div className="space-y-6">
                {/* Current Progress */}
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-4">Tier Progress</h4>
                  <div className="space-y-4">
                    {['bronze', 'silver', 'gold', 'platinum', 'diamond'].map((tier, index) => {
                      const thresholds = [0, 5000, 15000, 35000, 50000]
                      const isCurrentTier = tier === tierInfo.current
                      const isCompleted = tierInfo.totalPoints >= thresholds[index]
                      const isNext = tier === tierInfo.next

                      return (
                        <div key={tier} className="flex items-center space-x-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            isCompleted ? getTierStyling(tier).bgColor : 'bg-gray-100'
                          }`}>
                            {isCompleted ? (
                              getTierIcon(tier)
                            ) : (
                              <div className="w-2 h-2 rounded-full bg-gray-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className={`font-medium ${isCurrentTier ? 'text-blue-600' : ''}`}>
                                {tier.charAt(0).toUpperCase() + tier.slice(1)}
                              </span>
                              {isCurrentTier && <Badge variant="default">Current</Badge>}
                              {isNext && <Badge variant="outline">Next</Badge>}
                            </div>
                            <div className="text-sm text-gray-500">
                              {thresholds[index].toLocaleString()} points required
                            </div>
                          </div>
                          <div className="text-right">
                            {isCompleted ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                              <Clock className="h-5 w-5 text-gray-400" />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Next Tier Benefits */}
                {tierInfo.next && (
                  <div className="p-4 border rounded-lg bg-blue-50">
                    <h4 className="font-medium mb-2">Next Tier Benefits</h4>
                    <p className="text-sm text-gray-600 mb-3">
                      Reach {tierInfo.next} tier with {tierInfo.pointsToNext.toLocaleString()} more points to unlock:
                    </p>
                    <ul className="text-sm space-y-1">
                      {tierInfo.next === 'silver' && (
                        <li className="flex items-center space-x-2">
                          <Truck className="h-4 w-4 text-blue-500" />
                          <span>Free shipping coupon</span>
                        </li>
                      )}
                      {tierInfo.next === 'gold' && (
                        <>
                          <li className="flex items-center space-x-2">
                            <Gift className="h-4 w-4 text-green-500" />
                            <span>10,000 bonus points</span>
                          </li>
                          <li className="flex items-center space-x-2">
                            <Truck className="h-4 w-4 text-blue-500" />
                            <span>Free shipping coupon</span>
                          </li>
                        </>
                      )}
                      {tierInfo.next === 'platinum' && (
                        <>
                          <li className="flex items-center space-x-2">
                            <Gift className="h-4 w-4 text-green-500" />
                            <span>20,000 bonus points</span>
                          </li>
                          <li className="flex items-center space-x-2">
                            <Gift className="h-4 w-4 text-purple-500" />
                            <span>$50 gift credit</span>
                          </li>
                        </>
                      )}
                      {tierInfo.next === 'diamond' && (
                        <>
                          <li className="flex items-center space-x-2">
                            <Truck className="h-4 w-4 text-green-600" />
                            <span>Permanent free shipping</span>
                          </li>
                          <li className="flex items-center space-x-2">
                            <Gift className="h-4 w-4 text-purple-500" />
                            <span>$100 end-of-year bundle pack</span>
                          </li>
                          <li className="flex items-center space-x-2">
                            <Star className="h-4 w-4 text-gold-500" />
                            <span>Exclusive access to deals</span>
                          </li>
                        </>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
