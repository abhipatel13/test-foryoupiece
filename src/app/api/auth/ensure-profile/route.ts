import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * POST /api/auth/ensure-profile
 * Ensures a minimal users row exists for the authenticated user.
 * Idempotent: upsert by id. Returns the (possibly newly created) profile subset.
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body for additional metadata
    const body = await request.json().catch(() => ({}))
    const { metadata } = body
    
    const supabase = await createClient()
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    const bearer = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined
    const { data: { user }, error: authErr } = bearer
      ? await supabase.auth.getUser(bearer)
      : await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const admin = createServiceRoleClient()
    if (!admin) {
      throw new Error('Service role client unavailable')
    }

    // Enhanced profile creation with Google OAuth metadata
    const userMetadata = metadata || user.user_metadata || {}
    
    // Extract name from Google OAuth metadata
    let firstName = userMetadata.first_name || null
    let lastName = userMetadata.last_name || null
    
    // If no first/last name, try to split full_name from Google
    if (!firstName && !lastName && userMetadata.full_name) {
      const nameParts = userMetadata.full_name.split(' ')
      firstName = nameParts[0] || null
      lastName = nameParts.slice(1).join(' ') || null
    }

    const baseProfile = {
      id: user.id,
      email: user.email ?? null,
      first_name: firstName,
      last_name: lastName,
      avatar_url: userMetadata.avatar_url || userMetadata.picture || null,
      telegram_username: userMetadata.telegram_username ?? null,
      preferred_language: 'en' as const,
      points_balance: 1000, // Welcome points for new users
      tier_level: 'Bronze',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    console.log('🔧 Creating/updating profile for user:', {
      userId: user.id,
      email: user.email,
      provider: user.app_metadata?.provider,
      hasMetadata: !!metadata
    })

    // Upsert to ensure existence (safe for race conditions)
    const { error: upsertError } = await admin.from('users').upsert(baseProfile, { onConflict: 'id' })
    if (upsertError) {
      console.warn('ensure-profile upsert error (non-fatal):', upsertError)
    }

    // Return a lightweight profile using the user-scoped client (respect RLS)
    const { data: profile } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, telegram_username, points_balance, total_points_earned, tier_level')
      .eq('id', user.id)
      .maybeSingle()

    const res = NextResponse.json({ success: true, data: { profile: profile ?? null } }, { status: 200 })
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (e: any) {
    console.error('ensure-profile error:', e)
    return NextResponse.json({ success: false, error: e?.message || 'ensure-profile error' }, { status: 500 })
  }
}

