"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, Save } from "lucide-react"
import { toast } from "sonner"
import { Coupon, CouponDiscountType, CouponFormData, CouponStatus } from "@/types/coupon"

export default function EditCouponPage() {
  const { id, locale } = useParams() as { id: string; locale: string }
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<CouponFormData>({
    code: "",
    name: "",
    description: "",
    discountType: "percentage",
    discountValue: 0,
    totalUsageLimit: undefined,
    perUserUsageLimit: undefined,
    allowedUserIds: undefined,
    minimumOrderAmount: undefined,
    startsAt: new Date(),
    expiresAt: undefined,
    status: "active",
  })

  const [hasExpiration, setHasExpiration] = useState(false)
  const [hasUsageLimit, setHasUsageLimit] = useState(false)
  const [hasPerUserLimit, setHasPerUserLimit] = useState(false)
  const [hasMinimumOrder, setHasMinimumOrder] = useState(false)

  // JST helpers
  const toJstInputValue = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, "0")
    const utc = date.getTime() + date.getTimezoneOffset() * 60000
    const jst = new Date(utc + 9 * 60 * 60000)
    return `${jst.getFullYear()}-${pad(jst.getMonth() + 1)}-${pad(jst.getDate())}T${pad(jst.getHours())}:${pad(jst.getMinutes())}`
  }
  const fromJstInputValue = (value: string) => new Date(`${value}:00+09:00`)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/admin/coupons/${id}`)
        const result = await res.json()
        if (!res.ok || !result.success) throw new Error(result.error || "Failed to load coupon")
        const coupon: Coupon = result.data

        setFormData({
          code: coupon.code,
          name: coupon.name,
          description: coupon.description || "",
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          totalUsageLimit: coupon.totalUsageLimit,
          perUserUsageLimit: coupon.perUserUsageLimit,
          allowedUserIds: coupon.allowedUserIds,
          minimumOrderAmount: coupon.minimumOrderAmount,
          startsAt: new Date(coupon.startsAt),
          expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt) : undefined,
          status: coupon.status as CouponStatus,
        })

        setHasExpiration(!!coupon.expiresAt)
        setHasUsageLimit(coupon.totalUsageLimit != null)
        setHasPerUserLimit(coupon.perUserUsageLimit != null)
        setHasMinimumOrder(coupon.minimumOrderAmount != null)
      } catch (e) {
        console.error(e)
        toast.error("Failed to load coupon")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      const submitData: Partial<CouponFormData> = {
        ...formData,
        code: formData.code.toUpperCase().trim(),
        name: formData.name.trim(),
        description: formData.description?.trim() || undefined,
        totalUsageLimit: hasUsageLimit ? formData.totalUsageLimit : undefined,
        perUserUsageLimit: hasPerUserLimit ? formData.perUserUsageLimit : undefined,
        minimumOrderAmount: hasMinimumOrder ? formData.minimumOrderAmount : undefined,
        expiresAt: hasExpiration ? formData.expiresAt : undefined,
      }

      const res = await fetch(`/api/admin/coupons`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, couponData: submitData }),
      })
      const result = await res.json()
      if (!res.ok || !result.success) throw new Error(result.error || "Failed to update coupon")

      toast.success("Coupon updated")
      router.push(`/${locale}/fyponly-admin/coupons`)
    } catch (e: any) {
      console.error(e)
      toast.error(e.message || "Failed to update coupon")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Edit Coupon</h1>
        </div>
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Coupon</h1>
          <p className="text-muted-foreground">Update existing coupon details</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Update core coupon details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Coupon Code *</Label>
                <Input id="code" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })} className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Display Name *</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(v: CouponStatus) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Discount Configuration</CardTitle>
              <CardDescription>Type and value</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="discountType">Discount Type *</Label>
                <Select value={formData.discountType} onValueChange={(v: CouponDiscountType) => setFormData({ ...formData, discountType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discountValue">Discount Value {formData.discountType === "percentage" ? "(%)" : "($)"}</Label>
                <Input id="discountValue" type="number" min="0" max={formData.discountType === "percentage" ? 100 : undefined} step={formData.discountType === "percentage" ? "1" : "0.01"} value={formData.discountValue} onChange={(e) => setFormData({ ...formData, discountValue: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="hasMinimumOrder" checked={hasMinimumOrder} onCheckedChange={setHasMinimumOrder} />
                <Label htmlFor="hasMinimumOrder">Set minimum order amount</Label>
              </div>
              {hasMinimumOrder && (
                <div className="space-y-2">
                  <Label htmlFor="minimumOrderAmount">Minimum Order Amount ($)</Label>
                  <Input id="minimumOrderAmount" type="number" min="0" step="0.01" value={formData.minimumOrderAmount || ""} onChange={(e) => setFormData({ ...formData, minimumOrderAmount: parseFloat(e.target.value) || undefined })} />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Usage Limits</CardTitle>
              <CardDescription>Configure limits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch id="hasUsageLimit" checked={hasUsageLimit} onCheckedChange={setHasUsageLimit} />
                <Label htmlFor="hasUsageLimit">Set total usage limit</Label>
              </div>
              {hasUsageLimit && (
                <div className="space-y-2">
                  <Label htmlFor="totalUsageLimit">Total Usage Limit</Label>
                  <Input id="totalUsageLimit" type="number" min="1" value={formData.totalUsageLimit || ""} onChange={(e) => setFormData({ ...formData, totalUsageLimit: parseInt(e.target.value) || undefined })} />
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Switch id="hasPerUserLimit" checked={hasPerUserLimit} onCheckedChange={setHasPerUserLimit} />
                <Label htmlFor="hasPerUserLimit">Set per-user usage limit</Label>
              </div>
              {hasPerUserLimit && (
                <div className="space-y-2">
                  <Label htmlFor="perUserUsageLimit">Per-User Usage Limit</Label>
                  <Input id="perUserUsageLimit" type="number" min="1" value={formData.perUserUsageLimit || ""} onChange={(e) => setFormData({ ...formData, perUserUsageLimit: parseInt(e.target.value) || undefined })} />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Time Restrictions</CardTitle>
              <CardDescription>Set when this coupon is valid</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">All dates/times are interpreted in JST (UTC+9).</p>
              <div className="space-y-2">
                <Label htmlFor="startsAt">Start Date & Time</Label>
                <Input id="startsAt" type="datetime-local" value={toJstInputValue(formData.startsAt)} onChange={(e) => setFormData({ ...formData, startsAt: fromJstInputValue(e.target.value) })} />
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="hasExpiration" checked={hasExpiration} onCheckedChange={setHasExpiration} />
                <Label htmlFor="hasExpiration">Set expiration date</Label>
              </div>
              {hasExpiration && (
                <div className="space-y-2">
                  <Label htmlFor="expiresAt">Expiration Date & Time</Label>
                  <Input id="expiresAt" type="datetime-local" value={formData.expiresAt ? toJstInputValue(formData.expiresAt) : ""} onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value ? fromJstInputValue(e.target.value) : undefined })} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}

