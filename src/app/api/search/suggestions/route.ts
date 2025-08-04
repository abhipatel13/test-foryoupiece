import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

// GET - Get search suggestions and autocomplete
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim() || ''
    const limit = parseInt(searchParams.get('limit') || '10')
    const type = searchParams.get('type') // 'product', 'category', 'brand', 'popular'

    console.log('💡 Getting search suggestions:', { query, limit, type })

    const supabase = createServiceRoleClient()
    const suggestions = []

    if (query.length === 0) {
      // Return popular suggestions when no query
      const { data: popularSuggestions, error } = await supabase
        .from('search_suggestions')
        .select('suggestion_text, suggestion_type, priority_score')
        .eq('is_active', true)
        .order('priority_score', { ascending: false })
        .order('search_count', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('❌ Error fetching popular suggestions:', error)
      } else {
        suggestions.push(...(popularSuggestions || []))
      }

    } else {
      // Get filtered suggestions based on query
      let suggestionQuery = supabase
        .from('search_suggestions')
        .select('suggestion_text, suggestion_type, priority_score')
        .eq('is_active', true)
        .ilike('suggestion_text', `%${query}%`)

      if (type) {
        suggestionQuery = suggestionQuery.eq('suggestion_type', type)
      }

      const { data: filteredSuggestions, error } = await suggestionQuery
        .order('priority_score', { ascending: false })
        .order('search_count', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('❌ Error fetching filtered suggestions:', error)
      } else {
        suggestions.push(...(filteredSuggestions || []))
      }

      // If we don't have enough suggestions, add real-time product matches
      if (suggestions.length < limit) {
        const remainingLimit = limit - suggestions.length
        
        const { data: productMatches, error: productError } = await supabase
          .from('products')
          .select('name_en, brand')
          .eq('is_active', true)
          .or(`name_en.ilike.%${query}%,brand.ilike.%${query}%`)
          .limit(remainingLimit)

        if (!productError && productMatches) {
          const productSuggestions = productMatches.map(product => ({
            suggestion_text: product.name_en,
            suggestion_type: 'product',
            priority_score: 3.0
          }))

          // Add unique brand suggestions
          const brandSuggestions = [...new Set(
            productMatches
              .filter(p => p.brand && p.brand.toLowerCase().includes(query.toLowerCase()))
              .map(p => p.brand)
          )].map(brand => ({
            suggestion_text: brand,
            suggestion_type: 'brand',
            priority_score: 4.0
          }))

          suggestions.push(...productSuggestions, ...brandSuggestions)
        }
      }
    }

    // Remove duplicates and sort by priority
    const uniqueSuggestions = suggestions
      .filter((suggestion, index, self) => 
        index === self.findIndex(s => s.suggestion_text === suggestion.suggestion_text)
      )
      .sort((a, b) => b.priority_score - a.priority_score)
      .slice(0, limit)

    console.log(`✅ Retrieved ${uniqueSuggestions.length} search suggestions`)

    return NextResponse.json({
      success: true,
      data: uniqueSuggestions,
      meta: {
        query,
        count: uniqueSuggestions.length,
        limit
      }
    })

  } catch (error) {
    console.error('❌ Search suggestions API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      data: []
    }, { status: 500 })
  }
}

// POST - Update suggestion popularity (when user clicks on a suggestion)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { suggestionText, userId, action = 'click' } = body

    if (!suggestionText) {
      return NextResponse.json({
        success: false,
        error: 'Suggestion text is required'
      }, { status: 400 })
    }

    console.log('📊 Updating suggestion popularity:', { suggestionText, action })

    const supabase = createServiceRoleClient()

    // Update suggestion click count
    const { error } = await supabase
      .from('search_suggestions')
      .update({
        click_count: supabase.raw('click_count + 1'),
        updated_at: new Date().toISOString()
      })
      .eq('suggestion_text', suggestionText)

    if (error) {
      console.error('❌ Error updating suggestion popularity:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to update suggestion popularity'
      }, { status: 500 })
    }

    // Track user behavior if userId provided
    if (userId) {
      await supabase
        .from('user_behavior_tracking')
        .insert({
          user_id: userId,
          session_id: 'suggestion_click',
          behavior_type: 'search',
          search_query: suggestionText,
          behavior_data: {
            action: 'suggestion_click',
            suggestion_text: suggestionText
          }
        })
        .catch(err => console.warn('⚠️ Behavior tracking failed:', err))
    }

    console.log('✅ Suggestion popularity updated')

    return NextResponse.json({
      success: true,
      message: 'Suggestion popularity updated'
    })

  } catch (error) {
    console.error('❌ Update suggestion API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
