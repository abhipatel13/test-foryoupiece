import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { withAdminAuth } from '@/lib/auth/admin-middleware'

/**
 * Debug Edge Function Issue
 * This endpoint will help us understand why the Edge Function is failing
 *
 * Hardened: Wrapped with admin auth + rate limiting and gated in production.
 */
export const POST = withAdminAuth(async (request: NextRequest) => {
  // Disable in production by default unless explicitly enabled
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEBUG_EDGE_FUNCTION !== 'true') {
    return NextResponse.json({
      success: false,
      error: 'This debug endpoint is disabled in production',
    }, { status: 403 })
  }

  try {
    console.log('🔍 Debugging Edge Function issue...')

    const supabase = createServiceRoleClient()

    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'Failed to create Supabase service client',
        debug: {
          step: 'service_client_creation',
          issue: 'Service role client creation failed'
        }
      }, { status: 500 })
    }

    console.log('✅ Service role client created successfully')

    // Test 1: Try to call the Edge Function with minimal payload
    console.log('🧪 Test 1: Calling Edge Function with minimal payload...')

    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: 'test@example.com',
          subject: 'Debug Test',
          html: '<p>Debug test</p>',
          emailType: 'debug'
        }
      })

      if (error) {
        console.error('❌ Edge Function error:', error)

        // Let's get more details about the error
        const errorDetails = {
          name: error.name,
          message: error.message,
          context: error.context || {},
          stack: error.stack || 'No stack trace'
        }

        return NextResponse.json({
          success: false,
          error: 'Edge Function call failed',
          debug: {
            step: 'edge_function_call',
            error_details: errorDetails,
            raw_error: error
          }
        }, { status: 500 })
      }

      console.log('✅ Edge Function responded:', data)

      return NextResponse.json({
        success: true,
        message: 'Edge Function is working!',
        debug: {
          step: 'edge_function_call',
          response: data
        }
      })

    } catch (functionError: any) {
      console.error('❌ Edge Function call exception:', functionError)

      return NextResponse.json({
        success: false,
        error: 'Edge Function call threw exception',
        debug: {
          step: 'edge_function_call',
          exception: {
            name: functionError.name,
            message: functionError.message,
            stack: functionError.stack
          }
        }
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('❌ Debug endpoint error:', error)
    return NextResponse.json({
      success: false,
      error: 'Debug endpoint failed',
      debug: {
        step: 'debug_endpoint',
        exception: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      }
    }, { status: 500 })
  }
}, { rateLimitType: 'admin_api' })

export const GET = withAdminAuth(async () => {
  // Disable in production by default unless explicitly enabled
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEBUG_EDGE_FUNCTION !== 'true') {
    return NextResponse.json({
      success: false,
      error: 'This debug endpoint is disabled in production',
    }, { status: 403 })
  }

  return NextResponse.json({
    message: 'Edge Function Debug Endpoint',
    usage: 'POST to this endpoint to debug the Edge Function issue',
    purpose: 'Identify why the send-email Edge Function is returning 503 BOOT_ERROR'
  })
}, { rateLimitType: 'admin_api' })
