'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Target, 
  ArrowUp, 
  ArrowDown, 
  Plus, 
  Minus, 
  CheckCircle, 
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Package,
  Zap,
  RefreshCw
} from 'lucide-react'
import type { BestSellerRecommendation, RecommendationsResponse } from '@/app/api/admin/analytics/recommendations/route'
import { useBulkBestSellerUpdate } from '@/hooks/useAnalytics'

interface RecommendationsPanelProps {
  recommendations: BestSellerRecommendation[]
  summary?: RecommendationsResponse['data']['summary']
  isLoading: boolean
  onApplyRecommendations: () => void
}

export function RecommendationsPanel({ 
  recommendations, 
  summary, 
  isLoading, 
  onApplyRecommendations 
}: RecommendationsPanelProps) {
  const [selectedRecommendations, setSelectedRecommendations] = useState<Set<string>>(new Set())
  const { applyBulkUpdate, isLoading: isApplying } = useBulkBestSellerUpdate()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num)
  }

  const getActionIcon = (action: BestSellerRecommendation['action']) => {
    switch (action) {
      case 'promote': return <ArrowUp className="h-4 w-4 text-green-600" />
      case 'demote': return <ArrowDown className="h-4 w-4 text-orange-600" />
      case 'add': return <Plus className="h-4 w-4 text-blue-600" />
      case 'remove': return <Minus className="h-4 w-4 text-red-600" />
      default: return <CheckCircle className="h-4 w-4 text-gray-600" />
    }
  }

  const getActionColor = (action: BestSellerRecommendation['action']) => {
    switch (action) {
      case 'promote': return 'bg-green-100 text-green-800 border-green-200'
      case 'demote': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'add': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'remove': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getActionText = (recommendation: BestSellerRecommendation) => {
    switch (recommendation.action) {
      case 'promote':
        return `Promote to position #${recommendation.recommended_position}`
      case 'demote':
        return `Demote to position #${recommendation.recommended_position}`
      case 'add':
        return `Add as best seller at position #${recommendation.recommended_position}`
      case 'remove':
        return 'Remove from best sellers'
      default:
        return 'No action needed'
    }
  }

  const getConfidenceColor = (score: number) => {
    if (score >= 0.9) return 'text-green-600'
    if (score >= 0.7) return 'text-blue-600'
    if (score >= 0.5) return 'text-orange-600'
    return 'text-red-600'
  }

  const handleSelectRecommendation = (productId: string, checked: boolean) => {
    const newSelected = new Set(selectedRecommendations)
    if (checked) {
      newSelected.add(productId)
    } else {
      newSelected.delete(productId)
    }
    setSelectedRecommendations(newSelected)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRecommendations(new Set(recommendations.map(r => r.product_id)))
    } else {
      setSelectedRecommendations(new Set())
    }
  }

  const handleApplySelected = async () => {
    const selectedRecs = recommendations.filter(r => selectedRecommendations.has(r.product_id))
    
    if (selectedRecs.length === 0) {
      alert('Please select at least one recommendation to apply.')
      return
    }

    const updates = selectedRecs.map(rec => ({
      product_id: rec.product_id,
      action: rec.action,
      new_position: rec.recommended_position
    }))

    const result = await applyBulkUpdate(updates, 'Applied analytics recommendations')
    
    if (result?.success) {
      setSelectedRecommendations(new Set())
      onApplyRecommendations()
      alert(`Successfully applied ${result.data.updated_count} recommendations!`)
    } else {
      alert('Failed to apply some recommendations. Please check the console for details.')
    }
  }

  const handleApplyHighConfidence = async () => {
    const highConfidenceRecs = recommendations.filter(r => r.confidence_score >= 0.8)
    
    if (highConfidenceRecs.length === 0) {
      alert('No high-confidence recommendations available.')
      return
    }

    const updates = highConfidenceRecs.map(rec => ({
      product_id: rec.product_id,
      action: rec.action,
      new_position: rec.recommended_position
    }))

    const result = await applyBulkUpdate(updates, 'Auto-applied high-confidence recommendations')
    
    if (result?.success) {
      onApplyRecommendations()
      alert(`Successfully applied ${result.data.updated_count} high-confidence recommendations!`)
    } else {
      alert('Failed to apply some recommendations. Please check the console for details.')
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Recommendations</CardTitle>
          <CardDescription>Loading recommendations...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="h-4 w-4 bg-secondary rounded"></div>
                  <div className="h-4 bg-secondary rounded w-32"></div>
                  <div className="h-4 bg-secondary rounded w-20"></div>
                </div>
                <div className="h-4 bg-secondary rounded w-24"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Add</p>
                  <p className="text-2xl font-bold">{summary.add_count}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <ArrowUp className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Promote</p>
                  <p className="text-2xl font-bold">{summary.promote_count}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <ArrowDown className="h-4 w-4 text-orange-600" />
                <div>
                  <p className="text-sm font-medium">Demote</p>
                  <p className="text-2xl font-bold">{summary.demote_count}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Minus className="h-4 w-4 text-red-600" />
                <div>
                  <p className="text-sm font-medium">Remove</p>
                  <p className="text-2xl font-bold">{summary.remove_count}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Recommendations Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                AI-Powered Recommendations
              </CardTitle>
              <CardDescription>
                Data-driven suggestions to optimize your best seller selections
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                onClick={handleApplyHighConfidence}
                disabled={isApplying || recommendations.filter(r => r.confidence_score >= 0.8).length === 0}
                variant="outline"
              >
                <Zap className="h-4 w-4 mr-2" />
                Auto-Apply High Confidence
              </Button>
              
              <Button 
                onClick={handleApplySelected}
                disabled={isApplying || selectedRecommendations.size === 0}
              >
                {isApplying && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                Apply Selected ({selectedRecommendations.size})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {recommendations.length === 0 ? (
            <div className="text-center py-8">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No recommendations</h3>
              <p className="text-muted-foreground">
                Your current best seller configuration is optimal based on sales data.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Select All */}
              <div className="flex items-center gap-2 pb-2 border-b">
                <Checkbox
                  checked={selectedRecommendations.size === recommendations.length}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm font-medium">
                  Select All ({recommendations.length} recommendations)
                </span>
              </div>

              {/* Recommendations List */}
              {recommendations.map((recommendation) => (
                <div key={recommendation.product_id} className="border rounded-lg p-4">
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={selectedRecommendations.has(recommendation.product_id)}
                      onCheckedChange={(checked) => 
                        handleSelectRecommendation(recommendation.product_id, checked as boolean)
                      }
                    />
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <h4 className="font-medium">{recommendation.name_en}</h4>
                          <Badge className={getActionColor(recommendation.action)}>
                            {getActionIcon(recommendation.action)}
                            {recommendation.action}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Confidence:</span>
                          <span className={`font-semibold ${getConfidenceColor(recommendation.confidence_score)}`}>
                            {(recommendation.confidence_score * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-3">
                        {recommendation.sku} • {getActionText(recommendation)}
                      </p>
                      
                      {/* Performance Metrics */}
                      <div className="grid grid-cols-3 gap-4 mb-3">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Revenue Rank</p>
                            <p className="font-semibold">#{recommendation.performance_metrics.revenue_rank}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Units Sold</p>
                            <p className="font-semibold">{formatNumber(recommendation.performance_metrics.total_units_sold)}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Performance</p>
                            <p className="font-semibold">{recommendation.performance_metrics.performance_score.toFixed(1)}%</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Reasoning */}
                      <div className="space-y-1">
                        {recommendation.reasoning.map((reason, index) => (
                          <p key={index} className="text-xs text-muted-foreground flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            {reason}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
