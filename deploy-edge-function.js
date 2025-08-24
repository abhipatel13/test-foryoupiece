/**
 * Deploy Edge Function Script
 * This script helps redeploy the send-email Edge Function to Supabase
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

console.log('🚀 Starting Edge Function deployment...');

// Check if Edge Function exists
const edgeFunctionPath = path.join(__dirname, 'supabase', 'functions', 'send-email', 'index.ts');
if (!fs.existsSync(edgeFunctionPath)) {
  console.error('❌ Edge Function not found at:', edgeFunctionPath);
  process.exit(1);
}

console.log('✅ Edge Function found');

// Check environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'RESEND_API_KEY'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ Missing environment variables:', missingVars.join(', '));
  console.log('💡 Make sure your .env.local file contains all required variables');
  process.exit(1);
}

console.log('✅ Environment variables check passed');

try {
  // Try to deploy using npx supabase
  console.log('📦 Deploying Edge Function...');
  
  const deployCommand = 'npx supabase functions deploy send-email --project-ref xhfmyghtcugcocchzgja';
  
  console.log('🔧 Running:', deployCommand);
  
  const output = execSync(deployCommand, { 
    encoding: 'utf8',
    stdio: 'pipe'
  });
  
  console.log('✅ Deployment successful!');
  console.log('📄 Output:', output);
  
} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  
  if (error.message.includes('Access token not provided')) {
    console.log('');
    console.log('🔑 Authentication required. Please run:');
    console.log('   npx supabase login');
    console.log('');
    console.log('Or set the SUPABASE_ACCESS_TOKEN environment variable');
  }
  
  if (error.message.includes('not found')) {
    console.log('');
    console.log('📦 Supabase CLI might not be installed. Try:');
    console.log('   npm install -g supabase');
  }
  
  console.log('');
  console.log('🔧 Manual deployment steps:');
  console.log('1. Go to https://supabase.com/dashboard/project/xhfmyghtcugcocchzgja/functions');
  console.log('2. Click on the send-email function');
  console.log('3. Click "Deploy new version"');
  console.log('4. Copy the content from supabase/functions/send-email/index.ts');
  console.log('5. Make sure the RESEND_API_KEY secret is set correctly');
  
  process.exit(1);
}

console.log('');
console.log('🎉 Edge Function deployment complete!');
console.log('🧪 You can now test the Edge Function');
