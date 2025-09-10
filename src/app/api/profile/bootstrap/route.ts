import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Lightweight bootstrap endpoint for initial profile payload
// Returns only essential fields for first render
export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userErr } = await supabase.auth.getUser()

    if (userErr) {
      // Treat missing auth session as unauthenticated (not an error)
      return NextResponse.json({ success: true, data: { authenticated: false } }, { status: 200 })
    }

    if (!user) {
      return NextResponse.json({ success: true, data: { authenticated: false } }, { status: 200 })
    }

    // Fetch minimal profile fields
    const { data: profile, error: profileErr } = await supabase
      .from('users')
      .select(`
        id, email, phone, first_name, last_name, avatar_url,
        points_balance, total_points_earned, tier_level,
        telegram_username,
        address_line_1, address_line_2, aba_bank_name
      `)
      .eq('id', user.id)
      .single()

    if (profileErr) {
      // If profile does not exist yet, create a minimal one atomically and retry.
      // This makes first‑login flows robust in regions with higher latency (e.g., SEA)
      try {
        // Only handle the "no rows" case. For other errors, fall back to non‑blocking behavior.
        if ((profileErr as any)?.code === 'PGRST116') {
          const { createServiceRoleClient } = await import('@/lib/supabase/service-role')
          const admin = createServiceRoleClient()
          if (admin) {
            const baseProfile = {
              id: user.id,
              email: user.email ?? null,
              first_name: (user.user_metadata as any)?.first_name ?? null,
              last_name: (user.user_metadata as any)?.last_name ?? null,
              telegram_username: (user.user_metadata as any)?.telegram_username ?? null,
              preferred_language: 'en' as const
            }
            // Use upsert to be idempotent in case another tab creates it concurrently
            await admin.from('users').upsert(baseProfile, { onConflict: 'id' })
            // Retry fetch with the user-scoped client (respecting RLS)
            const { data: created } = await supabase
              .from('users')
              .select(`
                id, email, phone, first_name, last_name, avatar_url,
                points_balance, total_points_earned, tier_level,
                telegram_username,
                address_line_1, address_line_2, aba_bank_name
              `)
              .eq('id', user.id)
              .single()
            const res = NextResponse.json({ success: true, data: { authenticated: true, profile: created ?? null, cart_count: 0 } }, { status: 200 })
            res.headers.set('Cache-Control', 'no-store')
            return res
          }
        }
      } catch (e) {
        // Non-fatal: fall through to returning null profile
        console.warn('⚠️ Bootstrap: ensure profile failed (non-fatal):', e)
      }
      // Do not fail hard; return an empty profile to avoid blocking UI
      const res = NextResponse.json({ success: true, data: { authenticated: true, profile: null, cart_count: 0 } }, { status: 200 })
      res.headers.set('Cache-Control', 'no-store')
      return res
    }

    // Fetch cart count only (head request with count)
    const { count: cartCount = 0 } = await supabase
      .from('cart_items')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    const payload = {
      authenticated: true,
      profile,
      cart_count: cartCount,
      points_summary: {
        balance: profile?.points_balance ?? 0,
        total_earned: profile?.total_points_earned ?? 0,
        tier: profile?.tier_level ?? 'bronze',
      },
      name: profile?.first_name || profile?.telegram_username || 'User',
      avatar: profile?.avatar_url || null,
    }

    const res = NextResponse.json({ success: true, data: payload }, { status: 200 })
    // Make sure this is always fresh for auth flows
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || 'Bootstrap error' },
      { status: 200 }
    )
  }
}

