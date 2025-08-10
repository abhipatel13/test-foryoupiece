import { createClient } from '@/lib/supabase/client'
// Server-side imports are done dynamically to avoid client-side build errors

/**
 * Enhanced Session Management Security System
 * Implements session timeout, token blacklisting, and refresh token rotation
 */

export interface SessionConfig {
  idleTimeout: number // 30 minutes in milliseconds
  absoluteTimeout: number // 8 hours in milliseconds
  refreshThreshold: number // 15 minutes in milliseconds
  warningThreshold: number // 5 minutes in milliseconds
}

export interface SessionState {
  userId: string
  sessionId: string
  lastActivity: number
  createdAt: number
  refreshedAt: number
  isValid: boolean
  expiresAt: number
}

export interface SessionWarning {
  type: 'idle_warning' | 'absolute_warning'
  timeRemaining: number
  message: string
}

// Default session configuration
const DEFAULT_SESSION_CONFIG: SessionConfig = {
  idleTimeout: 30 * 60 * 1000, // 30 minutes
  absoluteTimeout: 8 * 60 * 60 * 1000, // 8 hours
  refreshThreshold: 15 * 60 * 1000, // 15 minutes
  warningThreshold: 5 * 60 * 1000, // 5 minutes
}

// In-memory session tracking (for client-side)
const sessionTracker = new Map<string, SessionState>()

// Blacklisted tokens (should be stored in database in production)
const tokenBlacklist = new Set<string>()

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Get current session state
 */
export function getCurrentSession(userId: string): SessionState | null {
  return sessionTracker.get(userId) || null
}

/**
 * Create a new session
 */
export function createSession(userId: string, config: Partial<SessionConfig> = {}): SessionState {
  const sessionConfig = { ...DEFAULT_SESSION_CONFIG, ...config }
  const now = Date.now()
  
  const sessionState: SessionState = {
    userId,
    sessionId: generateSessionId(),
    lastActivity: now,
    createdAt: now,
    refreshedAt: now,
    isValid: true,
    expiresAt: now + sessionConfig.absoluteTimeout
  }
  
  sessionTracker.set(userId, sessionState)
  
  console.log('🔐 Session created:', {
    userId: userId.substring(0, 8) + '...',
    sessionId: sessionState.sessionId,
    expiresAt: new Date(sessionState.expiresAt).toISOString()
  })
  
  return sessionState
}

/**
 * Update session activity
 */
export function updateSessionActivity(userId: string): boolean {
  const session = sessionTracker.get(userId)
  if (!session || !session.isValid) {
    return false
  }
  
  const now = Date.now()
  
  // Check if session has exceeded absolute timeout
  if (now > session.expiresAt) {
    invalidateSession(userId, 'absolute_timeout')
    return false
  }
  
  // Check if session has exceeded idle timeout
  if (now - session.lastActivity > DEFAULT_SESSION_CONFIG.idleTimeout) {
    invalidateSession(userId, 'idle_timeout')
    return false
  }
  
  // Update last activity
  session.lastActivity = now
  sessionTracker.set(userId, session)
  
  return true
}

/**
 * Check if session needs refresh
 */
export function shouldRefreshSession(userId: string): boolean {
  const session = sessionTracker.get(userId)
  if (!session || !session.isValid) {
    return false
  }
  
  const now = Date.now()
  const timeSinceRefresh = now - session.refreshedAt
  
  return timeSinceRefresh > DEFAULT_SESSION_CONFIG.refreshThreshold
}

/**
 * Refresh session tokens
 */
