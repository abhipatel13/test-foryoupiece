import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export interface BestSellerRecommendation {
  product_id: string
  sku: string
  name_en: string
  current_position: number | null
  recommended_position: number
  action: 'promote' | 'demote' | 'maintain' | 'add' | 'remove'
  confidence_score: number
  reasoning: string[]
  performance_metrics: {
    revenue_rank: number
    units_rank: number
    frequency_rank: number
    total_revenue: number
    total_units_sold: number
    order_count: number
    performance_score: number
  }
  impact_analysis: {
    revenue_contribution: number
    growth_trend: 'increasing' | 'decreasing' | 'stable'
    seasonality_factor: number
  }
}

export interface RecommendationsResponse {
  success: boolean
  data: {
    recommendations: BestSellerRecommendation[]
    summary: {
      total_recommendations: number
      promote_count: number
      demote_count: number
      add_count: number
      remove_count: number
      maintain_count: number
      avg_confidence_score: number
    }
    analysis_period: {
      start_date: string
      end_date: string
      days: number
    }
  }
  error?: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const confidenceThreshold = parseFloat(searchParams.get('confidence_threshold') || '0.7')
    const maxRecommendations = parseInt(searchParams.get('max_recommendations') || '20')
    
    const supabase = createServiceRoleClient()

