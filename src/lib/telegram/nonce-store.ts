import { createServiceRoleClient } from '@/lib/supabase/service-role'

// Stateless nonce storage backed by Supabase DB (auth_nonces)
// TTL is enforced in code (10 minutes). Service role client is used only on server.

export type TelegramUserData = {
  id: number
  username?: string
  first_name?: string
  last_name?: string
}

export type NonceRow = {
  nonce: string
  created_at: string
  verified: boolean
  telegram_data: TelegramUserData | null
}

const TTL_MS = 10 * 60 * 1000

function nowMs() {
  return Date.now()
}

export async function createNonce(nonce: string): Promise<void> {
  const admin = createServiceRoleClient()
  if (!admin) throw new Error('Service role client unavailable')

  const { error } = await admin
    .from('auth_nonces')
    .insert({ nonce, verified: false })

  if (error) throw error
}

export async function getNonce(nonce: string): Promise<NonceRow | null> {
  const admin = createServiceRoleClient()
  if (!admin) throw new Error('Service role client unavailable')

  const { data, error } = await admin
    .from('auth_nonces')
    .select('nonce, created_at, verified, telegram_data')
    .eq('nonce', nonce)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const created = new Date(data.created_at).getTime()
  if (nowMs() - created > TTL_MS) {
    // Expired: clean up
    await admin.from('auth_nonces').delete().eq('nonce', nonce)
    return null
  }

  return data as any
}

export async function markNonceVerified(nonce: string, telegram: TelegramUserData): Promise<boolean> {
  const admin = createServiceRoleClient()
  if (!admin) throw new Error('Service role client unavailable')

  // Ensure not expired and exists
  const current = await getNonce(nonce)
  if (!current) return false

  const { error } = await admin
    .from('auth_nonces')
    .update({ verified: true, telegram_data: telegram as any })
    .eq('nonce', nonce)

  if (error) throw error
  return true
}

export async function deleteNonce(nonce: string): Promise<void> {
  const admin = createServiceRoleClient()
  if (!admin) throw new Error('Service role client unavailable')
  await admin.from('auth_nonces').delete().eq('nonce', nonce)
}

