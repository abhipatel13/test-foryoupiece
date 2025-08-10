import { createBrowserClient } from '@supabase/ssr'
import { Database } from './database.types'

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

      console.log(`🔍 Storage available for ${this.browser.name} ${this.browser.version}`)
    } catch (error) {
      console.warn(`⚠️ localStorage unavailable in ${this.browser.name}, using memory fallback:`, error)
      this.storageAvailable = false
    }
  }

  private isSupabaseAuthKey(key: string) {
    // Supabase v2 stores session under keys like: sb-<project-ref>-auth-token
    // Keep support for legacy keys too
    return (
      key.startsWith('sb-') && key.endsWith('-auth-token') ||
      key.startsWith(this.legacyPrefix)
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

      // Only validate Supabase auth-related keys
      if (this.isSupabaseAuthKey(key) && value) {
        try {
          const data = JSON.parse(value)
          // Be permissive: different Supabase versions store different shapes.
          // If it's valid JSON, keep it. Only purge when JSON is corrupted.
          // Common shapes:
          // - { access_token, refresh_token, ... }
          // - { currentSession: { access_token, refresh_token, ... }, expiresAt }
          if (
            (typeof data === 'object' && data !== null) &&
            (
              ('access_token' in data) ||
              ('currentSession' in data && data.currentSession && typeof data.currentSession === 'object')
            )
          ) {
            return value
          }
          // Unknown shape: don't be destructive; keep but log once.
          console.warn('⚠️ Unrecognized Supabase auth storage shape; preserving as-is')
          return value
        } catch {
          // Invalid JSON - remove it
          console.warn('🧹 Removing corrupted Supabase auth storage item')
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

  // Browser-specific configuration
  const authConfig: any = {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }

  // Firefox-specific optimizations
  if (browser.name === 'firefox') {
    console.log('🦊 Applying Firefox-specific Supabase optimizations')

    // Firefox sometimes has issues with rapid token refresh
    authConfig.autoRefreshToken = true

    // Ensure session detection works in Firefox
    authConfig.detectSessionInUrl = true

    // Firefox handles PKCE flow well
    authConfig.flowType = 'pkce'
  }

  // Safari-specific optimizations
  if (browser.name === 'safari') {
    console.log('🧭 Applying Safari-specific Supabase optimizations')

    // Safari has stricter cookie policies
    authConfig.persistSession = true
  }

  return createBrowserClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: authConfig
    }
  )
}
