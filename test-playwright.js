const { chromium, firefox, webkit } = require('playwright');

async function testPlaywright() {
  console.log('🧪 Testing Playwright browsers...');
  
  const browsers = [
    { name: 'Chromium', launcher: chromium },
    { name: 'Firefox', launcher: firefox },
    { name: 'WebKit', launcher: webkit }
  ];
  
  for (const { name, launcher } of browsers) {
    try {
      console.log(`\n🔍 Testing ${name}...`);
      const browser = await launcher.launch({ headless: true });
      const page = await browser.newPage();
      
      console.log(`✅ ${name} launched successfully`);
      
      // Test navigation
      await page.goto('https://example.com');
      const title = await page.title();
      console.log(`✅ ${name} navigated successfully. Page title: ${title}`);
      
      await browser.close();
      console.log(`✅ ${name} test completed successfully`);
      
    } catch (error) {
      console.log(`❌ ${name} failed:`, error.message);
    }
  }
  
  console.log('\n🎯 Playwright test completed!');
}

testPlaywright().catch(console.error);