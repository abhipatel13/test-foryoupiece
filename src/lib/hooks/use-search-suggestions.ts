import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/use-auth'
import { useDebounce } from '@/lib/hooks/use-debounce'

export interface SearchSuggestion {
  suggestion_text: string
  suggestion_type: 'product' | 'category' | 'brand' | 'popular'
  priority_score: number
}

export interface UseSearchSuggestionsReturn {
  suggestions: SearchSuggestion[]
  isLoading: boolean
  error: string | null
  getSuggestions: (query: string) => Promise<void>
  trackSuggestionClick: (suggestionText: string) => Promise<void>
}

export function useSearchSuggestions(query: string = ''): UseSearchSuggestionsReturn {
  const { user } = useAuth()
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debouncedQuery = useDebounce(query, 300)

  // Get search suggestions
  const getSuggestions = useCallback(async (searchQuery: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('q', searchQuery)
      params.set('limit', '10')

      const response = await fetch(`/api/search/suggestions?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setSuggestions(data.data || [])
      } else {
        setError(data.error || 'Failed to fetch suggestions')
        setSuggestions([])
      }
    } catch (err) {
      setError('Network error while fetching suggestions')
      setSuggestions([])
      console.error('Search suggestions fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Track suggestion click for analytics
  const trackSuggestionClick = useCallback(async (suggestionText: string) => {
    if (!suggestionText) return

    try {
      await fetch('/api/search/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          suggestionText,
          userId: user?.id,
          action: 'click'
        }),
      })
    } catch (err) {
      console.warn('Failed to track suggestion click:', err)
    }
  }, [user?.id])

  // Auto-fetch suggestions when query changes
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      getSuggestions(debouncedQuery)
    } else if (debouncedQuery.length === 0) {
      // Get popular suggestions when no query
      getSuggestions('')
    } else {
      setSuggestions([])
    }
  }, [debouncedQuery, getSuggestions])

  return {
    suggestions,
    isLoading,
    error,
    getSuggestions,
    trackSuggestionClick,
  }
}
