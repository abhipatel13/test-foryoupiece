'use client'

import { useState, useEffect, useMemo } from 'react'
import { Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { requestUtils } from '@/lib/utils/request-deduplication'

interface LightweightPointsDisplayProps {
  userId: string
  className?: string
}

interface PointsSummary {
  total_available: number
  current_tier: string
}

const tierColors = {
  bronze: 'text-amber-600 bg-amber-50 border-amber-200',
  silver: 'text-gray-600 bg-gray-50 border-gray-200',
  gold: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  platinum: 'text-purple-600 bg-purple-50 border-purple-200',
  diamond: 'text-blue-600 bg-blue-50 border-blue-200'
}

const formatPrice = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function LightweightPointsDisplay({ userId, className = '' }: LightweightPointsDisplayProps) {
  const [pointsSummary, setPointsSummary] = useState<PointsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const loadPointsSummary = async () => {
      try {
        setLoading(true)
        setError(null)

        // Use the existing cached user points summary instead of full breakdown
        const summary = await requestUtils.fetchUserPointsSummary(userId)
        
        if (mounted && summary) {
          setPointsSummary({
            total_available: summary.points_balance || 0, // Fix: Use points_balance from UserPointsSummary
            current_tier: summary.current_rank || 'bronze' // Fix: Use current_rank from UserPointsSummary
          })
        }
      } catch (err: any) {
        console.warn('⚠️ Lightweight points display failed:', err.message)
        if (mounted) {
          // Fail silently with default values to avoid blocking dropdown
          setPointsSummary({
            total_available: 0,
            current_tier: 'bronze'
          })
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    if (userId) {
      loadPointsSummary()
    }

    return () => {
      mounted = false
    }
  }, [userId])

  // Memoize tier styling to prevent recalculation
  const tierColor = useMemo(() => {
    if (!pointsSummary) return tierColors.bronze
    return tierColors[pointsSummary.current_tier as keyof typeof tierColors] || tierColors.bronze
  }, [pointsSummary?.current_tier])

  // Show minimal loading state
  if (loading) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="h-4 w-4 bg-gray-200 rounded-full animate-pulse" />
            <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse" />
        </div>
        <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
      </div>
    )
  }

  // Show error state or default values
  if (error || !pointsSummary) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Star className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-500">Points unavailable</span>
          </div>
          <Badge variant="outline" className="text-xs text-gray-500">
            --
          </Badge>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Star className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium">
            {pointsSummary.total_available.toLocaleString()} points
          </span>
        </div>
        <Badge variant="outline" className={`text-xs ${tierColor}`}>
          {pointsSummary.current_tier.toUpperCase()}
        </Badge>
      </div>
      <div className="text-xs text-gray-600">
        Worth {formatPrice(pointsSummary.total_available / 1000)}
      </div>
      <div className="text-xs text-gray-500">
        <div className="flex justify-between">
          <span>Earned Points:</span>
          <span>{pointsSummary.total_available.toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}