    if (!supabase) {
      console.error('❌ Failed to create service role client for recommendations')
      return NextResponse.json(
        {
          success: false,
          error: 'Service configuration error'
        },
        { status: 500 }
      )
    }
    
    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - days)
    
    console.log(`🤖 Generating best seller recommendations for ${days} days`)
    
    // Get sales analytics data
    const { data: salesData, error: salesError } = await supabase
      .rpc('get_sales_analytics', {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        min_sales_threshold: 1
      })
    
    if (salesError) {
      console.error('❌ Error fetching sales data for recommendations:', salesError)
      throw salesError
    }
    
    if (!salesData || salesData.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          recommendations: [],
          summary: {
            total_recommendations: 0,
            promote_count: 0,
            demote_count: 0,
            add_count: 0,
            remove_count: 0,
            maintain_count: 0,
            avg_confidence_score: 0
          },
          analysis_period: {
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            days
          }
        }
      })
    }
    
    // Calculate performance metrics and rankings
    const maxRevenue = Math.max(...salesData.map((d: any) => parseFloat(d.total_revenue)))
    const maxUnits = Math.max(...salesData.map((d: any) => d.total_units_sold))
    const maxOrders = Math.max(...salesData.map((d: any) => d.order_count))
    
    const analyticsWithScores = salesData.map((item: any, index: number) => {
      const revenue = parseFloat(item.total_revenue)
      const units = item.total_units_sold
      const orders = item.order_count
      
      // Normalized scores (0-100)
      const revenueScore = maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0
      const unitsScore = maxUnits > 0 ? (units / maxUnits) * 100 : 0
      const frequencyScore = maxOrders > 0 ? (orders / maxOrders) * 100 : 0
      
      // Weighted performance score
      const performanceScore = (revenueScore * 0.4) + (unitsScore * 0.3) + (frequencyScore * 0.3)
      
      return {
        ...item,
        revenue_rank: index + 1,
        performance_score: performanceScore,
        revenue_score: revenueScore,
        units_score: unitsScore,
        frequency_score: frequencyScore
      }
    })
    
    // Sort by units and frequency for additional rankings
    const sortedByUnits = [...analyticsWithScores].sort((a, b) => b.total_units_sold - a.total_units_sold)
    const sortedByFrequency = [...analyticsWithScores].sort((a, b) => b.order_count - a.order_count)
    
    analyticsWithScores.forEach(item => {
      item.units_rank = sortedByUnits.findIndex(p => p.product_id === item.product_id) + 1
      item.frequency_rank = sortedByFrequency.findIndex(p => p.product_id === item.product_id) + 1
    })
    
    // Generate recommendations
    const recommendations: BestSellerRecommendation[] = []
    
    analyticsWithScores.forEach((item: any) => {
      const currentPosition = item.best_seller_position
      const isCurrentBestSeller = item.is_best_seller
      const performanceScore = item.performance_score
      const revenueRank = item.revenue_rank
      
      let action: BestSellerRecommendation['action'] = 'maintain'
      let recommendedPosition = currentPosition
      let confidenceScore = 0
      const reasoning: string[] = []
      
      // Determine recommended action based on performance
      if (!isCurrentBestSeller && revenueRank <= 10 && performanceScore >= 60) {
        action = 'add'
        recommendedPosition = revenueRank
        confidenceScore = Math.min(0.95, performanceScore / 100 + 0.2)
        reasoning.push(`High performance (rank #${revenueRank} in revenue)`)
        reasoning.push(`Strong performance score: ${performanceScore.toFixed(1)}%`)
        if (item.units_rank <= 10) reasoning.push(`Top 10 in units sold (rank #${item.units_rank})`)
        if (item.frequency_rank <= 10) reasoning.push(`Top 10 in order frequency (rank #${item.frequency_rank})`)
      } else if (isCurrentBestSeller && revenueRank > 20) {
        action = 'remove'
        recommendedPosition = null
        confidenceScore = Math.min(0.9, (30 - revenueRank) / 30 + 0.3)
        reasoning.push(`Poor performance (rank #${revenueRank} in revenue)`)
        reasoning.push(`Low performance score: ${performanceScore.toFixed(1)}%`)
        if (item.units_rank > 25) reasoning.push(`Low units sold rank: #${item.units_rank}`)
      } else if (isCurrentBestSeller && revenueRank <= 20) {
        const idealPosition = Math.min(revenueRank, 20)
        if (Math.abs(currentPosition - idealPosition) > 2) {
          action = currentPosition > idealPosition ? 'promote' : 'demote'
          recommendedPosition = idealPosition
          confidenceScore = Math.min(0.85, 1 - Math.abs(currentPosition - idealPosition) / 20)
          reasoning.push(`Position optimization based on performance`)
          reasoning.push(`Current: #${currentPosition}, Recommended: #${idealPosition}`)
          reasoning.push(`Revenue rank: #${revenueRank}`)
        } else {
          action = 'maintain'
          confidenceScore = 0.8
          reasoning.push(`Current position aligns with performance`)
          reasoning.push(`Revenue rank: #${revenueRank}`)
        }
      }
      
      // Only include recommendations above confidence threshold
      if (confidenceScore >= confidenceThreshold && action !== 'maintain') {
        recommendations.push({
          product_id: item.product_id,
          sku: item.sku,
          name_en: item.name_en,
          current_position: currentPosition,
          recommended_position: recommendedPosition,
          action,
          confidence_score: Math.round(confidenceScore * 100) / 100,
          reasoning,
          performance_metrics: {
            revenue_rank: revenueRank,
            units_rank: item.units_rank,
            frequency_rank: item.frequency_rank,
            total_revenue: parseFloat(item.total_revenue),
            total_units_sold: item.total_units_sold,
            order_count: item.order_count,
            performance_score: Math.round(performanceScore * 100) / 100
          },
          impact_analysis: {
            revenue_contribution: (parseFloat(item.total_revenue) / maxRevenue) * 100,
            growth_trend: 'stable', // TODO: Implement trend analysis
            seasonality_factor: 1.0 // TODO: Implement seasonality analysis
          }
        })
      }
    })
    
    // Sort recommendations by confidence score and limit results
    recommendations.sort((a, b) => b.confidence_score - a.confidence_score)
    const limitedRecommendations = recommendations.slice(0, maxRecommendations)
    
    // Calculate summary statistics
    const summary = {
      total_recommendations: limitedRecommendations.length,
      promote_count: limitedRecommendations.filter(r => r.action === 'promote').length,
      demote_count: limitedRecommendations.filter(r => r.action === 'demote').length,
      add_count: limitedRecommendations.filter(r => r.action === 'add').length,
      remove_count: limitedRecommendations.filter(r => r.action === 'remove').length,
      maintain_count: limitedRecommendations.filter(r => r.action === 'maintain').length,
      avg_confidence_score: limitedRecommendations.length > 0 
        ? limitedRecommendations.reduce((sum, r) => sum + r.confidence_score, 0) / limitedRecommendations.length 
        : 0
    }
    
    console.log(`✅ Generated ${limitedRecommendations.length} recommendations with avg confidence ${summary.avg_confidence_score.toFixed(2)}`)
    
    return NextResponse.json({
      success: true,
      data: {
        recommendations: limitedRecommendations,
        summary,
        analysis_period: {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          days
        }
      }
    })
    
  } catch (error) {
    console.error('❌ Error generating recommendations:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate recommendations'
      },
      { status: 500 }
    )
  }
}
