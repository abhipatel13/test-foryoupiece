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

    const baseProfile = {
      id: user.id,
      email: user.email ?? null,
      first_name: (user.user_metadata as any)?.first_name ?? null,
      last_name: (user.user_metadata as any)?.last_name ?? null,
      telegram_username: (user.user_metadata as any)?.telegram_username ?? null,
      preferred_language: 'en' as const
    }

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

