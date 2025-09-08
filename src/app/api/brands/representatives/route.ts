import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
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

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const brandsParam = url.searchParams.get('brands') || ''
    const seedParam = url.searchParams.get('seed') || ''

    const brandNames = brandsParam
      .split(',')
      .map((b) => decodeURIComponent(b.trim()))
      .filter((b) => b.length > 0)

    if (brandNames.length === 0) {
      return NextResponse.json({ success: true, data: {}, count: 0 })
    }

    // Deterministic RNG (optional)
    const seed = seedParam || brandNames.join('|')
    const rand = mulberry32(xmur3(seed)())

    const supabase = createServiceRoleClient()

    const { data: rows, error } = await supabase
      .from('products')
      .select('brand, images')
      .eq('is_active', true)
      .eq('is_deleted', false)
      .in('brand', brandNames)

    if (error) {
      console.error('representatives query error', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch representatives' }, { status: 500 })
    }

    const grouped: Record<string, string[]> = {}
    for (const r of rows || []) {
      const b = r.brand as string | null
      const imgs = (r.images as string[] | null) || []
      if (!b) continue
      if (!grouped[b]) grouped[b] = []
      if (imgs.length > 0) grouped[b].push(imgs[0])
    }

    const result: Record<string, { slug: string; image?: string }> = {}
    for (const b of brandNames) {
      const images = grouped[b] || []
      const image = images.length > 0 ? images[Math.floor(rand() * images.length)] : undefined
      result[b] = { slug: slugify(b), image }
    }

    return NextResponse.json({ success: true, data: result, count: Object.keys(result).length })
  } catch (e: any) {
    console.error('representatives API error', e)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

