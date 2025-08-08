'use client'

import React from 'react'

/**
 * Multi-tab synchronization utility for authentication state
 * Prevents race conditions and resource conflicts between tabs
 */

interface TabSyncMessage {
  type: 'AUTH_STATE_CHANGE' | 'ADMIN_STATUS_CHANGE' | 'PROFILE_UPDATE' | 'CACHE_INVALIDATE' | 'SESSION_EXPIRED' | 'SESSION_VALIDATED'
  payload: any
  timestamp: number
  tabId: string
}

interface TabSyncOptions {
  onAuthStateChange?: (payload: any) => void
  onAdminStatusChange?: (payload: any) => void
  onProfileUpdate?: (payload: any) => void
  onCacheInvalidate?: (payload: any) => void
  onSessionExpired?: (payload: any) => void
  onSessionValidated?: (payload: any) => void
}

class MultiTabSync {
  private tabId: string
  private channel: BroadcastChannel | null = null
  private listeners: TabSyncOptions = {}
  private isInitialized = false

  constructor() {
    this.tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.initialize()
  }

  private initialize() {
    if (typeof window === 'undefined' || this.isInitialized) return

    try {
      // Use BroadcastChannel for modern browsers
      if ('BroadcastChannel' in window) {
        this.channel = new BroadcastChannel('foryoupiece_tab_sync')
        this.channel.addEventListener('message', this.handleMessage.bind(this))
      } else {
        // Fallback to localStorage events for older browsers
        window.addEventListener('storage', this.handleStorageEvent.bind(this))
      }

      this.isInitialized = true
      console.log('🔄 Multi-tab sync initialized:', this.tabId)
    } catch (error) {
      console.error('❌ Failed to initialize multi-tab sync:', error)
    }
  }

  private handleMessage(event: MessageEvent<TabSyncMessage>) {
    try {
      const data = event && (event as any).data
      if (!data || typeof data !== 'object') return

      const { type, payload, tabId } = data as any
      if (!type || typeof type !== 'string') return

      // Ignore messages from the same tab
      if (tabId === this.tabId) return

      console.log('📨 Received tab sync message:', { type, tabId })

      switch (type) {
        case 'AUTH_STATE_CHANGE':
          this.listeners.onAuthStateChange?.(payload)
          break
        case 'ADMIN_STATUS_CHANGE':
          this.listeners.onAdminStatusChange?.(payload)
          break
        case 'PROFILE_UPDATE':
          this.listeners.onProfileUpdate?.(payload)
          break
        case 'CACHE_INVALIDATE':
          this.listeners.onCacheInvalidate?.(payload)
          break
        case 'SESSION_EXPIRED':
          this.listeners.onSessionExpired?.(payload)
          break
        case 'SESSION_VALIDATED':
          this.listeners.onSessionValidated?.(payload)
          break
        default:
          // Unknown message type - ignore
          break
      }
    } catch (err) {
      console.error('❌ Multi-tab sync handleMessage error:', err)
    }
  }

  private handleStorageEvent(event: StorageEvent) {
    if (event.key !== 'foryoupiece_tab_sync' || !event.newValue) return

    try {
      const message: TabSyncMessage = JSON.parse(event.newValue)
      this.handleMessage({ data: message } as MessageEvent<TabSyncMessage>)
    } catch (error) {
      console.error('❌ Failed to parse storage sync message:', error)
    }
  }

  public setListeners(options: TabSyncOptions) {
    this.listeners = { ...this.listeners, ...options }
  }

  public broadcast(type: TabSyncMessage['type'], payload: any) {
    if (!this.isInitialized) return

    const message: TabSyncMessage = {
      type,
      payload,
      timestamp: Date.now(),
      tabId: this.tabId
    }

    try {
      if (this.channel) {
        this.channel.postMessage(message)
      } else {
        // Fallback to localStorage
        localStorage.setItem('foryoupiece_tab_sync', JSON.stringify(message))
        // Clear after a short delay to trigger storage event
        setTimeout(() => {
          localStorage.removeItem('foryoupiece_tab_sync')
        }, 100)
      }

      console.log('📤 Broadcasted tab sync message:', { type, tabId: this.tabId })
    } catch (error) {
      console.error('❌ Failed to broadcast tab sync message:', error)
    }
  }

  public destroy() {
    try {
      if (this.channel) {
        this.channel.close()
        this.channel = null
      } else {
        window.removeEventListener('storage', this.handleStorageEvent.bind(this))
      }

      this.isInitialized = false
      console.log('🔄 Multi-tab sync destroyed:', this.tabId)
    } catch (error) {
      console.error('❌ Failed to destroy multi-tab sync:', error)
    }
  }
}

// Singleton instance
let tabSyncInstance: MultiTabSync | null = null

export function getTabSync(): MultiTabSync {
  if (!tabSyncInstance) {
    tabSyncInstance = new MultiTabSync()
  }
  return tabSyncInstance
}

export function destroyTabSync() {
  if (tabSyncInstance) {
    tabSyncInstance.destroy()
    tabSyncInstance = null
  }
}

/**
 * React hook for multi-tab synchronization
 */
export function useMultiTabSync(options: TabSyncOptions) {
  const tabSync = getTabSync()

  React.useEffect(() => {
    tabSync.setListeners(options)

    return () => {
      // Clean up listeners when component unmounts
      tabSync.setListeners({})
    }
  }, [tabSync, options])

  return {
    broadcast: tabSync.broadcast.bind(tabSync),
    tabId: (tabSync as any).tabId
  }
}

// Utility functions for common sync operations
export const tabSyncUtils = {
  broadcastAuthChange: (user: any) => {
    getTabSync().broadcast('AUTH_STATE_CHANGE', { user })
  },

  broadcastAdminStatusChange: (isAdmin: boolean, adminUser: any) => {
    getTabSync().broadcast('ADMIN_STATUS_CHANGE', { isAdmin, adminUser })
  },

  broadcastProfileUpdate: (profile: any) => {
    getTabSync().broadcast('PROFILE_UPDATE', { profile })
  },

  broadcastCacheInvalidate: (keys: string[]) => {
    getTabSync().broadcast('CACHE_INVALIDATE', { keys })
  },

  broadcastSessionExpired: (reason?: string) => {
    getTabSync().broadcast('SESSION_EXPIRED', { reason, timestamp: Date.now() })
  },

  broadcastSessionValidated: (userId: string) => {
    getTabSync().broadcast('SESSION_VALIDATED', { userId, timestamp: Date.now() })
  }
}
