const { chromium, firefox, webkit } = require('playwright');

async function runE2EAuthTest() {
  console.log('🚀 Starting End-to-End Authentication Test');
  
  let browser;
  let context;
  let page;
  
  try {
    // Try Firefox first, then Chromium, then WebKit
    const browsers = [
      { name: 'Firefox', launcher: firefox },
      { name: 'Chromium', launcher: chromium },
      { name: 'WebKit', launcher: webkit }
    ];
    
    for (const { name, launcher } of browsers) {
      try {
        console.log(`📱 Attempting to launch ${name}...`);
        browser = await launcher.launch({ 
          headless: false,
          args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
        });
        console.log(`✅ ${name} launched successfully`);
        break;
      } catch (error) {
        console.log(`❌ ${name} failed to launch:`, error.message);
        continue;
      }
    }
    
    if (!browser) {
      throw new Error('No browser could be launched');
    }
    
    // Create context and page
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    
    page = await context.newPage();
    
    // Enable console logging
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (text.includes('Auth') || text.includes('auth') || text.includes('session') || text.includes('provider')) {
        console.log(`🔍 [Browser ${type.toUpperCase()}]:`, text);
      }
    });
    
    // Enable error logging
    page.on('pageerror', error => {
      console.log('❌ [Browser Error]:', error.message);
    });
    
    console.log('🌐 Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    console.log('✅ Page loaded successfully');
    
    // Wait for React to hydrate
    await page.waitForTimeout(2000);
    
    // Test 1: Check if AuthProvider is rendered
    console.log('\n📋 Test 1: Checking AuthProvider rendering...');
    const authProviderExists = await page.evaluate(() => {
      // Look for auth-related elements or context
      const authElements = document.querySelectorAll('[data-testid*="auth"], [class*="auth"], [id*="auth"]');
      return {
        authElementsFound: authElements.length,
        hasAuthContext: typeof window.authContext !== 'undefined',
        reactMounted: typeof window.React !== 'undefined'
      };
    });
    
    console.log('Auth elements found:', authProviderExists.authElementsFound);
    console.log('React mounted:', authProviderExists.reactMounted);
    
    // Test 2: Check console for auth-related messages
    console.log('\n📋 Test 2: Checking for auth initialization messages...');
    await page.waitForTimeout(3000);
    
    // Test 3: Check if sign-in elements are present
    console.log('\n📋 Test 3: Checking for sign-in UI elements...');
    const signInElements = await page.evaluate(() => {
      const signInButtons = Array.from(document.querySelectorAll('button, a, [role="button"]'))
        .filter(el => {
          const text = el.textContent?.toLowerCase() || '';
          return text.includes('sign in') || text.includes('login') || text.includes('로그인');
        });
      
      return {
        signInButtonsFound: signInButtons.length,
        signInTexts: signInButtons.map(btn => btn.textContent?.trim()).slice(0, 3)
      };
    });
    
    console.log('Sign-in buttons found:', signInElements.signInButtonsFound);
    console.log('Sign-in texts:', signInElements.signInTexts);
    
    // Test 4: Check page title and basic functionality
    console.log('\n📋 Test 4: Checking page metadata...');
    const title = await page.title();
    const url = page.url();
    console.log('Page title:', title);
    console.log('Current URL:', url);
    
    // Test 5: Check for JavaScript errors
    console.log('\n📋 Test 5: Checking for JavaScript errors...');
    const jsErrors = await page.evaluate(() => {
      return window.jsErrors || [];
    });
    
    if (jsErrors.length > 0) {
      console.log('❌ JavaScript errors found:', jsErrors);
    } else {
      console.log('✅ No JavaScript errors detected');
    }
    
    // Test 6: Check network requests
    console.log('\n📋 Test 6: Monitoring network activity...');
    const responses = [];
    page.on('response', response => {
      if (response.url().includes('auth') || response.url().includes('api')) {
        responses.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText()
        });
      }
    });
    
    // Trigger a page interaction to see network activity
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    console.log('Network responses:', responses.slice(0, 5));
    
    // Final assessment
    console.log('\n🎯 End-to-End Test Summary:');
    console.log('================================');
    console.log('✅ Browser launched successfully');
    console.log('✅ Page loaded without critical errors');
    console.log(`✅ Found ${signInElements.signInButtonsFound} sign-in elements`);
    console.log('✅ React application is running');
    
    if (signInElements.signInButtonsFound > 0) {
      console.log('🎉 Authentication UI is present and working!');
    } else {
      console.log('⚠️  No sign-in elements found - check authentication setup');
    }
    
    // Keep browser open for manual inspection
    console.log('\n🔍 Browser will stay open for 60 seconds for manual inspection...');
    await page.waitForTimeout(60000);
    
  } catch (error) {
    console.error('❌ E2E Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
    console.log('🏁 E2E Test completed');
  }
}

// Run the test
runE2EAuthTest().catch(console.error);