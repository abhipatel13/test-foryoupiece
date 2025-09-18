/**
 * Authentication Diagnostics System
 * Tracks authentication state transitions and identifies reliability issues
 */

interface AuthTransition {
  timestamp: string
  type: 'LOGIN' | 'LOGOUT' | 'SESSION_RESTORE' | 'SESSION_EXPIRE' | 'METHOD_SWITCH' | 'STATE_CHANGE'
  from: {
    userId?: string
    email?: string
    method?: string
    hasSession: boolean
    hasProfile: boolean
    source?: string
  }
  to: {
    userId?: string
    email?: string
    method?: string
    hasSession: boolean
    hasProfile: boolean
    source?: string
  }
  metadata?: {
    trigger?: string
    error?: string
    staleDataDetected?: boolean
    crossTabEvent?: boolean
    signOutInProgress?: boolean
    cleanupComplete?: boolean
    storageCleared?: string[]
    warnings?: string[]
  }
}

class AuthDiagnostics {
  private transitions: AuthTransition[] = []
  private currentState: any = {}
  private staleDataWarnings: string[] = []
  private sessionContaminationDetected = false
  private incompleteLogouts = 0
  private maxTransitions = 100

  constructor() {
    if (typeof window !== 'undefined') {
      // Make diagnostics available globally for debugging
      (window as any).__authDiagnostics = this
    }
  }

  /**
   * Log an authentication state transition
   */
  logTransition(
    type: AuthTransition['type'],
    from: AuthTransition['from'],
    to: AuthTransition['to'],
    metadata?: AuthTransition['metadata']
  ) {
    const transition: AuthTransition = {
      timestamp: new Date().toISOString(),
      type,
      from,
      to,
      metadata
    }

    // Detect potential issues
    const issues = this.detectIssues(transition)
    if (issues.length > 0) {
      transition.metadata = {
        ...transition.metadata,
        warnings: issues
      }
      console.warn('⚠️ Auth transition issues detected:', issues)
    }

    this.transitions.push(transition)
    
    // Keep only recent transitions to avoid memory issues
    if (this.transitions.length > this.maxTransitions) {
      this.transitions.shift()
    }

    // Log critical transitions
    if (type === 'LOGOUT' || type === 'SESSION_EXPIRE' || type === 'METHOD_SWITCH') {
      console.log('🔍 [AUTH DIAGNOSTIC]', type, {
        from: `${from.userId || 'none'}/${from.email || 'none'}`,
        to: `${to.userId || 'none'}/${to.email || 'none'}`,
        metadata
      })
    }

    this.currentState = to
  }

  /**
   * Detect potential authentication issues
   */
  private detectIssues(transition: AuthTransition): string[] {
    const issues: string[] = []

    // Issue 1: Cross-account contamination
    if (
      transition.from.userId && 
      transition.to.userId && 
      transition.from.userId === transition.to.userId &&
      transition.from.email !== transition.to.email
    ) {
      issues.push('CROSS_ACCOUNT_CONTAMINATION: Same userId but different email')
      this.sessionContaminationDetected = true
    }

    // Issue 2: Incomplete logout
    if (
      transition.type === 'LOGOUT' &&
      (transition.to.hasSession || transition.to.hasProfile || transition.to.userId)
    ) {
      issues.push('INCOMPLETE_LOGOUT: State not fully cleared')
      this.incompleteLogouts++
    }

    // Issue 3: Stale data after session expiration
    if (
      transition.type === 'SESSION_EXPIRE' &&
      (transition.to.hasProfile || transition.to.userId)
    ) {
      issues.push('STALE_DATA_AFTER_EXPIRATION: User data persists after session expired')
    }

    // Issue 4: Method switch without cleanup
    if (
      transition.type === 'METHOD_SWITCH' &&
      transition.from.userId &&
      transition.metadata?.signOutInProgress === false
    ) {
      issues.push('METHOD_SWITCH_WITHOUT_CLEANUP: Switching auth methods without proper logout')
    }

    // Issue 5: Session restoration during logout
    if (
      transition.type === 'SESSION_RESTORE' &&
      transition.metadata?.signOutInProgress === true
    ) {
      issues.push('SESSION_RESTORE_DURING_LOGOUT: Attempting to restore session while logout in progress')
    }

    // Issue 6: Storage not cleared on logout
    if (
      transition.type === 'LOGOUT' &&
      (!transition.metadata?.storageCleared || transition.metadata.storageCleared.length === 0)
    ) {
      issues.push('STORAGE_NOT_CLEARED: localStorage/sessionStorage not cleared during logout')
    }

    return issues
  }

