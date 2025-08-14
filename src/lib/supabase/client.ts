import { createBrowserClient } from '@supabase/ssr'
import { Database } from './database.types'

// Global client cache to prevent redundant client creation
let globalSupabaseClient: ReturnType<typeof createBrowserClient<Database>> | null = null
let clientInitialized = false
let optimizationLogged = false

// Browser compatibility detection
function detectBrowser() {
  if (typeof window === 'undefined') return { name: 'server', version: '0' }

  const userAgent = window.navigator.userAgent

  if (userAgent.includes('Firefox/')) {
    const version = userAgent.match(/Firefox\/(\d+)/)?.[1] || '0'
    return { name: 'firefox', version }
  }

  if (userAgent.includes('Chrome/')) {
    const version = userAgent.match(/Chrome\/(\d+)/)?.[1] || '0'
    return { name: 'chrome', version }
  }

  if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) {
    const version = userAgent.match(/Version\/(\d+)/)?.[1] || '0'
    return { name: 'safari', version }
  }

  return { name: 'unknown', version: '0' }
}

// Enhanced storage implementation with cross-browser compatibility
class CrossBrowserStorage {
  private legacyPrefix = 'supabase.auth.'
  private browser = detectBrowser()
  private storageAvailable = false
  private memoryFallback = new Map<string, string>()

  constructor() {
    this.checkStorageAvailability()
  }

  private checkStorageAvailability(): void {
    try {
      if (typeof window === 'undefined') {
        this.storageAvailable = false
        return
      }

      // Test localStorage availability
      const testKey = '__storage_test__'
      localStorage.setItem(testKey, 'test')
      localStorage.removeItem(testKey)
      this.storageAvailable = true

      if (process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEBUG_SUPABASE === 'true') {
        console.log(`🔍 Storage available for ${this.browser.name} ${this.browser.version}`)
      }
    } catch (error) {
      console.warn(`⚠️ localStorage unavailable in ${this.browser.name}, using memory fallback:`, error)
      this.storageAvailable = false
    }
  }

  private isSupabaseAuthKey(key: string) {
    // Supabase v2 stores session under keys like: sb-<project-ref>-auth-token
    // Also includes PKCE code verifiers and other OAuth state
    // Keep support for legacy keys too
    return (
      key.startsWith('sb-') || // All Supabase keys (including PKCE verifiers)
      key.startsWith(this.legacyPrefix) ||
      key === 'foryoupiece-auth' // Our custom storage key
    )
  }

  private validateSessionData(data: any): boolean {
    try {
      // Enhanced session validation with security checks
      if (typeof data !== 'object' || data === null) {
        return false
      }

      // CRITICAL: Don't validate OAuth flow intermediate data
      // During PKCE flow, Supabase stores code verifiers and other OAuth state
      // that doesn't have access tokens yet but is essential for the flow
      if (this.isOAuthFlowData(data)) {
        return true // Always allow OAuth flow data to persist
      }

      // Check for session expiration
      if (data.expires_at) {
        const expiresAt = new Date(data.expires_at).getTime()
        if (Date.now() > expiresAt) {
          console.warn('🔒 Session expired, removing from storage')
          return false
        }
      }

      // Check for session age (8 hours maximum)
      if (data.created_at || data.issued_at) {
        const createdAt = new Date(data.created_at || data.issued_at).getTime()
        const sessionAge = Date.now() - createdAt
        const maxAge = 8 * 60 * 60 * 1000 // 8 hours

        if (sessionAge > maxAge) {
          console.warn('🔒 Session too old, removing from storage')
          return false
        }
      }

      // Validate token structure
      const hasValidTokens = (
        ('access_token' in data && data.access_token) ||
        ('currentSession' in data && data.currentSession &&
         typeof data.currentSession === 'object' &&
         data.currentSession.access_token)
      )

      return hasValidTokens
    } catch (error) {
      console.error('❌ Session validation error:', error)
      return false
    }
  }

  private isOAuthFlowData(data: any): boolean {
    // Detect OAuth flow intermediate data that should not be validated strictly
    return (
      // PKCE code verifier and challenge
      ('code_verifier' in data) ||
      ('code_challenge' in data) ||
      ('code_challenge_method' in data) ||
      // OAuth state parameters
      ('state' in data && typeof data.state === 'string') ||
      ('provider' in data && typeof data.provider === 'string') ||
      // Flow state identifiers
      ('flow_state_id' in data) ||
      ('pkce_verifier' in data) ||
      // Supabase OAuth session markers
      ('provider_token' in data) ||
      ('provider_refresh_token' in data) ||
      // OAuth callback parameters
      ('redirect_to' in data) ||
      // Any data structure that looks like OAuth intermediate state
      (typeof data === 'string' && (
        data.includes('code_verifier') ||
        data.includes('flow_state') ||
        data.includes('oauth') ||
        data.includes('pkce')
      ))
    )
  }

