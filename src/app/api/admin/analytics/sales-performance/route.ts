import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export interface SalesAnalytics {
  product_id: string
  sku: string
  name_en: string
  name_ja: string
  total_units_sold: number
  total_revenue: number
  order_count: number
  avg_order_value: number
  last_sale_date: string | null
  first_sale_date: string | null
  is_current_best_seller: boolean
  current_best_seller_position: number | null
  recommended_position: number | null
  performance_score: number
  revenue_rank: number
  units_rank: number
  frequency_rank: number
  images: string[]
  price: number
  category: {
    id: string
    name_en: string
    slug: string
  } | null
}

export interface SalesPerformanceResponse {
  success: boolean
  data: {
    analytics: SalesAnalytics[]
    summary: {
      total_products_analyzed: number
      total_revenue: number
      total_units_sold: number
      total_orders: number
      current_best_sellers_count: number
      recommended_best_sellers_count: number
      performance_discrepancies: number
    }
    time_period: {
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
    const limit = parseInt(searchParams.get('limit') || '50')
    const minSales = parseInt(searchParams.get('min_sales') || '1')
    
    const supabase = createServiceRoleClient()

    if (!supabase) {
      console.error('❌ Failed to create service role client for sales analytics')
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
    
    console.log(`📊 Analyzing sales performance for ${days} days (${startDate.toISOString()} to ${endDate.toISOString()})`)
    
    // Get sales analytics with comprehensive product data
    const { data: salesData, error: salesError } = await supabase
      .rpc('get_sales_analytics', {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        min_sales_threshold: minSales
      })
    
    if (salesError) {
      console.error('❌ Error fetching sales analytics:', salesError)
      throw salesError
    }
    
    if (!salesData || salesData.length === 0) {
      console.log('📊 No sales data found for the specified period')
      return NextResponse.json({
        success: true,
        data: {
          analytics: [],
          summary: {
            total_products_analyzed: 0,
            total_revenue: 0,
            total_units_sold: 0,
            total_orders: 0,
            current_best_sellers_count: 0,
            recommended_best_sellers_count: 0,
            performance_discrepancies: 0
          },
          time_period: {
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            days
          }
        }
      })
    }
    
    // Calculate performance scores and rankings
    const analytics: SalesAnalytics[] = salesData.map((item: any, index: number) => {
      // Performance score calculation (weighted average)
      const revenueWeight = 0.4
      const unitsWeight = 0.3
      const frequencyWeight = 0.3
      
      const maxRevenue = Math.max(...salesData.map((d: any) => d.total_revenue))
      const maxUnits = Math.max(...salesData.map((d: any) => d.total_units_sold))
      const maxOrders = Math.max(...salesData.map((d: any) => d.order_count))
      
      const revenueScore = maxRevenue > 0 ? (item.total_revenue / maxRevenue) * 100 : 0
      const unitsScore = maxUnits > 0 ? (item.total_units_sold / maxUnits) * 100 : 0
      const frequencyScore = maxOrders > 0 ? (item.order_count / maxOrders) * 100 : 0
      
      const performanceScore = (
        revenueScore * revenueWeight +
        unitsScore * unitsWeight +
        frequencyScore * frequencyWeight
      )
      
      return {
        product_id: item.product_id,
        sku: item.sku,
        name_en: item.name_en,
        name_ja: item.name_ja,
        total_units_sold: item.total_units_sold,
        total_revenue: parseFloat(item.total_revenue),
        order_count: item.order_count,
        avg_order_value: item.order_count > 0 ? parseFloat(item.total_revenue) / item.order_count : 0,
        last_sale_date: item.last_sale_date,
        first_sale_date: item.first_sale_date,
        is_current_best_seller: item.is_best_seller || false,
        current_best_seller_position: item.best_seller_position,
        recommended_position: index < 20 ? index + 1 : null, // Top 20 get recommended positions
        performance_score: Math.round(performanceScore * 100) / 100,
        revenue_rank: index + 1, // Already sorted by revenue
        units_rank: 0, // Will be calculated below
        frequency_rank: 0, // Will be calculated below
        images: item.images || [],
        price: parseFloat(item.price || 0),
        category: item.category_id ? {
          id: item.category_id,
          name_en: item.category_name_en || 'Uncategorized',
          slug: item.category_slug || 'uncategorized'
        } : null
      }
    })
    
    // Calculate units and frequency rankings
    const sortedByUnits = [...analytics].sort((a, b) => b.total_units_sold - a.total_units_sold)
    const sortedByFrequency = [...analytics].sort((a, b) => b.order_count - a.order_count)
    
    analytics.forEach(item => {
      item.units_rank = sortedByUnits.findIndex(p => p.product_id === item.product_id) + 1
      item.frequency_rank = sortedByFrequency.findIndex(p => p.product_id === item.product_id) + 1
    })
    
    // Calculate summary statistics
    const summary = {
      total_products_analyzed: analytics.length,
      total_revenue: analytics.reduce((sum, item) => sum + item.total_revenue, 0),
      total_units_sold: analytics.reduce((sum, item) => sum + item.total_units_sold, 0),
      total_orders: analytics.reduce((sum, item) => sum + item.order_count, 0),
      current_best_sellers_count: analytics.filter(item => item.is_current_best_seller).length,
      recommended_best_sellers_count: analytics.filter(item => item.recommended_position !== null).length,
      performance_discrepancies: analytics.filter(item => 
        (item.is_current_best_seller && item.revenue_rank > 20) || 
        (!item.is_current_best_seller && item.revenue_rank <= 10)
      ).length
    }
    
    console.log(`✅ Sales analytics calculated: ${analytics.length} products, $${summary.total_revenue.toFixed(2)} revenue`)
    
    return NextResponse.json({
      success: true,
      data: {
        analytics: analytics.slice(0, limit),
        summary,
        time_period: {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          days
        }
      }
    })
    
  } catch (error) {
    console.error('❌ Error in sales performance analytics:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch sales analytics'
      },
      { status: 500 }
    )
  }
}
