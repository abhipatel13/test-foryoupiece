'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Search, Package, Grid3X3, List, Filter } from 'lucide-react'
import { categoryQueries } from '@/lib/supabase/queries'

interface Category {
  id: string
  name_en: string
  name_ja?: string
  slug: string
  description_en?: string
  description_ja?: string
  product_count?: number
  image_url?: string
  // Add other potential fields from database
  is_active?: boolean
  sort_order?: number
  created_at?: string
  updated_at?: string
}

export default function CategoriesPage() {
  // const t = useTranslations('categories') // Removed - no translations needed
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      setLoading(true)
      const data = await categoryQueries.getCategories()
      console.log('Categories loaded:', data)
      setCategories(data || [])
    } catch (error) {
      console.error('Error loading categories:', error)
      setCategories([])
    } finally {
      setLoading(false)
    }
  }

  const filteredCategories = categories.filter(category => {
    if (!category.name_en) return false
    return category.name_en.toLowerCase().includes(searchTerm.toLowerCase())
  })

  console.log('Filtered categories:', filteredCategories.length, filteredCategories)

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-screen-2xl">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg p-6">
                  <div className="h-32 bg-gray-200 rounded mb-4"></div>
                  <div className="h-6 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-screen-2xl">
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
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Product Categories</h1>
              <p className="text-muted-foreground">
                Browse our curated collection of premium products from Japan and worldwide
              </p>
            </div>
            
            <Badge className="bg-primary/10 text-primary border-primary/20 w-fit">
              {categories.length} Categories
            </Badge>
          </div>
        </div>

        {/* Search and View Controls */}
        <div className="bg-white rounded-lg p-6 mb-8 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Categories Grid/List */}
        {filteredCategories.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No categories found</h3>
            <p className="text-muted-foreground">
              {searchTerm ? 'Try adjusting your search terms' : 'Categories will appear here once loaded'}
            </p>
          </div>
        ) : (
          <div className={
            viewMode === 'grid' 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              : "space-y-4"
          }>
            {filteredCategories.map((category) => (
              <Link
                key={category.id}
                href={`/en/products?category=${category.slug}`}
                className="block group"
              >
                {viewMode === 'grid' ? (
                  <Card className="h-full hover:shadow-lg transition-all duration-300 group-hover:scale-105">
                    <CardContent className="p-6">
                      <div className="aspect-square bg-secondary rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                        {category.image_url ? (
                          <Image
                            src={category.image_url}
                            alt={category.name_en}
                            width={120}
                            height={120}
                            className="object-contain"
                          />
                        ) : (
                          <Package className="h-12 w-12 text-muted-foreground" />
                        )}
                      </div>
                      
                      <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                        {category.name_en}
                      </h3>
                      
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs">
                          {category.product_count || 0} products
                        </Badge>
                      </div>
                      
                      {category.description_en && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {category.description_en}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-secondary rounded-lg flex items-center justify-center flex-shrink-0">
                          {category.image_url ? (
                            <Image
                              src={category.image_url}
                              alt={category.name_en}
                              width={40}
                              height={40}
                              className="object-contain"
                            />
                          ) : (
                            <Package className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                        
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            {category.name_en}
                          </h3>
                          {category.description_en && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {category.description_en}
                            </p>
                          )}
                        </div>
                        
                        <Badge variant="secondary" className="text-xs">
                          {category.product_count || 0}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </Link>
            ))}
          </div>
        )}

        {/* Back to Top */}
        <div className="text-center mt-12">
          <Button asChild variant="outline">
            <Link href="/">
              Back to Homepage
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
