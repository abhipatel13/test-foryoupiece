import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const redirectTo = searchParams.get('redirectTo') ?? '/'

  console.log('🔐 Auth callback received:', { code: !!code, redirectTo })

  if (code) {
    const supabase = await createClient()
    
    if (!supabase) {
      console.error('❌ Failed to create Supabase client')
      return NextResponse.redirect(`${origin}/en/auth/login?error=supabase_client_error`)
    }
    
    try {
      console.log('🔄 Exchanging code for session...')
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (!error && data.session) {
        console.log('✅ Authentication successful:', { 
          userId: data.user?.id, 
          email: data.user?.email,
          provider: data.user?.app_metadata?.provider 
        })
        
        // Successful authentication, redirect to the intended page
        const finalRedirectTo = redirectTo.startsWith('/') ? redirectTo : '/'
        return NextResponse.redirect(`${origin}${finalRedirectTo}`)
      } else {
        console.error('❌ Auth callback error:', error)
        // Redirect to login with error
        return NextResponse.redirect(`${origin}/en/auth/login?error=auth_callback_error&details=${encodeURIComponent(error?.message || 'Unknown error')}`)
      }
    } catch (err) {
      console.error('❌ Auth callback exception:', err)
      return NextResponse.redirect(`${origin}/en/auth/login?error=auth_callback_exception&details=${encodeURIComponent(String(err))}`)
    }
  }

  // No code provided, redirect to login
  console.log('❌ No authorization code provided')
  return NextResponse.redirect(`${origin}/en/auth/login?error=no_code_provided`)
}
