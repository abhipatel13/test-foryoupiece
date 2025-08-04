const fs = require('fs');
const path = require('path');

console.log('🔧 Creating admin product functions...');
console.log('📝 Please run the following SQL in your Supabase dashboard:');
console.log('');

const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '004_create_admin_product_functions.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

console.log(migrationSQL);
console.log('');
console.log('🌐 Go to: https://supabase.com/dashboard/project/xhfmyghtcugcocchzgja/sql');
console.log('📋 Copy and paste the SQL above into the SQL editor and run it.');
console.log('');
console.log('⚡ This will create admin functions that can bypass RLS policies for product operations.');
