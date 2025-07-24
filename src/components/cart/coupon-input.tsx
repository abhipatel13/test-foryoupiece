'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tag, X, Check, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { AppliedCoupon } from '@/types/coupon'

interface CouponInputProps {
  orderTotal: number
  appliedCoupon?: AppliedCoupon
  onCouponApplied: (coupon: AppliedCoupon) => void
  onCouponRemoved: () => void
  disabled?: boolean
}

export function CouponInput({
  orderTotal,
  appliedCoupon,
  onCouponApplied,
  onCouponRemoved,
  disabled = false
}: CouponInputProps) {
  const [couponCode, setCouponCode] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setValidationError('Please enter a coupon code')
      return
    }

    try {
      setIsValidating(true)
      setValidationError(null)

      console.log('🎫 Validating coupon:', { code: couponCode, orderTotal })

      const response = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: couponCode.toUpperCase().trim(),
          orderTotal
        })
      })

      const data = await response.json()

      if (!data.success) {
        setValidationError(data.error || 'Failed to validate coupon')
        return
      }

      const validationResult = data.data

      if (!validationResult.isValid) {
        setValidationError(validationResult.errorMessage || 'Invalid coupon code')
        return
      }

      // Create applied coupon object
      const appliedCouponData: AppliedCoupon = {
        id: validationResult.couponId!,
        code: couponCode.toUpperCase().trim(),
        name: couponCode.toUpperCase().trim(), // We'll get the actual name from the coupon service later
        discountType: 'percentage', // This should come from the validation result
        discountValue: 0, // This should come from the validation result
        discountAmount: validationResult.discountAmount!
      }

      onCouponApplied(appliedCouponData)
      setCouponCode('')
      setValidationError(null)
      toast.success(`Coupon applied! You saved $${validationResult.discountAmount!.toFixed(2)}`)
    } catch (error) {
      console.error('Failed to validate coupon:', error)
      setValidationError('Failed to validate coupon. Please try again.')
    } finally {
      setIsValidating(false)
    }
  }

  const handleRemoveCoupon = () => {
    onCouponRemoved()
    setCouponCode('')
    setValidationError(null)
    toast.success('Coupon removed')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleApplyCoupon()
    }
  }

  const formatDiscountAmount = (amount: number) => {
    return `$${amount.toFixed(2)}`
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Coupon Code</span>
          </div>

          {appliedCoupon ? (
            // Applied coupon display
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {appliedCoupon.code}
                      </Badge>
                      <span className="text-sm text-green-700 font-medium">
                        -{formatDiscountAmount(appliedCoupon.discountAmount)}
                      </span>
                    </div>
                    <p className="text-xs text-green-600 mt-1">
                      Coupon applied successfully
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveCoupon}
                  disabled={disabled}
                  className="text-green-700 hover:text-green-800 hover:bg-green-100"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            // Coupon input form
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value.toUpperCase())
                      setValidationError(null)
                    }}
                    onKeyPress={handleKeyPress}
                    placeholder="Enter coupon code"
                    className="font-mono"
                    disabled={disabled || isValidating}
                  />
                </div>
                <Button
                  onClick={handleApplyCoupon}
                  disabled={disabled || isValidating || !couponCode.trim()}
                  size="default"
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    'Apply'
                  )}
                </Button>
              </div>

              {validationError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                  <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-700">{validationError}</p>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Enter a valid coupon code to get a discount on your order
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
