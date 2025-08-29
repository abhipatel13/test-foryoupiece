import { NextRequest, NextResponse } from 'next/server'
import { createAnonymousClient } from '@/lib/supabase/server'

// Meta (Facebook) Catalog Feed - CSV format
// Public endpoint that Commerce Manager can pull on a schedule
// Usage: /api/feeds/meta-catalog?format=csv

export const dynamic = 'force-dynamic'

// CSV escape helper
function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function asPriceUSD(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(Number(n))) return ''
  return `${Number(n).toFixed(2)} USD`
}

function mapAvailability(stockStatus?: string, stockQty?: number | null): string {
  const status = (stockStatus || '').toLowerCase()
  if (status === 'in_stock' || status === 'low_stock') return 'in stock'
  if (status === 'out_of_stock') return 'out of stock'
  if (status === 'preorder') return 'preorder'
  if ((stockQty ?? 0) > 0) return 'in stock'
  return 'out of stock'
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const format = (url.searchParams.get('format') || 'csv').toLowerCase()

    if (format !== 'csv') {
      return NextResponse.json({ success: false, error: 'Only CSV is supported' }, { status: 400 })
    }

    const supabase = createAnonymousClient()

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || url.origin

    const selectFields = `
      sku,
      name_en,
      description_en,
      price,
      compare_at_price,
      images,
      stock_quantity,
      stock_status,
      brand,
      categories(name_en, slug)
    `

    const pageSize = 1000
    let from = 0
    const all: any[] = []
    // Simple pagination loop to handle many products
    while (true) {
      const { data, error } = await supabase
        .from('products')
        .select(selectFields)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1)

      if (error) {
        console.error('❌ Meta catalog feed Supabase error:', error)
        return NextResponse.json({ success: false, error: 'Database error fetching products' }, { status: 500 })
      }

      const batch = data || []
      all.push(...batch)
      if (batch.length < pageSize) break
      from += batch.length
    }

    // Meta spec header fields
    const headers = [
      'id',
      'title',
      'description',
      'availability',
      'condition',
      'price',
      'sale_price',
      'link',
      'image_link',
      'brand',
      'additional_image_link',
      'product_type'
    ]

    const rows: string[] = []
    rows.push(headers.join(','))

    for (const p of all) {
      const id = p.sku || ''
      const title = p.name_en || ''
      const description = (p.description_en || '').replace(/\s+/g, ' ').trim()
      const availability = mapAvailability(p.stock_status, p.stock_quantity)
      const condition = 'new'

      const hasCompare = p.compare_at_price && Number(p.compare_at_price) > Number(p.price)
      const priceStr = asPriceUSD(hasCompare ? Number(p.compare_at_price) : Number(p.price))
      const salePriceStr = hasCompare ? asPriceUSD(Number(p.price)) : ''

      const link = `${siteUrl}/en/products/${encodeURIComponent(p.sku)}`
      const images: string[] = Array.isArray(p.images) ? p.images : []
      const imageLink = images[0] || ''
      const additional = images.slice(1, 10).join(',')
      const brand = p.brand || 'ForYouPiece'
      const productType = p.categories?.name_en || ''

      const row = [
        csvEscape(id),
        csvEscape(title),
        csvEscape(description),
        csvEscape(availability),
        csvEscape(condition),
        csvEscape(priceStr),
        csvEscape(salePriceStr),
        csvEscape(link),
        csvEscape(imageLink),
        csvEscape(brand),
        csvEscape(additional),
        csvEscape(productType)
      ].join(',')

      rows.push(row)
    }

    const csv = rows.join('\n')

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'inline; filename="meta-catalog.csv"',
        'Cache-Control': 'public, max-age=300, s-maxage=1800, stale-while-revalidate=86400'
      }
    })
  } catch (e) {
    console.error('❌ Meta catalog feed error:', e)
    return NextResponse.json({ success: false, error: 'Unexpected server error' }, { status: 500 })
  }
}