  getItem(key: string): string | null {
    try {
      let value: string | null = null

      if (this.storageAvailable) {
        value = localStorage.getItem(key)
      } else {
        value = this.memoryFallback.get(key) || null
      }

      // Enhanced validation for Supabase auth-related keys
      if (this.isSupabaseAuthKey(key) && value) {
        // Debug logging for all Supabase storage access during development
        if (process.env.NODE_ENV === 'development') {
          console.log('🔐 Supabase storage access:', { key, hasValue: !!value, valueLength: value?.length })
        }

        try {
          const data = JSON.parse(value)

          // CRITICAL: Don't validate OAuth flow intermediate data
          // During PKCE flow, Supabase stores code verifiers and other OAuth state
          // that doesn't have access tokens yet but is essential for the flow
          if (this.isOAuthFlowData(data)) {
            console.log('✅ OAuth flow data detected, allowing access:', key)
            return value // Always allow OAuth flow data to persist
          }

          // Enhanced session validation for non-OAuth data
          if (!this.validateSessionData(data)) {
            console.warn('🧹 Removing invalid session data from storage:', key)
            this.removeItem(key)
            return null
          }

          return value
        } catch {
          // For non-JSON values (like simple strings), check if they might be OAuth-related
          if (typeof value === 'string' && (
            value.includes('code_verifier') ||
            value.includes('pkce') ||
            value.includes('oauth') ||
            key.includes('code_verifier') ||
            key.includes('pkce')
          )) {
            console.log('✅ OAuth string data detected, allowing access:', key)
            return value
          }

          // Invalid JSON - remove it
          console.warn('🧹 Removing corrupted Supabase auth storage item:', key)
          this.removeItem(key)
          return null
        }
      }

      return value
    } catch (error) {
      console.error(`Storage getItem error in ${this.browser.name}:`, error)
      return null
    }
  }

  setItem(key: string, value: string): void {
    try {
      // Debug logging for OAuth-related storage during development
      if (process.env.NODE_ENV === 'development' && this.isSupabaseAuthKey(key)) {
        console.log('💾 Supabase storage write:', { key, hasValue: !!value, valueLength: value?.length })
      }

      if (this.storageAvailable) {
        localStorage.setItem(key, value)
      } else {
        this.memoryFallback.set(key, value)
      }
    } catch (error) {
      console.error(`Storage setItem error in ${this.browser.name}:`, error)
      // Fallback to memory storage
      this.memoryFallback.set(key, value)
    }
  }

  removeItem(key: string): void {
    try {
      if (this.storageAvailable) {
        localStorage.removeItem(key)
      } else {
        this.memoryFallback.delete(key)
      }
    } catch (error) {
      console.error(`Storage removeItem error in ${this.browser.name}:`, error)
      // Fallback to memory storage
      this.memoryFallback.delete(key)
    }
  }
}

export function createClient() {
  // Return cached client if already initialized
  if (globalSupabaseClient && clientInitialized) {
    return globalSupabaseClient
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // During build time, environment variables might not be available
    if (typeof window === 'undefined') {
      console.warn('Supabase environment variables not available during build')
      return null as any
    }

    // In production, this should never happen if env vars are properly configured
    console.error('Missing Supabase environment variables:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey,
      nodeEnv: process.env.NODE_ENV
    })
    throw new Error('Missing Supabase environment variables. Please check your environment configuration.')
  }

  const browser = detectBrowser()
  const storage = new CrossBrowserStorage()

  // Enhanced browser-specific configuration with security improvements
  const authConfig: any = {
    // TEMPORARILY DISABLE CUSTOM STORAGE - OAUTH STILL HAS ISSUES
    // storage, // Re-enabled with OAuth-compatible fixes
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    // Enhanced session management
    // storageKey: 'foryoupiece-auth', // Use default for now
    // Add session timeout configuration
    sessionTimeout: 8 * 60 * 60 * 1000, // 8 hours
    // Enhanced token refresh settings
    refreshTokenRotation: true,
    refreshTokenGracePeriod: 5 * 60 * 1000, // 5 minutes grace period
  }

  // Apply browser-specific optimizations (log only once per session)
  if (!optimizationLogged) {
    // Firefox-specific optimizations
    if (browser.name === 'firefox') {
      if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEBUG_SUPABASE === 'true') {
        console.log('🦊 Applying Firefox-specific Supabase optimizations')
      }

      // Firefox sometimes has issues with rapid token refresh
      authConfig.autoRefreshToken = true

      // Ensure session detection works in Firefox
      authConfig.detectSessionInUrl = true

      // Firefox handles PKCE flow well
      authConfig.flowType = 'pkce'

      // Firefox-specific session timeout (slightly shorter due to memory management)
      authConfig.sessionTimeout = 6 * 60 * 60 * 1000 // 6 hours for Firefox
    }

    // Safari-specific optimizations
    if (browser.name === 'safari') {
      if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEBUG_SUPABASE === 'true') {
        console.log('🧭 Applying Safari-specific Supabase optimizations')
      }

      // Safari has stricter cookie policies
      authConfig.persistSession = true

      // Safari-specific session management
      authConfig.sessionTimeout = 4 * 60 * 60 * 1000 // 4 hours for Safari due to strict policies
    }

    // Chrome-specific optimizations
    if (browser.name === 'chrome') {
      if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEBUG_SUPABASE === 'true') {
        console.log('🌐 Applying Chrome-specific Supabase optimizations')
      }

      // Chrome handles longer sessions well
      authConfig.sessionTimeout = 8 * 60 * 60 * 1000 // 8 hours for Chrome
      authConfig.refreshTokenGracePeriod = 10 * 60 * 1000 // 10 minutes grace period
    }

    optimizationLogged = true
  }

  // Create and cache the client
  globalSupabaseClient = createBrowserClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: authConfig,
      // Add global configuration for enhanced security
      global: {
        headers: {
          'X-Client-Info': `foryoupiece-web/${browser.name}-${browser.version}`,
        },
      },
      // Enhanced real-time configuration for session monitoring
      realtime: {
        params: {
          eventsPerSecond: 2, // Limit events for better performance
        },
      },
    }
  )

  clientInitialized = true
  return globalSupabaseClient
}

// Export function to reset client cache (useful for testing or logout)
export function resetClientCache() {
  globalSupabaseClient = null
  clientInitialized = false
  optimizationLogged = false
}
