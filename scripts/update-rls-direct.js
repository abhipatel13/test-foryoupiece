const https = require('https');
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

async function executeSQL(sql) {
  const env = loadEnvFile();
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query: sql });
    
    const options = {
      hostname: 'xhfmyghtcugcocchzgja.supabase.co',
      port: 443,
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function updateRLSPolicy() {
  console.log('🔄 Updating RLS policy for products table...');

  try {
    // Drop the existing policy
    console.log('🗑️ Dropping existing policy...');
    await executeSQL('DROP POLICY IF EXISTS "Admins can manage products" ON products;');
    console.log('✅ Dropped existing policy');

    // Create the updated policy
    console.log('🔧 Creating updated policy...');
    await executeSQL(`CREATE POLICY "Admins can manage products" ON products
        FOR ALL USING (
            auth.role() = 'service_role' OR is_admin(auth.uid())
        );`);
    console.log('✅ Successfully updated RLS policy for products table');
    console.log('🎯 Service role operations are now allowed');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('');
    console.log('📝 Please manually run this SQL in your Supabase dashboard:');
    console.log('');
    console.log('DROP POLICY IF EXISTS "Admins can manage products" ON products;');
    console.log('');
    console.log('CREATE POLICY "Admins can manage products" ON products');
    console.log('    FOR ALL USING (');
    console.log('        auth.role() = \'service_role\' OR is_admin(auth.uid())');
    console.log('    );');
    console.log('');
    console.log('🌐 Go to: https://supabase.com/dashboard/project/xhfmyghtcugcocchzgja/sql');
  }
}

updateRLSPolicy();