  /**
   * Track stale data detection
   */
  detectStaleData(
    currentUserId: string | null,
    currentEmail: string | null,
    displayedUserId: string | null,
    displayedEmail: string | null
  ): boolean {
    if (!currentUserId && displayedUserId) {
      const warning = `STALE_USER_DISPLAYED: No session but showing user ${displayedUserId}`
      this.staleDataWarnings.push(warning)
      console.error('🔴 [STALE DATA]', warning)
      return true
    }

    if (currentUserId && displayedUserId && currentUserId !== displayedUserId) {
      const warning = `USER_MISMATCH: Session user ${currentUserId} but showing ${displayedUserId}`
      this.staleDataWarnings.push(warning)
      console.error('🔴 [USER MISMATCH]', warning)
      return true
    }

    if (currentEmail && displayedEmail && currentEmail !== displayedEmail) {
      const warning = `EMAIL_MISMATCH: Session email ${currentEmail} but showing ${displayedEmail}`
      this.staleDataWarnings.push(warning)
      console.error('🔴 [EMAIL MISMATCH]', warning)
      return true
    }

    return false
  }

  /**
   * Track session validation
   */
  trackSessionValidation(
    hasSupabaseSession: boolean,
    hasStoreUser: boolean,
    hasStoreProfile: boolean,
    signOutInProgress: boolean
  ) {
    const validationState = {
      timestamp: new Date().toISOString(),
      hasSupabaseSession,
      hasStoreUser,
      hasStoreProfile,
      signOutInProgress,
      isConsistent: hasSupabaseSession === hasStoreUser
    }

    if (!validationState.isConsistent) {
      console.warn('🔍 [SESSION INCONSISTENCY]', validationState)
    }

    return validationState
  }

  /**
   * Track cleanup completeness
   */
  trackCleanup(cleanupSteps: {
    supabaseSignOut?: boolean
    serverLogout?: boolean
    storeCleared?: boolean
    localStorageCleared?: string[]
    sessionStorageCleared?: boolean
    cartCleared?: boolean
    crossTabNotified?: boolean
  }) {
    const incomplete = Object.entries(cleanupSteps)
      .filter(([key, value]) => value === false)
      .map(([key]) => key)

    if (incomplete.length > 0) {
      console.warn('🔍 [INCOMPLETE CLEANUP]', {
        incomplete,
        completed: Object.entries(cleanupSteps)
          .filter(([key, value]) => value === true)
          .map(([key]) => key)
      })
    }

    return {
      isComplete: incomplete.length === 0,
      incomplete,
      steps: cleanupSteps
    }
  }

  /**
   * Get diagnostic summary
   */
  getSummary() {
    const recentIssues = this.transitions
      .filter(t => t.metadata?.warnings && t.metadata.warnings.length > 0)
      .slice(-10)

    return {
      totalTransitions: this.transitions.length,
      sessionContaminationDetected: this.sessionContaminationDetected,
      incompleteLogouts: this.incompleteLogouts,
      staleDataWarnings: this.staleDataWarnings.slice(-10),
      recentIssues: recentIssues.map(t => ({
        timestamp: t.timestamp,
        type: t.type,
        warnings: t.metadata?.warnings
      })),
      currentState: this.currentState,
      lastTransition: this.transitions[this.transitions.length - 1]
    }
  }

