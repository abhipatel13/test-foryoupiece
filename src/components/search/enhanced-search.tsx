'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useSSRSafeAuth } from '@/lib/hooks/use-ssr-safe-auth'
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
  const { user } = useSSRSafeAuth()
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [dropdownKey, setDropdownKey] = useState(0) // For forcing re-renders
  // Keyboard navigation state
  const [activeIndex, setActiveIndex] = useState<number>(-1)
  const listboxId = 'search-dropdown-listbox'

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

  // Handle click outside to close dropdown and window resize/scroll for repositioning
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Add a small delay to prevent immediate closing when clicking on the input
      setTimeout(() => {
        if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
          setIsOpen(false)
          setShowHistory(false)
        }
      }, 10)
    }

    const handleResize = () => {
      // Force re-render to update dropdown position
      if (isOpen) {
        setDropdownKey(prev => prev + 1)
      }
    }

    const handleScroll = (event: Event) => {
      // Only close dropdown if scrolling outside the dropdown itself
      if (isOpen && searchRef.current) {
        const target = event.target as Element
        const dropdown = document.querySelector('[data-search-dropdown]')

        // Don't close if scrolling within the dropdown
        if (dropdown && (dropdown.contains(target) || dropdown === target)) {
          return
        }

        // Close dropdown on external scroll to prevent positioning issues
        setIsOpen(false)
        setShowHistory(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleScroll, true)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [isOpen])

  // Cleanup on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      setIsOpen(false)
      setShowHistory(false)
    }
  }, [])

  const hasResults = searchResults.length > 0
  const hasSuggestions = suggestions.length > 0
  const hasHistory = searchHistory.length > 0 && showHistory

  // Show dropdown only when explicitly open and there is content to display
  // This ensures clicking outside (which sets isOpen=false) always hides it
  const shouldShowDropdown = isOpen && (hasResults || hasSuggestions || hasHistory)

  // DEBUG: Log dropdown visibility conditions (gated)
  if (process.env.NEXT_PUBLIC_DEBUG_UI === 'true') {
    console.log('🔍 Search dropdown debug:', {
      isOpen,
      hasResults,
      hasSuggestions,
      hasHistory,
      searchResults: searchResults.length,
      suggestions: suggestions.length,
      searchHistory: searchHistory.length,
      showHistory,
      query: query.length,
      shouldShowDropdown
    })
  }

  return (
    <div ref={searchRef} className={cn("relative w-full", className)}>
      <form
        role="search"
        aria-label="Site search"
        onSubmit={(e) => {
          e.preventDefault()
          handleSearch(query)
        }}
        onMouseDown={(e) => {
          const el = e.target as HTMLElement
          const isInteractive = el.closest('button,[role="button"],[aria-haspopup="menu"]')
          if (!isInteractive && inputRef.current) {
            e.preventDefault()
            inputRef.current.focus()
          }
        }}
        className="flex modern-search-bar overflow-hidden shadow-md w-full min-w-0 border border-border/50 hover:border-border focus-within:border-primary/50 focus-within:shadow-lg transition-all duration-300 lg:cursor-text lg:px-1.5 relative z-30"
      >
        {/* Category Dropdown */}
        {showCategoryFilter && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                data-slot="dropdown-menu-trigger"
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
          data-slot="input"
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          role="combobox"
          aria-expanded={shouldShowDropdown}
          aria-controls={shouldShowDropdown ? listboxId : undefined}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          onChange={(e) => {
            const value = e.target.value
            setQuery(value)
            setActiveIndex(-1)

            // Reset any previous state when user starts typing

            if (value.trim()) {
              setIsOpen(true)
              setShowHistory(false)
            } else {
              setShowHistory(true)
              setIsOpen(searchHistory.length > 0)
            }
          }}
          onKeyDown={(e) => {
            if (!shouldShowDropdown) return
            const totalItems = (hasHistory ? searchHistory.length : 0) + (hasSuggestions ? suggestions.length : 0) + (hasResults ? searchResults.length : 0)
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActiveIndex(prev => (prev + 1) % Math.max(totalItems, 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActiveIndex(prev => (prev - 1 + Math.max(totalItems, 1)) % Math.max(totalItems, 1))
            } else if (e.key === 'Enter') {
              if (activeIndex >= 0) {
                // Determine which list the activeIndex falls into
                const historyCount = hasHistory ? searchHistory.length : 0
                const suggestionCount = hasSuggestions ? suggestions.length : 0
                if (activeIndex < historyCount) {
                  handleHistoryClick(searchHistory[activeIndex].search_query)
                  return
                }
                if (activeIndex < historyCount + suggestionCount) {
                  const suggestion = suggestions[activeIndex - historyCount]
                  handleSuggestionClick(suggestion.suggestion_text)
                  return
                }
                const product = searchResults[activeIndex - historyCount - suggestionCount]
                router.push(`/en/products/${product.sku}`)
                return
              }
              // No active item: submit current query
              handleSearch(query)
            } else if (e.key === 'Escape') {
              setIsOpen(false)
            }
          }}
          onFocus={handleInputFocus}
          className="flex-1 h-11 border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-background text-foreground placeholder:text-muted-foreground/70 lg:placeholder:text-foreground/80 lg:placeholder:opacity-90 w-full min-w-0 text-sm lg:text-base px-4 lg:px-5 font-medium caret-primary selection:bg-primary/20"
        />

        {/* Search Button */}
        <Button
          data-slot="button"
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

      {/* Search Dropdown - Enhanced for Production with Fixed Positioning */}
      {shouldShowDropdown && (
        <div
          key={dropdownKey}
          data-search-dropdown
          role="listbox"
          id={listboxId}
          aria-label="Search suggestions and results"
          className="fixed bg-background border border-border rounded-lg shadow-xl z-[9999] min-h-[300px] max-h-[80vh] overflow-y-auto backdrop-blur-sm"
          style={{
            minHeight: '300px',
            maxHeight: '80vh',
            top: searchRef.current ? Math.max(searchRef.current.getBoundingClientRect().bottom + 8, 120) : 120,
            left: searchRef.current ? searchRef.current.getBoundingClientRect().left : 0,
            width: searchRef.current ? searchRef.current.getBoundingClientRect().width : 'auto',
            maxWidth: '100vw'
          }}
          onScroll={(e) => e.stopPropagation()}
        >
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
            <div className="p-4 border-b border-border/50 flex-shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Suggestions</span>
              </div>
              <div className="space-y-1 min-h-[150px]">
                {suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    role="option"
                    aria-selected={activeIndex === ((hasHistory ? searchHistory.length : 0) + index)}
                    tabIndex={-1}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-md cursor-pointer transition-all duration-200 group",
                      activeIndex === ((hasHistory ? searchHistory.length : 0) + index) ? 'bg-accent/50 shadow-sm' : 'hover:bg-accent/50 hover:shadow-sm'
                    )}
                    onMouseEnter={() => setActiveIndex((hasHistory ? searchHistory.length : 0) + index)}
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
                {searchResults.map((product, pIndex) => {
                  const baseIndex = (hasHistory ? searchHistory.length : 0) + (hasSuggestions ? suggestions.length : 0)
                  const index = baseIndex + pIndex
                  return (
                    <div
                      key={product.id}
                      role="option"
                      aria-selected={activeIndex === index}
                      tabIndex={-1}
                      className={cn(
                        "flex items-center gap-4 p-3 rounded-md cursor-pointer transition-all duration-200 group",
                        activeIndex === index ? 'bg-accent/50 shadow-sm' : 'hover:bg-accent/50 hover:shadow-sm'
                      )}
                      onMouseEnter={() => setActiveIndex(index)}
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
                      <div className="flex-shrink-0 relative w-12 h-12">
                        <Image
                          src={product.images[0]}
                          alt={product.name_en}
                          width={48}
                          height={48}
                          className="object-cover rounded-md border border-border/20 group-hover:border-primary/20 transition-colors duration-200"
                          sizes="48px"
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
                )})}
              </div>
            </div>
          )}

          {/* No Results Message */}
          {query.length >= 2 && !hasResults && !hasSuggestions && !hasHistory && (
            <div className="p-6 text-center">
              <div className="flex flex-col items-center gap-3">
                <Search className="h-8 w-8 text-muted-foreground/50" />
                <div>
                  <p className="text-sm font-medium text-foreground">No results found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Try searching for different keywords or check your spelling
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
