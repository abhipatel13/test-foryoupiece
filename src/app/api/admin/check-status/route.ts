import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    if (!supabase) {
      return NextResponse.json({
        isAdmin: false,
        error: 'Authentication system error'
      }, { status: 500 })
    }

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({
        isAdmin: false,
        error: 'Not authenticated'
      }, { status: 401 })
    }

    // Check if user is admin using direct database query
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (adminError || !adminUser) {
      return NextResponse.json({
        isAdmin: false,
        error: 'Not an admin user'
      }, { status: 403 })
    }

    // Enhanced security check for super admin
    if (adminUser.role === 'super_admin') {
      const allowedSuperAdminEmails = [
        process.env.NEXT_PUBLIC_ADMIN_EMAIL,
        process.env.NEXT_PUBLIC_ADMIN_EMAIL_BACKUP
      ].filter(Boolean) // Remove undefined values

      if (!allowedSuperAdminEmails.includes(user.email || '')) {
        console.error('❌ Super admin role mismatch - unauthorized access attempt:', {
          userId: user.id,
          email: user.email,
          role: adminUser.role,
          timestamp: new Date().toISOString()
        })
        
        return NextResponse.json({
          isAdmin: false,
          error: 'Unauthorized super admin access'
        }, { status: 403 })
      }
    }

    return NextResponse.json({
      isAdmin: true,
      user: {
        id: user.id,
        email: user.email,
        role: adminUser.role
      }
    })
  } catch (error) {
    console.error('Error checking admin status:', error)
    return NextResponse.json({
      isAdmin: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
