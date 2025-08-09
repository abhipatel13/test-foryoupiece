import { test, expect } from '@playwright/test';

// Utility: wait for no console errors during a block
async function captureConsole(page: any) {
  const messages: { type: string; text: string }[] = [];
  page.on('console', (msg: any) => messages.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', (err: any) => messages.push({ type: 'error', text: String(err) }));
  return {
    getErrors: () => messages.filter(m => m.type === 'error' || /uncaught|TypeError|ReferenceError/i.test(m.text)),
    all: () => messages,
  };
}

// Helper: assert API returns 200
async function expect200(request: any, url: string) {
  const res = await request.get(url);
  const status = res.status();
  expect(status, `${url} expected 200 but got ${status}`).toBe(200);
  return res;
}

// Because automating real Google OAuth is flaky in CI, we assume manual login is done once per run.
// This test will verify the authenticated session and exercise the profile flows.

test.describe('Auth + Profile E2E (manual Google login once per run)', () => {
  test('Profile tabs, APIs, responsive, and console clean', async ({ page, request, browserName }) => {
    test.slow();

    // Start console capture
    const consoleCapture = await captureConsole(page);

    // Go to login page to start from a known state
    await page.goto('/en/auth/login');
    await page.waitForLoadState('domcontentloaded');

    // If already logged in, the header account dropdown and notification bell should exist on profile
    await page.goto('/en/profile');
    await page.waitForLoadState('networkidle');

    // Verify protected route is accessible (we are authenticated)
    await expect(page.locator('text=Your tier rewards')).toBeVisible({ timeout: 10000 });

    // Validate tabs render
    await expect(page.getByRole('tab', { name: /Overview/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Tier Rewards/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Coupons/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Progress/i })).toBeVisible();

    // Get the authenticated user id from a lightweight API
    const validateRes = await request.post('/api/auth/validate');
    expect(validateRes.status()).toBe(200);
    const { userId } = await validateRes.json();

    // API endpoints must return 200
    await expect200(request, `/api/user/tier-rewards?userId=${userId}`);
    await expect200(request, '/api/user/coupons');
    await expect200(request, '/api/user/notifications');

    // Switch across tabs
    await page.getByRole('tab', { name: /Coupons/i }).click();
    await expect(page.locator('text=ACTIVE')).toBeVisible();

    await page.getByRole('tab', { name: /Tier Rewards/i }).click();
    await expect(page.locator('text=Tier Rewards')).toBeVisible();

    await page.getByRole('tab', { name: /Progress/i }).click();
    await expect(page.locator('text=Progress')).toBeVisible();

    // Responsive checks: 375, 768, 1920
    for (const size of [ [375, 812], [768, 1024], [1920, 1080] ]) {
      await page.setViewportSize({ width: size[0], height: size[1] });
      // Ensure core components are still visible
      await expect(page.getByRole('tab', { name: /Overview/i })).toBeVisible();
    }

    // Ensure no console errors recorded
    const errors = consoleCapture.getErrors();
    expect(errors, 'Console/page errors found: ' + errors.map(e => e.text).join('\n')).toHaveLength(0);
  });
});

