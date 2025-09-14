'use client'

import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Calculator, Percent, Tag } from 'lucide-react'
import { toast } from 'sonner'

export interface SalesProductRef {
  id: string
  sku: string
  name_en: string
  price: number
  compare_at_price?: number | null
  points_rate?: number | null
}

interface SalesConfigModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: SalesProductRef | null
  onSaved: () => void
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

export function SalesConfigModal({ open, onOpenChange, product, onSaved }: SalesConfigModalProps) {
  const baseOriginal = useMemo(() => {
    if (!product) return 0
    // If product already has compare_at_price, use it as original; else current price is original
    return product.compare_at_price && product.compare_at_price > 0 ? Number(product.compare_at_price) : Number(product.price)
  }, [product])

  const [discountPct, setDiscountPct] = useState<number>(10)
  const [salePrice, setSalePrice] = useState<number>(0)
  const [pointsRate, setPointsRate] = useState<number>(1)
  const [saleEndsAt, setSaleEndsAt] = useState<string>('') // datetime-local string
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!product) return
    const initialPoints = typeof product.points_rate === 'number' ? Number(product.points_rate) : 1
    setPointsRate(initialPoints)

    // Initialize discount and sale price sensibly
    const original = baseOriginal
    // If item is already on sale, compute displayed discount from its state
    if (product.compare_at_price && product.compare_at_price > product.price) {
      const pct = Math.round(((product.compare_at_price - product.price) / product.compare_at_price) * 100)
      setDiscountPct(pct)
      setSalePrice(Number(product.price))
    } else {
      const defaultPct = 10
      setDiscountPct(defaultPct)
      setSalePrice(round2(original * (1 - defaultPct / 100)))
    }
    setSaleEndsAt('')
  }, [product, baseOriginal])

  // Keep the two fields in sync
  const handleDiscountChange = (value: string) => {
    const v = Number(value)
    if (Number.isNaN(v)) return
    const pct = Math.max(0, Math.min(90, v))
    setDiscountPct(pct)
    const original = baseOriginal
    setSalePrice(round2(original * (1 - pct / 100)))
  }

  const handleSalePriceChange = (value: string) => {
    const v = Number(value)
    if (Number.isNaN(v)) return
    const price = Math.max(0, v)
    setSalePrice(price)
    const original = baseOriginal || 1
    const pct = original > 0 ? Math.round(((original - price) / original) * 100) : 0
    setDiscountPct(Math.max(0, Math.min(90, pct)))
  }

  const handleSave = async () => {
    if (!product) return

    const original = baseOriginal
    if (original <= 0) {
      toast.error('Invalid original price')
      return
    }

    if (salePrice <= 0 || salePrice >= original) {
      toast.error('Sale price must be less than original price')
      return
    }

    if (pointsRate < 0 || pointsRate > 100) {
      toast.error('Points multiplier must be between 0 and 100')
      return
    }

    setIsSaving(true)
    try {
      // 1) Update price and compare_at_price in a single admin endpoint
      const updatePayload = {
        updates: [
          {
            id: product.id,
            price: round2(salePrice),
            compare_at_price: round2(original),
            sale_ends_at: saleEndsAt || null,
          },
        ],
        operation: 'set_prices',
      }
      const res = await fetch('/api/admin/product-categories/sales', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      })
      const json = await res.json()
      if (!json?.success) throw new Error(json?.error || 'Failed to update sale pricing')

      // 2) Optionally update points rate (only if changed)
      if (typeof product.points_rate === 'number') {
        if (Number(product.points_rate) !== Number(pointsRate)) {
          const res2 = await fetch('/api/admin/products/points-rate', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productIds: product.id, pointsRate: Number(pointsRate), bulkUpdate: false }),
          })
          const j2 = await res2.json()
          if (!j2?.success) throw new Error(j2?.error || 'Failed to update points rate')
        }
      } else {
        // If product had no points_rate, set it explicitly
        const res2 = await fetch('/api/admin/products/points-rate', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productIds: product.id, pointsRate: Number(pointsRate), bulkUpdate: false }),
        })
        const j2 = await res2.json()
        if (!j2?.success) throw new Error(j2?.error || 'Failed to update points rate')
      }

      // 3) Invalidate product caches to reflect immediately across site
      try {
        await fetch('/api/admin/cache/invalidate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cacheTypes: ['products'], reason: 'admin_sale_update' }),
        })
      } catch {}

      toast.success('Sale updated successfully')
      onSaved()
      onOpenChange(false)
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message || 'Failed to save sale configuration')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" /> Add to Sales
          </DialogTitle>
          <DialogDescription>
            Configure discount, final price, points multiplier, and optional expiry.
          </DialogDescription>
        </DialogHeader>

        {product && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{product.name_en}</div>
                <div className="text-xs text-muted-foreground">SKU: {product.sku}</div>
              </div>
              <Badge variant="outline">Original: ${baseOriginal.toFixed(2)}</Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discount">Discount (%)</Label>
                <div className="flex items-center gap-2">
                  <Input id="discount" type="number" min={0} max={90} step={1} value={discountPct}
                         onChange={(e) => handleDiscountChange(e.target.value)} className="w-full" />
                  <Percent className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sale-price">Final Sale Price</Label>
                <Input id="sale-price" type="number" min={0} step={0.01} value={salePrice}
                       onChange={(e) => handleSalePriceChange(e.target.value)} className="w-full" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="points-rate">Points Multiplier (%)</Label>
                <Input id="points-rate" type="number" min={0} max={100} step={0.1}
                       value={pointsRate} onChange={(e) => setPointsRate(Number(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sale-ends">Sale Ends (optional)</Label>
                <Input id="sale-ends" type="datetime-local" value={saleEndsAt}
                       onChange={(e) => setSaleEndsAt(e.target.value)} />
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-blue-600" />
                <div className="text-sm font-medium">Preview</div>
              </div>
              <div className="text-sm text-muted-foreground">
                {discountPct}% off • From ${baseOriginal.toFixed(2)} to ${salePrice.toFixed(2)}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !product}>
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

