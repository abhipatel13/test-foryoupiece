'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/lib/store/cart-store'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Keyboard, Search, ShoppingCart, Home, TrendingUp } from 'lucide-react'

interface KeyboardShortcut {
  key: string
  description: string
  action: () => void
  category: 'navigation' | 'search' | 'cart' | 'general'
}

export function KeyboardShortcuts() {
  const router = useRouter()
  const { getItemCount } = useCartStore()
  const [showHelp, setShowHelp] = useState(false)

  const shortcuts: KeyboardShortcut[] = [
    // Navigation shortcuts
    {
      key: 'Alt+H',
      description: 'Go to Home page',
      action: () => router.push('/'),
      category: 'navigation'
    },
    {
      key: 'Alt+T',
      description: 'Go to Trending products',
      action: () => router.push('/en/trending'),
      category: 'navigation'
    },
    {
      key: 'Alt+P',
      description: 'Go to All products',
      action: () => router.push('/en/products'),
      category: 'navigation'
    },
    {
      key: 'Alt+C',
      description: 'Go to Categories',
      action: () => router.push('/en/categories'),
      category: 'navigation'
    },
    // Search shortcuts
    {
      key: 'Ctrl+K',
      description: 'Focus search bar',
      action: () => {
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
          searchInput.select()
        }
      },
      category: 'search'
    },
    {
      key: '/',
      description: 'Quick search focus',
      action: () => {
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
        }
      },
      category: 'search'
    },
    // Cart shortcuts
    {
      key: 'Alt+B',
      description: 'View shopping cart',
      action: () => router.push('/en/cart'),
      category: 'cart'
    },
    // General shortcuts
    {
      key: '?',
      description: 'Show keyboard shortcuts',
      action: () => setShowHelp(true),
      category: 'general'
    },
    {
      key: 'Escape',
      description: 'Close dialogs/modals',
      action: () => {
        // This is handled by individual components
      },
      category: 'general'
    }
  ]

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (event.target instanceof HTMLInputElement || 
          event.target instanceof HTMLTextAreaElement ||
          event.target instanceof HTMLSelectElement) {
        // Exception for Escape key
        if (event.key === 'Escape') {
          (event.target as HTMLElement).blur()
        }
        return
      }

      const shortcut = shortcuts.find(s => {
        if (s.key === 'Ctrl+K') {
          return event.ctrlKey && event.key === 'k'
        }
        if (s.key === 'Alt+H') {
          return event.altKey && event.key === 'h'
        }
        if (s.key === 'Alt+T') {
          return event.altKey && event.key === 't'
        }
        if (s.key === 'Alt+P') {
          return event.altKey && event.key === 'p'
        }
        if (s.key === 'Alt+C') {
          return event.altKey && event.key === 'c'
        }
        if (s.key === 'Alt+B') {
          return event.altKey && event.key === 'b'
        }
        if (s.key === '/') {
          return event.key === '/' && !event.ctrlKey && !event.altKey && !event.metaKey
        }
        if (s.key === '?') {
          return event.key === '?' && !event.ctrlKey && !event.altKey && !event.metaKey
        }
        return false
      })

      if (shortcut) {
        event.preventDefault()
        shortcut.action()
        
        // Show toast for navigation actions
        if (shortcut.category === 'navigation') {
          toast.success(`Navigating: ${shortcut.description}`)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [router])

  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = []
    }
    acc[shortcut.category].push(shortcut)
    return acc
  }, {} as Record<string, KeyboardShortcut[]>)

  const categoryIcons = {
    navigation: <Home className="h-4 w-4" />,
    search: <Search className="h-4 w-4" />,
    cart: <ShoppingCart className="h-4 w-4" />,
    general: <Keyboard className="h-4 w-4" />
  }

  const categoryLabels = {
    navigation: 'Navigation',
    search: 'Search',
    cart: 'Shopping Cart',
    general: 'General'
  }

  return (
    <>
      {/* Skip to content link for screen readers */}
      <a
        href="#main-content"
        className="skip-to-content enterprise-focus"
        tabIndex={1}
      >
        Skip to main content
      </a>

      {/* Keyboard shortcuts help dialog */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              Keyboard Shortcuts
            </DialogTitle>
            <DialogDescription>
              Use these keyboard shortcuts to navigate efficiently through Foryoupiece
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
              <div key={category}>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                  {categoryIcons[category as keyof typeof categoryIcons]}
                  {categoryLabels[category as keyof typeof categoryLabels]}
                </h3>
                <div className="space-y-2">
                  {shortcuts.map((shortcut) => (
                    <div key={shortcut.key} className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/50">
                      <span className="text-sm text-foreground">{shortcut.description}</span>
                      <Badge variant="outline" className="font-mono text-xs">
                        {shortcut.key}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Tip:</strong> Press <Badge variant="outline" className="font-mono text-xs mx-1">?</Badge> 
              anytime to show this help dialog. Press <Badge variant="outline" className="font-mono text-xs mx-1">Escape</Badge> 
              to close dialogs and clear focus.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
