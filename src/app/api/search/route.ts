import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { sortProductsByStockPriority } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim()
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') || '20')
    const userId = searchParams.get('user_id')
    const includeHistory = searchParams.get('include_history') === 'true'
    const includeSuggestions = searchParams.get('include_suggestions') === 'true'

    console.log('🔍 Enhanced Search API called:', {
      query,
      category,
      limit,
      userId,
      includeHistory,
      includeSuggestions
    })

    // Use service role client for comprehensive access
    const supabase = createServiceRoleClient()
    const response: any = {
      success: true,
      data: {
        products: [],
        suggestions: [],
        history: [],
        meta: {
          query,
          category,
          total: 0,
          searchTime: 0
        }
      }
    }

    const startTime = Date.now()

    // If no query provided, return suggestions and history only
    if (!query || query.length < 2) {
      if (includeSuggestions) {
        const { data: suggestions } = await supabase
          .rpc('get_search_suggestions', { p_query: query || '', p_limit: 10 })
        
        response.data.suggestions = suggestions || []
      }

      if (includeHistory && userId) {
        const { data: history } = await supabase
          .rpc('get_user_search_history', { p_user_id: userId, p_limit: 5 })
        
        response.data.history = history || []
      }

      response.data.meta.searchTime = Date.now() - startTime
      return NextResponse.json(response)
    }

    // Build comprehensive product search query
    let productQuery = supabase
      .from('products')
      .select(`
        id,
        name_en,
        description_en,
        price,
        compare_at_price,
        points_rate,
        stock_quantity,
        is_featured,
        brand,
        images,
        tags,
        sku,
        created_at,
        category:categories(
          id,
          name_en,
          slug
        )
      `)
      .eq('is_active', true)

    // Enhanced search across multiple fields with weighted relevance
    const searchTerms = query.split(' ').filter(term => term.length > 1)
    const searchConditions = []

    // Primary search fields (higher relevance)
    searchConditions.push(`name_en.ilike.%${query}%`)
    searchConditions.push(`brand.ilike.%${query}%`)
    
    // Secondary search fields
    searchConditions.push(`description_en.ilike.%${query}%`)
    searchConditions.push(`sku.ilike.%${query}%`)
    
    // Tag-based search - using contains operator for JSONB arrays
    if (searchTerms.length > 0) {
      searchTerms.forEach(term => {
        searchConditions.push(`tags.cs.{"${term}"}`)
      })
    }

    productQuery = productQuery.or(searchConditions.join(','))

    // Apply category filter if provided
    if (category && category !== 'all') {
      const { data: categoryData } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', category)
        .single()

      if (categoryData) {
        productQuery = productQuery.eq('category_id', categoryData.id)
      }
    }

    // Execute search with limit
    const { data: products, error: searchError } = await productQuery
      .order('is_featured', { ascending: false })
      .order('stock_quantity', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (searchError) {
      console.error('❌ Product search error:', searchError)
      return NextResponse.json({
        success: false,
        error: 'Search failed',
        data: { products: [], suggestions: [], history: [] }
      }, { status: 500 })
    }

    // Calculate search relevance scores
    const scoredProducts = (products || []).map(product => {
      let relevanceScore = 0
      const queryLower = query.toLowerCase()
      const nameLower = product.name_en?.toLowerCase() || ''
      const brandLower = product.brand?.toLowerCase() || ''
      const descLower = product.description_en?.toLowerCase() || ''

      // Exact name match (highest score)
      if (nameLower === queryLower) relevanceScore += 100
      else if (nameLower.includes(queryLower)) relevanceScore += 50

      // Brand match
      if (brandLower === queryLower) relevanceScore += 80
      else if (brandLower.includes(queryLower)) relevanceScore += 40

      // Description match
      if (descLower.includes(queryLower)) relevanceScore += 20

      // Featured product boost
      if (product.is_featured) relevanceScore += 10

      // Stock availability boost
      if (product.stock_quantity > 0) relevanceScore += 5

      // Tag matches
      if (product.tags) {
        const tagMatches = product.tags.filter((tag: string) => 
          tag.toLowerCase().includes(queryLower)
        ).length
        relevanceScore += tagMatches * 15
      }

      return {
        ...product,
        relevanceScore
      }
    })

    // Apply global stock-priority sorting while preserving relevance-based sorting
    const sortedProducts = sortProductsByStockPriority(scoredProducts, (a, b) => {
      // Secondary sort by relevance score (descending)
      return b.relevanceScore - a.relevanceScore
    })

    response.data.products = sortedProducts
    response.data.meta.total = sortedProducts.length
    response.data.meta.searchTime = Date.now() - startTime

    // Get search suggestions if requested (fallback implementation)
    if (includeSuggestions) {
      try {
        // Simple fallback: get popular product names and brands that match the query
        const { data: suggestionProducts } = await supabase
          .from('products')
          .select('name_en, brand')
          .eq('is_active', true)
          .or(`name_en.ilike.%${query}%,brand.ilike.%${query}%`)
          .limit(5)

        const suggestions = []
        if (suggestionProducts) {
          // Add product name suggestions
          suggestionProducts.forEach(product => {
            if (product.name_en && product.name_en.toLowerCase().includes(query.toLowerCase())) {
              suggestions.push({
                suggestion_text: product.name_en,
                suggestion_type: 'product',
                priority_score: 5.0
              })
            }
            if (product.brand && product.brand.toLowerCase().includes(query.toLowerCase())) {
              suggestions.push({
                suggestion_text: product.brand,
                suggestion_type: 'brand',
                priority_score: 4.0
              })
            }
          })
        }

        response.data.suggestions = suggestions.slice(0, 5)
      } catch (err) {
        console.warn('⚠️ Suggestions fallback failed:', err)
        response.data.suggestions = []
      }
    }

    // Get search history if requested and user is authenticated (fallback implementation)
    if (includeHistory && userId) {
      try {
        // Simple fallback: try to get from user_search_history table directly
        const { data: history } = await supabase
          .from('user_search_history')
          .select('id, search_query, search_category, results_count, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(5)

        response.data.history = history || []
      } catch (err) {
        console.warn('⚠️ Search history fallback failed:', err)
        response.data.history = []
      }
    }

    // Enhanced search behavior tracking (fire and forget)
    if (userId && query.length >= 2) {
      // Track in search history table
      supabase
        .from('user_search_history')
        .insert({
          user_id: userId,
          search_query: query,
          search_category: category,
          results_count: scoredProducts.length,
          search_source: 'header',
          user_agent: request.headers.get('user-agent'),
          session_id: `session_${userId}_${Date.now()}`
        })
        .then(() => console.log('✅ Search tracked in history'))
        .catch(err => console.warn('⚠️ Search history tracking failed:', err))

      // Also track in comprehensive behavior tracking
      supabase
        .from('user_behavior_tracking')
        .insert({
          user_id: userId,
          session_id: `session_${userId}_${Date.now()}`,
          behavior_type: 'search',
          search_query: query,
          behavior_data: {
            category: category,
            results_count: scoredProducts.length,
            search_source: 'header',
            timestamp: new Date().toISOString()
          }
        })
        .then(() => console.log('✅ Search behavior tracked'))
        .catch(err => console.warn('⚠️ Search behavior tracking failed:', err))
    }

    console.log(`✅ Search completed: ${scoredProducts.length} results in ${response.data.meta.searchTime}ms`)

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Search API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      data: { products: [], suggestions: [], history: [] }
    }, { status: 500 })
  }
}

// POST endpoint for tracking search behavior
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, query, category, action, productId, metadata } = body

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'User ID required for tracking'
      }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    // Track user behavior
    const behaviorData = {
      user_id: userId,
      session_id: metadata?.sessionId || 'unknown',
      behavior_type: action || 'search',
      product_id: productId,
      search_query: query,
      behavior_data: {
        category,
        ...metadata
      }
    }

    const { error } = await supabase
      .from('user_behavior_tracking')
      .insert(behaviorData)

    if (error) {
      console.error('❌ Behavior tracking error:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to track behavior'
      }, { status: 500 })
    }

    console.log('✅ User behavior tracked:', action)

    return NextResponse.json({
      success: true,
      message: 'Behavior tracked successfully'
    })

  } catch (error) {
    console.error('❌ Behavior tracking API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
