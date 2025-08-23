import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth/admin-middleware'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * Email System Status and Validation
 * GET /api/admin/email-system-status
 */
export const GET = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('📧 Email System Status Check called');
    
    const status = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      checks: {
        environment_variables: {},
        supabase_connection: {},
        edge_function: {},
        email_logs: {},
        recent_activity: {}
      },
      recommendations: [],
      overall_status: 'unknown'
    };

    // Check environment variables
    const resendApiKey = process.env.RESEND_API_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    status.checks.environment_variables = {
      resend_api_key: resendApiKey ? 'configured' : 'missing',
      supabase_url: supabaseUrl ? 'configured' : 'missing',
      supabase_service_key: supabaseServiceKey ? 'configured' : 'missing',
      resend_from_email: process.env.RESEND_FROM_EMAIL || 'using_default',
      resend_from_name: process.env.RESEND_FROM_NAME || 'using_default'
    };

    // Check Supabase connection
    try {
      const supabase = createServiceRoleClient();
      if (supabase) {
        // Test database connection
        const { data, error } = await supabase.from('email_logs').select('id').limit(1);
        status.checks.supabase_connection = {
          client_created: true,
          database_accessible: !error,
          error_message: error?.message || null
        };
      } else {
        status.checks.supabase_connection = {
          client_created: false,
          database_accessible: false,
          error_message: 'Failed to create service role client'
        };
      }
    } catch (error: any) {
      status.checks.supabase_connection = {
        client_created: false,
        database_accessible: false,
        error_message: error.message
      };
    }

    // Check Edge Function status (by attempting to call it)
    try {
      const supabase = createServiceRoleClient();
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: 'test@example.com',
          subject: 'Status Check',
          html: '<p>Test</p>',
          emailType: 'status_check'
        }
      });

      if (error) {
        status.checks.edge_function = {
          accessible: false,
          status: 'error',
          error_message: error.message,
          error_details: error
        };
      } else {
        status.checks.edge_function = {
          accessible: true,
          status: 'working',
          response: data
        };
      }
    } catch (error: any) {
      status.checks.edge_function = {
        accessible: false,
        status: 'error',
        error_message: error.message
      };
    }

    // Check email logs table
    try {
      const supabase = createServiceRoleClient();
      const { data: recentLogs, error } = await supabase
        .from('email_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        status.checks.email_logs = {
          accessible: false,
          error_message: error.message
        };
      } else {
        const failedCount = recentLogs?.filter(log => log.status === 'failed').length || 0;
        const successCount = recentLogs?.filter(log => log.status === 'sent').length || 0;
        
        status.checks.email_logs = {
          accessible: true,
          total_recent: recentLogs?.length || 0,
          recent_failures: failedCount,
          recent_successes: successCount,
          success_rate: recentLogs?.length ? (successCount / recentLogs.length * 100).toFixed(1) + '%' : 'N/A'
        };

        status.checks.recent_activity = {
          last_10_logs: recentLogs?.map(log => ({
            timestamp: log.created_at,
            recipient: log.recipient,
            status: log.status,
            error: log.error_message,
            type: log.email_type
          })) || []
        };
      }
    } catch (error: any) {
      status.checks.email_logs = {
        accessible: false,
        error_message: error.message
      };
    }

    // Generate recommendations
    if (!resendApiKey) {
      status.recommendations.push({
        priority: 'high',
        issue: 'Missing RESEND_API_KEY',
        solution: 'Sign up at resend.com and add RESEND_API_KEY to environment variables'
      });
    }

    if (!status.checks.edge_function.accessible) {
      status.recommendations.push({
        priority: 'high',
        issue: 'Edge Function not accessible',
        solution: 'Configure RESEND_API_KEY in Supabase Edge Function secrets'
      });
    }

    if (status.checks.email_logs.recent_failures > status.checks.email_logs.recent_successes) {
      status.recommendations.push({
        priority: 'medium',
        issue: 'High failure rate in recent emails',
        solution: 'Check error messages in email logs and verify API key configuration'
      });
    }

    // Determine overall status
    if (!resendApiKey || !status.checks.supabase_connection.database_accessible) {
      status.overall_status = 'critical';
    } else if (!status.checks.edge_function.accessible) {
      status.overall_status = 'degraded';
    } else if (status.checks.email_logs.recent_failures > 0) {
      status.overall_status = 'warning';
    } else {
      status.overall_status = 'healthy';
    }

    return NextResponse.json({
      success: true,
      status: status
    });

  } catch (error) {
    console.error('❌ Email System Status Check error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
});