  /**
   * Export diagnostic data for analysis
   */
  exportDiagnostics() {
    return {
      transitions: this.transitions,
      summary: this.getSummary(),
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Clear diagnostic data
   */
  clear() {
    this.transitions = []
    this.staleDataWarnings = []
    this.sessionContaminationDetected = false
    this.incompleteLogouts = 0
    console.log('🔍 [AUTH DIAGNOSTICS] Cleared')
  }
}

// Global diagnostic instance
let diagnosticsInstance: AuthDiagnostics | null = null

export function getAuthDiagnostics(): AuthDiagnostics {
  if (!diagnosticsInstance) {
    diagnosticsInstance = new AuthDiagnostics()
  }
  return diagnosticsInstance
}

// Diagnostic helper functions
export const authDiagnostics = {
  logLogin: (userId: string, email: string, method: string, previousUser?: any) => {
    getAuthDiagnostics().logTransition(
      'LOGIN',
      {
        userId: previousUser?.id,
        email: previousUser?.email,
        method: previousUser?.method,
        hasSession: !!previousUser,
        hasProfile: !!previousUser?.profile
      },
      {
        userId,
        email,
        method,
        hasSession: true,
        hasProfile: false
      },
      { trigger: 'user_login' }
    )
  },

  logLogout: (userId: string, cleanupComplete: boolean, storageCleared: string[]) => {
    getAuthDiagnostics().logTransition(
      'LOGOUT',
      {
        userId,
        hasSession: true,
        hasProfile: true
      },
      {
        userId: undefined,
        hasSession: false,
        hasProfile: false
      },
      {
        trigger: 'user_logout',
        cleanupComplete,
        storageCleared
      }
    )
  },

  logSessionExpiration: (userId: string, reason: string) => {
    getAuthDiagnostics().logTransition(
      'SESSION_EXPIRE',
      {
        userId,
        hasSession: true,
        hasProfile: true
      },
      {
        userId: undefined,
        hasSession: false,
        hasProfile: false
      },
      {
        trigger: reason,
        error: 'Session expired'
      }
    )
  },

  logMethodSwitch: (fromMethod: string, toMethod: string, userId?: string) => {
    getAuthDiagnostics().logTransition(
      'METHOD_SWITCH',
      {
        method: fromMethod,
        userId,
        hasSession: !!userId,
        hasProfile: !!userId
      },
      {
        method: toMethod,
        userId: undefined,
        hasSession: false,
        hasProfile: false
      },
      {
        trigger: 'auth_method_change'
      }
    )
  },

  trackSessionValidation: (
    hasSupabaseSession: boolean,
    hasStoreUser: boolean,
    hasStoreProfile: boolean,
    signOutInProgress: boolean
  ) => {
    return getAuthDiagnostics().trackSessionValidation(
      hasSupabaseSession,
      hasStoreUser,
      hasStoreProfile,
      signOutInProgress
    )
  },

  detectStaleData: (
    currentUserId: string | null,
    currentEmail: string | null,
    displayedUserId: string | null,
    displayedEmail: string | null
  ) => {
    return getAuthDiagnostics().detectStaleData(
      currentUserId,
      currentEmail,
      displayedUserId,
      displayedEmail
    )
  },

  trackCleanup: (cleanupSteps: any) => {
    return getAuthDiagnostics().trackCleanup(cleanupSteps)
  },

  getSummary: () => {
    return getAuthDiagnostics().getSummary()
  },

  exportDiagnostics: () => {
    return getAuthDiagnostics().exportDiagnostics()
  }
}

// Auto-export diagnostics to console in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).authDiagnosticsAPI = authDiagnostics
  (window as any).getAuthDiagnosticsSummary = () => {
    const summary = authDiagnostics.getSummary()
    console.table(summary.recentIssues)
    console.log('Current State:', summary.currentState)
    console.log('Contamination Detected:', summary.sessionContaminationDetected)
    console.log('Incomplete Logouts:', summary.incompleteLogouts)
    return summary
  }
  
  console.log('🔍 Auth Diagnostics enabled. Use window.getAuthDiagnosticsSummary() to view issues')
}