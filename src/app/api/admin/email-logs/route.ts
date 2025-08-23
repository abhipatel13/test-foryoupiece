import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth/admin-middleware'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * Get email logs for admin dashboard
 * GET /api/admin/email-logs
 */
export const GET = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('📧 Admin Email Logs API called');
    
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const status = searchParams.get('status');
    const emailType = searchParams.get('email_type');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    console.log('📊 Query params:', { status, emailType, limit, offset });

    // Use service role client to bypass RLS
    const supabase = createServiceRoleClient();
    
    if (!supabase) {
      console.error('❌ Failed to create service role client');
      return NextResponse.json({
        success: false,
        error: 'Service configuration error',
        logs: []
      }, { status: 500 });
    }

    // Build query
    let query = supabase
      .from('email_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    
    if (emailType) {
      query = query.eq('email_type', emailType);
    }

    const { data: logs, error, count } = await query;

    if (error) {
      console.error('❌ Failed to fetch email logs:', error);
      return NextResponse.json({
        success: false,
        error: error.message,
        logs: []
      }, { status: 500 });
    }

    console.log(`✅ Retrieved ${logs?.length || 0} email logs`);

    return NextResponse.json({
      success: true,
      logs: logs || [],
      total: count || logs?.length || 0,
      pagination: {
        limit,
        offset,
        hasMore: (logs?.length || 0) === limit
      }
    });

  } catch (error) {
    console.error('❌ Admin Email Logs API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      logs: []
    }, { status: 500 });
  }
});
