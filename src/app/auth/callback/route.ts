import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const redirectTo = searchParams.get('redirectTo') ?? '/'

  if (code) {
    const supabase = createClient()
    
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (!error) {
        // Successful authentication, redirect to the intended page
        return NextResponse.redirect(`${origin}${redirectTo}`)
      } else {
        console.error('Auth callback error:', error)
        // Redirect to login with error
        return NextResponse.redirect(`${origin}/en/auth/login?error=auth_callback_error`)
      }
    } catch (err) {
      console.error('Auth callback exception:', err)
      return NextResponse.redirect(`${origin}/en/auth/login?error=auth_callback_error`)
    }
  }

  // No code provided, redirect to login
  return NextResponse.redirect(`${origin}/en/auth/login?error=no_code_provided`)
}
