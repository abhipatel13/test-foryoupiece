"use client"

import { useEffect, useMemo, useState, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Pagination } from '@/components/ui/pagination'
import { slugify } from '@/lib/utils'

function xmur3(str: string) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return h >>> 0
  }
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seededShuffle<T>(array: T[], seed: string): T[] {
  const rand = mulberry32(xmur3(seed)())
  const a = [...array]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function BrandGrid({ brands, representatives }: { brands: string[]; representatives: Record<string, { slug: string; image?: string }> }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-6">
      {brands.map((brand) => {
        const rep = representatives[brand]
        const slug = rep?.slug || slugify(brand)
        const image = rep?.image
        return (
          <Link key={brand} href={`/en/brands/${slug}`} className="group">
            <div className="modern-product-card p-3 sm:p-4 text-center group-hover:scale-105 transition-all duration-300 hover:shadow-lg">
              <div className="aspect-square rounded-xl mb-3 sm:mb-4 overflow-hidden bg-gradient-to-br from-secondary to-accent relative flex items-center justify-center">
                {image ? (
                  <Image src={image} alt={`${brand}`} width={160} height={160} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-2xl sm:text-3xl font-semibold">{brand.charAt(0)}</span>
                  </div>
                )}
              </div>
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-1 text-sm sm:text-base line-clamp-2">
                {brand}
              </h3>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function BrandsPageInner() {
  const [allBrands, setAllBrands] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [representatives, setRepresentatives] = useState<Record<string, { slug: string; image?: string }>>({})
  const itemsPerPage = 40

  // Daily seed for randomization (stable throughout the day)
  const dailySeed = useMemo(() => {
    const today = new Date()
    const y = today.getUTCFullYear()
    const m = String(today.getUTCMonth() + 1).padStart(2, '0')
    const d = String(today.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const pageParam = params.get('page')
    if (pageParam) setCurrentPage(parseInt(pageParam))
  }, [])

  useEffect(() => {
    const loadBrands = async () => {
      try {
        const res = await fetch('/api/products/brands')
        const data = await res.json()
        if (data?.brands) {
          const shuffled = seededShuffle<string>(data.brands, dailySeed)
          setAllBrands(shuffled)
        }
      } catch (e) {
        console.error('Failed to fetch brands', e)
        setAllBrands([])
      }
    }
    loadBrands()
  }, [dailySeed])

  const totalPages = Math.max(1, Math.ceil(allBrands.length / itemsPerPage))
  const pageBrands = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return allBrands.slice(start, start + itemsPerPage)
  }, [allBrands, currentPage])

  useEffect(() => {
    const loadRepresentatives = async () => {
      if (pageBrands.length === 0) return
      const qs = new URLSearchParams()
      qs.set('brands', pageBrands.map(encodeURIComponent).join(','))
      qs.set('seed', dailySeed)
      const res = await fetch(`/api/brands/representatives?${qs.toString()}`)
      const data = await res.json()
      if (data?.success) setRepresentatives(data.data || {})
    }
    loadRepresentatives()
  }, [pageBrands, dailySeed])

  const handlePageChange = (p: number) => {
    setCurrentPage(p)
    const params = new URLSearchParams(window.location.search)
    params.set('page', String(p))
    window.history.replaceState({}, '', `?${params.toString()}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="w-full max-w-none px-1 sm:px-4 md:px-6 lg:container lg:mx-auto py-3">
          <div className="text-sm text-gray-600">
            <span>Home</span> &gt; <span className="text-gray-900">Brands</span>
          </div>
        </div>
      </div>

      <div className="w-full max-w-none px-1 sm:px-4 md:px-6 lg:container lg:mx-auto py-4 lg:py-6 lg:max-w-screen-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-medium text-gray-900 mb-2">Brands</h1>
          <p className="text-gray-600">Discover brands we carry. Order changes daily to keep things fresh.</p>
        </div>

        {pageBrands.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-500 text-lg">No brands available.</p>
          </div>
        ) : (
          <BrandGrid brands={pageBrands} representatives={representatives} />
        )}

        {totalPages > 1 && (
          <div className="mt-8">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={allBrands.length}
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
              className="bg-white p-4 rounded-lg shadow-sm"
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default function BrandsPage() {
  return (
    <Suspense>
      <BrandsPageInner />
    </Suspense>
  )
}

