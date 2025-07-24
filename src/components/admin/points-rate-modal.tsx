'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Loader2, Star, Calculator } from 'lucide-react'
import { toast } from 'sonner'

interface ProductForModal {
  id: string
  name_en: string
  sku: string
  price: number
  points_rate?: number
}

interface PointsRateModalProps {
  isOpen: boolean
  onClose: () => void
  products: ProductForModal[]
  onUpdate: () => void
}

export function PointsRateModal({ isOpen, onClose, products, onUpdate }: PointsRateModalProps) {
  const [pointsRate, setPointsRate] = useState<number>(1.0)
  const [isLoading, setIsLoading] = useState(false)
  const [bulkUpdate, setBulkUpdate] = useState(products.length > 1)

  useEffect(() => {
    if (products.length === 1) {
      setPointsRate(products[0].points_rate || 1.0)
      setBulkUpdate(false)
    } else {
      setPointsRate(1.0)
      setBulkUpdate(true)
    }
  }, [products])

  const handleSubmit = async () => {
    if (pointsRate < 0 || pointsRate > 100) {
      toast.error('Points rate must be between 0% and 100%')
      return
    }

    setIsLoading(true)
    try {
      const productIds = products.map(p => p.id)
      
      const response = await fetch('/api/admin/products/points-rate', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productIds,
          pointsRate,
          bulkUpdate
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast.success(result.message)
        onUpdate()
        onClose()
      } else {
        toast.error(result.error || 'Failed to update points rate')
      }
    } catch (error) {
      console.error('Error updating points rate:', error)
      toast.error('Failed to update points rate')
    } finally {
      setIsLoading(false)
    }
  }

  // Get the effective price for points calculation (sale price if available, otherwise regular price)
  const getEffectivePrice = (product: any) => {
    // Handle both raw price values and price objects
    const price = typeof product.price === 'object' ? product.price.value : product.price
    const compareAtPrice = typeof product.compare_at_price === 'object' ? product.compare_at_price.value : product.compare_at_price

    // If compare_at_price exists and is higher than price, then price is the sale price
    // Otherwise, use the regular price
    // For points calculation, we always use the actual price the customer pays
    return price || 0
  }

  const calculatePoints = (price: number) => {
    // Based on user requirements: $50 at 1% rate should give 500 points
    // This means: price * pointsRate * 10 (treating pointsRate as the percentage value)
    // Formula: price * pointsRate * 10
    return Math.floor(price * pointsRate * 10)
  }

  const calculateDollarValue = (points: number) => {
    // 1000 points = $1 value
    return (points / 1000).toFixed(2)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Star className="h-5 w-5 text-orange-600" />
            <span>Configure Points Rate</span>
          </DialogTitle>
          <DialogDescription>
            Set the points rate for {products.length === 1 ? 'this product' : `${products.length} products`}.
            Points are calculated as: Price × (Rate / 100) × 10
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Points Rate Input */}
          <div className="space-y-2">
            <Label htmlFor="pointsRate">Points Rate (%)</Label>
            <div className="flex items-center space-x-2">
              <Input
                id="pointsRate"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={pointsRate}
                onChange={(e) => setPointsRate(parseFloat(e.target.value) || 0)}
                className="w-32"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter a percentage between 0% and 100%. Default is 1% (equivalent to 1% cashback).
            </p>
          </div>

          <Separator />

          {/* Preview Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Calculator className="h-4 w-4 text-blue-600" />
              <h4 className="font-medium">Points Calculation Preview</h4>
            </div>
            
            {products.length === 1 ? (
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{products[0].name_en}</span>
                  <Badge variant="outline">{products[0].sku}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Price</p>
                    <p className="font-medium">${getEffectivePrice(products[0]).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Points Rate</p>
                    <p className="font-medium text-orange-600">{pointsRate}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Points Earned</p>
                    <p className="font-medium text-green-600">{calculatePoints(getEffectivePrice(products[0]))} points</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Dollar Value</p>
                    <p className="font-medium text-green-600">${calculateDollarValue(calculatePoints(getEffectivePrice(products[0])))}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Preview for first 3 products (all {products.length} products will be updated):
                </p>
                {products.slice(0, 3).map((product) => (
                  <div key={product.id} className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{product.name_en}</span>
                      <Badge variant="outline" className="text-xs">{product.sku}</Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Price</p>
                        <p className="font-medium">${getEffectivePrice(product).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Rate</p>
                        <p className="font-medium text-orange-600">{pointsRate}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Points</p>
                        <p className="font-medium text-green-600">{calculatePoints(getEffectivePrice(product))}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Value</p>
                        <p className="font-medium text-green-600">${calculateDollarValue(calculatePoints(getEffectivePrice(product)))}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {products.length > 3 && (
                  <p className="text-xs text-muted-foreground text-center">
                    ... and {products.length - 3} more products
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Common Rates Quick Select */}
          <div className="space-y-2">
            <Label>Quick Select Common Rates</Label>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 5, 10, 15, 20].map((rate) => (
                <Button
                  key={rate}
                  variant={pointsRate === rate ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPointsRate(rate)}
                >
                  {rate}%
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Points Rate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
