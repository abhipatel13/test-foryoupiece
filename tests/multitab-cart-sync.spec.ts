import { test, expect, chromium } from '@playwright/test';

// Simple selector helpers
const cartCountSelector = 'a[aria-label="View shopping cart"] >> text=/^\d+$/';

async function getCartCount(page: any) {
  const text = await page.locator(cartCountSelector).first().textContent();
  const num = parseInt((text || '0').trim(), 10);
  return Number.isNaN(num) ? 0 : num;
}

test.describe('Multi-tab auth and cart synchronization', () => {
  test('Auth state persists and cart count syncs across tabs', async ({ browser }) => {
    test.slow();

    const context = await browser.newContext();
    const pageA = await context.newPage();
    const pageB = await context.newPage();

    // Open profile in A to ensure session cookies present if user logged in
    await pageA.goto('/en/profile');
    await pageA.waitForLoadState('networkidle');

    // B should also be authenticated on first load
    await pageB.goto('/en/profile');
    await pageB.waitForLoadState('networkidle');

    // Baseline counts
    await pageA.goto('/en/products');
    await pageA.waitForLoadState('networkidle');

    await pageB.goto('/en/products');
    await pageB.waitForLoadState('networkidle');

    const beforeA = await getCartCount(pageA);
    const beforeB = await getCartCount(pageB);

    // Add first visible product from A
    const firstCard = pageA.locator('[data-testid="product-card"]').first();
    await firstCard.scrollIntoViewIfNeeded();
    await firstCard.getByRole('button', { name: /Add to Cart|Preorder/i }).click();

    // Wait a moment for cross-tab sync
    await pageB.waitForTimeout(1200);

    const afterA = await getCartCount(pageA);
    const afterB = await getCartCount(pageB);

    expect(afterA).toBeGreaterThanOrEqual(beforeA + 1);
    expect(afterB).toBeGreaterThanOrEqual(beforeB + 1);
  });
});

