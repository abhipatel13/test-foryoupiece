import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 DEBUG: Environment variables check')
    
    // Check environment variables
    const envVars = {
      TELEGRAM_AUTH_BOT_TOKEN: process.env.TELEGRAM_AUTH_BOT_TOKEN,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NODE_ENV: process.env.NODE_ENV
    }
    
    const envStatus = {
      TELEGRAM_AUTH_BOT_TOKEN: envVars.TELEGRAM_AUTH_BOT_TOKEN ? 'SET' : 'MISSING',
      SUPABASE_SERVICE_ROLE_KEY: envVars.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING',
      NEXT_PUBLIC_SUPABASE_URL: envVars.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING',
      NODE_ENV: envVars.NODE_ENV || 'undefined'
    }
    
    console.log('🔍 DEBUG: Environment status:', envStatus)
    
    // Check if we can create Supabase client
    let supabaseStatus = 'NOT_TESTED'
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        envVars.NEXT_PUBLIC_SUPABASE_URL!,
        envVars.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      )
      
      // Test a simple query
      const { data, error } = await supabase.auth.admin.listUsers()
      if (error) {
        supabaseStatus = `ERROR: ${error.message}`
      } else {
        supabaseStatus = `SUCCESS: Found ${data.users.length} users`
      }
    } catch (error) {
      supabaseStatus = `EXCEPTION: ${error instanceof Error ? error.message : String(error)}`
    }
    
    console.log('🔍 DEBUG: Supabase status:', supabaseStatus)
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: envStatus,
      supabase: supabaseStatus,
      debug: true
    })
    
  } catch (error) {
    console.error('❌ DEBUG: Error:', error)
    return NextResponse.json({
      error: 'Debug endpoint error',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
