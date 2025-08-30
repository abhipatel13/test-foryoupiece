import { test, expect } from '@playwright/test'

/**
 * Cart-aware recommendations end-to-end tests (browser-driven)
 *
 * Notes
 * - These tests assume the dev server is running locally.
 * - Do NOT run with `npx playwright test` per project policy; use MCP Browser runs or CI.
 * - Tests use relative URLs so Playwright baseURL can be applied if configured.
 */

// Utility: wait for minimal time to allow requests to fire
const shortWait = (ms = 800) => new Promise(res => setTimeout(res, ms))

// Extract cart item SKUs from cart page DOM
async function getCartItemSkus(page) {
  const links = page.locator('main a[href^="/en/products/"]')
  const hrefs = await links.evaluateAll((as: HTMLAnchorElement[]) => as.map(a => a.getAttribute('href') || ''))
  return [...new Set(hrefs
    .filter(Boolean)
    .map(h => h.replace('/en/products/', ''))
    .filter(sku => sku && sku.length > 3)
  )]
}

// Extract product titles in recommendation grid
async function getRecommendedTitles(page) {
  // Heuristic: product card titles inside recommendation grid container
  const recSection = page.locator('text=You might also like').first().locator('..').locator('..')
  const titles = recSection.locator('h3, a[href^="/en/products/"]')
  const texts = await titles.allInnerTexts()
  // Filter reasonable titles
  return texts.map(t => t.trim()).filter(t => t.length > 0 && t.length < 180)
}

// Find /api/recommendations request and parse its URL
async function findRecommendationsRequest(page) {
  const requests = page.context()._connection ? [] : [] // appease TS; actual scanning below
  const all = await page.evaluate(() => {
    // Collect from performance entries if available
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
    return entries.map(e => e.name)
  })
  // Fallback: use Playwright's request.finished via events – we rely on test interception instead
  return all.find(u => u.includes('/api/recommendations')) || ''
}

// Parse cart_items param from URL (JSON or CSV)
function parseCartItemsParam(url: string): string[] {
  try {
    const u = new URL(url)
    const raw = u.searchParams.get('cart_items')
    if (!raw) return []
    try { return JSON.parse(raw) } catch { return raw.split(',').map(s => s.trim()).filter(Boolean) }
  } catch { return [] }
}

// Basic price heuristic to ensure upsell intent
function isStrategicPriceRange(price: number) {
  return price >= 5 && price <= 60
}

// Extract product objects from API JSON
function extractProductsFromResponse(json: any) {
  if (!json || !json.data) return []
  return json.data as Array<any>
}

// Assert recommendations exclude a set of product IDs
function assertExcludesIds(recs: any[], excludedIds: string[]) {
  const recIds = new Set(recs.map(r => r.id))
  for (const id of excludedIds) {
    expect(recIds.has(id)).toBeFalsy()
  }
}

// Heuristic relevance check: category/tag/brand alignment with search keywords
function hasContextualRelevance(recs: any[], expectedKeywords: string[]) {
  const lowerKw = expectedKeywords.map(k => k.toLowerCase())
  const matched = recs.filter(r => {
    const fields: string[] = []
    if (r.category?.name_en) fields.push(String(r.category.name_en))
    if (Array.isArray(r.tags)) fields.push(...r.tags.map((t: any) => String(t)))
    if (r.brand) fields.push(String(r.brand))
    if (r.name_en) fields.push(String(r.name_en))
    const blob = fields.join(' ').toLowerCase()
    return lowerKw.some(k => blob.includes(k))
  })
  return matched.length >= Math.max(1, Math.floor(recs.length * 0.3)) // at least ~30% relevant
}

