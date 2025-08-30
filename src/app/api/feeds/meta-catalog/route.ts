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

    // Optional security: require token if configured
    const requiredToken = process.env.META_FEED_TOKEN
    const providedToken = url.searchParams.get('token')
    if (requiredToken && providedToken !== requiredToken) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (format !== 'csv') {
      return NextResponse.json({ success: false, error: 'Only CSV is supported' }, { status: 400 })
    }

    const supabase = createAnonymousClient()

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || url.origin

    const selectFields = `
      sku,
      name_en,
      description_en,
      short_description_en,
      price,
      compare_at_price,
      images,
      stock_quantity,
      stock_status,
      brand,
      weight_grams,
      is_preorder,
      preorder_date,
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

    // Meta spec header fields (includes recommended optional fields)
    const headers = [
      'id',
      'title',
      'description',
      'rich_text_description',
      'availability',
      'condition',
      'price',
      'sale_price',
      'link',
      'image_link',
      'brand',
      'additional_image_link',
      'product_type',
      'mpn',
      'item_group_id',
      'shipping_weight',
      'availability_date',
      'inventory'
    ]

    const rows: string[] = []
    rows.push(headers.join(','))

    for (const p of all) {
      const id = p.sku || ''
      const title = p.name_en || ''
      const shortDesc = (p.short_description_en || '').replace(/\s+/g, ' ').trim()
      const longDesc = (p.description_en || '').replace(/\s+/g, ' ').trim()
      const description = shortDesc || longDesc
      // Use HTML for rich_text_description; fallback to short when long is missing
      const richTextDescription = longDesc
        ? `<p>${longDesc}</p>`
        : (description ? `<p>${description}</p>` : '')
      const availability = mapAvailability(p.stock_status, p.stock_quantity)
      const condition = 'new'

      const hasCompare = p.compare_at_price && Number(p.compare_at_price) > Number(p.price)
      const priceStr = asPriceUSD(hasCompare ? Number(p.compare_at_price) : Number(p.price))
      const salePriceStr = hasCompare ? asPriceUSD(Number(p.price)) : ''

      const link = `${siteUrl}/en/products/${encodeURIComponent(p.sku)}`
      const rawImages: string[] = Array.isArray(p.images) ? p.images : []
      const absolutize = (u: string) => (u?.startsWith('http') ? u : `${siteUrl}${u.startsWith('/') ? '' : '/'}${u}`)
      const images: string[] = rawImages.map(absolutize)
      const imageLink = images[0] || ''
      const additional = images.slice(1, 10).join(',')
      const brand = p.brand || 'ForYouPiece'
      const productType = p.categories?.name_en || ''
      const mpn = p.sku || ''
      const itemGroupId = '' // No variant grouping currently
      const shippingWeight = p.weight_grams ? `${Number(p.weight_grams)} g` : ''
      const availabilityDate = p.is_preorder && p.preorder_date ? new Date(p.preorder_date).toISOString() : ''

      const row = [
        csvEscape(id),
        csvEscape(title),
        csvEscape(description),
        csvEscape(richTextDescription),
        csvEscape(availability),
        csvEscape(condition),
        csvEscape(priceStr),
        csvEscape(salePriceStr),
        csvEscape(link),
        csvEscape(imageLink),
        csvEscape(brand),
        csvEscape(additional),
        csvEscape(productType),
        csvEscape(mpn),
        csvEscape(itemGroupId),
        csvEscape(shippingWeight),
        csvEscape(availabilityDate),
        csvEscape(p.stock_quantity ?? '')
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

