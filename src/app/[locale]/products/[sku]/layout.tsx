import type { Metadata } from 'next'
import Script from 'next/script'
import { createAnonymousClient } from '@/lib/supabase/server'

// Server-only layout for the product detail route segment.
// Keeps the existing client page intact while providing server-side metadata and JSON-LD.

interface RouteParams {
  params: { locale: string; sku: string }
}

function getBaseUrlFromHeaders(): string | null {
  // Avoid using next/headers in client-unsafe contexts; rely on env or fallback
  return null
}

function getSiteBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  const fromHeaders = getBaseUrlFromHeaders()
  if (fromHeaders) return fromHeaders
  // Conservative fallback
  return 'https://foryoupiece.com'
}

function truncate(text: string, max = 160): string {
  if (!text) return ''
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  return clean.slice(0, max - 1).trimEnd() + '…'
}

function buildCanonical(baseUrl: string, locale: string, sku: string): string {
  // Maintain current URL structure without introducing slugs in Phase 1
  return `${baseUrl}/${locale}/products/${encodeURIComponent(sku)}`
}

function toAbsoluteUrl(baseUrl: string, url?: string): string | undefined {
  if (!url) return undefined
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  try {
    return new URL(url, baseUrl).toString()
  } catch {
    return undefined
  }
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; sku: string }> }): Promise<Metadata> {
  const { locale, sku } = await params
  const baseUrl = getSiteBaseUrl()
  const canonical = buildCanonical(baseUrl, locale, sku)

  // Fetch product server-side using an anonymous Supabase client (RLS-safe)
  let data: any | null = null
  try {
    const supabase = createAnonymousClient()
    const res = await supabase
      .from('products')
      .select(`
        id,
        sku,
        name_en,
        description_en,
        short_description_en,
        price,
        compare_at_price,
        stock_quantity,
        stock_status,
        brand,
        images,
        category:categories(id, name_en, slug)
      `)
      .eq('sku', sku)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .single()
    data = res.data
  } catch (_) {
    data = null
  }

  if (!data) {
    // Graceful fallback to safe defaults
    const fallbackTitle = 'Foryoupiece - Premium E-commerce'
    const fallbackDesc = 'Discover premium Japanese products delivered directly from Japan to Cambodia.'
    return {
      title: fallbackTitle,
      description: fallbackDesc,
      alternates: { canonical, languages: { en: canonical } },
      openGraph: {
        type: 'website',
        url: canonical,
        title: fallbackTitle,
        description: fallbackDesc,
      },
      twitter: {
        card: 'summary_large_image',
        title: fallbackTitle,
        description: fallbackDesc,
      },
    }
  }

  const product = data as any
  const brand: string | undefined = product.brand || undefined
  const categoryName: string | undefined = product.category?.name_en || undefined
  const productName: string = product.name_en

  // Build description with fallbacks and brand/category flavor
  const sourceDesc: string = product.short_description_en || product.description_en || ''
  const keyBenefit = '' // Conservative; avoid guessing benefits
  const baseDescription = sourceDesc
    ? truncate(sourceDesc, 150)
    : `${brand ? brand + ' ' : ''}${productName} — Authentic Japanese${categoryName ? ` ${categoryName}` : ' product'}. Fast delivery in Cambodia. ${keyBenefit}Shop ForYouPiece.`
  const description = truncate(baseDescription, 160)

  const title = `${brand ? brand + ' ' : ''}${productName} | Buy in Cambodia | ForYouPiece`

  // OG/Twitter images: prefer first product image (absolute URL)
  const rawImage: string | undefined = Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : undefined
  const ogImage = toAbsoluteUrl(baseUrl, rawImage)

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: { en: canonical },
    },
    openGraph: {
      type: 'website',
      url: canonical,
      title: brand ? `${brand} ${productName}` : productName,
      description,
      images: ogImage
        ? [{ url: ogImage, width: 1200, height: 630, alt: productName }]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: brand ? `${brand} ${productName}` : productName,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  }
}

export default async function ProductRouteLayout({ children, params }: { children: React.ReactNode, params: Promise<{ locale: string, sku: string }> }) {
  // Render JSON-LD for Product and Breadcrumbs server-side with graceful fallbacks
  const baseUrl = getSiteBaseUrl()
  const { locale, sku } = await params
  const canonical = buildCanonical(baseUrl, locale, sku)

  let productLd: any = null
  let breadcrumbLd: any = null
  try {
    const supabase = createAnonymousClient()
    const { data } = await supabase
      .from('products')
      .select(`
        id,
        sku,
        name_en,
        description_en,
        short_description_en,
        price,
        compare_at_price,
        stock_quantity,
        stock_status,
        brand,
        images,
        category:categories(id, name_en, slug)
      `)
      .eq('sku', sku)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .single()

    if (data) {
      const p = data as any
      const imagesAbs: string[] = Array.isArray(p?.images)
        ? (p.images as string[])
            .map((u) => toAbsoluteUrl(baseUrl, u))
            .filter((u): u is string => Boolean(u))
        : []
      const availability = (typeof p.stock_quantity === 'number' && p.stock_quantity > 0)
        ? 'https://schema.org/InStock'
        : 'https://schema.org/PreOrder'

      productLd = {
        '@context': 'https://schema.org/',
        '@type': 'Product',
        name: p.name_en,
        description: truncate(p.short_description_en || p.description_en || '', 300),
        sku: p.sku,
        brand: p.brand ? { '@type': 'Brand', name: p.brand } : undefined,
        image: imagesAbs.length ? imagesAbs : undefined,
        category: p.category?.name_en,
        url: canonical,
        offers: {
          '@type': 'Offer',
          priceCurrency: 'USD',
          price: p.price,
          availability,
          itemCondition: 'https://schema.org/NewCondition',
          url: canonical,
        }
      }

      const breadcrumbItems: { name: string; item: string }[] = [
        { name: 'Home', item: `${baseUrl}/` },
        { name: 'Products', item: `${baseUrl}/en/products` },
      ]
      if (p?.category?.slug && p?.category?.name_en) {
        breadcrumbItems.push({ name: p.category.name_en, item: `${baseUrl}/en/products?category=${encodeURIComponent(p.category.slug)}` })
      }
      if (p?.name_en) {
        breadcrumbItems.push({ name: p.name_en, item: canonical })
      }

      if (breadcrumbItems.length >= 2) {
        breadcrumbLd = {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: breadcrumbItems.map((b, idx) => ({
            '@type': 'ListItem',
            position: idx + 1,
            name: b.name,
            item: b.item,
          }))
        }
      }
    }
  } catch {
    // Silent fallback: do not block rendering
  }

  return (
    <>
      {productLd && (
        <Script id="ld-product" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }} />
      )}
      {breadcrumbLd && (
        <Script id="ld-breadcrumb" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      )}
      {children}
    </>
  )
}

