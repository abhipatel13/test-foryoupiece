import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, productId, productSku, searchQuery, source, timestamp } = body

    if (!userId || !productId || !searchQuery) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, productId, searchQuery' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Update search history with clicked product
    const { error: updateError } = await supabase
      .from('user_search_history')
      .update({ 
        clicked_product_id: productId,
        clicked_product_sku: productSku,
        clicked_at: timestamp || new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('search_query', searchQuery)
      .order('created_at', { ascending: false })
      .limit(1)

    if (updateError) {
      console.warn('Failed to update search history with click:', updateError)
    }

    // Track in behavior tracking table
    const { error: behaviorError } = await supabase
      .from('user_behavior_tracking')
      .insert({
        user_id: userId,
        session_id: `session_${userId}_${Date.now()}`,
        behavior_type: 'product_click_from_search',
        product_id: productId,
        search_query: searchQuery,
        behavior_data: {
          product_sku: productSku,
          search_query: searchQuery,
          source: source || 'search_dropdown',
          timestamp: timestamp || new Date().toISOString()
        }
      })

    if (behaviorError) {
      console.warn('Failed to track product click behavior:', behaviorError)
    }

    return NextResponse.json({ 
      success: true,
      message: 'Product click tracked successfully'
    })

  } catch (error) {
    console.error('Error tracking product click:', error)
    return NextResponse.json(
      { error: 'Failed to track product click' },
      { status: 500 }
    )
  }
}
