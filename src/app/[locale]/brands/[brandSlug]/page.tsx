"use client"

import { useEffect, useMemo, useState, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ProductCard } from '@/components/product/product-card'
import { slugify } from '@/lib/utils'

interface Product {
  id: string
  sku: string
  name_en: string
  name_ja: string
  description_en: string | null
  description_ja: string | null
  price: number
  compare_at_price: number | null
  images: string[]
  brand: string | null
  stock_quantity: number
  stock_status: string
  is_featured: boolean
  category?: any
  points_rate?: number | null
}

function BrandProductsInner() {
  const params = useParams<{ brandSlug: string }>()
  const brandSlug = params.brandSlug
  const [brandName, setBrandName] = useState<string>('')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  // Resolve brand name from slug using /api/products/brands
  useEffect(() => {
    const resolveBrand = async () => {
      try {
        const res = await fetch('/api/products/brands')
        const data = await res.json()
        const candidates: string[] = data?.brands || []
        const found = candidates.find((b: string) => slugify(b) === brandSlug)
        setBrandName(found || brandSlug.replace(/-/g, ' '))
      } catch (e) {
        setBrandName(brandSlug.replace(/-/g, ' '))
      }
    }
    resolveBrand()
  }, [brandSlug])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const supabase = createClient()
        if (!supabase) {
          setProducts([])
          setLoading(false)
          return
        }
        // Fetch products for this brand
        const { data, error } = await supabase
          .from('products')
          .select(`
            id, sku, name_en, name_ja, description_en, description_ja,
            price, compare_at_price, images, stock_quantity, stock_status,
            brand, is_featured, points_rate
          `)
          .eq('is_active', true)
          .eq('is_deleted', false)
          .eq('brand', brandName)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Failed to fetch brand products', error)
          setProducts([])
        } else {
          setProducts(data as Product[])
        }
      } finally {
        setLoading(false)
      }
    }
    if (brandName) load()
  }, [brandName])

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="w-full max-w-none px-1 sm:px-4 md:px-6 lg:container lg:mx-auto py-3">
          <div className="text-sm text-gray-600">
            <Link href="/en">Home</Link> &gt; <Link href="/en/brands">Brands</Link> &gt; <span className="text-gray-900">{brandName}</span>
          </div>
        </div>
      </div>

      <div className="w-full max-w-none px-1 sm:px-4 md:px-6 lg:container lg:mx-auto py-4 lg:py-6 lg:max-w-screen-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-medium text-gray-900 mb-2">Brand: {brandName}</h1>
          <p className="text-gray-600">Showing products from {brandName}.</p>
        </div>

        {loading ? (
          <div className="product-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="modern-product-card p-4 animate-pulse">
                <div className="aspect-square bg-muted rounded-lg mb-3"></div>
                <div className="h-4 bg-muted rounded mb-2"></div>
                <div className="h-3 bg-muted rounded mb-2"></div>
                <div className="h-4 bg-muted rounded w-20"></div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-500 text-lg">No products found for this brand.</p>
          </div>
        ) : (
          <div className="product-grid">
            {products.map((p) => (
              <ProductCard key={p.id} product={p as any} locale="en" />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function BrandProductsPage() {
  return (
    <Suspense>
      <BrandProductsInner />
    </Suspense>
  )
}

