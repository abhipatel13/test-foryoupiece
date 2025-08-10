import { test, expect } from '@playwright/test';

const routes: string[] = [
  '/',
  '/en',
  '/en/products',
  '/en/auth/login',
  '/en/auth/register',
  '/en/auth/forgot-password',
  '/en/cart',
  '/en/profile',
];

// Utility to record console + page errors for a route
async function recordConsole(page: import('@playwright/test').Page) {
  const messages: { type: string; text: string }[] = [];
  page.on('console', (msg) => messages.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', (err) => messages.push({ type: 'error', text: String(err) }));
  return {
    all: () => messages,
    errors: () => messages.filter((m) => m.type === 'error' || /uncaught|TypeError|ReferenceError|UnhandledPromiseRejection|Failed to load resource/i.test(m.text)),
  };
}

test.describe('Console Audit', () => {
  for (const route of routes) {
    test(`no console errors on ${route}`, async ({ page }) => {
      const cap = await recordConsole(page);

      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      const errors = cap.errors();
      expect(
        errors,
        `Console/page errors on ${route} (total ${errors.length}):\n` + errors.map((e) => `- [${e.type}] ${e.text}`).join('\n')
      ).toHaveLength(0);
    });
  }
});
