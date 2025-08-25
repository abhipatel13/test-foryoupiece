'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { 
  Star, 
  Gift, 
  AlertCircle, 
  CheckCircle, 
  Info, 
  Trophy,
  Sparkles,
  HelpCircle,
  Coins
} from 'lucide-react'
import { useSSRSafeCartStore } from '@/lib/store/ssr-safe-cart-store'
import { PointsService, CheckoutPointsInfo } from '@/lib/services/points-service'
import { pointsToDollars, formatPrice } from '@/lib/utils'
import { toast } from 'sonner'

interface CheckoutPointsDisplayProps {
  userId: string
  orderTotal: number
  onPointsChange?: (points: number) => void
}

export function CheckoutPointsDisplay({ userId, orderTotal, onPointsChange }: CheckoutPointsDisplayProps) {
  const {
    pointsToRedeem,
    setPointsToRedeem,
    getPointsDiscount,
    clearPointsRedemption
  } = useSSRSafeCartStore()

  const [checkoutPointsInfo, setCheckoutPointsInfo] = useState<CheckoutPointsInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState(pointsToRedeem.toString())
  const [validationMessage, setValidationMessage] = useState('')
  const [isValid, setIsValid] = useState(true)
  const [showBreakdown, setShowBreakdown] = useState(false)

  const pointsService = new PointsService()

  useEffect(() => {
    loadCheckoutPointsInfo()
  }, [userId])

  useEffect(() => {
    if (pointsToRedeem > 0) {
      setInputValue(pointsToRedeem.toString())
    }
  }, [pointsToRedeem])

  const loadCheckoutPointsInfo = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { info, error: infoError } = await pointsService.getCheckoutPointsInfo(userId)
      if (infoError) throw new Error(infoError)
      
      setCheckoutPointsInfo(info)
    } catch (err: any) {
      console.error('Error loading checkout points info:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (value: string) => {
    setInputValue(value)
    const points = parseInt(value) || 0
    
    if (checkoutPointsInfo) {
      const validation = pointsService.validatePointsRedemption(
        points, 
        checkoutPointsInfo.available_points, 
        orderTotal
      )
      
      setIsValid(validation.isValid)
      setValidationMessage(validation.error || '')
      
      if (validation.isValid) {
        setPointsToRedeem(points)
        onPointsChange?.(points)
      }
    }
  }

  const handleSuggestedAmount = (points: number) => {
    setInputValue(points.toString())
    setPointsToRedeem(points)
    onPointsChange?.(points)
    
    if (checkoutPointsInfo) {
      const validation = pointsService.validatePointsRedemption(
        points, 
        checkoutPointsInfo.available_points, 
        orderTotal
      )
      
      setIsValid(validation.isValid)
      setValidationMessage(validation.error || '')
      
      if (validation.isValid) {
        toast.success(`Applied ${points.toLocaleString()} points (${formatPrice(pointsToDollars(points))} discount)`)
      }
    }
  }

  const handleClearRedemption = () => {
    setInputValue('0')
    clearPointsRedemption()
    onPointsChange?.(0)
    setIsValid(true)
    setValidationMessage('')
    toast.info('Points redemption cleared')
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="p-2 sm:p-3 pb-1 sm:pb-2">
          <div className="animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-1/2 mb-1"></div>
            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
          </div>
        </CardHeader>
        <CardContent className="p-2 sm:p-3">
          <div className="animate-pulse space-y-2">
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !checkoutPointsInfo) {
    return (
      <Card>
        <CardHeader className="p-2 sm:p-3 pb-1 sm:pb-2">
          <CardTitle className="flex items-center space-x-1.5 text-red-600 text-sm sm:text-base">
            <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5" />
            <span>Points System Unavailable</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 sm:p-3">
          <p className="text-xs sm:text-sm text-gray-600">
            Unable to load points information. You can still complete your order without using points.
          </p>
          {error && (
            <p className="text-xs text-red-500 mt-1">Error: {error}</p>
          )}
        </CardContent>
      </Card>
    )
  }

  const { points_breakdown, redemption_rules, suggested_amounts } = checkoutPointsInfo
  const pointsDiscount = getPointsDiscount()

  return (
    <TooltipProvider>
      <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardHeader className="p-2 sm:p-3 pb-1 sm:pb-2">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <Star className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
              <span className="text-sm sm:text-base">Loyalty Points</span>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Use your loyalty points to get discounts on your order</p>
                  <p className="text-xs mt-1">1,000 points = $1.00 USD</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowBreakdown(!showBreakdown)}
              className="text-xs h-6 px-2"
            >
              {showBreakdown ? 'Hide Details' : 'Show Details'}
            </Button>
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm mt-0.5 sm:mt-1">
            Redeem your points for instant discounts (minimum 500 points)
          </CardDescription>
        </CardHeader>

        <CardContent className="p-2 sm:p-3 space-y-2 sm:space-y-2.5">
          {/* Points Balance Display */}
          <div className="bg-white border border-blue-200 rounded-lg p-1.5 sm:p-2.5">
            <div className="flex items-center justify-between mb-1 sm:mb-1.5">
              <div className="flex items-center space-x-1.5">
                <Coins className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                <span className="text-sm sm:text-base font-semibold text-gray-900">Available Points</span>
              </div>
              <div className="text-right">
                <div className="text-lg sm:text-xl font-bold text-blue-600">
                  {checkoutPointsInfo.available_points.toLocaleString()}
                </div>
                <div className="text-xs text-gray-600">
                  Worth {formatPrice(pointsToDollars(checkoutPointsInfo.available_points))}
                </div>
              </div>
            </div>

            {/* Points Breakdown - mobile hidden when collapsed */}
            {showBreakdown && (
              <div className="space-y-1.5 pt-1.5 border-t border-gray-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Earned Points:</span>
                    <span className="font-medium">{Math.max(0, points_breakdown.earned_points).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tier Rewards:</span>
                    <span className="font-medium text-orange-600">{Math.max(0, points_breakdown.tier_reward_points).toLocaleString()}</span>
                  </div>
                </div>

                {/* Tier Information */}
                <div className="bg-gray-50 rounded-lg p-1.5 sm:p-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-1.5">
                      <Trophy className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-500" />
                      <span className="text-xs sm:text-sm font-medium">Current Tier</span>
                    </div>
                    <Badge variant="outline" className="text-xs py-0 px-1.5">
                      {points_breakdown.tier_info.current_tier.toUpperCase()}
                    </Badge>
                  </div>
                  
                  {points_breakdown.tier_info.next_tier ? (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Progress to {points_breakdown.tier_info.next_tier?.toUpperCase()}</span>
                        <span>{points_breakdown.tier_info.progress_percentage.toFixed(0)}%</span>
                      </div>
                      <Progress value={points_breakdown.tier_info.progress_percentage} className="h-1" />
                      {typeof points_breakdown.tier_info.points_to_next === 'number' && (
                        <p className="text-xs text-gray-500">
                          {points_breakdown.tier_info.points_to_next.toLocaleString()} points to next tier
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Max tier achieved</span>
                        <span>{points_breakdown.tier_info.progress_percentage.toFixed(0)}%</span>
                      </div>
                      <Progress value={points_breakdown.tier_info.progress_percentage} className="h-1" />
                      <p className="text-xs text-gray-500">You're at the highest tier</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Current Discount Display */}
          {pointsToRedeem > 0 && isValid && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-1.5 sm:p-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                  <span className="text-xs sm:text-sm font-medium text-green-800">Points Applied</span>
                </div>
                <div className="text-right">
                  <div className="text-sm sm:text-base font-bold text-green-600">
                    -{formatPrice(pointsDiscount)}
                  </div>
                  <div className="text-xs text-green-700">
                    {pointsToRedeem.toLocaleString()} points used
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Points Input */}
          <div className="space-y-1.5">
            <Label htmlFor="checkout-points-input" className="text-xs sm:text-sm font-medium">
              Points to redeem
            </Label>
            <div className="flex space-x-1.5">
              <Input
                id="checkout-points-input"
                type="number"
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="Enter points (min. 500)"
                min="0"
                max={redemption_rules.max_redeemable}
                step="10"
                className={`flex-1 h-8 sm:h-9 text-sm ${!isValid ? 'border-red-300 focus:border-red-500' : ''}`}
              />
              {pointsToRedeem > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearRedemption}
                  className="px-2 h-8 sm:h-9 text-xs"
                >
                  Clear
                </Button>
              )}
            </div>

            {/* Validation Message */}
            {validationMessage && (
              <div className="flex items-center space-x-1.5 text-xs sm:text-sm text-red-600">
                <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>{validationMessage}</span>
              </div>
            )}
          </div>

          {/* Suggested Amounts */}
          {suggested_amounts.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs sm:text-sm font-medium">Quick Select</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                {suggested_amounts.slice(0, 6).map((amount) => (
                  <Button
                    key={amount}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSuggestedAmount(amount)}
                    className="text-xs h-7 px-1.5 py-1"
                    disabled={amount > checkoutPointsInfo.available_points}
                  >
                    <div className="text-center leading-tight">
                      <div>{amount.toLocaleString()}</div>
                      <div className="text-[10px] text-gray-500">
                        {formatPrice(pointsToDollars(amount))}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Redemption Rules */}
          <div className="text-xs text-gray-500 space-y-0.5">
            <p>• Minimum redemption: {redemption_rules.minimum_points.toLocaleString()} points</p>
            <p>• Points must be redeemed in increments of {redemption_rules.increment}</p>
            <p>• {redemption_rules.conversion_rate.toLocaleString()} points = $1.00 USD</p>
            <p>• Points are deducted immediately upon order placement</p>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
