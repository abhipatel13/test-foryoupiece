import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({
        success: false,
        error: 'User not authenticated'
      }, { status: 401 })
    }

    console.log('🔐 MFA Remove All: Starting removal for user:', user.id, user.email)

    // Use service role client to remove MFA factors (bypasses AAL2 requirement)
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    console.log('🔧 MFA Remove All: Using service role client to bypass AAL2 requirement')

    // Use service role to delete MFA factors directly from database
    // This bypasses the AAL2 requirement that prevents normal unenrollment
    try {
      console.log('🗑️ MFA Remove All: Deleting MFA factors directly from auth.mfa_factors table')

      const { data: deletedFactors, error: deleteError } = await serviceSupabase
        .from('auth.mfa_factors')
        .delete()
        .eq('user_id', user.id)
        .select()

      if (deleteError) {
        console.log('❌ MFA Remove All: Error deleting factors from database:', deleteError)
        return NextResponse.json({
          success: false,
          error: 'Failed to remove MFA factors from database'
        }, { status: 500 })
      }

      const removedCount = deletedFactors?.length || 0
      console.log('✅ MFA Remove All: Successfully removed factors from database:', removedCount)

      if (removedCount === 0) {
        console.log('✅ MFA Remove All: No factors found to remove')
        return NextResponse.json({
          success: true,
          message: 'No MFA factors found to remove',
          removedCount: 0
        })
      }

      return NextResponse.json({
        success: true,
        message: `Successfully removed ${removedCount} MFA factors`,
        removedCount: removedCount,
        removedFactors: deletedFactors
      })

    } catch (dbError) {
      console.log('❌ MFA Remove All: Database operation failed:', dbError)
      return NextResponse.json({
        success: false,
        error: 'Database operation failed'
      }, { status: 500 })
    }



  } catch (error) {
    console.error('❌ MFA Remove All: Exception:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
