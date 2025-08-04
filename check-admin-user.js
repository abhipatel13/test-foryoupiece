// Check if admin user exists and create if needed
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkAdminUser() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!supabaseUrl || !serviceRoleKey || !adminEmail) {
    console.error('❌ Missing required environment variables');
    console.log('SUPABASE_URL:', !!supabaseUrl);
    console.log('SERVICE_ROLE_KEY:', !!serviceRoleKey);
    console.log('ADMIN_EMAIL:', !!adminEmail);
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  console.log('🔍 Checking admin user setup...');
  console.log('Admin email:', adminEmail);

  // 1. Check if user exists in auth.users
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.error('❌ Error fetching auth users:', authError);
    return;
  }

  const adminAuthUser = authUsers.users.find(user => user.email === adminEmail);
  
  if (!adminAuthUser) {
    console.error('❌ Admin user not found in auth.users table');
    console.log('Available users:', authUsers.users.map(u => u.email));
    return;
  }

  console.log('✅ Admin user found in auth.users:', adminAuthUser.id);

  // 2. Check if user exists in users table
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('email', adminEmail)
    .single();

  if (userError) {
    console.error('❌ Error fetching user from users table:', userError);
    return;
  }

  console.log('✅ Admin user found in users table:', user.id);

  // 3. Check if admin entry exists
  const { data: adminUser, error: adminError } = await supabase
    .from('admin_users')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (adminError && adminError.code !== 'PGRST116') {
    console.error('❌ Error checking admin_users table:', adminError);
    return;
  }

  if (!adminUser) {
    console.log('⚠️ Admin user entry not found in admin_users table');
    console.log('Creating admin user entry...');
    
    const { data: newAdminUser, error: createError } = await supabase
      .from('admin_users')
      .insert({
        user_id: user.id,
        role: 'super_admin',
        permissions: { all: true },
        is_active: true
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating admin user:', createError);
      return;
    }

    console.log('✅ Admin user created successfully:', newAdminUser);
  } else {
    console.log('✅ Admin user entry exists:', adminUser);
  }

  console.log('\n🎉 Admin user setup complete!');
}

checkAdminUser().catch(console.error);
