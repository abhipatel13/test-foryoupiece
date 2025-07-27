import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { withAdminAuth } from '@/lib/auth/admin-middleware';
import { getTierFromPoints } from '@/lib/utils';

/**
 * Admin Points & Tier Synchronization Fix API
 * POST /api/admin/points/sync-fix
 * 
 * Fixes data inconsistencies between points_balance, total_points_earned, and tier_level
 * across all users to ensure proper synchronization between systems
 */
export const POST = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('🔧 Admin points & tier synchronization fix initiated');

    const serviceClient = createServiceRoleClient();
    if (!serviceClient) {
      console.error('❌ Failed to create service role client');
      return NextResponse.json({
        success: false,
        error: 'Service configuration error'
      }, { status: 500 });
    }

    // Parse request body for options
    const body = await request.json();
    const { 
      fixMode = 'auto', // 'auto', 'manual', 'validate-only'
      userId = null, // specific user ID or null for all users
      dryRun = false // if true, only report issues without fixing
    } = body;

    console.log('🔧 Sync fix parameters:', { fixMode, userId, dryRun });

    // Get all users or specific user
    let query = serviceClient
      .from('users')
      .select(`
        id,
        first_name,
        last_name,
        email,
        points_balance,
        tier_level,
        total_points_earned,
        total_spent,
        total_orders,
        created_at,
        updated_at
      `);

    if (userId) {
      query = query.eq('id', userId);
    }

    const { data: users, error: usersError } = await query;

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch users: ' + usersError.message
      }, { status: 500 });
    }

    if (!users || users.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No users found'
      }, { status: 404 });
    }

    const issues = [];
    const fixes = [];

    // Analyze each user for inconsistencies
    for (const user of users) {
      const userIssues = [];
      const userFixes = [];

      const pointsBalance = user.points_balance || 0;
      const totalPointsEarned = user.total_points_earned || 0;
      const storedTier = user.tier_level;
      const calculatedTier = getTierFromPoints(totalPointsEarned);

      // Issue 1: Tier mismatch (stored tier doesn't match calculated tier)
      if (storedTier !== calculatedTier) {
        userIssues.push({
          type: 'tier_mismatch',
          description: `Stored tier (${storedTier}) doesn't match calculated tier (${calculatedTier}) based on total_points_earned (${totalPointsEarned})`,
          severity: 'high',
          storedTier,
          calculatedTier,
          totalPointsEarned
        });

        if (!dryRun) {
          userFixes.push({
            type: 'tier_update',
            action: `Update tier_level from ${storedTier} to ${calculatedTier}`,
            oldValue: storedTier,
            newValue: calculatedTier
          });
        }
      }

      // Issue 2: Points balance vs total earned inconsistency
      // This suggests manual point additions without proper total_points_earned updates
      if (pointsBalance > totalPointsEarned) {
        const discrepancy = pointsBalance - totalPointsEarned;
        userIssues.push({
          type: 'points_discrepancy',
          description: `Points balance (${pointsBalance}) exceeds total_points_earned (${totalPointsEarned}) by ${discrepancy} points`,
          severity: 'medium',
          pointsBalance,
          totalPointsEarned,
          discrepancy
        });

        if (fixMode === 'auto' && !dryRun) {
          // Auto-fix: Update total_points_earned to match points_balance
          // This assumes the points_balance is correct and total_points_earned needs updating
          userFixes.push({
            type: 'total_points_update',
            action: `Update total_points_earned from ${totalPointsEarned} to ${pointsBalance}`,
            oldValue: totalPointsEarned,
            newValue: pointsBalance
          });

          // Recalculate tier based on new total_points_earned
          const newCalculatedTier = getTierFromPoints(pointsBalance);
          if (storedTier !== newCalculatedTier) {
            userFixes.push({
              type: 'tier_update_after_points_fix',
              action: `Update tier_level from ${storedTier} to ${newCalculatedTier} after points fix`,
              oldValue: storedTier,
              newValue: newCalculatedTier
            });
          }
        }
      }

      if (userIssues.length > 0) {
        issues.push({
          userId: user.id,
          userEmail: user.email,
          userName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          issues: userIssues,
          fixes: userFixes
        });
      }
    }

    // Apply fixes if not dry run
    let appliedFixes = 0;
    if (!dryRun) {
      // Process fixes for each user
      for (const userIssue of issues) {
        if (userIssue.fixes.length === 0) continue;

        const userId = userIssue.userId;
        const updates = {};

        // Collect all updates for this user
        for (const fix of userIssue.fixes) {
          if (fix.type === 'tier_update' || fix.type === 'tier_update_after_points_fix') {
            updates.tier_level = fix.newValue;
          } else if (fix.type === 'total_points_update') {
            updates.total_points_earned = fix.newValue;
          }
        }

        if (Object.keys(updates).length > 0) {
          updates.updated_at = new Date().toISOString();

          const { error: updateError } = await serviceClient
            .from('users')
            .update(updates)
            .eq('id', userId);

          if (updateError) {
            console.error(`❌ Failed to update user ${userId}:`, updateError);
          } else {
            appliedFixes++;
            console.log(`✅ Fixed user ${userId}:`, updates);

            // Update user ranks if tier changed
            if (updates.tier_level) {
              // Mark current rank as not current
              await serviceClient
                .from('user_ranks')
                .update({ is_current: false })
                .eq('user_id', userId)
                .eq('is_current', true);

              // Create new rank record
              await serviceClient
                .from('user_ranks')
                .insert({
                  user_id: userId,
                  rank: updates.tier_level,
                  points_at_rank: updates.total_points_earned || userIssue.issues.find(i => i.totalPointsEarned)?.totalPointsEarned || 0,
                  achieved_at: new Date().toISOString(),
                  is_current: true
                });
            }
          }
        }
      }
    }

    const summary = {
      totalUsersChecked: users.length,
      usersWithIssues: issues.length,
      totalIssuesFound: issues.reduce((sum, user) => sum + user.issues.length, 0),
      issueTypes: {
        tierMismatch: issues.filter(u => u.issues.some(i => i.type === 'tier_mismatch')).length,
        pointsDiscrepancy: issues.filter(u => u.issues.some(i => i.type === 'points_discrepancy')).length
      },
      fixesApplied: appliedFixes,
      mode: dryRun ? 'validation-only' : fixMode
    };

    console.log('✅ Points & tier synchronization analysis complete:', summary);

    return NextResponse.json({
      success: true,
      data: {
        summary,
        issues,
        dryRun,
        fixMode,
        message: dryRun
          ? `Found ${summary.totalIssuesFound} issues across ${summary.usersWithIssues} users. Use dryRun: false to apply fixes.`
          : `Applied ${appliedFixes} fixes across ${summary.usersWithIssues} users.`
      }
    });

  } catch (error) {
    console.error('❌ Admin points & tier sync fix error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});
