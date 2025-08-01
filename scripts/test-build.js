/**
 * Test script to verify build works locally before Vercel deployment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing build locally...\n');

// Clean previous build
console.log('🧹 Cleaning previous build...');
const nextDir = path.join(__dirname, '..', '.next');
if (fs.existsSync(nextDir)) {
  fs.rmSync(nextDir, { recursive: true, force: true });
}

// Set NODE_ENV to production to simulate Vercel environment
process.env.NODE_ENV = 'production';

// Run the build
console.log('🔨 Running production build...');
try {
  execSync('npm run build', {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      // Simulate Vercel environment variables
      VERCEL: '1',
      VERCEL_ENV: 'production',
    },
  });
  
  console.log('\n✅ Build completed successfully!');
  
  // Check if vendor files were created
  const vendorFiles = fs.readdirSync(path.join(nextDir, 'server'))
    .filter(f => f.includes('vendor'));
  
  console.log('\n📦 Vendor files created:');
  vendorFiles.forEach(f => console.log(`  - ${f}`));
  
} catch (error) {
  console.error('\n❌ Build failed with error:');
  console.error(error.message);
  process.exit(1);
}