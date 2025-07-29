'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/use-auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Search, 
  X, 
  Clock, 
  TrendingUp, 
  Package,
  Tag,
  ChevronDown,
  Loader2
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/lib/hooks/use-debounce'

interface SearchResult {
  id: string
  name_en: string
  price: number
  brand?: string
  category?: { name_en: string; slug: string }
  images: string[]
  relevanceScore?: number
}

interface SearchSuggestion {
  suggestion_text: string
  suggestion_type: 'product' | 'category' | 'brand' | 'popular'
  priority_score: number
}

interface SearchHistory {
  id: string
  search_query: string
  search_category?: string
  results_count: number
  created_at: string
}

interface EnhancedSearchProps {
  className?: string
  placeholder?: string
  showCategoryFilter?: boolean
  onSearch?: (query: string, category?: string) => void
}

const categories = [
  { value: 'all', label: 'All Categories' },
  { value: 'skincare', label: 'Skincare' },
  { value: 'makeup', label: 'Makeup' },
  { value: 'fragrance', label: 'Fragrance' },
  { value: 'hair-care', label: 'Hair Care' },
  { value: 'body-care', label: 'Body Care' },
]

export function EnhancedSearch({ 
  className, 
  placeholder = "Search for products...",
  showCategoryFilter = true,
  onSearch 
}: EnhancedSearchProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([])
  const [showHistory, setShowHistory] = useState(false)

  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debouncedQuery = useDebounce(query, 300)

  // Handle search API calls
  const performSearch = useCallback(async (searchQuery: string, includeHistory = false) => {
    if (searchQuery.length < 2 && !includeHistory) return

    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('q', searchQuery)
      params.set('limit', '8')
      params.set('include_suggestions', 'true')
      
      if (selectedCategory !== 'all') {
        params.set('category', selectedCategory)
      }
      
      if (user?.id) {
        params.set('user_id', user.id)
        if (includeHistory) {
          params.set('include_history', 'true')
        }
      }

      const response = await fetch(`/api/search?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setSearchResults(data.data.products || [])
        setSuggestions(data.data.suggestions || [])
        if (includeHistory) {
          setSearchHistory(data.data.history || [])
        }
      }
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsLoading(false)
    }
  }, [selectedCategory, user?.id])

  // Debounced search effect
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      performSearch(debouncedQuery)
      setShowHistory(false)
    } else if (debouncedQuery.length === 0) {
      setSearchResults([])
      setSuggestions([])
    }
  }, [debouncedQuery, performSearch])

  // Load search history when input is focused
  const handleInputFocus = useCallback(() => {
    setIsOpen(true)
    if (query.length === 0 && user?.id) {
      setShowHistory(true)
      performSearch('', true)
    }
  }, [query.length, user?.id, performSearch])

  // Handle search submission
  const handleSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return

    const finalQuery = searchQuery.trim()
    const categoryParam = selectedCategory !== 'all' ? selectedCategory : undefined

    // Enhanced search behavior tracking
    if (user?.id) {
      fetch('/api/search/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          searchQuery: finalQuery,
          searchCategory: categoryParam,
          resultsCount: searchResults.length,
          searchSource: 'header',
          timestamp: new Date().toISOString(),
          sessionId: `session_${user.id}_${Date.now()}`
        })
      }).then(() => {
        console.log(`✅ Search tracked: "${finalQuery}" (${searchResults.length} results)`)
      }).catch(err => console.warn('Search tracking failed:', err))
    }

    // Close dropdown and navigate
    setIsOpen(false)
    setQuery('')

    if (onSearch) {
      onSearch(finalQuery, categoryParam)
    } else {
      const searchParams = new URLSearchParams()
      searchParams.set('search', finalQuery)
      if (categoryParam) {
        searchParams.set('category', categoryParam)
      }
      router.push(`/en/products?${searchParams.toString()}`)
    }
  }, [selectedCategory, user?.id, searchResults.length, onSearch, router])

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestionText: string) => {
    // Update suggestion popularity
    if (user?.id) {
      fetch('/api/search/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestionText,
          userId: user.id,
          action: 'click'
        })
      }).catch(err => console.warn('Suggestion tracking failed:', err))
    }

    handleSearch(suggestionText)
  }, [user?.id, handleSearch])

  // Handle history item click
  const handleHistoryClick = useCallback((historyQuery: string) => {
    setQuery(historyQuery)
    handleSearch(historyQuery)
  }, [handleSearch])

  // Delete history item
  const deleteHistoryItem = useCallback(async (historyId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (!user?.id) return

    try {
      const response = await fetch(`/api/search/history?user_id=${user.id}&history_id=${historyId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setSearchHistory(prev => prev.filter(item => item.id !== historyId))
      }
    } catch (error) {
      console.error('Failed to delete history item:', error)
    }
  }, [user?.id])

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setShowHistory(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const hasResults = searchResults.length > 0
  const hasSuggestions = suggestions.length > 0
  const hasHistory = searchHistory.length > 0 && showHistory

  return (
    <div ref={searchRef} className={cn("relative w-full", className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSearch(query)
        }}
        className="flex modern-search-bar overflow-hidden shadow-md w-full min-w-0 border border-border/50 hover:border-border focus-within:border-primary/50 focus-within:shadow-lg transition-all duration-300"
      >
        {/* Category Dropdown */}
        {showCategoryFilter && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-11 px-3 sm:px-4 lg:px-6 bg-muted/30 hover:bg-muted/50 text-foreground border-r border-border/30 rounded-none rounded-l-lg flex-shrink-0 cursor-pointer transition-all duration-200 hover:shadow-sm font-medium"
              >
                <span className="hidden sm:inline text-sm font-semibold truncate">
                  {categories.find(cat => cat.value === selectedCategory)?.label || 'All Categories'}
                </span>
                <span className="sm:hidden text-sm font-semibold">All</span>
                <ChevronDown className="h-4 w-4 ml-2 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 shadow-xl border-border/50">
              {categories.map((category) => (
                <DropdownMenuItem
                  key={category.value}
                  onClick={() => setSelectedCategory(category.value)}
                  className="text-sm font-medium py-2.5 px-3 cursor-pointer hover:bg-accent/50 transition-colors duration-200"
                >
                  {category.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Search Input */}
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleInputFocus}
          className="flex-1 h-11 border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-background text-foreground placeholder:text-muted-foreground/70 w-full min-w-0 text-sm lg:text-base px-4 lg:px-5 font-medium"
        />

        {/* Search Button */}
        <Button
          type="submit"
          disabled={isLoading}
          className="h-11 px-4 lg:px-5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-none rounded-r-lg flex-shrink-0 cursor-pointer transition-all duration-200 hover:shadow-md font-semibold"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </form>

      {/* Search Dropdown - Enhanced for Production */}
      {isOpen && (hasResults || hasSuggestions || hasHistory) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-lg shadow-xl z-[100] max-h-[32rem] overflow-y-auto backdrop-blur-sm">
          {/* Search History */}
          {hasHistory && (
            <div className="p-4 border-b border-border/50">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">Recent Searches</span>
              </div>
              <div className="space-y-1">
                {searchHistory.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 hover:bg-accent/50 rounded-md cursor-pointer group transition-all duration-200 hover:shadow-sm"
                    onClick={() => handleHistoryClick(item.search_query)}
                  >
                    <span className="text-sm font-medium text-foreground">{item.search_query}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
                      onClick={(e) => deleteHistoryItem(item.id, e)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {hasSuggestions && (
            <div className="p-4 border-b border-border/50">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Suggestions</span>
              </div>
              <div className="space-y-1">
                {suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 hover:bg-accent/50 rounded-md cursor-pointer transition-all duration-200 hover:shadow-sm group"
                    onClick={() => handleSuggestionClick(suggestion.suggestion_text)}
                  >
                    <div className="flex-shrink-0">
                      {suggestion.suggestion_type === 'product' && <Package className="h-4 w-4 text-primary" />}
                      {suggestion.suggestion_type === 'brand' && <Tag className="h-4 w-4 text-primary" />}
                      {suggestion.suggestion_type === 'category' && <TrendingUp className="h-4 w-4 text-primary" />}
                    </div>
                    <span className="text-sm font-medium text-foreground flex-1 truncate group-hover:text-primary transition-colors duration-200">{suggestion.suggestion_text}</span>
                    <Badge variant="secondary" className="text-xs font-medium bg-muted/50 text-muted-foreground border-0">
                      {suggestion.suggestion_type}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search Results */}
          {hasResults && (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Search className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Products</span>
              </div>
              <div className="space-y-2">
                {searchResults.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-4 p-3 hover:bg-accent/50 rounded-md cursor-pointer transition-all duration-200 hover:shadow-sm group"
                    onClick={() => {
                      // Track product click from search
                      if (user?.id && query) {
                        fetch('/api/search/track-click', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            userId: user.id,
                            productId: product.id,
                            productSku: product.sku,
                            searchQuery: query,
                            source: 'search_dropdown',
                            timestamp: new Date().toISOString()
                          })
                        }).then(() => {
                          console.log(`🎯 Product click tracked: ${product.sku} from search "${query}"`)
                        }).catch(err => console.warn('Product click tracking failed:', err))
                      }

                      // Navigate to product
                      router.push(`/en/products/${product.sku}`)
                    }}
                  >
                    {product.images[0] && (
                      <div className="flex-shrink-0">
                        <img
                          src={product.images[0]}
                          alt={product.name_en}
                          className="w-12 h-12 object-cover rounded-md border border-border/20 group-hover:border-primary/20 transition-colors duration-200"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors duration-200">{product.name_en}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="font-medium">{product.brand}</span> • <span className="font-semibold text-foreground">${product.price}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
