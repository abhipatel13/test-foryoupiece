const { createClient } = require('@supabase/supabase-js')

// Supabase configuration
const supabaseUrl = 'https://xhfmyghtcugcocchzgja.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createTestAdmin() {
  try {
    console.log('🔧 Creating test admin user...')

    // First, find the test user
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers()

    if (usersError) {
      console.error('❌ Error fetching users:', usersError)
      return
    }

    console.log('📋 Found users:', users.users.length)

    // Find the test user
    const testUser = users.users.find(user => user.email === 'test@foryoupiece.com')

    if (!testUser) {
      console.log('❌ Test user not found. Please create the test user first.')
      return
    }

    console.log('✅ Found test user:', testUser.email, 'ID:', testUser.id)

    // Check if admin user already exists
    const { data: existingAdmin, error: adminCheckError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', testUser.id)
      .single()

    if (adminCheckError && adminCheckError.code !== 'PGRST116') {
      console.error('❌ Error checking existing admin:', adminCheckError)
      return
    }

    if (existingAdmin) {
      console.log('✅ Admin user already exists:', existingAdmin.role)
      return
    }

    // Create admin user entry
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .insert({
        user_id: testUser.id,
        role: 'super_admin',
        permissions: { all: true },
        is_active: true
      })
      .select()
      .single()

    if (adminError) {
      console.error('❌ Error creating admin user:', adminError)
      return
    }

    console.log('✅ Test admin user created successfully!')
    console.log('📧 Email:', testUser.email)
    console.log('🆔 User ID:', testUser.id)
    console.log('👑 Role:', adminUser.role)
    console.log('🔑 Permissions:', adminUser.permissions)

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Run the script
createTestAdmin()