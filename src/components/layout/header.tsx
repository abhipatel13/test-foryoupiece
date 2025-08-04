'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useSSRSafeAuth } from '@/lib/hooks/use-ssr-safe-auth'
import { useHydration } from '@/lib/hooks/use-hydration'
import { useSSRSafeCartStore } from '@/lib/store/ssr-safe-cart-store'
import { getCorrectUserTier, getTierStyling, getTierFromPoints } from '@/lib/utils'
import { PointsBreakdownComponent } from '@/components/user/points-breakdown'
import { OptimizedFloatingAccountDropdown } from '@/components/layout/optimized-floating-account-dropdown'
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
  Clock
} from 'lucide-react'

export function Header() {
  const t = useTranslations('navigation')
  const { user, profile, signOut, isAuthenticated, loading } = useSSRSafeAuth()
  const isHydrated = useHydration()
  const { getItemCount, clearCartOnLogout, isLoading: cartLoading } = useSSRSafeCartStore()
  const [mounted, setMounted] = useState(false)
  const [showMobileSearch, setShowMobileSearch] = useState(false)
  const cartItemCount = getItemCount()
  const showCartCount = isHydrated && mounted && !cartLoading

  useEffect(() => {
    setMounted(true)
  }, [])



  const handleScrollToCategories = () => {
    // Smooth scroll to categories section on the current page
    const categoriesSection = document.getElementById('categories-section')
    if (categoriesSection) {
      categoriesSection.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
    } else {
      // If no categories section found on current page, navigate to home page with hash
      if (typeof window !== 'undefined') {
        window.location.href = '/#categories-section'
      }
    }
  }

  return (
    <>


      {/* Mobile-First Responsive Header */}
      <header className="sticky top-0 z-50 w-full modern-header overflow-x-hidden">
        {/* Main Header Bar - Mobile-First Design */}
        <div className="desktop-container">
          <div className="flex h-16 lg:h-14 xl:h-16 items-center justify-between min-w-0 gap-2 sm:gap-3 lg:gap-4">
            {/* Logo - Mobile Optimized */}
            <Link href="/" className="flex items-center space-x-1 sm:space-x-2 lg:space-x-1.5 text-foreground hover:text-primary transition-colors flex-shrink-0 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 rounded-lg p-1" aria-label="Foryoupiece Home">
              <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-1.5">
                <Image
                  src="/favicon.jpg"
                  alt="ForYouPiece"
                  width={28}
                  height={28}
                  className="rounded-lg shadow-sm object-contain flex-shrink-0 sm:w-8 sm:h-8 lg:w-7 lg:h-7 xl:w-8 xl:h-8"
                  priority
                />
                <Image
                  src="/logo.jpg"
                  alt="ForYouPiece"
                  width={70}
                  height={20}
                  className="hidden sm:block object-contain flex-shrink-0 sm:w-20 sm:h-6 lg:w-16 lg:h-5 xl:w-20 xl:h-6"
                  priority
                />
              </div>
            </Link>

            {/* Enterprise Search Bar - Desktop Optimized */}
            <EnhancedSearch
              className="hidden md:flex flex-1 max-w-3xl mx-3 lg:mx-8 xl:mx-10 min-w-0"
              placeholder="Search for products, brands, categories..."
              showCategoryFilter={true}
            />

            {/* Mobile Search Button - Enhanced Touch Target */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-foreground hover:text-primary hover:bg-accent/50 flex-shrink-0 touch-target transition-all duration-200 rounded-lg"
              onClick={() => setShowMobileSearch(true)}
              aria-label="Open search"
            >
              <Search className="h-5 w-5" />
              <span className="sr-only">Search</span>
            </Button>

            {/* Language Switcher - Enhanced */}
            <div className="hidden lg:flex items-center text-muted-foreground text-sm cursor-pointer hover:text-foreground hover:bg-accent/30 transition-all duration-200 flex-shrink-0 px-3 py-2 rounded-lg">
              <Globe className="h-4 w-4 mr-2" />
              <span className="font-semibold">EN</span>
              <ChevronDown className="h-3 w-3 ml-2" />
            </div>

            {/* Account & Lists - Mobile Optimized with OptimizedFloatingAccountDropdown */}
            <OptimizedFloatingAccountDropdown className="flex-shrink-0 min-w-0" />

            {/* FIXED Cart - Better Visibility & Sizing */}
            <Link href="/en/cart" className="flex items-center text-foreground hover:text-primary hover:bg-accent/30 transition-all duration-200 px-2 sm:px-3 lg:px-4 py-2 rounded-lg flex-shrink-0 touch-target-lg focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 group min-w-[80px] sm:min-w-[100px]" aria-label="View shopping cart">
              <div className="relative mr-2 sm:mr-3">
                <ShoppingCart className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 group-hover:scale-105 transition-transform duration-200" aria-hidden="true" />
                {/* Cart badge with better visibility */}
                {showCartCount && cartItemCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-6 w-6 sm:h-7 sm:w-7 rounded-full p-0 text-xs sm:text-sm bg-red-500 hover:bg-red-600 text-white font-bold shadow-lg border-2 border-white"
                  >
                    {cartItemCount}
                  </Badge>
                )}
              </div>
              <div className="text-right min-w-0 hidden sm:block">
                <div className="text-sm text-muted-foreground font-medium">Cart</div>
                <div className="font-bold text-base lg:text-lg group-hover:text-primary transition-colors duration-200">
                  {cartLoading ? '...' : (showCartCount ? cartItemCount : 0)}
                </div>
              </div>
              {/* Mobile cart count - larger and more visible */}
              <div className="sm:hidden text-sm font-bold ml-1 group-hover:text-primary transition-colors duration-200">
                {cartLoading ? '...' : (showCartCount ? cartItemCount : 0)}
              </div>
            </Link>
          </div>
        </div>

        {/* Enhanced Secondary Navigation - Mobile-First Responsive */}
        <div className="bg-muted/20 border-t border-border/50 overflow-x-hidden shadow-sm">
          <div className="desktop-container">
            <div className="flex h-12 sm:h-14 lg:h-12 xl:h-14 items-center min-w-0">
            <nav className="flex items-center space-x-2 sm:space-x-4 lg:space-x-6 xl:space-x-8 overflow-x-auto scrollbar-hide w-full">
              <Link
                href="/en/trending"
                className="text-sm sm:text-sm lg:text-base font-semibold text-foreground hover:text-primary hover:bg-accent/30 transition-all duration-200 py-2 sm:py-3 px-2 sm:px-3 lg:px-4 rounded-md flex items-center gap-1 sm:gap-2 whitespace-nowrap flex-shrink-0 group touch-target-lg min-h-[44px]"
              >
                <TrendingUp className="h-4 w-4 sm:h-4 sm:w-4 lg:h-5 lg:w-5 group-hover:scale-110 transition-transform duration-200" />
                <span className="hidden sm:inline">Trending Now</span>
                <span className="sm:hidden">Trending</span>
              </Link>
              <Link
                href="/en/products?deals=true"
                className="text-sm sm:text-sm lg:text-base font-semibold text-foreground hover:text-primary hover:bg-accent/30 transition-all duration-200 py-2 sm:py-3 px-2 sm:px-3 lg:px-4 rounded-md flex items-center gap-1 sm:gap-2 whitespace-nowrap flex-shrink-0 group touch-target-lg min-h-[44px]"
              >
                <Percent className="h-4 w-4 sm:h-4 sm:w-4 lg:h-5 lg:w-5 group-hover:scale-110 transition-transform duration-200" />
                <span className="hidden sm:inline">Deals and Discounts</span>
                <span className="sm:hidden">Deals</span>
              </Link>
              <Link
                href="/en/products?recently_added=true"
                className="text-sm sm:text-sm lg:text-base font-semibold text-foreground hover:text-primary hover:bg-accent/30 transition-all duration-200 py-2 sm:py-3 px-2 sm:px-3 lg:px-4 rounded-md flex items-center gap-1 sm:gap-2 whitespace-nowrap flex-shrink-0 group touch-target-lg min-h-[44px]"
              >
                <Clock className="h-4 w-4 sm:h-4 sm:w-4 lg:h-5 lg:w-5 group-hover:scale-110 transition-transform duration-200" />
                <span className="hidden sm:inline">Recently Added</span>
                <span className="sm:hidden">New</span>
              </Link>
              <Link
                href="/en/products?recommended=true"
                className="text-sm sm:text-sm lg:text-base font-semibold text-foreground hover:text-primary hover:bg-accent/30 transition-all duration-200 py-2 sm:py-3 px-2 sm:px-3 lg:px-4 rounded-md flex items-center gap-1 sm:gap-2 whitespace-nowrap flex-shrink-0 group touch-target-lg min-h-[44px]"
              >
                <Heart className="h-4 w-4 sm:h-4 sm:w-4 lg:h-5 lg:w-5 group-hover:scale-110 transition-transform duration-200" />
                <span className="hidden sm:inline">Recommended for You</span>
                <span className="sm:hidden">For You</span>
              </Link>
              <button
                onClick={handleScrollToCategories}
                className="text-sm sm:text-sm lg:text-base font-semibold text-foreground hover:text-primary hover:bg-accent/30 transition-all duration-200 py-2 sm:py-3 px-2 sm:px-3 lg:px-4 rounded-md flex items-center gap-1 sm:gap-2 cursor-pointer whitespace-nowrap flex-shrink-0 group touch-target-lg min-h-[44px]"
              >
                <Menu className="h-4 w-4 sm:h-4 sm:w-4 lg:h-5 lg:w-5 group-hover:scale-110 transition-transform duration-200" />
                Categories
              </button>
            </nav>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu - Optimized for Touch */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden text-foreground hover:text-primary touch-manipulation">
            <Menu className="h-5 w-5" />
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
                href="/en/trending"
                className="text-base font-medium transition-colors hover:text-primary py-3 px-2 flex items-center gap-3 rounded-lg hover:bg-secondary touch-manipulation"
              >
                <TrendingUp className="h-5 w-5 text-primary" />
                Trending Now
              </Link>
              <Link
                href="/en/products?deals=true"
                className="text-base font-medium transition-colors hover:text-primary py-3 px-2 flex items-center gap-3 rounded-lg hover:bg-secondary touch-manipulation"
              >
                <Percent className="h-5 w-5 text-primary" />
                Deals & Discounts
              </Link>
              <Link
                href="/en/products?recently_added=true"
                className="text-base font-medium transition-colors hover:text-primary py-3 px-2 flex items-center gap-3 rounded-lg hover:bg-secondary touch-manipulation"
              >
                <Clock className="h-5 w-5 text-primary" />
                Recently Added
              </Link>
              <Link
                href="/en/products?recommended=true"
                className="text-base font-medium transition-colors hover:text-primary py-3 px-2 flex items-center gap-3 rounded-lg hover:bg-secondary touch-manipulation"
              >
                <Heart className="h-5 w-5 text-primary" />
                For You
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
                    className="text-sm font-medium transition-colors hover:text-gray-600 py-2"
                  >
                    Your Account
                  </Link>
                  <Link
                    href="/en/orders"
                    className="text-sm font-medium transition-colors hover:text-gray-600 py-2"
                  >
                    Your Orders
                  </Link>
                  <Link
                    href="/en/wishlist"
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
