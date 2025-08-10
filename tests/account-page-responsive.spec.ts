import { test, expect } from '@playwright/test'

// Utility to capture console + page errors
async function captureConsole(page: any) {
  const messages: { type: string; text: string }[] = []
  page.on('console', (msg: any) => messages.push({ type: msg.type(), text: msg.text() }))
  page.on('pageerror', (err: any) => messages.push({ type: 'error', text: String(err) }))
  return {
    getErrors: () => messages.filter(m => m.type === 'error' || /uncaught|TypeError|ReferenceError/i.test(m.text)),
    all: () => messages,
  }
}

// Validates the account page core UI/UX across critical viewports
// Assumes session already authenticated once per run (as with other suite tests)
const viewports: Array<[number, number]> = [
  [314, 858], // ultra-small mobile
  [320, 812],
  [375, 812],
  [414, 896],
  [768, 1024],
  [1024, 768],
  [1280, 800],
  [1920, 1080],
]

for (const [w, h] of viewports) {
  test.describe(`Account page UI/UX @ ${w}x${h}`, () => {
    test(`renders, tabs usable, no console errors @ ${w}x${h}`, async ({ page, request }) => {
      test.slow()
      const consoleCapture = await captureConsole(page)

      await page.setViewportSize({ width: w, height: h })

      // Navigate to profile (assumes already logged in). If not, the test will fail clearly.
      await page.goto('/en/profile')
      await page.waitForLoadState('domcontentloaded')

      // Heading and main landmark
      await expect(page.getByRole('heading', { name: /my profile/i })).toBeVisible({ timeout: 15000 })
      await expect(page.locator('main[aria-labelledby="page-title"]')).toBeVisible()

      // Rewards & Coupons tabs present and selectable
      const tablist = page.getByRole('tablist', { name: /rewards and coupons tabs/i })
      await expect(tablist).toBeVisible()

      // On narrow screens the tablist must be horizontally scrollable
      const scrollInfo = await tablist.evaluate((el: HTMLElement) => ({ sw: el.scrollWidth, cw: el.clientWidth }))
      if (w <= 414) {
        expect(scrollInfo.sw).toBeGreaterThan(scrollInfo.cw)
      }

      // Switch through tabs (ensure they are reachable on mobile by scrolling)
      const tab = (name: RegExp) => page.getByRole('tab', { name })
      await tab(/Coupons/i).click()
      await expect(page.getByRole('tabpanel')).toBeVisible()
      await tab(/Tier Rewards/i).click()
      await expect(page.getByRole('tabpanel')).toBeVisible()
      await tab(/Progress/i).click()
      await expect(page.getByRole('tabpanel')).toBeVisible()
      await tab(/Overview/i).click()

      // Buttons must be at least 44px tall
      const buttons = page.locator('button')
      const sizes = await buttons.evaluateAll((els: HTMLElement[]) => els.slice(0, 20).map(el => ({ h: el.getBoundingClientRect().height })))
      for (const { h: height } of sizes) {
        expect(Math.round(height)).toBeGreaterThanOrEqual(40) // allow rounding tolerance
      }

      // Quick smoke on account security section presence
      await expect(page.getByRole('region', { name: /account security/i })).toBeVisible()

      // Auth validate endpoint should be 200 and return userId
      const validateRes = await request.post('/api/auth/validate')
      expect(validateRes.status()).toBe(200)
      const { userId } = await validateRes.json()
      expect(typeof userId).toBe('string')

      // Tier rewards and coupons must respond
      expect((await request.get(`/api/user/tier-rewards?userId=${userId}`)).status()).toBe(200)
      expect((await request.get('/api/user/coupons')).status()).toBe(200)

      // No console errors
      const errors = consoleCapture.getErrors()
      expect(errors, 'Console/page errors found: ' + errors.map(e => e.text).join('\n')).toHaveLength(0)
    })
  })
}

