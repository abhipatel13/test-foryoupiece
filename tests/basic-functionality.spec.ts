import { test, expect } from '@playwright/test';

test.describe('ForYouPiece Basic Functionality', () => {
  test('homepage loads successfully', async ({ page }) => {
    // Navigate to the homepage
    await page.goto('http://localhost:3002');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check that the page title contains ForYouPiece
    await expect(page).toHaveTitle(/ForYouPiece/);
    
    // Check for main navigation elements
    await expect(page.locator('nav')).toBeVisible();
    
    // Check for product sections
    await expect(page.locator('text=Trending Now')).toBeVisible();
    await expect(page.locator('text=Best Sellers')).toBeVisible();
    
    console.log('✅ Homepage loaded successfully');
  });

  test('products page loads', async ({ page }) => {
    await page.goto('http://localhost:3002/en/products');
    
    // Wait for products to load
    await page.waitForLoadState('networkidle');
    
    // Check that products are displayed
    await expect(page.locator('[data-testid="product-card"]').first()).toBeVisible({ timeout: 10000 });
    
    console.log('✅ Products page loaded successfully');
  });

  test('authentication pages load', async ({ page }) => {
    // Test login page
    await page.goto('http://localhost:3002/en/auth/login');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    
    console.log('✅ Login page loaded successfully');
    
    // Test register page
    await page.goto('http://localhost:3002/en/auth/register');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('input[type="email"]')).toBeVisible();
    
    console.log('✅ Register page loaded successfully');
  });

  test('cart page loads', async ({ page }) => {
    await page.goto('http://localhost:3002/en/cart');
    await page.waitForLoadState('networkidle');
    
    // Cart page should load even if empty
    await expect(page.locator('text=Cart')).toBeVisible();
    
    console.log('✅ Cart page loaded successfully');
  });

  test('API endpoints respond', async ({ page }) => {
    // Test products API
    const productsResponse = await page.request.get('http://localhost:3002/api/products?limit=5');
    expect(productsResponse.status()).toBe(200);
    
    // Test categories API
    const categoriesResponse = await page.request.get('http://localhost:3002/api/boxhero/categories');
    expect(categoriesResponse.status()).toBe(200);
    
    console.log('✅ API endpoints responding correctly');
  });
});