export async function refreshSessionTokens(userId: string): Promise<{
  success: boolean
  newTokens?: { accessToken: string; refreshToken: string }
  error?: string
}> {
  try {
    const session = sessionTracker.get(userId)
    if (!session || !session.isValid) {
      return { success: false, error: 'Invalid session' }
    }
    
    const supabase = createClient()
    
    // Refresh the session with Supabase
    const { data, error } = await supabase.auth.refreshSession()
    
    if (error || !data.session) {
      console.error('❌ Session refresh failed:', error?.message)
      invalidateSession(userId, 'refresh_failed')
      return { success: false, error: error?.message || 'Refresh failed' }
    }
    
    // Update session state
    const now = Date.now()
    session.refreshedAt = now
    session.lastActivity = now
    sessionTracker.set(userId, session)
    
    console.log('✅ Session refreshed:', {
      userId: userId.substring(0, 8) + '...',
      sessionId: session.sessionId
    })
    
    return {
      success: true,
      newTokens: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token
      }
    }
  } catch (error) {
    console.error('❌ Session refresh error:', error)
    invalidateSession(userId, 'refresh_error')
    return { success: false, error: 'Refresh error' }
  }
}

/**
 * Check for session warnings
 */
export function checkSessionWarnings(userId: string): SessionWarning | null {
  const session = sessionTracker.get(userId)
  if (!session || !session.isValid) {
    return null
  }
  
  const now = Date.now()
  const timeSinceActivity = now - session.lastActivity
  const timeUntilAbsoluteExpiry = session.expiresAt - now
  
  // Check for idle timeout warning
  const idleTimeRemaining = DEFAULT_SESSION_CONFIG.idleTimeout - timeSinceActivity
  if (idleTimeRemaining <= DEFAULT_SESSION_CONFIG.warningThreshold && idleTimeRemaining > 0) {
    return {
      type: 'idle_warning',
      timeRemaining: idleTimeRemaining,
      message: `Your session will expire due to inactivity in ${Math.ceil(idleTimeRemaining / 60000)} minutes`
    }
  }
  
  // Check for absolute timeout warning
  if (timeUntilAbsoluteExpiry <= DEFAULT_SESSION_CONFIG.warningThreshold && timeUntilAbsoluteExpiry > 0) {
    return {
      type: 'absolute_warning',
      timeRemaining: timeUntilAbsoluteExpiry,
      message: `Your session will expire in ${Math.ceil(timeUntilAbsoluteExpiry / 60000)} minutes`
    }
  }
  
  return null
}

/**
 * Invalidate session
 */
export function invalidateSession(userId: string, reason: string): void {
  const session = sessionTracker.get(userId)
  if (session) {
    session.isValid = false
    sessionTracker.set(userId, session)
    
    console.log('🔒 Session invalidated:', {
      userId: userId.substring(0, 8) + '...',
      sessionId: session.sessionId,
      reason
    })
  }
}

/**
 * Blacklist a token (SERVER-SIDE ONLY)
 * This function should only be called from server-side code (API routes)
 */
export async function blacklistToken(token: string, userId: string, reason: string): Promise<void> {
  try {
    // Only run on server side
    if (typeof window !== 'undefined') {
      console.warn('⚠️ blacklistToken called on client side - skipping database operation')
      return
    }

    tokenBlacklist.add(token)

    // In production, store in database
    const { createServiceRoleClient } = await import('@/lib/supabase/service-role')
    const serviceClient = createServiceRoleClient()
    await serviceClient
      .from('blacklisted_tokens')
      .insert({
        token_hash: await hashToken(token),
        user_id: userId,
        reason,
        blacklisted_at: new Date().toISOString()
      })

    console.log('🚫 Token blacklisted:', {
      userId: userId.substring(0, 8) + '...',
      reason,
      tokenPrefix: token.substring(0, 10) + '...'
    })
  } catch (error) {
    console.error('❌ Error blacklisting token:', error)
  }
}

/**
 * Check if token is blacklisted (SERVER-SIDE ONLY)
 * This function should only be called from server-side code (API routes)
 */
