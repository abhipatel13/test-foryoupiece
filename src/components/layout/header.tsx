'use client'

import { useState, useEffect } from 'react'
import type React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useSSRSafeAuth } from '@/lib/hooks/use-ssr-safe-auth'
import { useHydration } from '@/lib/hooks/use-hydration'
import { useSSRSafeCartStore } from '@/lib/store/ssr-safe-cart-store'
import { getCorrectUserTier, getTierStyling, getTierFromPoints } from '@/lib/utils'
import { useMultiTabSync } from '@/lib/utils/multi-tab-sync'
import { PointsBreakdownComponent } from '@/components/user/points-breakdown'
import { SimpleAccountDropdown } from '@/components/layout/simple-account-dropdown'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { EnhancedSearch } from '@/components/search/enhanced-search'
import {
  ShoppingCart,
  Menu,
  Heart,
  Search,
  ChevronDown,
  Globe,
  TrendingUp,
  Percent,
  Clock,
  Tag
} from 'lucide-react'

export function Header() {
  const t = useTranslations('navigation')
  const { user, profile, signOut, isAuthenticated, loading } = useSSRSafeAuth()
  const isHydrated = useHydration()
  const { clearCartOnLogout } = useSSRSafeCartStore()
  const [mounted, setMounted] = useState(false)
  const [showMobileSearch, setShowMobileSearch] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  // Desktop-only floating tooltip state for nav icons
  const [hoverTip, setHoverTip] = useState<{ label: string; x: number; y: number; visible: boolean }>({ label: '', x: 0, y: 0, visible: false })
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)') // lg breakpoint
    const update = () => setIsDesktop(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const showNavTooltip = (e: React.MouseEvent<HTMLElement>, label: string) => {
    if (!isDesktop) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setHoverTip({ label, x: rect.left + rect.width / 2, y: rect.bottom + 8, visible: true })
  }
  const hideNavTooltip = () => setHoverTip((t) => ({ ...t, visible: false }))

  // Use SSR-safe cart store for reactive cart count
  const { getItemCount, isLoading: cartLoading, isHydrated: cartHydrated } = useSSRSafeCartStore()

  const cartItemCount = cartHydrated ? getItemCount() : 0
  const showCartCount = isHydrated && mounted && cartHydrated && !cartLoading

  // Improved loading state detection
  const isAuthLoading = loading || !isHydrated || !mounted
  const isCartLoading = cartLoading || !cartHydrated

  useEffect(() => {
    setMounted(true)
  }, [])

  // Force a tiny tick re-render when cart or auth changes cross-tab
  const [, forceRender] = useState(0)
  useMultiTabSync({
    onAuthStateChange: () => forceRender((t) => t + 1),
    onSessionExpired: () => forceRender((t) => t + 1),
    onSessionValidated: () => forceRender((t) => t + 1),
    onCartCleared: () => forceRender((t) => t + 1)
  })



  // Robust smooth-scroll with fixed header offset
  const navigateToSection = (sectionId: string, fallbackHref?: string) => {
    // Always close mobile menu first
    setShowMobileMenu(false)

    if (typeof window === 'undefined') return

    const onHome = window.location.pathname === '/' || window.location.pathname === '/en'
    const target = document.getElementById(sectionId)

    if (onHome && target) {
      const header = document.querySelector('header.modern-header') as HTMLElement | null
      const headerHeight = header?.offsetHeight ?? 0
      const targetTop = target.getBoundingClientRect().top + window.scrollY
      const y = Math.max(0, targetTop - headerHeight - 4) // small extra gap
      window.scrollTo({ top: y, behavior: 'smooth' })
    } else {
      // Default to homepage anchor so browser jumps to section, preserving existing pages
      window.location.href = fallbackHref || `/#${sectionId}`
    }
  }

  const handleScrollToCategories = () => {
    navigateToSection('categories-section')
  }

  // Function to handle navigation link clicks and close mobile menu
  const handleMobileNavClick = () => {
    setShowMobileMenu(false)
  }

  return (
    <>


      {/* Mobile-First Responsive Header - Ultra Compact */}
      <header className="fixed top-0 z-[20000] w-full modern-header overflow-x-hidden">
        {/* Main Header Bar - Ultra Compact Mobile Design */}
        <div className="desktop-container">
          <div className="flex h-12 sm:h-14 lg:h-14 xl:h-16 items-center justify-between min-w-0 gap-1 sm:gap-2 lg:gap-2 xl:gap-3">
            {/* Logo - Ultra Compact Mobile */}
            <Link href="/" className="flex items-center space-x-1 sm:space-x-2 lg:space-x-1.5 text-foreground hover:text-primary transition-colors flex-shrink-0 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 rounded-lg p-0.5 sm:p-1" aria-label="Foryoupiece Home">
              <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-1.5">
                <Image
                  src="/favicon.jpg"
                  alt="ForYouPiece"
                  width={24}
                  height={24}
                  className="rounded-lg shadow-sm object-contain flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 lg:w-7 lg:h-7 xl:w-8 xl:h-8"
                  priority
                />
                <Image
                  src="/logo.jpg"
                  alt="ForYouPiece"
                  width={60}
                  height={18}
                  className="hidden sm:block object-contain flex-shrink-0 sm:w-16 sm:h-5 lg:w-16 lg:h-5 xl:w-20 xl:h-6"
                />
              </div>
            </Link>

            {/* Enterprise Search Bar - Desktop Optimized */}
            <EnhancedSearch
              className="hidden lg:flex flex-1 min-w-0 w-full lg:basis-[clamp(800px,60vw,1200px)] xl:basis-[clamp(1000px,62vw,1400px)] 2xl:basis-[clamp(1200px,64vw,1600px)] mx-2 lg:mx-4 xl:mx-6"
              placeholder="Search for products, brands, categories..."
              showCategoryFilter={true}
            />

            {/* Navigation Menu - Integrated into Header (Desktop) */}
            <nav className="hidden lg:flex items-center gap-1 xl:gap-2 flex-shrink-0">
              <Link
                href="/#trending-section"
                onClick={(e) => { e.preventDefault(); navigateToSection('trending-section', '/#trending-section') }}
                onMouseEnter={(e) => showNavTooltip(e, 'Trending')}
                onMouseLeave={hideNavTooltip}
                className="text-xs xl:text-sm font-semibold text-foreground hover:text-primary hover:bg-accent/30 transition-all duration-200 py-1.5 px-1 xl:px-2.5 rounded-md flex items-center gap-1 whitespace-nowrap min-h-[44px] touch-manipulation group relative overflow-visible"
              >
                <TrendingUp className="h-4 w-4 group-hover:scale-110 transition-transform duration-200" />
                <span className="sr-only">Trending</span>
                <span aria-hidden="true" className="hidden">Trending</span>
              </Link>
              <Link
                href="/#deals-section"
                onClick={(e) => { e.preventDefault(); navigateToSection('deals-section', '/#deals-section') }}
                onMouseEnter={(e) => showNavTooltip(e, 'Deals')}
                onMouseLeave={hideNavTooltip}
                className="text-xs xl:text-sm font-semibold text-foreground hover:text-primary hover:bg-accent/30 transition-all duration-200 py-1.5 px-1 xl:px-2.5 rounded-md flex items-center gap-1 whitespace-nowrap min-h-[44px] touch-manipulation group relative overflow-visible"
              >
                <Percent className="h-4 w-4 group-hover:scale-110 transition-transform duration-200" />
                <span className="sr-only">Deals</span>
                <span aria-hidden="true" className="hidden">Deals</span>
              </Link>
              <Link
                href="/#recently-added-section"
                onClick={(e) => { e.preventDefault(); navigateToSection('recently-added-section', '/#recently-added-section') }}
                onMouseEnter={(e) => showNavTooltip(e, 'New')}
                onMouseLeave={hideNavTooltip}
                className="text-xs xl:text-sm font-semibold text-foreground hover:text-primary hover:bg-accent/30 transition-all duration-200 py-1.5 px-1 xl:px-2.5 rounded-md flex items-center gap-1 whitespace-nowrap min-h-[44px] touch-manipulation group relative overflow-visible"
              >
                <Clock className="h-4 w-4 group-hover:scale-110 transition-transform duration-200" />
                <span className="sr-only">New</span>
                <span aria-hidden="true" className="hidden">New</span>
              </Link>
              <Link
                href="/#brands-section"
                onClick={(e) => { e.preventDefault(); navigateToSection('brands-section', '/#brands-section') }}
                onMouseEnter={(e) => showNavTooltip(e, 'Brand')}
                onMouseLeave={hideNavTooltip}
                className="text-xs xl:text-sm font-semibold text-foreground hover:text-primary hover:bg-accent/30 transition-all duration-200 py-1.5 px-1 xl:px-2.5 rounded-md flex items-center gap-1 whitespace-nowrap min-h-[44px] touch-manipulation group relative overflow-visible"
              >
                <Tag className="h-4 w-4 group-hover:scale-110 transition-transform duration-200" />
                <span className="sr-only">Brand</span>
                <span aria-hidden="true" className="hidden">Brand</span>
              </Link>

              <Link
                href="/#recommended-section"
                onClick={(e) => { e.preventDefault(); navigateToSection('recommended-section', '/#recommended-section') }}
                onMouseEnter={(e) => showNavTooltip(e, 'For You')}
                onMouseLeave={hideNavTooltip}
                className="text-xs xl:text-sm font-semibold text-foreground hover:text-primary hover:bg-accent/30 transition-all duration-200 py-1.5 px-1 xl:px-2.5 rounded-md flex items-center gap-1 whitespace-nowrap min-h-[44px] touch-manipulation group relative overflow-visible"
              >
                <Heart className="h-4 w-4 group-hover:scale-110 transition-transform duration-200" />
                <span className="sr-only">For You</span>
                <span aria-hidden="true" className="hidden">For You</span>
              </Link>
            </nav>

            {/* Mobile Search Button - Ultra Compact */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-foreground hover:text-primary hover:bg-accent/50 flex-shrink-0 transition-all duration-200 rounded-lg h-11 w-11 sm:h-12 sm:w-12"
              onClick={() => setShowMobileSearch(true)}
              aria-label="Open search"
            >
              <Search className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="sr-only">Search</span>
            </Button>

            {/* Mobile Menu Button - Ultra Compact */}
            <Sheet open={showMobileMenu} onOpenChange={setShowMobileMenu}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden text-foreground hover:text-primary hover:bg-accent/50 flex-shrink-0 transition-all duration-200 rounded-lg h-11 w-11 sm:h-12 sm:w-12">
                  <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] sm:w-[320px] p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Navigation Menu</SheetTitle>
                  <SheetDescription>
                    Access navigation links, search, and account options
                  </SheetDescription>
                </SheetHeader>
                <div className="flex flex-col h-full">
                  {/* Mobile Search Header */}
                  <div className="p-4 border-b border-border">
                    <EnhancedSearch
                      placeholder="Search products..."
                      showCategoryFilter={false}
                      className="w-full"
                    />
                  </div>

                  {/* Mobile Navigation - Better Touch Targets */}
                  <nav className="flex flex-col p-4 space-y-2 flex-1">
                    <Link
                      href="/#trending-section"
                      onClick={(e) => { e.preventDefault(); navigateToSection('trending-section', '/#trending-section') }}
                      className="text-base font-medium transition-colors hover:text-primary py-3 px-2 flex items-center gap-3 rounded-lg hover:bg-secondary touch-manipulation"
                    >
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Trending Now
                    </Link>
                    <Link
                      href="/#deals-section"
                      onClick={(e) => { e.preventDefault(); navigateToSection('deals-section', '/#deals-section') }}
                      className="text-base font-medium transition-colors hover:text-primary py-3 px-2 flex items-center gap-3 rounded-lg hover:bg-secondary touch-manipulation"
                    >
                      <Percent className="h-5 w-5 text-primary" />
                      Deals & Discounts
                    </Link>
                    <Link
                      href="/#recently-added-section"
                      onClick={(e) => { e.preventDefault(); navigateToSection('recently-added-section', '/#recently-added-section') }}
                      className="text-base font-medium transition-colors hover:text-primary py-3 px-2 flex items-center gap-3 rounded-lg hover:bg-secondary touch-manipulation"
                    >
                      <Clock className="h-5 w-5 text-primary" />
                      Recently Added
                    </Link>
                    <Link
                      href="/#recommended-section"
                      onClick={(e) => { e.preventDefault(); navigateToSection('recommended-section', '/#recommended-section') }}
                      className="text-base font-medium transition-colors hover:text-primary py-3 px-2 flex items-center gap-3 rounded-lg hover:bg-secondary touch-manipulation"
                    >
                      <Heart className="h-5 w-5 text-primary" />
                      For You
                    </Link>
                    <Link
                      href="/#brands-section"
                      onClick={(e) => { e.preventDefault(); navigateToSection('brands-section', '/#brands-section') }}
                      className="text-base font-medium transition-colors hover:text-primary py-3 px-2 flex items-center gap-3 rounded-lg hover:bg-secondary touch-manipulation"
                    >
                      <Tag className="h-5 w-5 text-primary" />
                      Brand
                    </Link>

                    <button
                      onClick={handleScrollToCategories}
                      className="text-base font-medium transition-colors hover:text-primary py-3 px-2 flex items-center gap-3 text-left rounded-lg hover:bg-secondary touch-manipulation"
                    >
                      <Menu className="h-5 w-5 text-primary" />
                      Categories
                    </button>
                    {isAuthenticated && (
                      <>
                        <hr className="my-2" />
                        <Link
                          href="/en/profile"
                          onClick={handleMobileNavClick}
                          className="text-sm font-medium transition-colors hover:text-gray-600 py-2"
                        >
                          Your Account
                        </Link>
                        <Link
                          href="/en/orders"
                          onClick={handleMobileNavClick}
                          className="text-sm font-medium transition-colors hover:text-gray-600 py-2"
                        >
                          Your Orders
                        </Link>
                        <Link
                          href="/en/wishlist"
                          onClick={handleMobileNavClick}
                          className="text-sm font-medium transition-colors hover:text-gray-600 py-2"
                        >
                          Your Wish List
                        </Link>
                      </>
                    )}
                  </nav>
                </div>
              </SheetContent>
            </Sheet>

            {/* Language Switcher - Enhanced */}
            <div className="hidden xl:flex items-center text-muted-foreground text-sm cursor-pointer hover:text-foreground hover:bg-accent/30 transition-all duration-200 flex-shrink-0 px-2 py-1.5 rounded-lg">
              <Globe className="h-4 w-4 mr-2" />
              <span className="font-semibold hidden 2xl:inline">EN</span>
              <ChevronDown className="h-3 w-3 ml-2" />
            </div>

            {/* Notifications bell intentionally removed; count appears in account dropdown */}

            {/* Account & Lists - Simple and Fast */}
            <SimpleAccountDropdown className="flex-shrink-0 min-w-0 max-w-[88px] overflow-hidden xl:max-w-none" />

            {/* Ultra Compact Cart - Maximum Visibility on Small Screens */}
            <Link href="/en/cart" className="flex items-center text-foreground hover:text-primary hover:bg-accent/30 transition-all duration-200 px-1 sm:px-2 lg:px-3 py-1 sm:py-2 rounded-lg flex-shrink-0 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 group min-w-[52px] sm:min-w-[64px]" aria-label="View shopping cart">
              <div className="relative mr-1 sm:mr-2">
                <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 group-hover:scale-105 transition-transform duration-200" aria-hidden="true" />
                {/* Ultra compact cart badge */}
                {showCartCount && cartItemCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1.5 -right-1.5 h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 rounded-full p-0 text-[10px] sm:text-xs bg-red-500 hover:bg-red-600 text-white font-bold shadow-lg border border-white flex items-center justify-center"
                  >
                    {cartItemCount > 99 ? '99+' : cartItemCount}
                  </Badge>

                )}
              </div>
              <div className="text-right min-w-0 hidden">
                <div className="text-xs sm:text-sm text-muted-foreground font-medium">Cart</div>
                <div className="font-bold text-sm sm:text-base lg:text-lg group-hover:text-primary transition-colors duration-200">
                  {isCartLoading ? (
                    <span className="animate-pulse text-muted-foreground">•••</span>
                  ) : (
                    showCartCount ? cartItemCount : 0
                  )}
                </div>
              </div>
              {/* Ultra compact mobile cart count */}
              <div className="sm:hidden text-xs font-bold ml-0.5 group-hover:text-primary transition-colors duration-200 min-w-[12px] text-center">
                {isCartLoading ? (
                  <span className="animate-pulse text-muted-foreground">•••</span>
                ) : (
                  showCartCount ? cartItemCount : 0
                )}
              </div>
            </Link>
          </div>
        </div>


      </header>



      {/* Desktop-only floating tooltip (fixed, above all content) */}
      {isDesktop && hoverTip.visible && (
        <div
          className="hidden lg:block pointer-events-none fixed z-[2147483647] px-2 py-1 text-[11px] rounded-md bg-black/90 text-white shadow-lg"
          style={{ left: hoverTip.x, top: hoverTip.y, transform: 'translateX(-50%)' }}
          aria-hidden="true"
        >
          {hoverTip.label}
        </div>
      )}


      {/* Mobile Search Modal */}
      <Dialog open={showMobileSearch} onOpenChange={setShowMobileSearch}>
        <DialogContent className="top-[5%] translate-y-0 max-w-full h-auto max-h-[90vh] sm:max-w-lg sm:h-auto sm:top-[50%] sm:translate-y-[-50%] md:top-[20%] md:h-auto p-2 sm:p-6">
          <DialogHeader className="pb-2 mb-0">
            <DialogTitle className="text-base font-medium">Search Products</DialogTitle>
          </DialogHeader>
          <div className="mt-0">
            <EnhancedSearch
              className="w-full"
              placeholder="Search for products..."

              showCategoryFilter={true}
              autoFocus
              onSearch={(query, category) => {
                setShowMobileSearch(false)
                // Navigate to search results
                const searchParams = new URLSearchParams()
                searchParams.set('search', query)
                if (category) {
                  searchParams.set('category', category)
                }
                window.location.href = `/en/products?${searchParams.toString()}`
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
