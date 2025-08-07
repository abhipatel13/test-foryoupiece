'use client'

/**
 * Admin Token Migration Utility
 * Safely removes localStorage-based admin tokens and clears any legacy authentication data
 * This ensures a clean transition to the new httpOnly cookie-based authentication system
 */

interface MigrationResult {
  success: boolean
  clearedItems: string[]
  errors: string[]
  message: string
}

/**
 * List of localStorage keys that may contain admin authentication data
 */
const ADMIN_STORAGE_KEYS = [
  'admin_token',
  'admin_session',
  'admin_user',
  'admin_auth',
  'fyp_admin_token',
  'fyp_admin_session',
  'foryoupiece_admin_token',
  'foryoupiece_admin_session',
  'supabase_admin_token',
  'admin_access_token',
  'admin_refresh_token'
]

/**
 * Additional localStorage keys that may contain sensitive admin data
 */
const SENSITIVE_ADMIN_KEYS = [
  'admin_permissions',
  'admin_role',
  'admin_config',
  'admin_settings',
  'admin_cache',
  'admin_state'
]

/**
 * Clear all admin-related localStorage items
 */
export function clearAdminTokensFromStorage(): MigrationResult {
  const result: MigrationResult = {
    success: true,
    clearedItems: [],
    errors: [],
    message: ''
  }

  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    result.success = false
    result.message = 'Not in browser environment - no action needed'
    return result
  }

  console.log('🧹 Starting admin token migration - clearing localStorage...')

  // Clear known admin token keys
  const allKeysToCheck = [...ADMIN_STORAGE_KEYS, ...SENSITIVE_ADMIN_KEYS]

  for (const key of allKeysToCheck) {
    try {
      const value = localStorage.getItem(key)
      if (value !== null) {
        localStorage.removeItem(key)
        result.clearedItems.push(key)
        console.log(`🗑️ Cleared localStorage key: ${key}`)
      }
    } catch (error) {
      const errorMessage = `Failed to clear ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`
      result.errors.push(errorMessage)
      console.error(`❌ ${errorMessage}`)
    }
  }

  // Scan for any other keys that might contain admin data
  try {
    const allKeys = Object.keys(localStorage)
    const suspiciousKeys = allKeys.filter(key => 
      key.toLowerCase().includes('admin') && 
      !allKeysToCheck.includes(key)
    )

    for (const key of suspiciousKeys) {
      try {
        const value = localStorage.getItem(key)
        if (value !== null) {
          // Check if the value looks like authentication data
          if (typeof value === 'string' && (
            value.includes('token') || 
            value.includes('session') || 
            value.includes('auth') ||
            value.startsWith('eyJ') || // JWT tokens
            value.length > 50 // Likely to be a token
          )) {
            localStorage.removeItem(key)
            result.clearedItems.push(key)
            console.log(`🗑️ Cleared suspicious admin key: ${key}`)
          }
        }
      } catch (error) {
        const errorMessage = `Failed to clear suspicious key ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`
        result.errors.push(errorMessage)
        console.error(`❌ ${errorMessage}`)
      }
    }
  } catch (error) {
    const errorMessage = `Failed to scan localStorage: ${error instanceof Error ? error.message : 'Unknown error'}`
    result.errors.push(errorMessage)
    console.error(`❌ ${errorMessage}`)
  }

  // Clear sessionStorage as well for completeness
  try {
    if (typeof sessionStorage !== 'undefined') {
      const sessionKeys = Object.keys(sessionStorage)
      const adminSessionKeys = sessionKeys.filter(key => 
        key.toLowerCase().includes('admin')
      )

      for (const key of adminSessionKeys) {
        try {
          sessionStorage.removeItem(key)
          result.clearedItems.push(`sessionStorage:${key}`)
          console.log(`🗑️ Cleared sessionStorage key: ${key}`)
        } catch (error) {
          const errorMessage = `Failed to clear sessionStorage key ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`
          result.errors.push(errorMessage)
          console.error(`❌ ${errorMessage}`)
        }
      }
    }
  } catch (error) {
    const errorMessage = `Failed to clear sessionStorage: ${error instanceof Error ? error.message : 'Unknown error'}`
    result.errors.push(errorMessage)
    console.error(`❌ ${errorMessage}`)
  }

  // Set migration completion flag
  try {
    localStorage.setItem('fyp_admin_migration_completed', new Date().toISOString())
    console.log('✅ Admin token migration completed')
  } catch (error) {
    console.warn('⚠️ Could not set migration completion flag:', error)
  }

  // Generate result message
  if (result.clearedItems.length > 0) {
    result.message = `Successfully cleared ${result.clearedItems.length} admin storage items`
    if (result.errors.length > 0) {
      result.message += ` with ${result.errors.length} errors`
      result.success = false
    }
  } else {
    result.message = 'No admin tokens found in storage - migration not needed'
  }

  console.log(`🎉 Admin token migration result: ${result.message}`)
  return result
}

/**
 * Check if admin token migration has been completed
 */
export function isAdminMigrationCompleted(): boolean {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return true // Assume completed in non-browser environments
  }

  try {
    const migrationFlag = localStorage.getItem('fyp_admin_migration_completed')
    return migrationFlag !== null
  } catch (error) {
    console.warn('Could not check migration status:', error)
    return false
  }
}

/**
 * Force admin token migration (useful for testing or manual cleanup)
 */
export function forceAdminTokenMigration(): MigrationResult {
  console.log('🔄 Forcing admin token migration...')
  
  // Remove migration flag to force re-migration
  try {
    localStorage.removeItem('fyp_admin_migration_completed')
  } catch (error) {
    console.warn('Could not remove migration flag:', error)
  }

  return clearAdminTokensFromStorage()
}

/**
 * Get migration status and statistics
 */
export function getAdminMigrationStatus(): {
  completed: boolean
  completedAt: string | null
  hasAdminTokens: boolean
  suspiciousKeys: string[]
} {
  const status = {
    completed: false,
    completedAt: null as string | null,
    hasAdminTokens: false,
    suspiciousKeys: [] as string[]
  }

  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return { ...status, completed: true }
  }

  try {
    // Check if migration was completed
    const migrationFlag = localStorage.getItem('fyp_admin_migration_completed')
    status.completed = migrationFlag !== null
    status.completedAt = migrationFlag

    // Check for remaining admin tokens
    const allKeys = Object.keys(localStorage)
    const adminKeys = allKeys.filter(key => 
      key.toLowerCase().includes('admin') && 
      key !== 'fyp_admin_migration_completed'
    )

    status.hasAdminTokens = adminKeys.length > 0
    status.suspiciousKeys = adminKeys

  } catch (error) {
    console.error('Error checking migration status:', error)
  }

  return status
}

/**
 * Auto-run migration on import if needed (for backward compatibility)
 */
export function autoMigrateAdminTokens(): void {
  if (typeof window !== 'undefined' && !isAdminMigrationCompleted()) {
    console.log('🔄 Auto-running admin token migration...')
    clearAdminTokensFromStorage()
  }
}
