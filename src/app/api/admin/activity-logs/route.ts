import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { withAdminAuth } from '@/lib/auth/admin-middleware'

/**
 * GET /api/admin/activity-logs
 * Get admin activity logs with filtering and pagination
 */
export const GET = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const actionType = searchParams.get('action_type')
    const resourceType = searchParams.get('resource_type')
    const adminUserId = searchParams.get('admin_user_id')
    const days = parseInt(searchParams.get('days') || '30')

    const supabase = createServiceRoleClient()

    // Build query
    let query = supabase
      .from('admin_activity_logs')
      .select(`
        *,
        admin_user:admin_user_id(
          id,
          first_name,
          last_name,
          email
        )
      `)
      .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (actionType) {
      query = query.eq('action_type', actionType)
    }
    if (resourceType) {
      query = query.eq('resource_type', resourceType)
    }
    if (adminUserId) {
      query = query.eq('admin_user_id', adminUserId)
    }

    const { data: activityLogs, error } = await query

    if (error) {
      throw error
    }

    // Get summary statistics
    const { data: summaryData } = await supabase
      .from('admin_activity_logs')
      .select('action_type, resource_type, admin_user_id')
      .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())

    const summary = {
      totalActivities: summaryData?.length || 0,
      byActionType: {} as Record<string, number>,
      byResourceType: {} as Record<string, number>,
      byAdmin: {} as Record<string, number>
    }

    summaryData?.forEach(log => {
      summary.byActionType[log.action_type] = (summary.byActionType[log.action_type] || 0) + 1
      if (log.resource_type) {
        summary.byResourceType[log.resource_type] = (summary.byResourceType[log.resource_type] || 0) + 1
      }
      if (log.admin_user_id) {
        summary.byAdmin[log.admin_user_id] = (summary.byAdmin[log.admin_user_id] || 0) + 1
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        activityLogs: activityLogs || [],
        summary,
        pagination: {
          limit,
          offset,
          total: summaryData?.length || 0,
          hasMore: (activityLogs?.length || 0) === limit
        },
        filters: {
          actionType,
          resourceType,
          adminUserId,
          days
        }
      }
    })

  } catch (error) {
    console.error('❌ Failed to get activity logs:', error)

    return NextResponse.json(
      {
        success: false,
        message: 'Failed to get activity logs',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
})

/**
 * POST /api/admin/activity-logs
 * Create a new admin activity log entry
 */
export const POST = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    const body = await request.json()
    const {
      actionType,
      actionDescription,
      resourceType,
      resourceId,
      resourceName,
      beforeData,
      afterData,
      metadata = {}
    } = body

    if (!actionType || !actionDescription) {
      return NextResponse.json(
        {
          success: false,
          message: 'Action type and description are required'
        },
        { status: 400 }
      )
    }

    const supabase = createServiceRoleClient()

    // Create activity log entry
    const { data: activityLog, error } = await supabase
      .from('admin_activity_logs')
      .insert({
        admin_user_id: adminUser.id,
        action_type: actionType,
        action_description: actionDescription,
        resource_type: resourceType,
        resource_id: resourceId,
        resource_name: resourceName,
        before_data: beforeData,
        after_data: afterData,
        metadata: {
          ...metadata,
          user_agent: request.headers.get('user-agent'),
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
        }
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    console.log('✅ Activity logged:', {
      id: activityLog.id,
      actionType,
      adminUser: adminUser.id
    })

    return NextResponse.json({
      success: true,
      message: 'Activity logged successfully',
      data: activityLog
    })

  } catch (error) {
    console.error('❌ Failed to create activity log:', error)

    return NextResponse.json(
      {
        success: false,
        message: 'Failed to create activity log',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
})

/**
 * DELETE /api/admin/activity-logs
 * Clean up old activity logs (admin only)
 */
export const DELETE = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    const { searchParams } = new URL(request.url)
    const daysToKeep = parseInt(searchParams.get('days') || '90')
    const dryRun = searchParams.get('dry_run') === 'true'

    const supabase = createServiceRoleClient()
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString()

    if (dryRun) {
      // Count logs that would be deleted
      const { count } = await supabase
        .from('admin_activity_logs')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', cutoffDate)

      return NextResponse.json({
        success: true,
        message: `Dry run: ${count || 0} activity logs would be deleted`,
        data: {
          logsToDelete: count || 0,
          cutoffDate,
          daysToKeep
        }
      })
    }

    // Delete old logs
    const { data, error } = await supabase
      .from('admin_activity_logs')
      .delete()
      .lt('created_at', cutoffDate)
      .select('id')

    if (error) {
      throw error
    }

    // Log the cleanup activity
    await supabase.rpc('log_admin_activity', {
      p_admin_user_id: adminUser.id,
      p_action_type: 'activity_logs_cleanup',
      p_action_description: `Cleaned up ${data?.length || 0} activity logs older than ${daysToKeep} days`,
      p_resource_type: 'activity_logs',
      p_metadata: JSON.stringify({
        logsDeleted: data?.length || 0,
        cutoffDate,
        daysToKeep
      })
    })

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${data?.length || 0} old activity logs`,
      data: {
        logsDeleted: data?.length || 0,
        cutoffDate,
        daysToKeep
      }
    })

  } catch (error) {
    console.error('❌ Failed to clean up activity logs:', error)

    return NextResponse.json(
      {
        success: false,
        message: 'Failed to clean up activity logs',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
})
