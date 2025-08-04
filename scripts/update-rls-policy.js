const { createClient } = require('@supabase/supabase-js');

// Read environment variables from .env.local manually
const fs = require('fs');
const path = require('path');

function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};

  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      envVars[key.trim()] = value.trim();
    }
  });

  return envVars;
}

async function updateRLSPolicy() {
  const env = loadEnvFile();

  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  console.log('🔄 Updating RLS policy for products table...');
  console.log('📝 Since we cannot execute DDL directly, please run the following SQL in your Supabase dashboard:');
  console.log('');
  console.log('-- Drop the existing policy');
  console.log('DROP POLICY IF EXISTS "Admins can manage products" ON products;');
  console.log('');
  console.log('-- Create the updated policy');
  console.log('CREATE POLICY "Admins can manage products" ON products');
  console.log('    FOR ALL USING (');
  console.log('        auth.role() = \'service_role\' OR is_admin(auth.uid())');
  console.log('    );');
  console.log('');
  console.log('🌐 Go to: https://supabase.com/dashboard/project/xhfmyghtcugcocchzgja/sql');
  console.log('📋 Copy and paste the SQL above into the SQL editor and run it.');
  console.log('');
  console.log('⚡ This will allow service role operations to bypass RLS policies for the products table.');
}

updateRLSPolicy();
