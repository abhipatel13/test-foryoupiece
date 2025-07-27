'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/hooks/use-auth'
import { useHydration } from '@/lib/hooks/use-hydration'
import { useCartStore } from '@/lib/store/cart-store'
import { getCorrectUserTier, getTierStyling, getTierFromPoints } from '@/lib/utils'
import { PointsBreakdownComponent } from '@/components/user/points-breakdown'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { AuthForm } from '@/components/auth/auth-form'
import { Input } from '@/components/ui/input'
import { EnhancedSearch } from '@/components/search/enhanced-search'
import {
  ShoppingCart,
  User,
  Menu,
  Heart,
  Search,
  LogOut,
  Settings,
  Package,
  Star,
  ChevronDown,
  MapPin,
  Globe,
  TrendingUp,
  Percent,
  Clock
} from 'lucide-react'

export function Header() {
  const t = useTranslations('navigation')
  const { user, profile, signOut, isAuthenticated, loading } = useAuth()
  const isHydrated = useHydration()
  const { getItemCount, clearCartOnLogout, isLoading: cartLoading } = useCartStore()
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [mounted, setMounted] = useState(false)
  const cartItemCount = getItemCount()
  const showCartCount = isHydrated && mounted && !cartLoading

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleAuthSuccess = () => {
    setAuthDialogOpen(false)
  }

  const handleSignOut = async () => {
    try {
      // Save cart to database and clear local state on logout
      await clearCartOnLogout()
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }



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


      {/* Modern Clean Header */}
      <header className="sticky top-0 z-50 w-full modern-header">
        {/* Main Header Bar */}
        <div className="px-4">
          <div className="flex h-16 items-center justify-between max-w-screen-2xl mx-auto">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2 text-foreground hover:text-primary transition-colors">
              <div className="flex items-center space-x-2">
                <Image
                  src="/favicon.jpg"
                  alt="ForYouPiece"
                  width={32}
                  height={32}
                  className="rounded-lg shadow-sm object-contain flex-shrink-0"
                />
                <Image
                  src="/logo.jpg"
                  alt="ForYouPiece"
                  width={80}
                  height={24}
                  className="hidden sm:block object-contain flex-shrink-0"
                />
              </div>
            </Link>

            {/* Enhanced Search Bar with Real-time Search */}
            <EnhancedSearch
              className="flex-1 max-w-3xl mx-4 lg:mx-8"
              placeholder="Search for products..."
              showCategoryFilter={true}
            />

            {/* Language Switcher */}
            <div className="hidden md:flex items-center text-muted-foreground text-sm cursor-pointer hover:text-foreground transition-colors">
              <Globe className="h-4 w-4 mr-1" />
              <span className="font-medium">EN</span>
              <ChevronDown className="h-3 w-3 ml-1" />
            </div>

            {/* Account & Lists */}
            {!isHydrated || loading ? (
              // Show loading state to prevent flash of unauthenticated content during hydration
              <div className="flex items-center text-foreground text-sm px-3 py-2 rounded-lg">
                <div className="text-right mr-2">
                  <div className="text-xs text-muted-foreground">Loading...</div>
                  <div className="font-medium flex items-center">
                    Account & Lists
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </div>
                </div>
              </div>
            ) : isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center text-foreground text-sm cursor-pointer hover:text-primary transition-colors px-3 py-2 rounded-lg hover:bg-secondary">
                    <div className="text-right mr-2">
                      <div className="text-xs text-muted-foreground">Hello, {profile?.first_name || 'User'}</div>
                      <div className="font-medium flex items-center">
                        Account & Lists
                        <ChevronDown className="h-3 w-3 ml-1" />
                      </div>
                    </div>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={profile?.avatar_url || ''} alt={profile?.first_name || ''} />
                        <AvatarFallback>
                          {profile?.first_name?.[0] || profile?.telegram_username?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {profile?.first_name || profile?.telegram_username || 'User'}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {profile?.email || 'Telegram User'}
                        </p>
                        {/* Enhanced Points Display */}
                        <div className="pt-2 border-t border-gray-100 mt-2">
                          <PointsBreakdownComponent
                            userId={user?.id || ''}
                            variant="header"
                            showTierProgress={true}
                          />
                        </div>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/en/profile">
                      <User className="mr-2 h-4 w-4" />
                      <span>Your Account</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/en/orders">
                      <Package className="mr-2 h-4 w-4" />
                      <span>Your Orders</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/en/wishlist">
                      <Heart className="mr-2 h-4 w-4" />
                      <span>Your Wish List</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/en/settings">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center space-x-2">
                <Link href="/en/auth/login" className="flex items-center text-foreground text-sm hover:text-primary transition-colors px-3 py-2 rounded-lg hover:bg-secondary">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Hello, sign in</div>
                    <div className="font-medium flex items-center">
                      Account & Lists
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </div>
                  </div>
                </Link>
                <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs">
                      Quick Login
                    </Button>
                  </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>
                      {authMode === 'login' ? 'Sign in to ForYouPiece' : 'Create Account'}
                    </DialogTitle>
                    <DialogDescription>
                      {authMode === 'login'
                        ? 'Sign in to your account to continue shopping'
                        : 'Create a new account to start shopping'
                      }
                    </DialogDescription>
                  </DialogHeader>
                  <AuthForm mode={authMode} onSuccess={handleAuthSuccess} />
                  <div className="text-center text-sm text-gray-600">
                    {authMode === 'login' ? (
                      <span>
                        New to ForYouPiece?{' '}
                        <button
                          onClick={() => setAuthMode('signup')}
                          className="text-blue-600 hover:underline"
                        >
                          Create your account
                        </button>
                      </span>
                    ) : (
                      <span>
                        Already have an account?{' '}
                        <button
                          onClick={() => setAuthMode('login')}
                          className="text-blue-600 hover:underline"
                        >
                          Sign in
                        </button>
                      </span>
                    )}
                  </div>
                </DialogContent>
                </Dialog>
              </div>
            )}

            {/* Cart */}
            <Link href="/en/cart" className="flex items-center text-foreground hover:text-primary transition-colors px-3 py-2 rounded-lg hover:bg-secondary">
              <div className="relative mr-3">
                <ShoppingCart className="h-6 w-6" />
                {showCartCount && cartItemCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs bg-primary hover:bg-primary text-primary-foreground"
                  >
                    {cartItemCount}
                  </Badge>
                )}
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Cart</div>
                <div className="font-medium">
                  {cartLoading ? '...' : (showCartCount ? cartItemCount : 0)}
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Secondary Navigation Bar */}
        <div className="bg-secondary border-t border-border px-4">
          <div className="flex h-12 items-center space-x-8 max-w-screen-2xl mx-auto">
            <nav className="flex items-center space-x-8">
              <Link
                href="/en/trending"
                className="text-sm font-medium text-foreground hover:text-primary transition-colors py-2 flex items-center gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                Trending Now
              </Link>
              <Link
                href="/en/products?deals=true"
                className="text-sm font-medium text-foreground hover:text-primary transition-colors py-2 flex items-center gap-2"
              >
                <Percent className="h-4 w-4" />
                Deals and Discounts
              </Link>
              <Link
                href="/en/products?recently_added=true"
                className="text-sm font-medium text-foreground hover:text-primary transition-colors py-2 flex items-center gap-2"
              >
                <Clock className="h-4 w-4" />
                Recently Added
              </Link>
              <Link
                href="/en/products?recommended=true"
                className="text-sm font-medium text-foreground hover:text-primary transition-colors py-2 flex items-center gap-2"
              >
                <Heart className="h-4 w-4" />
                Recommended for You
              </Link>
              <button
                onClick={handleScrollToCategories}
                className="text-sm font-medium text-foreground hover:text-primary transition-colors py-2 flex items-center gap-2 cursor-pointer"
              >
                <Menu className="h-4 w-4" />
                Categories
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden text-foreground hover:text-primary">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[300px] sm:w-[400px]">
          <div className="flex flex-col space-y-6 pt-6">
            {/* Mobile Enhanced Search */}
            <EnhancedSearch
              placeholder="Search for products..."
              showCategoryFilter={false}
            />

            {/* Mobile Navigation */}
            <nav className="flex flex-col space-y-4">
              <Link
                href="/en/trending"
                className="text-sm font-medium transition-colors hover:text-gray-600 py-2 flex items-center gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                Trending Now
              </Link>
              <Link
                href="/en/products?deals=true"
                className="text-sm font-medium transition-colors hover:text-gray-600 py-2 flex items-center gap-2"
              >
                <Percent className="h-4 w-4" />
                Deals and Discounts
              </Link>
              <Link
                href="/en/products?recently_added=true"
                className="text-sm font-medium transition-colors hover:text-gray-600 py-2 flex items-center gap-2"
              >
                <Clock className="h-4 w-4" />
                Recently Added
              </Link>
              <Link
                href="/en/products?recommended=true"
                className="text-sm font-medium transition-colors hover:text-gray-600 py-2 flex items-center gap-2"
              >
                <Heart className="h-4 w-4" />
                Recommended for You
              </Link>
              <button
                onClick={handleScrollToCategories}
                className="text-sm font-medium transition-colors hover:text-gray-600 py-2 flex items-center gap-2 text-left"
              >
                <Menu className="h-4 w-4" />
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
    </>
  )
}
