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
import { CouponFormData, CouponDiscountType, CouponStatus, CouponTargetingOptions, UserRankTier } from '@/types/coupon'
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


  // Targeting state
  const [tiers, setTiers] = useState<UserRankTier[]>([])
  const [recentSignupEnabled, setRecentSignupEnabled] = useState(false)
  const [recentSignupDays, setRecentSignupDays] = useState<number>(14)
  const [mostPurchasedEnabled, setMostPurchasedEnabled] = useState(false)
  const [mostPurchasedMode, setMostPurchasedMode] = useState<'topN' | 'minTotal'>('topN')
  const [mostPurchasedTopN, setMostPurchasedTopN] = useState<number>(100)
  const [mostPurchasedMinTotal, setMostPurchasedMinTotal] = useState<number>(100)
  const [recentPurchasedEnabled, setRecentPurchasedEnabled] = useState(false)
  const [recentPurchasedDays, setRecentPurchasedDays] = useState<number>(30)

  // Eligible users preview
  const [eligibleUsers, setEligibleUsers] = useState<any[]>([])
  const [eligibleLoading, setEligibleLoading] = useState(false)
  const [eligiblePage, setEligiblePage] = useState(1)
  const [eligibleTotalPages, setEligibleTotalPages] = useState(0)
  const [eligibleTotalUsers, setEligibleTotalUsers] = useState(0)

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

      // Build targeting payload for submission (if any options enabled)
      const targetingEnabled = tiers.length > 0 || recentSignupEnabled || mostPurchasedEnabled || recentPurchasedEnabled
      const targeting: CouponTargetingOptions | undefined = targetingEnabled ? {
        ...(tiers.length ? { tiers } as any : {}),
        ...(recentSignupEnabled ? { recentlySignedUpDays: recentSignupDays } : {}),
        ...(mostPurchasedEnabled && mostPurchasedMode === 'topN' ? { mostPurchasedTopN } : {}),
        ...(mostPurchasedEnabled && mostPurchasedMode === 'minTotal' ? { mostPurchasedMinTotalSpent: mostPurchasedMinTotal } : {}),
        ...(recentPurchasedEnabled ? { recentlyPurchasedDays: recentPurchasedDays } : {})
      } : undefined

      const submitData = {
        ...formData,
        code: formData.code.toUpperCase().trim(),
        name: formData.name.trim(),
        description: formData.description?.trim() || undefined,
        totalUsageLimit: hasUsageLimit ? formData.totalUsageLimit : undefined,
        perUserUsageLimit: hasPerUserLimit ? formData.perUserUsageLimit : undefined,
        minimumOrderAmount: hasMinimumOrder ? formData.minimumOrderAmount : undefined,
        targeting,
        expiresAt: hasExpiration ? formData.expiresAt : undefined
      }

      const response = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ couponData: submitData, createdBy: userId })
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

  // JST helpers: ensure UI uses Japan Standard Time (UTC+9)
  // Preview eligible users based on current targeting selections
  const handleRefreshEligible = async () => {
    if (!(tiers.length > 0 || recentSignupEnabled || mostPurchasedEnabled || recentPurchasedEnabled)) {
      setEligibleUsers([]); setEligibleTotalUsers(0); return
    }
    setEligibleLoading(true)
    try {
      const targeting: CouponTargetingOptions = {
        ...(tiers.length ? { tiers } as any : {}),
        ...(recentSignupEnabled ? { recentlySignedUpDays: recentSignupDays } : {}),
        ...(mostPurchasedEnabled && mostPurchasedMode === 'topN' ? { mostPurchasedTopN } : {}),
        ...(mostPurchasedEnabled && mostPurchasedMode === 'minTotal' ? { mostPurchasedMinTotalSpent: mostPurchasedMinTotal } : {}),
        ...(recentPurchasedEnabled ? { recentlyPurchasedDays: recentPurchasedDays } : {})
      }
      const response = await fetch('/api/admin/coupons/eligible-users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: eligiblePage, limit: 40, targeting })
      })
      const data = await response.json()
      if (data?.success) {
        setEligibleUsers(data.users || [])
        setEligibleTotalUsers(data.pagination?.totalUsers ?? data.total ?? 0)
        setEligibleTotalPages(data.pagination?.totalPages ?? 0)
      } else {
        setEligibleUsers([]); setEligibleTotalUsers(0); setEligibleTotalPages(0)
      }
    } catch (e) {
      console.error('eligible preview failed', e)
    } finally {
      setEligibleLoading(false)
    }
  }

  const toJstInputValue = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0')
    // Convert system local -> UTC -> JST
    const utcTime = date.getTime() + date.getTimezoneOffset() * 60000
    const jst = new Date(utcTime + 9 * 60 * 60000)
    return `${jst.getFullYear()}-${pad(jst.getMonth() + 1)}-${pad(jst.getDate())}T${pad(jst.getHours())}:${pad(jst.getMinutes())}`
  }
  const fromJstInputValue = (value: string) => {
    // Interpret the input as JST explicitly
    return new Date(`${value}:00+09:00`)
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
              <p className="text-xs text-muted-foreground">All dates/times are interpreted in JST (UTC+9).</p>
              <div className="space-y-2">
                <Label htmlFor="startsAt">Start Date & Time</Label>
                <Input
                  id="startsAt"
                  type="datetime-local"
                  value={toJstInputValue(formData.startsAt)}
                  onChange={(e) => setFormData({
                    ...formData,
                    startsAt: fromJstInputValue(e.target.value)
                  })}
                />

          {/* User Targeting (Optional) */}
          <Card>
            <CardHeader>
              <CardTitle>User Targeting (Optional)</CardTitle>
              <CardDescription>Limit coupon eligibility to specific user segments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Rank tiers */}
              <div className="space-y-2">
                <Label>User Ranking Tiers</Label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {(['bronze','silver','gold','platinum','diamond'] as UserRankTier[]).map(t => (
                    <label key={t} className={`flex items-center gap-2 rounded border px-3 py-2 text-sm ${tiers.includes(t) ? 'border-primary' : 'border-muted'}`}>
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={tiers.includes(t)}
                        onChange={(e) => setTiers(e.target.checked ? [...tiers, t] : tiers.filter(x => x !== t))}
                      />
                      <span className="capitalize">{t}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Recently signed up */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Switch id="recentSignupEnabled" checked={recentSignupEnabled} onCheckedChange={setRecentSignupEnabled} />
                  <Label htmlFor="recentSignupEnabled">Users who signed up recently</Label>
                </div>
                {recentSignupEnabled && (
                  <div className="flex items-center gap-3">
                    <Label className="text-sm text-muted-foreground">Within last</Label>
                    <Input type="number" min={1} className="w-24" value={recentSignupDays}
                      onChange={(e)=> setRecentSignupDays(parseInt(e.target.value)||1)} />
                    <span className="text-sm text-muted-foreground">days</span>
                  </div>
                )}
              </div>

              {/* Most purchased */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Switch id="mostPurchasedEnabled" checked={mostPurchasedEnabled} onCheckedChange={setMostPurchasedEnabled} />
                  <Label htmlFor="mostPurchasedEnabled">Most purchased users</Label>
                </div>
                {mostPurchasedEnabled && (
                  <div className="flex flex-wrap items-center gap-3">
                    <Select value={mostPurchasedMode} onValueChange={(v: 'topN'|'minTotal') => setMostPurchasedMode(v)}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="topN">Top N by spend</SelectItem>
                        <SelectItem value="minTotal">Min total spent ($)</SelectItem>
                      </SelectContent>
                    </Select>
                    {mostPurchasedMode === 'topN' ? (
                      <Input type="number" min={1} className="w-32" value={mostPurchasedTopN}
                        onChange={(e)=> setMostPurchasedTopN(parseInt(e.target.value)||1)} />
                    ) : (
                      <Input type="number" min={1} step="0.01" className="w-36" value={mostPurchasedMinTotal}
                        onChange={(e)=> setMostPurchasedMinTotal(parseFloat(e.target.value)||1)} />
                    )}
                  </div>
                )}
              </div>

              {/* Recently purchased */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Switch id="recentPurchasedEnabled" checked={recentPurchasedEnabled} onCheckedChange={setRecentPurchasedEnabled} />
                  <Label htmlFor="recentPurchasedEnabled">Users who purchased recently</Label>
                </div>
                {recentPurchasedEnabled && (
                  <div className="flex items-center gap-3">
                    <Label className="text-sm text-muted-foreground">Within last</Label>
                    <Input type="number" min={1} className="w-24" value={recentPurchasedDays}
                      onChange={(e)=> setRecentPurchasedDays(parseInt(e.target.value)||1)} />
                    <span className="text-sm text-muted-foreground">days</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Eligible Users Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Eligible Users Preview</CardTitle>
              <CardDescription>See a sample of users who match the current targeting</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {eligibleLoading ? 'Loading…' : `${eligibleTotalUsers} users currently match`}
                </p>
                <Button type="button" variant="outline" onClick={handleRefreshEligible} disabled={eligibleLoading}>
                  {eligibleLoading ? 'Refreshing…' : 'Refresh Preview'}
                </Button>
              </div>
              <div className="max-h-64 overflow-auto rounded border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Email</th>
                      <th className="px-3 py-2 text-left">Rank</th>
                      <th className="px-3 py-2 text-right">Total Spent</th>
                      <th className="px-3 py-2 text-left">Last Purchase</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eligibleUsers.length === 0 && !eligibleLoading && (
                      <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No users to show</td></tr>
                    )}
                    {eligibleUsers.map((u) => (
                      <tr key={u.id} className="border-t">
                        <td className="px-3 py-2">{u.name}</td>
                        <td className="px-3 py-2">{u.email}</td>
                        <td className="px-3 py-2 capitalize">{u.rank || '-'}</td>
                        <td className="px-3 py-2 text-right">{`$${(u.totalPurchases || 0).toFixed(2)}`}</td>

                        <td className="px-3 py-2">{u.lastPurchaseDate ? new Date(u.lastPurchaseDate).toLocaleDateString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between pt-3">
                <span className="text-xs text-muted-foreground">Page {eligiblePage} {eligibleTotalPages ? `of ${eligibleTotalPages}` : ''}</span>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={eligiblePage <= 1 || eligibleLoading}
                    onClick={() => { if (eligiblePage > 1) { setEligiblePage(eligiblePage - 1); handleRefreshEligible(); } }}>
                    Prev
                  </Button>
                  <Button type="button" variant="outline" size="sm" disabled={(!!eligibleTotalPages && eligiblePage >= eligibleTotalPages) || eligibleLoading}
                    onClick={() => { if (!eligibleTotalPages || eligiblePage < eligibleTotalPages) { setEligiblePage(eligiblePage + 1); handleRefreshEligible(); } }}>
                    Next
                  </Button>
                </div>
              </div>

            </CardContent>
          </Card>



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
                    value={formData.expiresAt ? toJstInputValue(formData.expiresAt) : ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      expiresAt: e.target.value ? fromJstInputValue(e.target.value) : undefined
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
