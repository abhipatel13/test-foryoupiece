import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Retrieve user's search history
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'Service unavailable'
      }, { status: 500 })
    }

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '5')

    console.log('📜 Getting search history for user:', user.id)

    // Get user's recent search history with enhanced metadata
    const { data: history, error } = await supabase
      .from('user_search_history')
      .select(`
        id,
        search_query,
        search_category,
        results_count,
        search_source,
        clicked_product_id,
        created_at
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('❌ Error fetching search history:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch search history'
      }, { status: 500 })
    }

    console.log(`✅ Retrieved ${history?.length || 0} search history items`)

    return NextResponse.json({
      success: true,
      data: history || [],
      meta: {
        userId: user.id,
        count: history?.length || 0,
        limit
      }
    })

  } catch (error) {
    console.error('❌ Search history API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// POST - Add new search to history
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'Service unavailable'
      }, { status: 500 })
    }

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 })
    }

    const body = await request.json()
    const {
      searchQuery,
      searchCategory,
      resultsCount,
      clickedProductId,
      searchSource = 'header',
      metadata = {}
    } = body

    if (!searchQuery) {
      return NextResponse.json({
        success: false,
        error: 'Search query is required'
      }, { status: 400 })
    }

    console.log('📝 Adding search to history:', { userId: user.id, searchQuery, resultsCount })

    // Insert search history record
    const { data, error } = await supabase
      .from('user_search_history')
      .insert({
        user_id: user.id,
        search_query: searchQuery.trim(),
        search_category: searchCategory,
        results_count: resultsCount || 0,
        clicked_product_id: clickedProductId,
        search_source: searchSource,
        user_agent: metadata.userAgent,
        ip_address: metadata.ipAddress,
        session_id: metadata.sessionId
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Error adding search to history:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to add search to history'
      }, { status: 500 })
    }

    console.log('✅ Search added to history successfully')

    return NextResponse.json({
      success: true,
      data: data,
      message: 'Search added to history'
    })

  } catch (error) {
    console.error('❌ Add search history API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// DELETE - Remove search history item
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'Service unavailable'
      }, { status: 500 })
    }

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const historyId = searchParams.get('history_id')
    const clearAll = searchParams.get('clear_all') === 'true'

    console.log('🗑️ Deleting search history:', { userId: user.id, historyId, clearAll })

    if (clearAll) {
      // Clear all search history for the user
      const { error } = await supabase
        .from('user_search_history')
        .delete()
        .eq('user_id', user.id)

      if (error) {
        console.error('❌ Error clearing search history:', error)
        return NextResponse.json({
          success: false,
          error: 'Failed to clear search history'
        }, { status: 500 })
      }

      console.log('✅ All search history cleared for user')

      return NextResponse.json({
        success: true,
        message: 'All search history cleared'
      })

    } else if (historyId) {
      // Delete specific search history item
      const { error } = await supabase
        .from('user_search_history')
        .delete()
        .eq('id', historyId)
        .eq('user_id', user.id) // Ensure user can only delete their own history

      if (error) {
        console.error('❌ Error deleting search history item:', error)
        return NextResponse.json({
          success: false,
          error: 'Failed to delete search history item'
        }, { status: 500 })
      }

      console.log('✅ Search history item deleted')

      return NextResponse.json({
        success: true,
        message: 'Search history item deleted'
      })

    } else {
      return NextResponse.json({
        success: false,
        error: 'Either history_id or clear_all=true is required'
      }, { status: 400 })
    }

  } catch (error) {
    console.error('❌ Delete search history API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
