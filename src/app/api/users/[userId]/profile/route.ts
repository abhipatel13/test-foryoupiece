import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * User Profile API Endpoint
 * GET /api/users/[userId]/profile
 *
 * This endpoint provides user profile data for the request deduplication system
 * and performance optimization hooks. It's designed to be lightweight and fast.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'User ID is required'
      }, { status: 400 })
    }

    const supabase = await createClient()
    
    // Get authenticated user to verify access
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // Security check: Users can only access their own profile
    // Admin users can access any profile (handled by admin middleware elsewhere)
    if (user.id !== userId) {
      return NextResponse.json({
        success: false,
        error: 'Access denied: You can only access your own profile'
      }, { status: 403 })
    }

    console.log('👤 User Profile API called for user:', userId)

    // Use service role client for better performance (bypasses RLS for authenticated user's own data)
    const serviceClient = createServiceRoleClient()

    if (!serviceClient) {
      throw new Error('Failed to create service role client')
    }

    // Fetch user profile data
    const { data: profile, error: profileError } = await serviceClient
      .from('users')
      .select(`
        id,
        email,
        phone,
        first_name,
        last_name,
        avatar_url,
        points_balance,
        total_points_earned,
        tier_level,
        total_spent,
        total_orders,
        preferred_language,
        created_at,
        updated_at,
        permanent_free_shipping,
        address_line_1,
        address_line_2,
        aba_bank_name
      `)
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('❌ Error fetching user profile:', profileError)

      // If missing profile, create minimal row and retry once (only for self-access)
      if (profileError.code === 'PGRST116' && user.id === userId) {
        try {
          const minimal = {
            id: user.id,
            email: user.email ?? null,
            first_name: (user.user_metadata as any)?.first_name ?? null,
            last_name: (user.user_metadata as any)?.last_name ?? null,
            telegram_username: (user.user_metadata as any)?.telegram_username ?? null,
            preferred_language: 'en' as const
          }
          await serviceClient.from('users').upsert(minimal, { onConflict: 'id' })
          const retry = await serviceClient
            .from('users')
            .select(`
              id,
              email,
              phone,
              first_name,
              last_name,
              avatar_url,
              points_balance,
              total_points_earned,
              tier_level,
              total_spent,
              total_orders,
              preferred_language,
              created_at,
              updated_at,
              permanent_free_shipping,
              address_line_1,
              address_line_2,
              aba_bank_name
            `)
            .eq('id', userId)
            .single()
          if (!retry.error && retry.data) {
            // replace profile with retry result
            const profile = retry.data
            // Continue with normal flow using "profile"
            const tierThresholds = {
              bronze: 0,
              silver: 5000,
              gold: 15000,
              platinum: 35000,
              diamond: 50000
            }
            const totalPointsEarned = profile.total_points_earned || 0
            let currentTier: keyof typeof tierThresholds | 'diamond' = 'bronze'
            let nextTier: keyof typeof tierThresholds | null = 'silver'
            let pointsToNext = tierThresholds.silver - totalPointsEarned
            if (totalPointsEarned >= tierThresholds.diamond) { currentTier = 'diamond'; nextTier = null; pointsToNext = 0 }
            else if (totalPointsEarned >= tierThresholds.platinum) { currentTier = 'platinum'; nextTier = 'diamond'; pointsToNext = tierThresholds.diamond - totalPointsEarned }
            else if (totalPointsEarned >= tierThresholds.gold) { currentTier = 'gold'; nextTier = 'platinum'; pointsToNext = tierThresholds.platinum - totalPointsEarned }
            else if (totalPointsEarned >= tierThresholds.silver) { currentTier = 'silver'; nextTier = 'gold'; pointsToNext = tierThresholds.gold - totalPointsEarned }

            const response = {
              success: true,
              data: {
                profile: {
                  ...profile,
                  displayName: profile.first_name && profile.last_name
                    ? `${profile.first_name} ${profile.last_name}`.trim()
                    : profile.email?.split('@')[0] || 'User',
                  initials: profile.first_name && profile.last_name
                    ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
                    : profile.email?.[0]?.toUpperCase() || 'U'
                },
                tier_info: {
                  current_tier: currentTier,
                  next_tier: nextTier,
                  points_to_next: pointsToNext,
                  progress_percentage: nextTier
                    ? Math.round(((totalPointsEarned - tierThresholds[currentTier as keyof typeof tierThresholds]) /
                       (tierThresholds[nextTier as keyof typeof tierThresholds] - tierThresholds[currentTier as keyof typeof tierThresholds])) * 100)
                    : 100
                },
                metadata: {
                  generated_at: new Date().toISOString(),
                  cache_ttl: 600
                }
              }
            }
            return NextResponse.json(response, { headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=600', 'X-Cache-TTL': '300' } })
          }
        } catch (e) {
          console.warn('ensure-profile (users/[id]/profile) upsert failed (non-fatal):', e)
        }
        // As a secondary guard, try collapsing to the most recent row in case of accidental duplicates
        try {
          const collapse = await serviceClient
            .from('users')
            .select(`
              id,
              email,
              phone,
              first_name,
              last_name,
              avatar_url,
              points_balance,
              total_points_earned,
              tier_level,
              total_spent,
              total_orders,
              preferred_language,
              created_at,
              updated_at,
              permanent_free_shipping,
              address_line_1,
              address_line_2,
              aba_bank_name
            `)
            .eq('id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
          const collapsed = collapse.data?.[0]
          if (collapsed) {
            const tierThresholds = { bronze: 0, silver: 5000, gold: 15000, platinum: 35000, diamond: 50000 }
            const totalPointsEarned = collapsed.total_points_earned || 0
            let currentTier: keyof typeof tierThresholds | 'diamond' = 'bronze'
            let nextTier: keyof typeof tierThresholds | null = 'silver'
            let pointsToNext = tierThresholds.silver - totalPointsEarned
            if (totalPointsEarned >= tierThresholds.diamond) { currentTier = 'diamond'; nextTier = null; pointsToNext = 0 }
            else if (totalPointsEarned >= tierThresholds.platinum) { currentTier = 'platinum'; nextTier = 'diamond'; pointsToNext = tierThresholds.diamond - totalPointsEarned }
            else if (totalPointsEarned >= tierThresholds.gold) { currentTier = 'gold'; nextTier = 'platinum'; pointsToNext = tierThresholds.platinum - totalPointsEarned }
            else if (totalPointsEarned >= tierThresholds.silver) { currentTier = 'silver'; nextTier = 'gold'; pointsToNext = tierThresholds.gold - totalPointsEarned }
            const response = {
              success: true,
              data: {
                profile: {
                  ...collapsed,
                  displayName: collapsed.first_name && collapsed.last_name ? `${collapsed.first_name} ${collapsed.last_name}`.trim() : collapsed.email?.split('@')[0] || 'User',
                  initials: collapsed.first_name && collapsed.last_name ? `${collapsed.first_name[0]}${collapsed.last_name[0]}`.toUpperCase() : collapsed.email?.[0]?.toUpperCase() || 'U'
                },
                tier_info: {
                  current_tier: currentTier,
                  next_tier: nextTier,
                  points_to_next: pointsToNext,
                  progress_percentage: nextTier ? Math.round(((totalPointsEarned - tierThresholds[currentTier as keyof typeof tierThresholds]) / (tierThresholds[nextTier as keyof typeof tierThresholds] - tierThresholds[currentTier as keyof typeof tierThresholds])) * 100) : 100
                },
                metadata: { generated_at: new Date().toISOString(), cache_ttl: 600 }
              }
            }
            return NextResponse.json(response, { headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=600', 'X-Cache-TTL': '300' } })
          }
        } catch (e) {
          console.warn('users/[id]/profile duplicate collapse failed:', e)
        }

        return NextResponse.json({ success: false, error: 'User profile not found' }, { status: 404 })
      }

      throw new Error('Failed to fetch user profile')
    }

    if (!profile) {
      return NextResponse.json({
        success: false,
        error: 'User profile not found'
      }, { status: 404 })
    }

    // Calculate tier progress for enhanced profile data
    const tierThresholds = {
      bronze: 0,
      silver: 5000,
      gold: 15000,
      platinum: 35000,
      diamond: 50000
    }

    // Use lifetime points earned for tier calculations (not current balance)
    const totalPointsEarned = profile.total_points_earned || 0
    let currentTier: keyof typeof tierThresholds | 'diamond' = 'bronze'
    let nextTier: keyof typeof tierThresholds | null = 'silver'
    let pointsToNext = tierThresholds.silver - totalPointsEarned

    if (totalPointsEarned >= tierThresholds.diamond) {
      currentTier = 'diamond'
      nextTier = null
      pointsToNext = 0
    } else if (totalPointsEarned >= tierThresholds.platinum) {
      currentTier = 'platinum'
      nextTier = 'diamond'
      pointsToNext = tierThresholds.diamond - totalPointsEarned
    } else if (totalPointsEarned >= tierThresholds.gold) {
      currentTier = 'gold'
      nextTier = 'platinum'
      pointsToNext = tierThresholds.platinum - totalPointsEarned
    } else if (totalPointsEarned >= tierThresholds.silver) {
      currentTier = 'silver'
      nextTier = 'gold'
      pointsToNext = tierThresholds.gold - totalPointsEarned
    }

    const response = {
      success: true,
      data: {
        profile: {
          ...profile,
          // Add computed fields for dropdown display
          displayName: profile.first_name && profile.last_name 
            ? `${profile.first_name} ${profile.last_name}`.trim()
            : profile.email?.split('@')[0] || 'User',
          initials: profile.first_name && profile.last_name
            ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
            : profile.email?.[0]?.toUpperCase() || 'U'
        },
        tier_info: {
          current_tier: currentTier,
          next_tier: nextTier,
          points_to_next: pointsToNext,
          progress_percentage: nextTier
            ? Math.round(((totalPointsEarned - tierThresholds[currentTier as keyof typeof tierThresholds]) /
               (tierThresholds[nextTier as keyof typeof tierThresholds] - tierThresholds[currentTier as keyof typeof tierThresholds])) * 100)
            : 100
        },
        metadata: {
          generated_at: new Date().toISOString(),
          cache_ttl: 600 // 10 minutes
        }
      }
    }

    console.log(`✅ User profile data generated successfully for user ${userId}`)

    // Set cache headers for performance
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=600', // 5 min cache, 10 min stale
        'X-Cache-TTL': '300'
      }
    })

  } catch (error) {
    console.error('❌ User Profile API Error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch user profile',
      data: null
    }, { status: 500 })
  }
}
