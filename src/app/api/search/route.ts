import { NextRequest, NextResponse } from 'next/server'
import { createAnonymousClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * SECURITY FIX: Sanitize search input to prevent PostgREST filter injection
 * Remove dangerous characters that could be used for injection attacks
 */
function sanitizeSearchInput(input: string): string {
  if (!input || typeof input !== 'string') return ''

  // Remove dangerous characters: , ( ) ; and control characters
  // Also remove quotes and backslashes that could be used for escaping
  return input
    .replace(/[,();'"\\]/g, '') // Remove dangerous punctuation
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .trim()
    .substring(0, 100) // Limit length to prevent abuse
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rawQuery = searchParams.get('q')?.trim()
    const query = sanitizeSearchInput(rawQuery || '') // SECURITY FIX: Sanitize search input
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') || '20')
    const userId = searchParams.get('user_id')
    const includeHistory = searchParams.get('include_history') === 'true'
    const includeSuggestions = searchParams.get('include_suggestions') === 'true'

    console.log('🔍 Enhanced Search API called:', {
      rawQuery,
      sanitizedQuery: query,
      category,
      limit,
      userId,
      includeHistory,
      includeSuggestions
    })

    // SECURITY FIX: Use anonymous client instead of service role to ensure RLS applies
    const supabase: any = createAnonymousClient()
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
    const hasNonAscii = /[^\x00-\x7F]/.test(query)
    if (!query || (query.length < 2 && !hasNonAscii)) {
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

    // Build candidates via RPC with server-side ranking (EN + KM), then fetch details
    const candidateLimit = Math.max(limit, 100)
    const { data: rpcRows, error: rpcError } = await supabase
      .rpc('search_products_en_km', {
        p_query: query,
        p_limit: candidateLimit,
        p_category_slug: category && category !== 'all' ? category : null
      })

    let finalProducts: any[] = []

    if (!rpcError && rpcRows && rpcRows.length > 0) {
      const ids = rpcRows.map((r: any) => r.product_id)
      const scoreMap = new Map<string, number>(rpcRows.map((r: any) => [r.product_id, Number(r.score) || 0]))

      const { data: details, error: detailsError } = await supabase
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
        .in('id', ids)

      const byId = new Map((details || []).map((p: any) => [p.id, p]))
      finalProducts = ids
        .map((id: string) => byId.get(id))
        .filter(Boolean)
        .map((p: any) => ({ ...p, relevanceScore: scoreMap.get(p.id) || 0 }))

      // Stock-priority ordering, then textual relevance, then recency
      finalProducts.sort((a: any, b: any) => {
        const stockCmp = Number(b.stock_quantity > 0) - Number(a.stock_quantity > 0)
        if (stockCmp) return stockCmp
        const relCmp = (b.relevanceScore || 0) - (a.relevanceScore || 0)
        if (relCmp) return relCmp
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

      const limited = finalProducts.slice(0, limit)
      response.data.products = limited
      response.data.meta.total = limited.length
      ;(response.data.meta as any).totalCandidates = finalProducts.length
      response.data.meta.searchTime = Date.now() - startTime
    } else {
      // Fallback to previous OR-based search if RPC fails or yields no results
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

      if (query && (query.length >= 2 || /[^\x00-\x7F]/.test(query))) {
        const orConditions: string[] = [
          `name_en.ilike.%${query}%`,
          `brand.ilike.%${query}%`,
          `description_en.ilike.%${query}%`,
          `sku.ilike.%${query}%`
        ]
        const searchTerms = query
          .split(' ')
          .filter(term => term.length > 1 || /[^\x00-\x7F]/.test(term))
          .slice(0, 5)
        for (const term of searchTerms) {
          const sanitizedTerm = sanitizeSearchInput(term)
          if (sanitizedTerm) {
            orConditions.push(`tags.cs.{"${sanitizedTerm}"}`)
          }
        }
        if (orConditions.length > 0) {
          productQuery = productQuery.or(orConditions.join(','))
        }
      }

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

      const { data: products, error: searchError } = await productQuery
        .order('created_at', { ascending: false })
        .limit(limit)

      if (searchError) {
        console.error('❌ Product search error (fallback):', searchError)
        return NextResponse.json({
          success: false,
          error: 'Search failed',
          data: { products: [], suggestions: [], history: [] }
        }, { status: 500 })
      }

      const queryLower = query.toLowerCase()
      const scored = (products || []).map((product: any) => {
        let relevanceScore = 0
        const nameLower = product.name_en?.toLowerCase() || ''
        const brandLower = product.brand?.toLowerCase() || ''
        const descLower = product.description_en?.toLowerCase() || ''
        if (nameLower === queryLower) relevanceScore += 100
        else if (nameLower.includes(queryLower)) relevanceScore += 50
        if (brandLower === queryLower) relevanceScore += 80
        else if (brandLower.includes(queryLower)) relevanceScore += 40
        if (descLower.includes(queryLower)) relevanceScore += 20
        if (product.is_featured) relevanceScore += 10
        if (product.stock_quantity > 0) relevanceScore += 5
        if (product.tags) {
          const tagMatches = product.tags.filter((tag: string) => tag.toLowerCase().includes(queryLower)).length
          relevanceScore += tagMatches * 15
        }
        return { ...product, relevanceScore }
      })
      // Stock-priority ordering, then textual relevance, then recency
      scored.sort((a: any, b: any) => {
        const stockCmp = Number(b.stock_quantity > 0) - Number(a.stock_quantity > 0)
        if (stockCmp) return stockCmp
        const relCmp = (b.relevanceScore || 0) - (a.relevanceScore || 0)
        if (relCmp) return relCmp
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
      response.data.products = scored
      response.data.meta.total = scored.length
      response.data.meta.searchTime = Date.now() - startTime
    }

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

        const suggestions: any[] = []
        if (suggestionProducts) {
          // Add product name suggestions
          suggestionProducts.forEach((product: any) => {
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
      } catch (err: any) {
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
      } catch (err: any) {
        console.warn('⚠️ Search history fallback failed:', err)
        response.data.history = []
      }
    }

    // Enhanced search behavior tracking (fire and forget)
    if (userId && query.length >= 2) {
      const resultsCountForTracking = Array.isArray(response.data.products) ? response.data.products.length : 0
      // Track in search history table
      supabase
        .from('user_search_history')
        .insert({
          user_id: userId,
          search_query: query,
          search_category: category,
          results_count: resultsCountForTracking,
          search_source: 'header',
          user_agent: request.headers.get('user-agent'),
          session_id: `session_${userId}_${Date.now()}`
        })
        .then(() => console.log('✅ Search tracked in history'))
        .catch((err: any) => console.warn('⚠️ Search history tracking failed:', err))

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
            results_count: resultsCountForTracking,
            search_source: 'header',
            timestamp: new Date().toISOString()
          }
        })
        .then(() => console.log('✅ Search behavior tracked'))
        .catch((err: any) => console.warn('⚠️ Search behavior tracking failed:', err))
    }

    const totalCount = Array.isArray(response.data.products) ? response.data.products.length : 0
    console.log(`✅ Search completed: ${totalCount} results in ${response.data.meta.searchTime}ms`)

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

    const supabase: any = createServiceRoleClient()

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
