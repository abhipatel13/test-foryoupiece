'use client'

/**
 * Browser compatibility utilities for cross-browser support
 * Handles differences between Chrome, Firefox, Safari, and Edge
 */

interface BrowserInfo {
  name: string
  version: string
  isChrome: boolean
  isFirefox: boolean
  isSafari: boolean
  isEdge: boolean
  isMobile: boolean
  supportsWebP: boolean
  supportsBroadcastChannel: boolean
  supportsAbortController: boolean
}

class BrowserCompatibility {
  private browserInfo: BrowserInfo | null = null

  /**
   * Detect browser information
   */
  private detectBrowser(): BrowserInfo {
    if (typeof window === 'undefined') {
      return {
        name: 'unknown',
        version: '0',
        isChrome: false,
        isFirefox: false,
        isSafari: false,
        isEdge: false,
        isMobile: false,
        supportsWebP: false,
        supportsBroadcastChannel: false,
        supportsAbortController: false
      }
    }

    const userAgent = navigator.userAgent
    let name = 'unknown'
    let version = '0'

    // Detect browser
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      name = 'chrome'
      const match = userAgent.match(/Chrome\/(\d+)/)
      version = match ? match[1] : '0'
    } else if (userAgent.includes('Firefox')) {
      name = 'firefox'
      const match = userAgent.match(/Firefox\/(\d+)/)
      version = match ? match[1] : '0'
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      name = 'safari'
      const match = userAgent.match(/Version\/(\d+)/)
      version = match ? match[1] : '0'
    } else if (userAgent.includes('Edg')) {
      name = 'edge'
      const match = userAgent.match(/Edg\/(\d+)/)
      version = match ? match[1] : '0'
    }

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)

    return {
      name,
      version,
      isChrome: name === 'chrome',
      isFirefox: name === 'firefox',
      isSafari: name === 'safari',
      isEdge: name === 'edge',
      isMobile,
      supportsWebP: this.checkWebPSupport(),
      supportsBroadcastChannel: 'BroadcastChannel' in window,
      supportsAbortController: 'AbortController' in window
    }
  }

  /**
   * Check WebP support
   */
  private checkWebPSupport(): boolean {
    if (typeof window === 'undefined') return false

    try {
      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1
      return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0
    } catch {
      return false
    }
  }

  /**
   * Get browser information
   */
  getBrowserInfo(): BrowserInfo {
    if (!this.browserInfo) {
      this.browserInfo = this.detectBrowser()
    }
    return this.browserInfo
  }

  /**
   * Create fetch with browser-specific optimizations
   */
  createOptimizedFetch() {
    const browserInfo = this.getBrowserInfo()

    return async (url: string, options: RequestInit = {}) => {
      const optimizedOptions: RequestInit = { ...options }

      // Browser-specific optimizations
      if (browserInfo.isFirefox) {
        // Firefox-specific optimizations
        optimizedOptions.cache = optimizedOptions.cache || 'default'
      } else if (browserInfo.isSafari) {
        // Safari-specific optimizations
        optimizedOptions.credentials = optimizedOptions.credentials || 'same-origin'
      } else if (browserInfo.isChrome) {
        // Chrome-specific optimizations
        optimizedOptions.keepalive = false // Remove keepalive for compatibility
      }

      // Remove problematic headers for older browsers
      if (optimizedOptions.headers) {
        const headers = new Headers(optimizedOptions.headers)
        
        // Remove Connection header (not allowed in fetch)
        headers.delete('Connection')
        
        optimizedOptions.headers = headers
      }

      // Add timeout support for browsers that don't support AbortController
      if (!browserInfo.supportsAbortController && !optimizedOptions.signal) {
        const timeoutMs = 30000 // 30 seconds default timeout
        
        return new Promise<Response>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Request timeout'))
          }, timeoutMs)

          fetch(url, optimizedOptions)
            .then(response => {
              clearTimeout(timeoutId)
              resolve(response)
            })
            .catch(error => {
              clearTimeout(timeoutId)
              reject(error)
            })
        })
      }

      return fetch(url, optimizedOptions)
    }
  }

  /**
   * Create storage with fallbacks
   */
  createStorage() {
    const browserInfo = this.getBrowserInfo()

    return {
      setItem: (key: string, value: string) => {
        try {
          localStorage.setItem(key, value)
        } catch (error) {
          console.warn('localStorage not available, using memory storage')
          // Fallback to memory storage
          if (typeof window !== 'undefined') {
            (window as any).__memoryStorage = (window as any).__memoryStorage || {}
            ;(window as any).__memoryStorage[key] = value
          }
        }
      },

      getItem: (key: string): string | null => {
        try {
          return localStorage.getItem(key)
        } catch (error) {
          // Fallback to memory storage
          if (typeof window !== 'undefined' && (window as any).__memoryStorage) {
            return (window as any).__memoryStorage[key] || null
          }
          return null
        }
      },

      removeItem: (key: string) => {
        try {
          localStorage.removeItem(key)
        } catch (error) {
          // Fallback to memory storage
          if (typeof window !== 'undefined' && (window as any).__memoryStorage) {
            delete (window as any).__memoryStorage[key]
          }
        }
      }
    }
  }

  /**
   * Add browser-specific polyfills
   */
  addPolyfills() {
    if (typeof window === 'undefined') return

    const browserInfo = this.getBrowserInfo()

    // AbortController polyfill for older browsers
    if (!browserInfo.supportsAbortController) {
      console.log('Adding AbortController polyfill')
      
      class AbortControllerPolyfill {
        signal: any
        
        constructor() {
          this.signal = {
            aborted: false,
            addEventListener: () => {},
            removeEventListener: () => {}
          }
        }
        
        abort() {
          this.signal.aborted = true
        }
      }
      
      ;(window as any).AbortController = AbortControllerPolyfill
    }

    // BroadcastChannel polyfill for older browsers
    if (!browserInfo.supportsBroadcastChannel) {
      console.log('Adding BroadcastChannel polyfill')
      
      class BroadcastChannelPolyfill extends EventTarget {
        name: string
        
        constructor(name: string) {
          super()
          this.name = name
          
          // Use storage events as fallback
          window.addEventListener('storage', (event) => {
            if (event.key === `broadcast_${name}` && event.newValue) {
              try {
                const data = JSON.parse(event.newValue)
                this.dispatchEvent(new MessageEvent('message', { data }))
              } catch (error) {
                console.error('BroadcastChannel polyfill error:', error)
              }
            }
          })
        }
        
        postMessage(data: any) {
          const message = JSON.stringify(data)
          localStorage.setItem(`broadcast_${this.name}`, message)
          // Remove after short delay to trigger storage event
          setTimeout(() => {
            localStorage.removeItem(`broadcast_${this.name}`)
          }, 100)
        }
        
        close() {
          // Cleanup if needed
        }
      }
      
      ;(window as any).BroadcastChannel = BroadcastChannelPolyfill
    }

    // Add CSS.supports polyfill for older browsers
    if (!('CSS' in window) || !('supports' in (window as any).CSS)) {
      ;(window as any).CSS = (window as any).CSS || {}
      ;(window as any).CSS.supports = () => false
    }
  }

  /**
   * Get browser-specific CSS classes
   */
  getBrowserClasses(): string[] {
    const browserInfo = this.getBrowserInfo()
    const classes: string[] = []

    classes.push(`browser-${browserInfo.name}`)
    classes.push(`browser-version-${browserInfo.version}`)

    if (browserInfo.isMobile) {
      classes.push('is-mobile')
    }

    if (!browserInfo.supportsWebP) {
      classes.push('no-webp')
    }

    return classes
  }
}

// Singleton instance
let compatibilityInstance: BrowserCompatibility | null = null

export function getBrowserCompatibility(): BrowserCompatibility {
  if (!compatibilityInstance) {
    compatibilityInstance = new BrowserCompatibility()
    
    // Add polyfills on first access
    if (typeof window !== 'undefined') {
      compatibilityInstance.addPolyfills()
    }
  }
  return compatibilityInstance
}

// Utility functions
export const browserUtils = {
  getBrowserInfo: () => getBrowserCompatibility().getBrowserInfo(),
  createOptimizedFetch: () => getBrowserCompatibility().createOptimizedFetch(),
  createStorage: () => getBrowserCompatibility().createStorage(),
  getBrowserClasses: () => getBrowserCompatibility().getBrowserClasses(),
  
  // Quick browser checks
  isChrome: () => getBrowserCompatibility().getBrowserInfo().isChrome,
  isFirefox: () => getBrowserCompatibility().getBrowserInfo().isFirefox,
  isSafari: () => getBrowserCompatibility().getBrowserInfo().isSafari,
  isEdge: () => getBrowserCompatibility().getBrowserInfo().isEdge,
  isMobile: () => getBrowserCompatibility().getBrowserInfo().isMobile
}
