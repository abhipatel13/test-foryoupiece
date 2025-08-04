'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Save, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { CouponFormData, CouponDiscountType, CouponStatus } from '@/types/coupon'
import { useAuth } from '@/lib/hooks/use-auth'

export default function NewCouponPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string || 'en'
  const { userId } = useAuth()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<CouponFormData>({
    code: '',
    name: '',
    description: '',
    discountType: 'percentage',
    discountValue: 0,
    totalUsageLimit: undefined,
    perUserUsageLimit: undefined,
    allowedUserIds: undefined,
    minimumOrderAmount: undefined,
    startsAt: new Date(),
    expiresAt: undefined,
    status: 'active'
  })

  const [hasExpiration, setHasExpiration] = useState(false)
  const [hasUsageLimit, setHasUsageLimit] = useState(false)
  const [hasPerUserLimit, setHasPerUserLimit] = useState(false)
  const [hasMinimumOrder, setHasMinimumOrder] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!formData.code.trim()) {
      toast.error('Coupon code is required')
      return
    }
    
    if (!formData.name.trim()) {
      toast.error('Coupon name is required')
      return
    }
    
    if (formData.discountValue <= 0) {
      toast.error('Discount value must be greater than 0')
      return
    }
    
    if (formData.discountType === 'percentage' && formData.discountValue > 100) {
      toast.error('Percentage discount cannot exceed 100%')
      return
    }

    try {
      setLoading(true)
      
      const submitData = {
        ...formData,
        code: formData.code.toUpperCase().trim(),
        name: formData.name.trim(),
        description: formData.description?.trim() || undefined,
        totalUsageLimit: hasUsageLimit ? formData.totalUsageLimit : undefined,
        perUserUsageLimit: hasPerUserLimit ? formData.perUserUsageLimit : undefined,
        minimumOrderAmount: hasMinimumOrder ? formData.minimumOrderAmount : undefined,
        expiresAt: hasExpiration ? formData.expiresAt : undefined
      }

      const response = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          couponData: submitData,
          createdBy: userId // Use the actual admin user ID
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Coupon created successfully')
        router.push(`/${locale}/fyponly-admin/coupons`)
      } else {
        toast.error(data.error || 'Failed to create coupon')
      }
    } catch (error) {
      console.error('Failed to create coupon:', error)
      toast.error('Failed to create coupon')
    } finally {
      setLoading(false)
    }
  }

  const formatDateForInput = (date: Date) => {
    return date.toISOString().slice(0, 16)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create New Coupon</h1>
          <p className="text-muted-foreground">
            Create a new discount coupon for your store
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Enter the basic details for your coupon
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Coupon Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g., SAVE20"
                  className="font-mono"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Use uppercase letters and numbers only
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Display Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., 20% Off Summer Sale"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Internal description for admin reference"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: CouponStatus) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Discount Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Discount Configuration</CardTitle>
              <CardDescription>
                Configure the discount amount and type
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="discountType">Discount Type *</Label>
                <Select
                  value={formData.discountType}
                  onValueChange={(value: CouponDiscountType) => setFormData({ ...formData, discountType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discountValue">
                  Discount Value * {formData.discountType === 'percentage' ? '(%)' : '($)'}
                </Label>
                <Input
                  id="discountValue"
                  type="number"
                  min="0"
                  max={formData.discountType === 'percentage' ? 100 : undefined}
                  step={formData.discountType === 'percentage' ? '1' : '0.01'}
                  value={formData.discountValue}
                  onChange={(e) => setFormData({ ...formData, discountValue: parseFloat(e.target.value) || 0 })}
                  required
                />
                {formData.discountType === 'percentage' && (
                  <p className="text-xs text-muted-foreground">
                    Enter a value between 1 and 100
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="hasMinimumOrder"
                  checked={hasMinimumOrder}
                  onCheckedChange={setHasMinimumOrder}
                />
                <Label htmlFor="hasMinimumOrder">Set minimum order amount</Label>
              </div>

              {hasMinimumOrder && (
                <div className="space-y-2">
                  <Label htmlFor="minimumOrderAmount">Minimum Order Amount ($)</Label>
                  <Input
                    id="minimumOrderAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.minimumOrderAmount || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      minimumOrderAmount: parseFloat(e.target.value) || undefined 
                    })}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Usage Limits */}
          <Card>
            <CardHeader>
              <CardTitle>Usage Limits</CardTitle>
              <CardDescription>
                Set limits on how many times this coupon can be used
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="hasUsageLimit"
                  checked={hasUsageLimit}
                  onCheckedChange={setHasUsageLimit}
                />
                <Label htmlFor="hasUsageLimit">Set total usage limit</Label>
              </div>

              {hasUsageLimit && (
                <div className="space-y-2">
                  <Label htmlFor="totalUsageLimit">Total Usage Limit</Label>
                  <Input
                    id="totalUsageLimit"
                    type="number"
                    min="1"
                    value={formData.totalUsageLimit || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      totalUsageLimit: parseInt(e.target.value) || undefined 
                    })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum number of times this coupon can be used across all users
                  </p>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Switch
                  id="hasPerUserLimit"
                  checked={hasPerUserLimit}
                  onCheckedChange={setHasPerUserLimit}
                />
                <Label htmlFor="hasPerUserLimit">Set per-user usage limit</Label>
              </div>

              {hasPerUserLimit && (
                <div className="space-y-2">
                  <Label htmlFor="perUserUsageLimit">Per-User Usage Limit</Label>
                  <Input
                    id="perUserUsageLimit"
                    type="number"
                    min="1"
                    value={formData.perUserUsageLimit || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      perUserUsageLimit: parseInt(e.target.value) || undefined 
                    })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum number of times a single user can use this coupon
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Time Restrictions */}
          <Card>
            <CardHeader>
              <CardTitle>Time Restrictions</CardTitle>
              <CardDescription>
                Set when this coupon is valid
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="startsAt">Start Date & Time</Label>
                <Input
                  id="startsAt"
                  type="datetime-local"
                  value={formatDateForInput(formData.startsAt)}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    startsAt: new Date(e.target.value) 
                  })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="hasExpiration"
                  checked={hasExpiration}
                  onCheckedChange={setHasExpiration}
                />
                <Label htmlFor="hasExpiration">Set expiration date</Label>
              </div>

              {hasExpiration && (
                <div className="space-y-2">
                  <Label htmlFor="expiresAt">Expiration Date & Time</Label>
                  <Input
                    id="expiresAt"
                    type="datetime-local"
                    value={formData.expiresAt ? formatDateForInput(formData.expiresAt) : ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      expiresAt: e.target.value ? new Date(e.target.value) : undefined 
                    })}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Submit Button */}
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={loading}>
            <Save className="mr-2 h-4 w-4" />
            {loading ? 'Creating...' : 'Create Coupon'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
