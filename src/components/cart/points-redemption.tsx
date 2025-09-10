'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Star, Gift, AlertCircle, CheckCircle } from 'lucide-react'
import { useSSRSafeCartStore } from '@/lib/store/ssr-safe-cart-store'
import { pointsToDollars, formatPrice } from '@/lib/utils'
import { toast } from 'sonner'

interface PointsRedemptionProps {
  userPointsBalance: number
  onPointsChange?: (points: number) => void
}

export function PointsRedemption({ userPointsBalance, onPointsChange }: PointsRedemptionProps) {
  const {
    pointsToRedeem,
    setPointsToRedeem,
    getPointsDiscount,
    getFinalTotal,
    validatePointsRedemption,
    clearPointsRedemption
  } = useSSRSafeCartStore()

  const [inputValue, setInputValue] = useState(pointsToRedeem.toString())
  const [validationMessage, setValidationMessage] = useState('')
  const [isValid, setIsValid] = useState(true)

  const finalTotal = getFinalTotal()
  const pointsDiscount = getPointsDiscount()
  const maxRedeemablePoints = Math.min(userPointsBalance, Math.floor(finalTotal * 1000))

  // Suggest optimal redemption amounts
  const suggestedAmounts = [
    500, // Minimum
    1000, // $1 discount
    Math.floor(maxRedeemablePoints / 1000) * 1000, // Nearest $1 equivalent
    maxRedeemablePoints // Maximum possible
  ].filter((amount, index, arr) => 
    amount >= 500 && 
    amount <= maxRedeemablePoints && 
    arr.indexOf(amount) === index // Remove duplicates
  ).sort((a, b) => a - b)

  useEffect(() => {
    if (pointsToRedeem > 0) {
      const validation = validatePointsRedemption(pointsToRedeem, userPointsBalance)
      setIsValid(validation.isValid)
      setValidationMessage(validation.message)
    } else {
      setIsValid(true)
      setValidationMessage('')
    }
  }, [pointsToRedeem, userPointsBalance, validatePointsRedemption])

  const handleInputChange = (value: string) => {
    setInputValue(value)
    const points = parseInt(value) || 0
    
    if (points === 0) {
      setPointsToRedeem(0)
      onPointsChange?.(0)
      return
    }

    const validation = validatePointsRedemption(points, userPointsBalance)
    setIsValid(validation.isValid)
    setValidationMessage(validation.message)

    if (validation.isValid) {
      setPointsToRedeem(points)
      onPointsChange?.(points)
    }
  }

  const handleSuggestedAmount = (points: number) => {
    setInputValue(points.toString())
    setPointsToRedeem(points)
    onPointsChange?.(points)
    
    const validation = validatePointsRedemption(points, userPointsBalance)
    setIsValid(validation.isValid)
    setValidationMessage(validation.message)
    
    if (validation.isValid) {
      toast.success(`Applied ${points} points (${formatPrice(pointsToDollars(points))} discount)`)
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

  if (userPointsBalance < 500) {
    return (
      <Card className="border-gray-200">
        <CardHeader className="pb-2 sm:pb-3">
          <CardTitle className="flex items-center space-x-2 text-sm">
            <Star className="h-4 w-4 text-orange-500" />
            <span>Loyalty Points</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-3 sm:py-4">
            <Gift className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-xs sm:text-sm text-gray-600 mb-1">
              You have {userPointsBalance.toLocaleString()} points
            </p>
            <p className="text-xs text-gray-500">
              You need at least 500 points to redeem rewards
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-gray-200 !py-2 !gap-2 sm:!py-3 sm:!gap-3 lg:!py-4 lg:!gap-4">
      <CardHeader className="pb-0.5 sm:pb-2 lg:pb-3 px-3 sm:px-4 lg:px-5 h-[100px] sm:h-auto items-center">
        <CardTitle className="flex items-center space-x-2 text-sm">
          <Star className="h-4 w-4 text-orange-500" />
          <span>Redeem Loyalty Points</span>
        </CardTitle>

        {/* Compact Points Balance Display */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-1 sm:p-1.5 lg:p-2 mt-1">
          {/* Mobile condensed summary */}
          <div className="sm:hidden text-[12px] text-blue-900 font-medium">
            Available: {userPointsBalance.toLocaleString()} pts • Max {formatPrice(pointsToDollars(userPointsBalance))}
          </div>
          {/* Desktop/tablet detailed summary */}
          <div className="hidden sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-900">
                Available: {userPointsBalance.toLocaleString()} points
              </p>
              <p className="text-xs text-blue-700">
                1,000 points = $1.00
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-blue-600">Worth up to</p>
              <p className="text-sm font-bold text-blue-900">
                {formatPrice(pointsToDollars(userPointsBalance))}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="!px-3 sm:!px-4 space-y-1.5 sm:space-y-2 lg:space-y-3 h-[140px] sm:h-auto overflow-y-auto">
        {/* Current Discount Display - Compact */}
        {pointsToRedeem > 0 && isValid && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-1 sm:p-2 lg:p-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-0.5 sm:space-y-0">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-xs sm:text-sm font-medium text-green-800">
                  Using {pointsToRedeem.toLocaleString()} points
                </span>
              </div>
              <span className="text-xs sm:text-sm font-bold text-green-800 ml-6 sm:ml-0">
                -{formatPrice(pointsDiscount)} discount
              </span>
            </div>
          </div>
        )}

        {/* Points Input */}
        <div className="space-y-1">
          <Label htmlFor="points-input" className="text-xs sm:text-sm font-medium">
            Points to redeem
          </Label>
          <div className="flex space-x-2">
            <Input
              id="points-input"
              type="number"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Enter points (min. 500)"
              min="0"
              max={maxRedeemablePoints}
              step="10"
              className={`flex-1 text-sm !h-8 !px-2 !py-0.5 sm:!h-9 sm:!px-3 sm:!py-1 ${!isValid ? 'border-red-300 focus:border-red-500' : ''}`}
            />
            {pointsToRedeem > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearRedemption}
                className="px-2 sm:px-3 text-xs sm:text-sm min-h-[24px] lg:min-h-[36px] py-0.5"
              >
                Clear
              </Button>
            )}
          </div>

          {/* Validation Message */}
          {validationMessage && (
            <div className={`flex items-center space-x-1 text-[11px] sm:text-xs ${
              isValid ? 'text-green-600' : 'text-red-600'
            }`}>
              <AlertCircle className="h-3 w-3" />
              <span>{validationMessage}</span>
            </div>
          )}
        </div>

        {/* Suggested Amounts */}
        {suggestedAmounts.length > 0 && (
          <div className="space-y-1">
            <Label className="hidden sm:inline text-xs font-medium text-gray-600">Quick select:</Label>
            <div className="flex gap-1 sm:gap-1.5 overflow-x-auto flex-nowrap -mx-1 px-1">
              {suggestedAmounts.map((points) => (
                <Button
                  key={points}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSuggestedAmount(points)}
                  className="text-xs px-1.5 py-0.5 h-auto min-h-[24px] lg:min-h-[32px] flex-shrink-0"
                  disabled={points === pointsToRedeem}
                >
                  <span className="hidden sm:inline">{points.toLocaleString()} pts</span>
                  <span className="sm:hidden">{points >= 1000 ? `${points/1000}k` : points}</span>
                  <Badge variant="secondary" className="ml-1 text-[11px] hidden sm:inline-flex">
                    {formatPrice(pointsToDollars(points))}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Redemption Rules */}
        <div className="hidden sm:block text-xs text-gray-500 space-y-0.5">
          <p>• Min: 500 points • Increments of 10</p>
          <p>• Maximum redemption: {maxRedeemablePoints.toLocaleString()} points for this order</p>
        </div>
      </CardContent>
    </Card>
  )
}
