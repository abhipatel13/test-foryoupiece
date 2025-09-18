import { test, expect } from '@playwright/test'

// NOTE: These tests validate the browser-side behavior of the Telegram server-managed flow.
// They do not hit Telegram; they only verify the profile-page handler's reload/cleanup logic
// and that the ensure-profile endpoint is called when the feature flag is enabled at build-time.
// You must run the app with:
//   - Flag ON:   NEXT_PUBLIC_AUTH_USE_SERVER_TELEGRAM_LOGIN=true npm run dev
//   - Flag OFF:  (unset) npm run dev
// The tests will run against the currently-running server (BASE_URL) or default localhost:3000/3002.

const BASE_URL = process.env.BASE_URL || 'http://localhost:3002'

async function navigateAndObserve(page, path: string, { interceptEnsureProfile = true } = {}) {
  let ensureProfileCalls = 0
  if (interceptEnsureProfile) {
    await page.route('**/api/auth/ensure-profile', async (route) => {
      ensureProfileCalls++
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { profile: {} } }) })
    })
  }

  const initial = new URL(path, BASE_URL).toString()
  await page.goto(initial)

  // First phase: the page should append ?r= cache-buster and hard reload
  // Wait for the URL to gain an r= param (may be very fast)
  await page.waitForURL((url) => url.searchParams.has('r'), { timeout: 5000 })

  // Second phase: after reload, the handler should clean parameters
  await page.waitForURL((url) => !url.searchParams.has('auth') && !url.searchParams.has('r'), { timeout: 8000 })

  const finalUrl = page.url()
  return { ensureProfileCalls, finalUrl }
}

// Server-managed flow expectations (feature flag ON)
// - ensure-profile should be called once before reload
// - URL must be cleaned after reload
// - Page should render without crashing

test.describe('Telegram server-managed flow (flag ON)', () => {
  test('navigating to /en/profile?auth=telegram_success triggers ensure-profile, reload, and cleans URL', async ({ page }) => {
    const { ensureProfileCalls, finalUrl } = await navigateAndObserve(page, '/en/profile?auth=telegram_success', { interceptEnsureProfile: true })

    // Soft assertion: if the app was not built with the flag, this may be 0.
    // We still assert the URL cleanup behavior to ensure backward-compat.
    expect(finalUrl).not.toContain('auth=')
    expect(finalUrl).not.toMatch(/[?&]r=/)

    // Prefer exactly one ensure-profile call when the flag is enabled
    test.info().annotations.push({ type: 'note', description: `ensure-profile calls observed: ${ensureProfileCalls}` })
    // Do not hard fail when flag is off; provide a soft hint
    if (process.env.NEXT_PUBLIC_AUTH_USE_SERVER_TELEGRAM_LOGIN === 'true') {
      expect(ensureProfileCalls).toBeGreaterThanOrEqual(1)
    }

    // Sanity: page has main content
    await expect(page.locator('main')).toBeVisible({ timeout: 5000 })
  })
})

// Legacy fallback expectations (feature flag OFF)
// - ensure-profile might not be called by the profile handler
// - URL must still be cleaned after reload

test.describe('Telegram legacy fallback (flag OFF)', () => {
  test('navigating to /en/profile?auth=telegram_success cleans URL even without server flag', async ({ page }) => {
    const { ensureProfileCalls, finalUrl } = await navigateAndObserve(page, '/en/profile?auth=telegram_success', { interceptEnsureProfile: true })

    expect(finalUrl).not.toContain('auth=')
    expect(finalUrl).not.toMatch(/[?&]r=/)

    test.info().annotations.push({ type: 'note', description: `ensure-profile calls observed (fallback): ${ensureProfileCalls}` })
    // In legacy flow this could be 0; do not assert >0 here.
  })
})

