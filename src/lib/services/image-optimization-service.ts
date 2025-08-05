/**
 * Image Optimization Service for ForYouPiece
 * Handles image loading, caching, and optimization strategies
 */

interface ImageCacheEntry {
  url: string
  timestamp: number
  loaded: boolean
  error?: boolean
}

interface ImageOptimizationOptions {
  quality?: number
  format?: 'webp' | 'jpeg' | 'png'
  width?: number
  height?: number
  priority?: boolean
}

class ImageOptimizationService {
  private cache = new Map<string, ImageCacheEntry>()
  private loadingPromises = new Map<string, Promise<boolean>>()
  private preloadQueue: string[] = []
  private isProcessingQueue = false
  private readonly CACHE_TTL = 30 * 60 * 1000 // 30 minutes
  private readonly MAX_CONCURRENT_LOADS = 3

  /**
   * Optimize image URL with Next.js Image optimization parameters
   */
  optimizeImageUrl(src: string, options: ImageOptimizationOptions = {}): string {
    if (!src || src.startsWith('data:')) return src

    const {
      quality = 75,
      format = 'webp',
      width,
      height
    } = options

    // For external URLs, use Next.js image optimization
    if (src.startsWith('http')) {
      const params = new URLSearchParams()
      params.set('url', src)
      params.set('q', quality.toString())
      
      if (width) params.set('w', width.toString())
      if (height) params.set('h', height.toString())
      
      return `/_next/image?${params.toString()}`
    }

    return src
  }

  /**
   * Preload image with caching and deduplication
   */
  async preloadImage(src: string, priority: boolean = false): Promise<boolean> {
    if (!src || typeof window === 'undefined') return false

    const cacheKey = src
    const cached = this.cache.get(cacheKey)

    // Return cached result if available and not expired
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.loaded && !cached.error
    }

    // Return existing promise if already loading
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey)!
    }

    // Create loading promise
    const loadingPromise = this.loadImagePromise(src)
    this.loadingPromises.set(cacheKey, loadingPromise)

    try {
      const success = await loadingPromise
      
      // Cache the result
      this.cache.set(cacheKey, {
        url: src,
        timestamp: Date.now(),
        loaded: success,
        error: !success
      })

      return success
    } finally {
      this.loadingPromises.delete(cacheKey)
    }
  }

  /**
   * Load image using Image constructor
   */
  private loadImagePromise(src: string): Promise<boolean> {
    return new Promise((resolve) => {
      const img = new Image()
      
      img.onload = () => resolve(true)
      img.onerror = () => resolve(false)
      
      // Set timeout to prevent hanging
      setTimeout(() => resolve(false), 10000)
      
      img.src = src
    })
  }

  /**
   * Batch preload images with queue management
   */
  async preloadImages(srcs: string[], priority: boolean = false): Promise<void> {
    if (!srcs.length) return

    // Add to queue
    this.preloadQueue.push(...srcs.filter(src => src && !this.cache.has(src)))

    // Process queue if not already processing
    if (!this.isProcessingQueue) {
      this.processPreloadQueue(priority)
    }
  }

  /**
   * Process preload queue with concurrency control
   */
  private async processPreloadQueue(priority: boolean = false): Promise<void> {
    if (this.isProcessingQueue || !this.preloadQueue.length) return

    this.isProcessingQueue = true

    try {
      while (this.preloadQueue.length > 0) {
        // Take batch of images to load concurrently
        const batch = this.preloadQueue.splice(0, this.MAX_CONCURRENT_LOADS)
        
        // Load batch concurrently
        await Promise.allSettled(
          batch.map(src => this.preloadImage(src, priority))
        )

        // Small delay between batches to prevent overwhelming the browser
        if (this.preloadQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
    } finally {
      this.isProcessingQueue = false
    }
  }

  /**
   * Get optimized sizes string for responsive images
   */
  getResponsiveSizes(breakpoints: { [key: string]: string } = {}): string {
    const defaultBreakpoints = {
      '(max-width: 640px)': '50vw',
      '(max-width: 768px)': '33vw',
      '(max-width: 1024px)': '25vw',
      ...breakpoints
    }

    const sizes = Object.entries(defaultBreakpoints)
      .map(([query, size]) => `${query} ${size}`)
      .join(', ')

    return `${sizes}, 20vw`
  }

  /**
   * Generate blur placeholder data URL
   */
  generateBlurPlaceholder(width: number = 8, height: number = 8, color: string = '#f3f4f6'): string {
    if (typeof window === 'undefined') {
      // Server-side fallback
      return `data:image/svg+xml;base64,${btoa(
        `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="${color}"/></svg>`
      )}`
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')

    if (ctx) {
      ctx.fillStyle = color
      ctx.fillRect(0, 0, width, height)
    }

    return canvas.toDataURL('image/jpeg', 0.1)
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const total = this.cache.size
    const loaded = Array.from(this.cache.values()).filter(entry => entry.loaded).length
    const errors = Array.from(this.cache.values()).filter(entry => entry.error).length

    return {
      total,
      loaded,
      errors,
      hitRate: total > 0 ? (loaded / total) * 100 : 0
    }
  }

  /**
   * Preload critical images for the current page
   */
  preloadCriticalImages(images: string[]): void {
    // Preload first 3 images immediately with high priority
    const criticalImages = images.slice(0, 3)
    this.preloadImages(criticalImages, true)

    // Queue remaining images for background loading
    const remainingImages = images.slice(3)
    if (remainingImages.length > 0) {
      // Use requestIdleCallback for non-critical images
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          this.preloadImages(remainingImages, false)
        })
      } else {
        setTimeout(() => {
          this.preloadImages(remainingImages, false)
        }, 1000)
      }
    }
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.cache.clear()
    this.loadingPromises.clear()
    this.preloadQueue.length = 0
    this.isProcessingQueue = false
  }
}

// Export singleton instance
export const imageOptimizationService = new ImageOptimizationService()

// Auto cleanup expired cache every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    imageOptimizationService.clearExpiredCache()
  }, 5 * 60 * 1000)
}
