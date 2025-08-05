const { firefox } = require('playwright');

async function debugAuth() {
  console.log('🔍 Starting comprehensive authentication provider test...');
  console.log('🦊 Using Firefox browser (confirmed working)...');
  
  const browser = await firefox.launch({ 
    headless: false,
    args: ['--width=1280', '--height=720']
  });
  
  const page = await browser.newPage();
  
  // Comprehensive console logging
  const consoleMessages = [];
  page.on('console', msg => {
    const message = `[${msg.type().toUpperCase()}] ${msg.text()}`;
    consoleMessages.push(message);
    console.log(`🖥️  BROWSER:`, message);
  });
  
  // Track all errors
  const errors = [];
  page.on('pageerror', error => {
    const errorMsg = `PAGE ERROR: ${error.message}`;
    errors.push(errorMsg);
    console.log('🚨', errorMsg);
  });
  
  page.on('requestfailed', request => {
    const failMsg = `REQUEST FAILED: ${request.url()} - ${request.failure().errorText}`;
    errors.push(failMsg);
    console.log('🚨', failMsg);
  });
  
  console.log('🌐 Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  
  // Wait for React to load
  console.log('⏳ Waiting for React and components to load...');
  await page.waitForTimeout(3000);
  
  // Test 1: Check if React is loaded
  console.log('\n📋 TEST 1: React Status');
  const reactStatus = await page.evaluate(() => {
    return {
      hasReact: typeof window.React !== 'undefined',
      hasReactDOM: typeof window.ReactDOM !== 'undefined',
      reactVersion: window.React?.version || 'Not found'
    };
  });
  console.log('✅ React Status:', reactStatus);
  
  // Test 2: Check for AuthProvider context
  console.log('\n📋 TEST 2: Authentication Context');
  const authContextTest = await page.evaluate(() => {
    // Try to access the auth context through various methods
    const results = {
      authContextExists: false,
      authProviderMounted: false,
      authElementsFound: 0,
      contextProviders: 0,
      authRelatedClasses: [],
      authRelatedIds: [],
      reactContexts: 0
    };
    
    // Check for auth-related DOM elements
    const authElements = document.querySelectorAll('[data-testid*="auth"], [class*="auth"], [id*="auth"]');
    results.authElementsFound = authElements.length;
    
    // Check for context providers
    const providers = document.querySelectorAll('[data-react-provider], [data-provider]');
    results.contextProviders = providers.length;
    
    // Look for auth-related classes
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
      if (el.className && typeof el.className === 'string') {
        if (el.className.includes('auth')) {
          results.authRelatedClasses.push(el.className);
        }
      }
      if (el.id && el.id.includes('auth')) {
        results.authRelatedIds.push(el.id);
      }
    });
    
    // Check if we can find any React contexts
    try {
      const reactFiber = document.querySelector('#__next')?._reactInternalFiber || 
                        document.querySelector('#__next')?._reactInternals;
      if (reactFiber) {
        results.reactContexts = 1;
      }
    } catch (e) {
      // Ignore
    }
    
    return results;
  });
  console.log('🔍 Auth Context Test:', authContextTest);
  
  // Test 3: Check console messages for auth provider logs
  console.log('\n📋 TEST 3: Console Message Analysis');
  const authLogs = consoleMessages.filter(msg => 
    msg.includes('Auth') || 
    msg.includes('auth') || 
    msg.includes('🔍') || 
    msg.includes('✅') || 
    msg.includes('❌')
  );
  console.log(`📊 Total console messages: ${consoleMessages.length}`);
  console.log(`🔐 Auth-related messages: ${authLogs.length}`);
  
  if (authLogs.length > 0) {
    console.log('🔐 Auth-related console messages:');
    authLogs.forEach(log => console.log(`   ${log}`));
  } else {
    console.log('❌ NO AUTH-RELATED CONSOLE MESSAGES FOUND!');
  }
  
  // Test 4: Check for JavaScript errors
  console.log('\n📋 TEST 4: Error Analysis');
  console.log(`🚨 Total errors: ${errors.length}`);
  if (errors.length > 0) {
    console.log('🚨 Errors found:');
    errors.forEach(error => console.log(`   ${error}`));
  } else {
    console.log('✅ No JavaScript errors detected');
  }
  
  // Test 5: Try to manually trigger auth context check
  console.log('\n📋 TEST 5: Manual Auth Context Check');
  const manualAuthCheck = await page.evaluate(() => {
    // Try to find the auth context by checking window objects
    const windowKeys = Object.keys(window).filter(key => 
      key.toLowerCase().includes('auth') || 
      key.toLowerCase().includes('context')
    );
    
    // Check for common auth context patterns
    const authChecks = {
      windowAuthKeys: windowKeys,
      hasAuthContext: false,
      hasUserContext: false,
      authProviderFound: false
    };
    
    // Try to access React DevTools if available
    try {
      if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        authChecks.hasReactDevTools = true;
      }
    } catch (e) {
      // Ignore
    }
    
    return authChecks;
  });
  console.log('🔍 Manual Auth Check:', manualAuthCheck);
  
  // Test 6: Check the actual page content
  console.log('\n📋 TEST 6: Page Content Analysis');
  const pageContent = await page.evaluate(() => {
    const signInText = document.body.textContent?.includes('Hello, sign in') || false;
    const hasAuthForm = document.querySelector('form[data-auth], .auth-form, [class*="auth-form"]') !== null;
    const hasSignInButton = document.querySelector('button[data-signin], .signin-btn, [class*="signin"]') !== null;
    
    return {
      hasSignInText: signInText,
      hasAuthForm: hasAuthForm,
      hasSignInButton: hasSignInButton,
      pageTitle: document.title,
      bodyClasses: document.body.className
    };
  });
  console.log('📄 Page Content:', pageContent);
  
  // Final summary
  console.log('\n🎯 FINAL DIAGNOSIS:');
  if (authLogs.length === 0) {
    console.log('🚨 CRITICAL: AuthProvider is NOT initializing - no auth logs found');
    console.log('🔍 Possible causes:');
    console.log('   1. AuthProvider component is not being rendered');
    console.log('   2. JavaScript error preventing useEffect from running');
    console.log('   3. Import/export issue with AuthProvider');
    console.log('   4. React context not being created');
  } else {
    console.log('✅ AuthProvider appears to be working - auth logs found');
  }
  
  if (errors.length > 0) {
    console.log('🚨 JavaScript errors detected - these may be preventing AuthProvider from working');
  }
  
  // Keep browser open for manual inspection
  console.log('\n🔍 Browser will stay open for 60 seconds for manual inspection...');
  console.log('💡 You can manually inspect the page and check the React DevTools');
  await page.waitForTimeout(60000);
  
  await browser.close();
  console.log('✅ Test completed');
}

debugAuth().catch(error => {
  console.error('🚨 Test failed:', error);
  process.exit(1);
});