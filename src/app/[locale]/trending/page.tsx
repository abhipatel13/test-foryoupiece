'use client'

import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { ProductCard } from '@/components/product/product-card'
import { useTrendingProducts } from '@/presentation/hooks/useTrendingProducts'
import { TrendingUp, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function TrendingPage() {
  const t = useTranslations('navigation')

  const {
    data: trendingData,
    isLoading: trendingLoading,
    error: trendingError
  } = useTrendingProducts(50, false) // Get more products but no stats for users

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link 
              href="/" 
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              <h1 className="text-3xl font-bold text-foreground">Trending Now</h1>
            </div>
            <Badge className="bg-red-500 text-white animate-pulse">HOT</Badge>
          </div>
          
          <p className="text-muted-foreground mt-2">
            Discover what's popular right now - our most sought-after products
          </p>
        </div>

        {/* Loading State */}
        {trendingLoading && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {[...Array(20)].map((_, i) => (
              <div key={i} className="modern-product-card p-4 animate-pulse">
                <div className="aspect-square bg-secondary rounded-lg mb-3"></div>
                <div className="h-4 bg-secondary rounded mb-2"></div>
                <div className="h-3 bg-secondary rounded mb-2"></div>
                <div className="h-4 bg-secondary rounded w-20"></div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {trendingError && (
          <div className="text-center py-12">
            <div className="text-muted-foreground mb-4">
              Unable to load trending products
            </div>
            <p className="text-sm text-muted-foreground">
              Please try refreshing the page
            </p>
          </div>
        )}

        {/* Unified Products Grid - Mobile-First Responsive */}
        {!trendingLoading && !trendingError && trendingData?.products && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-6">
            {trendingData.products.map((product) => (
              <ProductCard
                key={product.product_id}
                product={{
                  id: product.product_id,
                  sku: product.sku,
                  name_en: product.name_en,
                  name_ja: product.name_ja,
                  price: product.price,
                  compare_at_price: product.compare_at_price,
                  images: product.images,
                  stock_quantity: product.stock_quantity,
                  is_featured: product.is_featured,
                  category_name: product.category_name
                }}
                locale="en"
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!trendingLoading && !trendingError && (!trendingData?.products || trendingData.products.length === 0) && (
          <div className="text-center py-12">
            <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No trending products yet</h3>
            <p className="text-muted-foreground">
              Check back soon for the latest trending products
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
