'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Target, Percent, Star } from 'lucide-react'
import { toast } from 'sonner'

interface RecommendedProduct {
  date: string
  type: 'deals' | 'best_sellers'
  rank: number
  score: number
  reason?: string[] | string
  product: {
    id: string
    sku: string
    name_en: string
    price: number
    compare_at_price?: number | null
    stock_quantity: number
    images?: string[]
    is_active: boolean
  }
}

export default function RecommendationsTab() {
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [date, setDate] = useState<string>('')
  const [deals, setDeals] = useState<RecommendedProduct[]>([])
  const [best, setBest] = useState<RecommendedProduct[]>([])

  const loadRecommendations = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/admin/product-categories/recommendations', { cache: 'no-store' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Failed to fetch recommendations')
      setDeals(json.data.deals || [])
      setBest(json.data.best || [])
      setDate(json.date)
    } catch (e: any) {
      console.error(e)
      toast.error('Failed to load recommendations')
    } finally {
      setIsLoading(false)
    }
  }

  const generateNow = async () => {
    try {
      setIsGenerating(true)
      const res = await fetch('/api/admin/product-categories/recommendations/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_type: 'manual' })
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Generation failed')
      toast.success('Recommendations generated')
      await loadRecommendations()
    } catch (e: any) {
      console.error(e)
      toast.error(e.message || 'Failed to generate recommendations')
    } finally {
      setIsGenerating(false)
    }
  }

  useEffect(() => {
    loadRecommendations()
  }, [])

  const headerNote = useMemo(() => {
    if (!date) return null
    return `Generated for ${date}`
  }, [date])

  const Section = ({ title, icon, items }: { title: string; icon: any; items: RecommendedProduct[] }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <Badge variant="secondary">{items.length}</Badge>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground">No recommendations yet. Click Generate to create today's list.</div>
        ) : (
          <div className="space-y-3">
            {items.slice(0, 20).map((item) => (
              <div key={`${item.type}-${item.product.id}`} className="flex items-start justify-between border rounded-lg p-3 hover:bg-gray-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-indigo-600">#{item.rank}</span>
                    <span className="font-medium truncate">{item.product.name_en}</span>
                    <span className="text-xs text-gray-500">({item.product.sku})</span>
                    <Badge variant="outline" className="ml-2">Score {item.score?.toFixed(2)}</Badge>
                  </div>
                  <div className="text-xs text-gray-600 line-clamp-2">
                    {Array.isArray(item.reason) ? item.reason.join(' • ') : (item.reason || '')}
                  </div>
                </div>
                <div className="text-right ml-3">
                  <div className="text-sm font-semibold">${'{'}item.product.price.toFixed(2){'}'}</div>
                  {item.product.compare_at_price && item.product.compare_at_price > item.product.price ? (
                    <div className="text-xs text-gray-500 line-through">${'{'}item.product.compare_at_price.toFixed(2){'}'}</div>
                  ) : null}
                  <div className="text-xs text-gray-500">Stock: {item.product.stock_quantity}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5" /> Daily Recommendations
          </h3>
          {headerNote && <p className="text-sm text-muted-foreground">{headerNote}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={loadRecommendations} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button onClick={generateNow} size="sm" disabled={isGenerating}>
            <RefreshCw className="h-4 w-4 mr-1" /> Generate Today
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Deals & Discounts Suggestions" icon={<Percent className="h-4 w-4" />} items={deals} />
        <Section title="Best Sellers Suggestions" icon={<Star className="h-4 w-4" />} items={best} />
      </div>
    </div>
  )
}

