import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * Admin Security Monitoring API
 * GET /api/admin/security/suspicious-activity
 * 
 * Detects and reports suspicious points/tier modifications
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking for suspicious points activity...')

    // Use service role client for admin operations
    const serviceClient = createServiceRoleClient()

    if (!serviceClient) {
      console.error('❌ Failed to create service role client')
      return NextResponse.json({
        success: false,
        error: 'Service configuration error'
      }, { status: 500 })
    }

    // Get suspicious activity alerts
    const { data: suspiciousActivity, error: activityError } = await serviceClient
      .rpc('detect_suspicious_points_activity')

    if (activityError) {
      console.error('❌ Failed to detect suspicious activity:', activityError)
      return NextResponse.json({
        success: false,
        error: 'Failed to detect suspicious activity: ' + activityError.message
      }, { status: 500 })
    }

    console.log(`🔍 Found ${suspiciousActivity?.length || 0} suspicious activities`)

    // Get recent audit log entries for context
    const { data: recentAudits, error: auditError } = await serviceClient
      .from('user_security_audit_log')
      .select(`
        id,
        user_id,
        operation,
        points_balance_before,
        points_balance_after,
        total_points_earned_before,
        total_points_earned_after,
        tier_level_before,
        tier_level_after,
        trigger_source,
        session_user_name,
        client_addr,
        created_at,
        metadata
      `)
      .order('created_at', { ascending: false })
      .limit(100)

    if (auditError) {
      console.error('❌ Failed to get audit log:', auditError)
    }

    return NextResponse.json({
      success: true,
      data: {
        suspiciousActivities: suspiciousActivity || [],
        recentAudits: recentAudits || [],
        summary: {
          totalSuspiciousActivities: suspiciousActivity?.length || 0,
          totalRecentAudits: recentAudits?.length || 0,
          criticalAlerts: suspiciousActivity?.filter((activity: any) => 
            activity.alert_type.includes('CRITICAL')
          ).length || 0,
          directSqlModifications: suspiciousActivity?.filter((activity: any) => 
            activity.alert_type === 'DIRECT_SQL_MODIFICATION'
          ).length || 0
        }
      }
    })

  } catch (error) {
    console.error('❌ Security monitoring error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

/**
 * Get security audit history for a specific user
 * GET /api/admin/security/suspicious-activity?userId=xxx&limit=50
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, limit = 50 } = body

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'User ID is required'
      }, { status: 400 })
    }

    console.log(`🔍 Getting security audit history for user: ${userId}`)

    const serviceClient = createServiceRoleClient()

    if (!serviceClient) {
      console.error('❌ Failed to create service role client')
      return NextResponse.json({
        success: false,
        error: 'Service configuration error'
      }, { status: 500 })
    }

    // Get user's security audit history
    const { data: auditHistory, error: historyError } = await serviceClient
      .rpc('get_user_security_audit_history', {
        p_user_id: userId,
        p_limit: limit
      })

    if (historyError) {
      console.error('❌ Failed to get user audit history:', historyError)
      return NextResponse.json({
        success: false,
        error: 'Failed to get audit history: ' + historyError.message
      }, { status: 500 })
    }

    // Get user info
    const { data: userInfo, error: userError } = await serviceClient
      .from('users')
      .select('id, email, first_name, last_name, points_balance, total_points_earned, tier_level')
      .eq('id', userId)
      .single()

    if (userError) {
      console.error('❌ Failed to get user info:', userError)
    }

    console.log(`✅ Retrieved ${auditHistory?.length || 0} audit records for user`)

    return NextResponse.json({
      success: true,
      data: {
        user: userInfo,
        auditHistory: auditHistory || [],
        summary: {
          totalRecords: auditHistory?.length || 0,
          pointsChanges: auditHistory?.filter((record: any) => record.points_balance_changed).length || 0,
          tierChanges: auditHistory?.filter((record: any) => record.tier_level_changed).length || 0,
          directSqlChanges: auditHistory?.filter((record: any) => record.trigger_source === 'direct_sql').length || 0
        }
      }
    })

  } catch (error) {
    console.error('❌ User audit history error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
