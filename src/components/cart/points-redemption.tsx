'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Star, Gift, AlertCircle, CheckCircle } from 'lucide-react'
import { useCartStore } from '@/lib/store/cart-store'
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
  } = useCartStore()

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
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2 text-sm">
            <Star className="h-4 w-4 text-orange-500" />
            <span>Loyalty Points</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <Gift className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600 mb-1">
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
    <Card className="border-gray-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2 text-sm">
          <Star className="h-4 w-4 text-orange-500" />
          <span>Redeem Loyalty Points</span>
        </CardTitle>

        {/* Prominent Points Balance Display */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-900">
                Available: {userPointsBalance.toLocaleString()} points
              </p>
              <p className="text-xs text-blue-700">
                1,000 points = $1.00
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-blue-600">
                Worth up to
              </p>
              <p className="text-sm font-bold text-blue-900">
                {formatPrice(pointsToDollars(userPointsBalance))}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Discount Display */}
        {pointsToRedeem > 0 && isValid && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  Using {pointsToRedeem.toLocaleString()} points
                </span>
              </div>
              <span className="text-sm font-bold text-green-800">
                -{formatPrice(pointsDiscount)} discount
              </span>
            </div>
          </div>
        )}

        {/* Points Input */}
        <div className="space-y-2">
          <Label htmlFor="points-input" className="text-sm font-medium">
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
              className={`flex-1 ${!isValid ? 'border-red-300 focus:border-red-500' : ''}`}
            />
            {pointsToRedeem > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearRedemption}
                className="px-3"
              >
                Clear
              </Button>
            )}
          </div>
          
          {/* Validation Message */}
          {validationMessage && (
            <div className={`flex items-center space-x-1 text-xs ${
              isValid ? 'text-green-600' : 'text-red-600'
            }`}>
              <AlertCircle className="h-3 w-3" />
              <span>{validationMessage}</span>
            </div>
          )}
        </div>

        {/* Suggested Amounts */}
        {suggestedAmounts.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-600">Quick select:</Label>
            <div className="flex flex-wrap gap-2">
              {suggestedAmounts.map((points) => (
                <Button
                  key={points}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSuggestedAmount(points)}
                  className="text-xs px-2 py-1 h-auto"
                  disabled={points === pointsToRedeem}
                >
                  {points.toLocaleString()} pts
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {formatPrice(pointsToDollars(points))}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Redemption Rules */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>• Minimum redemption: 500 points</p>
          <p>• Points must be redeemed in increments of 10</p>
          <p>• Maximum redemption: {maxRedeemablePoints.toLocaleString()} points for this order</p>
        </div>
      </CardContent>
    </Card>
  )
}
