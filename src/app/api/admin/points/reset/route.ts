import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { createClient } from '@/lib/supabase/server';

/**
 * Points Reset API
 * POST /api/admin/points/reset - Perform manual points reset
 * GET /api/admin/points/reset - Get reset information and history
 */

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Admin reset request received');

    // Use service role client for admin operations (authentication handled by middleware)
    const serviceClient = createServiceRoleClient();

    if (!serviceClient) {
      console.error('❌ Failed to create service role client');
      return NextResponse.json({
        success: false,
        error: 'Service configuration error'
      }, { status: 500 });
    }

    // Parse request body
    const body = await request.json();
    const { confirmReset, resetType = 'manual' } = body;

    if (!confirmReset) {
      return NextResponse.json({
        success: false,
        error: 'Reset confirmation required'
      }, { status: 400 });
    }

    // Admin user ID (in production, get from authenticated session)
    const adminUserId = '80901357-6a94-4b8a-91d7-4f9b5e5fb44c';

    let resetResult, resetError;

    if (resetType === 'admin_rank') {
      console.log('⚠️ Performing admin rank and lifetime points reset');

      const { data, error } = await serviceClient
        .rpc('perform_admin_rank_lifetime_reset', {
          admin_user_id_param: adminUserId
        });

      resetResult = data;
      resetError = error;
    } else {
      console.log('⚠️ Performing manual points reset by admin');

      const { data, error } = await serviceClient
        .rpc('perform_manual_points_reset', {
          admin_user_id_param: adminUserId
        });

      resetResult = data;
      resetError = error;
    }

    if (resetError) {
      console.error('❌ Reset failed:', resetError);
      return NextResponse.json({
        success: false,
        error: 'Failed to perform reset: ' + resetError.message
      }, { status: 500 });
    }

    const result = resetResult[0];

    console.log('✅ Reset successful:', {
      resetType,
      usersAffected: result.users_affected,
      totalReset: resetType === 'rank_lifetime' ? result.total_lifetime_points_reset : result.total_points_reset,
      resetId: result.reset_id
    });

    return NextResponse.json({
      success: true,
      data: {
        usersAffected: result.users_affected,
        totalPointsReset: resetType === 'admin_rank' ? result.total_lifetime_points_reset : result.total_points_reset,
        resetId: result.reset_id,
        resetDate: new Date().toISOString(),
        resetType: resetType,
        adminUserId: 'admin'
      }
    });

  } catch (error) {
    console.error('❌ Reset error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('📊 Fetching points reset information');

    // Use service role client for admin operations (authentication handled by middleware)
    const serviceClient = createServiceRoleClient();

    if (!serviceClient) {
      console.error('❌ Failed to create service role client');
      return NextResponse.json({
        success: false,
        error: 'Service configuration error'
      }, { status: 500 });
    }

    // Get next reset date and time until reset
    const { data: nextResetDate, error: nextResetError } = await serviceClient
      .rpc('get_next_points_reset_date');

    const { data: timeUntilReset, error: timeUntilError } = await serviceClient
      .rpc('get_time_until_reset');

    if (nextResetError || timeUntilError) {
      console.error('❌ Failed to get reset timing:', { nextResetError, timeUntilError });
    }

    // Get reset history
    const { data: resetHistory, error: historyError } = await serviceClient
      .from('points_reset_history')
      .select(`
        *,
        admin:users!points_reset_history_admin_user_id_fkey(
          id, first_name, last_name, email
        )
      `)
      .order('reset_date', { ascending: false })
      .limit(10);

    if (historyError) {
      console.error('❌ Failed to fetch reset history:', historyError);
    }

    // Get current year reset status
    const currentYear = new Date().getFullYear();
    const currentYearReset = resetHistory?.find(reset => reset.reset_year === currentYear);

    // Calculate time components for countdown
    let timeComponents = null;
    if (timeUntilReset) {
      // Parse PostgreSQL interval format
      const intervalMatch = timeUntilReset.match(/(\d+) days? (\d+):(\d+):(\d+)/);
      if (intervalMatch) {
        const [, days, hours, minutes, seconds] = intervalMatch;
        timeComponents = {
          days: parseInt(days),
          hours: parseInt(hours),
          minutes: parseInt(minutes),
          seconds: parseInt(seconds),
          totalSeconds: (parseInt(days) * 24 * 60 * 60) + 
                       (parseInt(hours) * 60 * 60) + 
                       (parseInt(minutes) * 60) + 
                       parseInt(seconds)
        };
      }
    }

    console.log('✅ Retrieved reset information');

    return NextResponse.json({
      success: true,
      data: {
        nextResetDate,
        timeUntilReset,
        timeComponents,
        currentYearReset,
        resetHistory: resetHistory || [],
        canPerformManualReset: true, // TODO: Check admin role
        resetStats: {
          totalResets: resetHistory?.length || 0,
          lastResetDate: resetHistory?.[0]?.reset_date || null,
          lastResetUsersAffected: resetHistory?.[0]?.total_users_affected || 0,
          lastResetPointsReset: resetHistory?.[0]?.total_points_reset || 0
        }
      }
    });

  } catch (error) {
    console.error('❌ Get reset information error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
