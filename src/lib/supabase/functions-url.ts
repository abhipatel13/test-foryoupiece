export function extractProjectRef(url?: string | null) {
  if (!url) return null
  try {
    const u = new URL(url)
    const host = u.hostname
    const parts = host.split('.')
    // standard host: <ref>.supabase.co
    if (parts.length >= 3 && parts[1] === 'supabase' && parts[2] === 'co') {
      return parts[0]
    }
    return null
  } catch {
    return null
  }
}

/**
 * Derives the Supabase Functions base URL from env.
 * Priority:
 * 1) SUPABASE_FUNCTIONS_URL (trim trailing slash)
 * 2) SUPABASE_URL host ref
 * 3) NEXT_PUBLIC_SUPABASE_URL host ref
 * 4) SUPABASE_PROJECT_REF
 */
export function getFunctionsBaseUrlFromEnv(env: NodeJS.ProcessEnv) {
  const override = (env.SUPABASE_FUNCTIONS_URL || '').trim()
  if (override) return override.replace(/\/$/, '')

  const ref =
    extractProjectRef(env.SUPABASE_URL) ||
    extractProjectRef(env.NEXT_PUBLIC_SUPABASE_URL) ||
    (env.SUPABASE_PROJECT_REF || null)

  return ref ? `https://${ref}.functions.supabase.co` : null
}
