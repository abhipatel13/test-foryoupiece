#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function confirmTestUser() {
  try {
    console.log('🔧 Confirming test user email...')
    
    // Get the test user
    const { data: users, error: getUserError } = await supabase.auth.admin.listUsers()
    
    if (getUserError) {
      console.error('❌ Error getting users:', getUserError)
      return
    }
    
    console.log('📋 Found users:', users.users.length)
    
    // Find the test user
    const testUser = users.users.find(user => user.email === 'test@foryoupiece.com')
    
    if (!testUser) {
      console.log('❌ Test user not found. Creating test user...')
      
      // Create the test user with confirmed email
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: 'test@foryoupiece.com',
        password: 'testpassword123',
        email_confirm: true,
        user_metadata: {
          first_name: 'Test',
          last_name: 'User'
        }
      })
      
      if (createError) {
        console.error('❌ Error creating user:', createError)
        return
      }
      
      console.log('✅ Test user created successfully!')
      console.log('📧 Email:', newUser.user.email)
      console.log('🆔 User ID:', newUser.user.id)
      console.log('✅ Email confirmed:', newUser.user.email_confirmed_at ? 'Yes' : 'No')
      
      // Create user profile
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: newUser.user.id,
          email: newUser.user.email,
          first_name: 'Test',
          last_name: 'User',
          points_balance: 1000, // Give some test points
          tier_level: 'bronze'
        })
      
      if (profileError) {
        console.error('❌ Error creating user profile:', profileError)
      } else {
        console.log('✅ User profile created successfully!')
      }
      
    } else {
      console.log('📧 Test user found:', testUser.email)
      console.log('🆔 User ID:', testUser.id)
      console.log('✅ Email confirmed:', testUser.email_confirmed_at ? 'Yes' : 'No')
      
      if (!testUser.email_confirmed_at) {
        // Confirm the user's email
        const { data: updatedUser, error: confirmError } = await supabase.auth.admin.updateUserById(
          testUser.id,
          { email_confirm: true }
        )
        
        if (confirmError) {
          console.error('❌ Error confirming email:', confirmError)
        } else {
          console.log('✅ Email confirmed successfully!')
        }
      }
      
      // Check if user profile exists
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', testUser.id)
        .single()
      
      if (profileError && profileError.code === 'PGRST116') {
        // User profile doesn't exist, create it
        console.log('📝 Creating user profile...')
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: testUser.id,
            email: testUser.email,
            first_name: 'Test',
            last_name: 'User',
            points_balance: 1000, // Give some test points
            tier_level: 'bronze'
          })
        
        if (insertError) {
          console.error('❌ Error creating user profile:', insertError)
        } else {
          console.log('✅ User profile created successfully!')
        }
      } else if (profile) {
        console.log('✅ User profile exists')
        console.log('💰 Points balance:', profile.points_balance)
        console.log('🏆 Tier level:', profile.tier_level)
      }
    }
    
    console.log('\n🎉 Test user setup complete!')
    console.log('📧 Email: test@foryoupiece.com')
    console.log('🔑 Password: testpassword123')
    console.log('🌐 Login URL: http://localhost:3003/en/auth/login')
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

confirmTestUser()
