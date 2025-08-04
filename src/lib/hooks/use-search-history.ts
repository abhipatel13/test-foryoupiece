import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/use-auth'

export interface SearchHistoryItem {
  id: string
  search_query: string
  search_category?: string
  results_count: number
  created_at: string
}

export interface UseSearchHistoryReturn {
  searchHistory: SearchHistoryItem[]
  isLoading: boolean
  error: string | null
  addSearchToHistory: (query: string, category?: string, resultsCount?: number) => Promise<void>
  deleteSearchHistoryItem: (historyId: string) => Promise<void>
  clearAllSearchHistory: () => Promise<void>
  refreshSearchHistory: () => Promise<void>
}

export function useSearchHistory(): UseSearchHistoryReturn {
  const { user } = useAuth()
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch search history
  const fetchSearchHistory = useCallback(async () => {
    if (!user?.id) {
      setSearchHistory([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/search/history?user_id=${user.id}&limit=5`)
      const data = await response.json()

      if (data.success) {
        setSearchHistory(data.data || [])
      } else {
        setError(data.error || 'Failed to fetch search history')
      }
    } catch (err) {
      setError('Network error while fetching search history')
      console.error('Search history fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  // Add search to history
  const addSearchToHistory = useCallback(async (
    query: string, 
    category?: string, 
    resultsCount?: number
  ) => {
    if (!user?.id || !query.trim()) return

    try {
      const response = await fetch('/api/search/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          searchQuery: query.trim(),
          searchCategory: category,
          resultsCount: resultsCount || 0,
          searchSource: 'header',
          metadata: {
            userAgent: navigator.userAgent,
            sessionId: sessionStorage.getItem('session_id') || 'unknown'
          }
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Add the new search to the beginning of the history
        setSearchHistory(prev => {
          const newHistory = [data.data, ...prev.filter(item => item.id !== data.data.id)]
          return newHistory.slice(0, 5) // Keep only the 5 most recent
        })
      } else {
        console.warn('Failed to add search to history:', data.error)
      }
    } catch (err) {
      console.error('Error adding search to history:', err)
    }
  }, [user?.id])

  // Delete specific search history item
  const deleteSearchHistoryItem = useCallback(async (historyId: string) => {
    if (!user?.id) return

    try {
      const response = await fetch(`/api/search/history?user_id=${user.id}&history_id=${historyId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        setSearchHistory(prev => prev.filter(item => item.id !== historyId))
      } else {
        setError(data.error || 'Failed to delete search history item')
      }
    } catch (err) {
      setError('Network error while deleting search history item')
      console.error('Delete search history error:', err)
    }
  }, [user?.id])

  // Clear all search history
  const clearAllSearchHistory = useCallback(async () => {
    if (!user?.id) return

    try {
      const response = await fetch(`/api/search/history?user_id=${user.id}&clear_all=true`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        setSearchHistory([])
      } else {
        setError(data.error || 'Failed to clear search history')
      }
    } catch (err) {
      setError('Network error while clearing search history')
      console.error('Clear search history error:', err)
    }
  }, [user?.id])

  // Refresh search history
  const refreshSearchHistory = useCallback(async () => {
    await fetchSearchHistory()
  }, [fetchSearchHistory])

  // Load search history when user changes
  useEffect(() => {
    fetchSearchHistory()
  }, [fetchSearchHistory])

  return {
    searchHistory,
    isLoading,
    error,
    addSearchToHistory,
    deleteSearchHistoryItem,
    clearAllSearchHistory,
    refreshSearchHistory,
  }
}
