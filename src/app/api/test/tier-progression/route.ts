import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { TierRewardsService } from '@/lib/services/tier-rewards-service'
import { getTierFromPoints } from '@/lib/utils'

/**
 * TEST ENDPOINT: Simulate tier progression for testing
 * This endpoint allows testing tier upgrades by adding points to a user
 * WARNING: This should only be used in development/testing environments
 */
export async function POST(request: NextRequest) {
  try {
    // Only allow in development environment
    // Hard gate test endpoint: require explicit enable flag in env
    if (process.env.ENABLE_TEST_APIS !== 'true') {
      return NextResponse.json({
        success: false,
        error: 'Test endpoints are disabled'
      }, { status: 403 })
    }

    console.log('🧪 Test Tier Progression API called')

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.log('❌ Test Tier Progression API: Authentication failed')
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const userId = user.id

    // Parse request body
    const body = await request.json()
    const { action, points, targetTier } = body

    if (!action) {
      return NextResponse.json({
        success: false,
        error: 'Action is required (add_points, set_tier, reset_progress)'
      }, { status: 400 })
    }

    // Use service client for database operations
    const serviceClient = createServiceRoleClient()
    if (!serviceClient) {
      return NextResponse.json({
        success: false,
        error: 'Service unavailable'
      }, { status: 503 })
    }

    let result: any = {}

    switch (action) {
      case 'add_points':
        if (!points || points <= 0) {
          return NextResponse.json({
            success: false,
            error: 'Valid points amount is required'
          }, { status: 400 })
        }

        // Add points to user's total_points_earned (this affects tier calculation)
        const { data: currentUser, error: getUserError } = await serviceClient
          .from('users')
          .select('total_points_earned, points_balance, tier_level')
          .eq('id', userId)
          .single()

        if (getUserError) {
          throw new Error(`Failed to get user data: ${getUserError.message}`)
        }

        const newTotalPointsEarned = (currentUser.total_points_earned || 0) + points
        const newPointsBalance = (currentUser.points_balance || 0) + points
        const oldTier = currentUser.tier_level || 'bronze'
        const newTier = getTierFromPoints(newTotalPointsEarned)

        // Check for tier upgrade BEFORE updating the database
        const tierRewardsService = new TierRewardsService()
        const tierUpgradeResult = await tierRewardsService.checkAndAwardTierUpgrade(userId, newTotalPointsEarned)

        // Update user's points
        const { error: updateError } = await serviceClient
          .from('users')
          .update({
            total_points_earned: newTotalPointsEarned,
            points_balance: newPointsBalance,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)

        if (updateError) {
          throw new Error(`Failed to update user points: ${updateError.message}`)
        }

        // Create point transaction record
        const { error: transactionError } = await serviceClient
          .from('point_transactions')
          .insert({
            user_id: userId,
            points: points,
            transaction_type: 'bonus',
            reference_type: 'admin_adjustment',
            description: `Test tier progression: Added ${points} points`
          })

        if (transactionError) {
          console.error('Failed to create transaction record:', transactionError)
        }

        result = {
          action: 'add_points',
          points_added: points,
          old_total_points: currentUser.total_points_earned || 0,
          new_total_points: newTotalPointsEarned,
          old_tier: oldTier,
          new_tier: newTier,
          tier_upgraded: newTier !== oldTier,
          tier_upgrade_result: tierUpgradeResult
        }
        break

      case 'set_tier':
        if (!targetTier) {
          return NextResponse.json({
            success: false,
            error: 'Target tier is required (bronze, silver, gold, platinum, diamond)'
          }, { status: 400 })
        }

        const tierThresholds = {
          bronze: 0,
          silver: 5000,
          gold: 15000,
          platinum: 35000,
          diamond: 50000
        }

        const requiredPoints = tierThresholds[targetTier as keyof typeof tierThresholds]
        if (requiredPoints === undefined) {
          return NextResponse.json({
            success: false,
            error: 'Invalid tier. Must be one of: bronze, silver, gold, platinum, diamond'
          }, { status: 400 })
        }

        // Set user's points to the minimum required for the target tier
        const { error: setTierError } = await serviceClient
          .from('users')
          .update({
            total_points_earned: requiredPoints,
            points_balance: requiredPoints,
            tier_level: targetTier,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)

        if (setTierError) {
          throw new Error(`Failed to set user tier: ${setTierError.message}`)
        }

        result = {
          action: 'set_tier',
          target_tier: targetTier,
          points_set: requiredPoints
        }
        break

      case 'reset_progress':
        // Reset user to bronze tier with 0 points
        const { error: resetError } = await serviceClient
          .from('users')
          .update({
            total_points_earned: 0,
            points_balance: 1000, // Keep welcome bonus
            tier_level: 'bronze',
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)

        if (resetError) {
          throw new Error(`Failed to reset user progress: ${resetError.message}`)
        }

        // Delete test-related point transactions
        await serviceClient
          .from('point_transactions')
          .delete()
          .eq('user_id', userId)
          .eq('reference_type', 'admin_adjustment')

        // Delete test tier reward history
        await serviceClient
          .from('tier_reward_history')
          .delete()
          .eq('user_id', userId)

        result = {
          action: 'reset_progress',
          message: 'User progress reset to bronze tier with welcome bonus'
        }
        break

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Must be one of: add_points, set_tier, reset_progress'
        }, { status: 400 })
    }

    console.log(`✅ Test Tier Progression completed for user ${userId}:`, result)

    return NextResponse.json({
      success: true,
      user_id: userId,
      result,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('❌ Test Tier Progression API error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}
