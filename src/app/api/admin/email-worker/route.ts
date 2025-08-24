import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * Admin API to manually trigger email worker and check queue status
 * This provides manual control over the email processing system
 */

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Manual email worker trigger requested')

    const supabase = createServiceRoleClient()

    // Check authentication (optional - add admin auth if needed)
    const authHeader = request.headers.get('authorization')
    const adminKey = process.env.ADMIN_API_KEY

    if (adminKey && authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get current queue status
    const { data: pendingEmails, error: pendingError } = await supabase
      .rpc('get_pending_emails', { p_limit: 50 })

    if (pendingError) {
      throw new Error(`Failed to get pending emails: ${pendingError.message}`)
    }

    console.log(`📊 Found ${pendingEmails?.length || 0} pending emails`)

    // Trigger the email worker
    const { data: workerResult, error: workerError } = await supabase.functions.invoke('email-worker', {
      body: { trigger: 'manual_admin' }
    })

    if (workerError) {
      console.error('❌ Email worker failed:', workerError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Email worker failed',
          details: workerError,
          pending_emails: pendingEmails?.length || 0
        },
        { status: 500 }
      )
    }

    console.log('✅ Email worker completed successfully')

    return NextResponse.json({
      success: true,
      message: 'Email worker triggered successfully',
      pending_emails_before: pendingEmails?.length || 0,
      worker_result: workerResult,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('❌ Admin email worker trigger failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to trigger email worker',
        details: error.message 
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('📊 Email queue status requested')

    const supabase = createServiceRoleClient()

    // Get queue statistics
    const [
      { data: pendingEmails, error: pendingError },
      { data: recentLogs, error: logsError },
      { data: outboxStats, error: statsError }
    ] = await Promise.all([
      supabase.rpc('get_pending_emails', { p_limit: 100 }),
      supabase
        .from('email_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('email_outbox')
        .select('status')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
    ])

    if (pendingError || logsError || statsError) {
      throw new Error(`Database query failed: ${pendingError?.message || logsError?.message || statsError?.message}`)
    }

    // Calculate statistics
    const statusCounts = outboxStats?.reduce((acc: any, item: any) => {
      acc[item.status] = (acc[item.status] || 0) + 1
      return acc
    }, {}) || {}

    const recentFailures = recentLogs?.filter(log => log.status === 'failed') || []

    return NextResponse.json({
      success: true,
      queue_status: {
        pending_emails: pendingEmails?.length || 0,
        pending_details: pendingEmails?.slice(0, 10) || [], // First 10 for preview
      },
      outbox_stats_24h: {
        total: outboxStats?.length || 0,
        by_status: statusCounts
      },
      recent_logs: recentLogs?.slice(0, 10) || [], // First 10 for preview
      recent_failures: recentFailures.slice(0, 5), // First 5 failures
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('❌ Failed to get email queue status:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get queue status',
        details: error.message 
      },
      { status: 500 }
    )
  }
}