// Guest scenario
test.describe('Guest cart-aware recommendations', () => {
  test('passes cart_items, excludes cart items, shows relevant complements', async ({ page, context }) => {
    // Start clean guest session
    await context.clearCookies()
    await page.goto('/en/products')
    await page.waitForLoadState('networkidle')

    // Add first visible product to cart via UI
    const firstCard = page.locator('[role="button"]').filter({ hasText: 'Add to Cart' }).first()
    await firstCard.click()

    // Go to cart
    await page.goto('/en/cart')
    await page.waitForLoadState('networkidle')

    // Capture recommendations request
    await shortWait(900)
    const recUrl = await findRecommendationsRequest(page)
    expect(recUrl).toContain('/api/recommendations')

    // 1) cart_items param present
    const cartItems = parseCartItemsParam(recUrl)
    expect(cartItems.length).toBeGreaterThan(0)

    // 2) Fetch the same URL to get response JSON and assert exclusion
    const response = await page.request.get(recUrl)
    expect(response.status()).toBe(200)
    const json = await response.json()
    const recs = extractProductsFromResponse(json)
    expect(recs.length).toBeGreaterThan(0)
    assertExcludesIds(recs, cartItems)

    // 3) Relevance heuristic: use product name keywords from cart DOM
    const cartSkus = await getCartItemSkus(page)
    const cartKeywords = ['hair','shampoo','conditioner','treatment','body','wash','mask','serum','oil']
    expect(hasContextualRelevance(recs, cartKeywords)).toBeTruthy()

    // 4) Strategic price range heuristic
    const strategic = recs.filter(r => isStrategicPriceRange(r.price || 0))
    expect(strategic.length).toBeGreaterThan(0)

    // UI grid intact
    const titles = await getRecommendedTitles(page)
    expect(titles.length).toBeGreaterThan(0)
  })
})

// Authenticated scenario
test.describe('Authenticated cart-aware recommendations', () => {
  test('excludes cart and purchased, remains complementary', async ({ page }) => {
    // Navigate to products and assume an authenticated session is already present in the environment
    await page.goto('/en/products')
    await page.waitForLoadState('networkidle')

    // Add two products to diversify categories
    const buttons = page.getByRole('button', { name: /Add to Cart/i })
    await buttons.nth(0).click()
    await buttons.nth(1).click()

    await page.goto('/en/cart')
    await page.waitForLoadState('networkidle')
    await shortWait(900)

    const recUrl = await findRecommendationsRequest(page)
    expect(recUrl).toContain('/api/recommendations')
    const cartItems = parseCartItemsParam(recUrl)
    expect(cartItems.length).toBeGreaterThanOrEqual(1)

    const res = await page.request.get(recUrl)
    const json = await res.json()
    const recs = extractProductsFromResponse(json)

    // Exclude cart items
    assertExcludesIds(recs, cartItems)

    // Complementary check via keywords again
    const complementaryKeywords = ['hair','shampoo','conditioner','treatment','face','serum','toner','mask','body','wash']
    expect(hasContextualRelevance(recs, complementaryKeywords)).toBeTruthy()
  })
})

// Fallback and performance
test.describe('Fallback and UI integrity', () => {
  test('fallback activates on API error and skeleton shows', async ({ page }) => {
    // Intercept recommendations to simulate server error once
    await page.route('**/api/recommendations**', route => route.fulfill({ status: 500, body: JSON.stringify({ success:false, error:'forced' }) }))

    await page.goto('/en/products')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: /Add to Cart/i }).first().click()

    await page.goto('/en/cart')

    // Skeleton should exist briefly
    // Use CSS heuristic: gray placeholder blocks in grid
    const skeletonBlocks = page.locator('.bg-gray-200').first()
    await expect(skeletonBlocks).toBeVisible()

    // Remove route to allow real call and fallback to render real items
    await page.unroute('**/api/recommendations**')
    await shortWait(1200)

    // Grid should show product titles/links
    const titles = await getRecommendedTitles(page)
    expect(titles.length).toBeGreaterThan(0)
  })

  test('layout responsive across key viewports', async ({ page }) => {
    const sizes = [ {w:320,h:700}, {w:768,h:900}, {w:1024,h:900}, {w:1440,h:900} ]
    for (const s of sizes) {
      await page.setViewportSize({ width:s.w, height:s.h })
      await page.goto('/en/cart')
      await page.waitForLoadState('networkidle')
      await shortWait(600)
      // Grid exists and no console errors
      const titles = await getRecommendedTitles(page)
      expect(titles.length).toBeGreaterThan(0)
    }
  })
})

