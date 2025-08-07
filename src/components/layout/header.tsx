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
  Clock
} from 'lucide-react'

export function Header() {
  const t = useTranslations('navigation')
  const { user, profile, signOut, isAuthenticated, loading } = useSSRSafeAuth()
  const isHydrated = useHydration()
  const { clearCartOnLogout } = useSSRSafeCartStore()
  const [mounted, setMounted] = useState(false)
  const [showMobileSearch, setShowMobileSearch] = useState(false)

  // Use SSR-safe cart store for reactive cart count
  const { getItemCount, isLoading: cartLoading, isHydrated: cartHydrated } = useSSRSafeCartStore()

  const cartItemCount = cartHydrated ? getItemCount() : 0
  const showCartCount = isHydrated && mounted && cartHydrated && !cartLoading

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


      {/* Mobile-First Responsive Header - Ultra Compact */}
      <header className="sticky top-0 z-50 w-full modern-header overflow-x-hidden">
        {/* Main Header Bar - Ultra Compact Mobile Design */}
        <div className="desktop-container">
          <div className="flex h-12 sm:h-14 lg:h-14 xl:h-16 items-center justify-between min-w-0 gap-1 sm:gap-2 lg:gap-4">
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
                  priority
                />
              </div>
            </Link>

            {/* Enterprise Search Bar - Desktop Optimized */}
            <EnhancedSearch
              className="hidden lg:flex flex-1 max-w-3xl mx-3 lg:mx-8 xl:mx-10 min-w-0"
              placeholder="Search for products, brands, categories..."
              showCategoryFilter={true}
            />

            {/* Navigation Menu - Integrated into Header (Desktop) */}
            <nav className="hidden lg:flex items-center gap-1 xl:gap-2 flex-shrink-0">
              <Link
                href="/en/trending"
                className="text-xs xl:text-sm font-semibold text-foreground hover:text-primary hover:bg-accent/30 transition-all duration-200 py-2 px-2 xl:px-3 rounded-md flex items-center gap-1 whitespace-nowrap min-h-[44px] touch-manipulation group"
              >
                <TrendingUp className="h-4 w-4 group-hover:scale-110 transition-transform duration-200" />
                <span>Trending</span>
              </Link>
              <Link
                href="/en/products?deals=true"
                className="text-xs xl:text-sm font-semibold text-foreground hover:text-primary hover:bg-accent/30 transition-all duration-200 py-2 px-2 xl:px-3 rounded-md flex items-center gap-1 whitespace-nowrap min-h-[44px] touch-manipulation group"
              >
                <Percent className="h-4 w-4 group-hover:scale-110 transition-transform duration-200" />
                <span>Deals</span>
              </Link>
              <Link
                href="/en/products?recently_added=true"
                className="text-xs xl:text-sm font-semibold text-foreground hover:text-primary hover:bg-accent/30 transition-all duration-200 py-2 px-2 xl:px-3 rounded-md flex items-center gap-1 whitespace-nowrap min-h-[44px] touch-manipulation group"
              >
                <Clock className="h-4 w-4 group-hover:scale-110 transition-transform duration-200" />
                <span>New</span>
              </Link>
              <Link
                href="/en/products?recommended=true"
                className="text-xs xl:text-sm font-semibold text-foreground hover:text-primary hover:bg-accent/30 transition-all duration-200 py-2 px-2 xl:px-3 rounded-md flex items-center gap-1 whitespace-nowrap min-h-[44px] touch-manipulation group"
              >
                <Heart className="h-4 w-4 group-hover:scale-110 transition-transform duration-200" />
                <span>For You</span>
              </Link>
            </nav>

            {/* Mobile Search Button - Ultra Compact */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-foreground hover:text-primary hover:bg-accent/50 flex-shrink-0 transition-all duration-200 rounded-lg h-8 w-8 sm:h-10 sm:w-10"
              onClick={() => setShowMobileSearch(true)}
              aria-label="Open search"
            >
              <Search className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="sr-only">Search</span>
            </Button>

            {/* Mobile Menu Button - Ultra Compact */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden text-foreground hover:text-primary hover:bg-accent/50 flex-shrink-0 transition-all duration-200 rounded-lg h-8 w-8 sm:h-10 sm:w-10">
                  <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
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

            {/* Language Switcher - Enhanced */}
            <div className="hidden xl:flex items-center text-muted-foreground text-sm cursor-pointer hover:text-foreground hover:bg-accent/30 transition-all duration-200 flex-shrink-0 px-3 py-2 rounded-lg">
              <Globe className="h-4 w-4 mr-2" />
              <span className="font-semibold">EN</span>
              <ChevronDown className="h-3 w-3 ml-2" />
            </div>

            {/* Account & Lists - Simple and Fast */}
            <SimpleAccountDropdown className="flex-shrink-0 min-w-0" />

            {/* Ultra Compact Cart - Maximum Visibility on Small Screens */}
            <Link href="/en/cart" className="flex items-center text-foreground hover:text-primary hover:bg-accent/30 transition-all duration-200 px-1 sm:px-2 lg:px-4 py-1 sm:py-2 rounded-lg flex-shrink-0 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 group min-w-[60px] sm:min-w-[80px]" aria-label="View shopping cart">
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
              <div className="text-right min-w-0 hidden sm:block">
                <div className="text-xs sm:text-sm text-muted-foreground font-medium">Cart</div>
                <div className="font-bold text-sm sm:text-base lg:text-lg group-hover:text-primary transition-colors duration-200">
                  {cartLoading ? '...' : (showCartCount ? cartItemCount : 0)}
                </div>
              </div>
              {/* Ultra compact mobile cart count */}
              <div className="sm:hidden text-xs font-bold ml-0.5 group-hover:text-primary transition-colors duration-200 min-w-[12px] text-center">
                {cartLoading ? '...' : (showCartCount ? cartItemCount : 0)}
              </div>
            </Link>
          </div>
        </div>


      </header>



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
