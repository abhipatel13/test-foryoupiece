'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Star,
  Trophy,
  Gift,
  Coins,
  TrendingUp,
  Award,
  Crown,
  Gem,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react'
import { PointsService, PointsBreakdown } from '@/lib/services/points-service'
import { formatPrice } from '@/lib/utils'
import { requestUtils } from '@/lib/utils/request-deduplication'

interface PointsBreakdownProps {
  userId: string
  variant?: 'full' | 'compact' | 'header'
  showTierProgress?: boolean
  className?: string
}

const tierIcons = {
  bronze: '🥉',
  silver: '🥈', 
  gold: '🥇',
  platinum: '🏆',
  diamond: '💎'
}

const tierColors = {
  bronze: 'text-amber-600 bg-amber-50 border-amber-200',
  silver: 'text-gray-600 bg-gray-50 border-gray-200',
  gold: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  platinum: 'text-purple-600 bg-purple-50 border-purple-200',
  diamond: 'text-blue-600 bg-blue-50 border-blue-200'
}

export function PointsBreakdownComponent({
  userId,
  variant = 'full',
  showTierProgress = true,
  className = ''
}: PointsBreakdownProps) {
  const [pointsBreakdown, setPointsBreakdown] = useState<PointsBreakdown | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(variant === 'full')
  const [lastLoadedUserId, setLastLoadedUserId] = useState<string | null>(null)

  // Memoize the points service to prevent recreation
  const pointsService = useMemo(() => new PointsService(), [])

  useEffect(() => {
    // Only load points breakdown if userId changed to prevent duplicate API calls
    if (userId && userId !== lastLoadedUserId) {
      console.log('🔄 PointsBreakdownComponent: Loading points for new userId:', userId)
      loadPointsBreakdown()
      setLastLoadedUserId(userId)
    }
  }, [userId, lastLoadedUserId])

  const loadPointsBreakdown = async () => {
    try {
      setLoading(true)
      setError(null)

      // Use cached request deduplication for better performance
      const breakdown = await requestUtils.fetchPointsBreakdown(userId)
      setPointsBreakdown(breakdown)
    } catch (err: any) {
      console.error('Error loading points breakdown:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Enhanced loading state with skeleton UI
  if (loading) {
    if (variant === 'header') {
      return (
        <div className={`space-y-2 ${className}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3 w-16" />
        </div>
      )
    }

    if (variant === 'compact') {
      return (
        <Card className={className}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-5 w-24" />
              </div>
              <Skeleton className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          </CardContent>
        </Card>
      )
    }

    // Full variant skeleton
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-6 w-32" />
          </div>
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
            <div className="space-y-4">
              <Skeleton className="h-10 w-24" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Skeleton className="h-16 rounded-lg" />
                <Skeleton className="h-16 rounded-lg" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !pointsBreakdown) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="text-center text-gray-500">
            <Star className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Unable to load points information</p>
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
        </CardContent>
      </Card>
    )
  }

  const { tier_info } = pointsBreakdown
  const tierColor = tierColors[tier_info.current_tier as keyof typeof tierColors] || tierColors.bronze

  // Compact variant for header dropdown
  if (variant === 'header') {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Star className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">
              {pointsBreakdown.total_available.toLocaleString()} points
            </span>
          </div>
          <Badge variant="outline" className={`text-xs ${tierColor}`}>
            {tier_info.current_tier.toUpperCase()}
          </Badge>
        </div>
        <div className="text-xs text-gray-600">
          Worth {formatPrice(pointsBreakdown.total_available / 1000)}
        </div>

        {/* Available Balance Allocation (sums to available) */}
        <div className="space-y-1 pt-1 border-t border-gray-100">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Available from Purchases:</span>
            <span className="font-medium text-green-600">
              {Math.max(0, pointsBreakdown.available_by_type?.earned ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Available from Tier Rewards:</span>
            <span className="font-medium text-blue-600">
              {Math.max(0, pointsBreakdown.available_by_type?.tier_rewards ?? 0).toLocaleString()}
            </span>
          </div>
        </div>

        {tier_info.next_tier && tier_info.points_to_next && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>To {tier_info.next_tier.toUpperCase()}</span>
              <span>{tier_info.points_to_next.toLocaleString()} pts</span>
            </div>
            <Progress value={tier_info.progress_percentage} className="h-1" />
          </div>
        )}
      </div>
    )
  }

  // Compact variant for cards
  if (variant === 'compact') {
    return (
      <TooltipProvider>
        <Card className={className}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Coins className="h-5 w-5 text-blue-500" />
                <span className="font-semibold">Points Balance</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                className="h-6 px-2"
              >
                {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {pointsBreakdown.total_available.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">
                    Worth {formatPrice(pointsBreakdown.total_available / 1000)}
                  </div>
                </div>
                <Badge variant="outline" className={tierColor}>
                  {tierIcons[tier_info.current_tier as keyof typeof tierIcons]} {tier_info.current_tier.toUpperCase()}
                </Badge>
              </div>

              {showDetails && (
                <div className="space-y-3 pt-3 border-t border-gray-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex justify-between cursor-help">
                          <span className="text-gray-600 flex items-center">
                            Earned Points
                            <HelpCircle className="h-3 w-3 ml-1" />
                          </span>
                          <span className="font-medium">{Math.max(0, pointsBreakdown.available_by_type?.earned ?? 0).toLocaleString()}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Points earned from purchases and activities</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex justify-between cursor-help">
                          <span className="text-gray-600 flex items-center">
                            Tier Rewards
                            <HelpCircle className="h-3 w-3 ml-1" />
                          </span>
                          <span className="font-medium text-orange-600">{Math.max(0, pointsBreakdown.available_by_type?.tier_rewards ?? 0).toLocaleString()}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Bonus points from tier achievements</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  {showTierProgress && tier_info.next_tier && tier_info.points_to_next && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Progress to {tier_info.next_tier.toUpperCase()}</span>
                        <span>{tier_info.progress_percentage.toFixed(0)}%</span>
                      </div>
                      <Progress value={tier_info.progress_percentage} className="h-2" />
                      <p className="text-xs text-gray-500">
                        {tier_info.points_to_next.toLocaleString()} points to next tier
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </TooltipProvider>
    )
  }

  // Full variant for profile pages
  return (
    <TooltipProvider>
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Star className="h-5 w-5 text-blue-500" />
            <span>Loyalty Points</span>
          </CardTitle>
          <CardDescription>
            Your points balance and tier information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Main Points Display */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-3xl font-bold text-blue-600 mb-1">
                  {pointsBreakdown.total_available.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">
                  Available Points • Worth {formatPrice(pointsBreakdown.total_available / 1000)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-2">
                  {tierIcons[tier_info.current_tier as keyof typeof tierIcons]}
                </div>
                <Badge variant="outline" className={tierColor}>
                  {tier_info.current_tier.toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* Points Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="bg-white rounded-lg p-3 cursor-help">
                    <div className="flex items-center space-x-2 mb-1">
                      <Coins className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium text-gray-700">Earned Points</span>
                    </div>
                    <div className="text-lg font-bold text-green-600">
                      {Math.max(0, pointsBreakdown.available_by_type?.earned ?? 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">Currently available from purchases</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Points earned from orders, welcome bonus, and other activities</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="bg-white rounded-lg p-3 cursor-help">
                    <div className="flex items-center space-x-2 mb-1">
                      <Sparkles className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium text-gray-700">Tier Rewards</span>
                    </div>
                    <div className="text-lg font-bold text-orange-600">
                      {Math.max(0, pointsBreakdown.available_by_type?.tier_rewards ?? 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">Currently available from tier rewards</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Bonus points awarded for reaching new tiers</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Tier Progress */}
            {showTierProgress && tier_info.next_tier && tier_info.points_to_next && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Progress to {tier_info.next_tier.toUpperCase()}</span>
                  <span className="font-medium">{tier_info.progress_percentage.toFixed(0)}%</span>
                </div>
                <Progress value={tier_info.progress_percentage} className="h-2" />
                <p className="text-xs text-gray-500">
                  {tier_info.points_to_next.toLocaleString()} points to next tier
                </p>
              </div>
            )}
          </div>

          {/* Tier Benefits */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 flex items-center space-x-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              <span>Your Tier Benefits</span>
            </h4>
            <div className="space-y-2">
              {tier_info.tier_benefits.map((benefit) => (
                <div key={`${benefit}-${tier_info.current_tier}`} className="flex items-center space-x-2 text-sm">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-700">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Points Breakdown by Source */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Points Sources</h4>
            <div className="space-y-2 text-sm">
              {pointsBreakdown.breakdown_by_source.orders > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">From Orders</span>
                  <span className="font-medium">{pointsBreakdown.breakdown_by_source.orders.toLocaleString()}</span>
                </div>
              )}
              {pointsBreakdown.breakdown_by_source.welcome_bonus > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Welcome Bonus</span>
                  <span className="font-medium">{pointsBreakdown.breakdown_by_source.welcome_bonus.toLocaleString()}</span>
                </div>
              )}
              {pointsBreakdown.breakdown_by_source.tier_rewards > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Tier Rewards</span>
                  <span className="font-medium text-orange-600">{pointsBreakdown.breakdown_by_source.tier_rewards.toLocaleString()}</span>
                </div>
              )}
              {pointsBreakdown.breakdown_by_source.admin_adjustments > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Admin Adjustments</span>
                  <span className="font-medium">{pointsBreakdown.breakdown_by_source.admin_adjustments.toLocaleString()}</span>
                </div>
              )}
              {pointsBreakdown.breakdown_by_source.other > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Other</span>
                  <span className="font-medium">{pointsBreakdown.breakdown_by_source.other.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