export async function isTokenBlacklisted(token: string): Promise<boolean> {
  try {
    // Only run on server side
    if (typeof window !== 'undefined') {
      console.warn('⚠️ isTokenBlacklisted called on client side - returning false')
      return false
    }

    // Check in-memory cache first
    if (tokenBlacklist.has(token)) {
      return true
    }

    // Check database
    const { createServiceRoleClient } = await import('@/lib/supabase/service-role')
    const serviceClient = createServiceRoleClient()
    const tokenHash = await hashToken(token)

    const { data, error } = await serviceClient
      .from('blacklisted_tokens')
      .select('id')
      .eq('token_hash', tokenHash)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('❌ Error checking token blacklist:', error)
      return false
    }

    const isBlacklisted = !!data

    // Cache result
    if (isBlacklisted) {
      tokenBlacklist.add(token)
    }

    return isBlacklisted
  } catch (error) {
    console.error('❌ Error checking token blacklist:', error)
    return false
  }
}

/**
 * Hash token for storage (to avoid storing actual tokens)
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Client-side logout (safe for browser use)
 * Only handles local cleanup and Supabase logout
 */
export async function clientSideLogout(userId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = createClient()

    // Sign out from Supabase
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('❌ Supabase logout error:', error)
      // Continue with cleanup even if Supabase logout fails
    }

    // Invalidate local session
    invalidateSession(userId, 'user_logout')

    // Clear all auth-related storage
    const authKeys = [
      'supabase.auth.token',
      'foryoupiece-user',
      'foryoupiece-cart',
      'session_validated_at'
    ]

    try {
      // Include Supabase v2 auth keys too (sb-<ref>-auth-token...)
      const dynamicKeys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue
        if (key.startsWith('sb-') && key.includes('auth')) {
          dynamicKeys.push(key)
        }
      }
      authKeys.push(...dynamicKeys)
    } catch (e) {
      console.warn('Failed to enumerate localStorage keys for cleanup:', e)
    }

    authKeys.forEach(key => {
      try {
        localStorage.removeItem(key)
      } catch (e) {
        console.error(`Failed to remove ${key}:`, e)
      }
    })

    try {
      sessionStorage.clear()
    } catch (e) {
      console.error('Failed to clear session storage:', e)
    }

    console.log('✅ Client-side logout completed for user:', userId.substring(0, 8) + '...')

    return { success: true }
  } catch (error) {
    console.error('❌ Client-side logout error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Logout failed' }
  }
}

/**
 * Enhanced logout with token blacklisting (SERVER-SIDE ONLY)
 * This function should only be called from server-side code (API routes)
 */
export async function enhancedLogout(userId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    // Only run on server side
    if (typeof window !== 'undefined') {
      console.warn('⚠️ enhancedLogout called on client side - using clientSideLogout instead')
      return await clientSideLogout(userId)
    }

    const { createClient: createServerClient } = await import('@/lib/supabase/server')
    const supabase = await createServerClient()

    // Get current session to blacklist tokens
    const { data: { session } } = await supabase.auth.getSession()

    if (session) {
      // Blacklist current tokens
      await blacklistToken(session.access_token, userId, 'user_logout')
      if (session.refresh_token) {
        await blacklistToken(session.refresh_token, userId, 'user_logout')
      }
    }

    // Sign out from Supabase
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('❌ Supabase logout error:', error)
      // Continue with cleanup even if Supabase logout fails
    }

    // Invalidate local session
    invalidateSession(userId, 'user_logout')

    console.log('✅ Enhanced logout completed for user:', userId.substring(0, 8) + '...')

    return { success: true }
  } catch (error) {
    console.error('❌ Enhanced logout error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Logout failed' }
  }
}

/**
 * Clean up expired sessions
 */
export function cleanupExpiredSessions(): void {
  const now = Date.now()
  
  for (const [userId, session] of sessionTracker.entries()) {
    if (!session.isValid || now > session.expiresAt) {
      sessionTracker.delete(userId)
    }
  }
}

// Cleanup expired sessions every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(cleanupExpiredSessions, 5 * 60 * 1000)
}
