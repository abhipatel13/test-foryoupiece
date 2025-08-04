import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { withAdminAuth } from '@/lib/auth/admin-middleware';

/**
 * Admin User Statistics Fix API
 * POST /api/admin/fix-user-stats - Fix all user statistics
 * GET /api/admin/fix-user-stats - Validate user statistics consistency
 */

export const POST = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('🔧 Admin user statistics fix request received');

    const serviceClient = createServiceRoleClient();
    if (!serviceClient) {
      console.error('❌ Failed to create service role client');
      return NextResponse.json({
        success: false,
        error: 'Service configuration error'
      }, { status: 500 });
    }

    // Run the fix_user_statistics function
    const { data: fixResults, error: fixError } = await serviceClient
      .rpc('fix_user_statistics');

    if (fixError) {
      console.error('❌ Error fixing user statistics:', fixError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fix user statistics: ' + fixError.message
      }, { status: 500 });
    }

    // Count the fixes made
    const fixedUsers = fixResults || [];
    const totalFixed = fixedUsers.length;

    console.log('✅ User statistics fix completed:', {
      totalUsersFixed: totalFixed,
      adminId: adminUser.id
    });

    return NextResponse.json({
      success: true,
      data: {
        totalUsersFixed: totalFixed,
        fixedUsers: fixedUsers,
        fixedBy: {
          id: adminUser.id,
          email: user.email
        },
        fixedAt: new Date().toISOString()
      },
      message: `Successfully fixed statistics for ${totalFixed} users`
    });

  } catch (error) {
    console.error('❌ Admin user statistics fix error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});

export const GET = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('📊 Admin user statistics validation request received');

    const serviceClient = createServiceRoleClient();
    if (!serviceClient) {
      console.error('❌ Failed to create service role client');
      return NextResponse.json({
        success: false,
        error: 'Service configuration error'
      }, { status: 500 });
    }

    // Run the validate_user_statistics function
    const { data: validationResults, error: validationError } = await serviceClient
      .rpc('validate_user_statistics');

    if (validationError) {
      console.error('❌ Error validating user statistics:', validationError);
      return NextResponse.json({
        success: false,
        error: 'Failed to validate user statistics: ' + validationError.message
      }, { status: 500 });
    }

    // Process validation results
    const inconsistentUsers = validationResults || [];
    const totalInconsistent = inconsistentUsers.length;

    // Categorize the issues
    const issuesSummary = {
      totalOrdersMismatches: inconsistentUsers.filter(u => u.total_orders_mismatch).length,
      totalSpentMismatches: inconsistentUsers.filter(u => u.total_spent_mismatch).length,
      totalPointsEarnedMismatches: inconsistentUsers.filter(u => u.total_points_earned_mismatch).length,
      tierMismatches: inconsistentUsers.filter(u => u.tier_mismatch).length
    };

    console.log('✅ User statistics validation completed:', {
      totalInconsistentUsers: totalInconsistent,
      issuesSummary,
      adminId: adminUser.id
    });

    return NextResponse.json({
      success: true,
      data: {
        totalInconsistentUsers: totalInconsistent,
        inconsistentUsers: inconsistentUsers,
        issuesSummary,
        validatedBy: {
          id: adminUser.id,
          email: user.email
        },
        validatedAt: new Date().toISOString()
      },
      message: totalInconsistent > 0 
        ? `Found ${totalInconsistent} users with inconsistent statistics`
        : 'All user statistics are consistent'
    });

  } catch (error) {
    console.error('❌ Admin user statistics validation error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});
