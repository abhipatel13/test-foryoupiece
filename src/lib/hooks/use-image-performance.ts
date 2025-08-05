'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { imageOptimizationService } from '@/lib/services/image-optimization-service'

interface ImagePerformanceMetrics {
  loadTime: number
  size?: number
  format?: string
  cached: boolean
  error?: boolean
}

interface UseImagePerformanceOptions {
  trackMetrics?: boolean
  preload?: boolean
  priority?: boolean
  onLoad?: (metrics: ImagePerformanceMetrics) => void
  onError?: (error: Error) => void
}

export function useImagePerformance(
  src: string,
  options: UseImagePerformanceOptions = {}
) {
  const {
    trackMetrics = false,
    preload = false,
    priority = false,
    onLoad,
    onError
  } = options

  const [isLoading, setIsLoading] = useState(true)
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [metrics, setMetrics] = useState<ImagePerformanceMetrics | null>(null)
  
  const startTimeRef = useRef<number>(0)
  const imageRef = useRef<HTMLImageElement | null>(null)

  // Preload image if requested
  useEffect(() => {
    if (preload && src) {
      imageOptimizationService.preloadImage(src, priority)
    }
  }, [src, preload, priority])

  // Track image loading performance
  const handleImageLoad = useCallback((event?: Event) => {
    const endTime = performance.now()
    const loadTime = startTimeRef.current ? endTime - startTimeRef.current : 0

    const imageMetrics: ImagePerformanceMetrics = {
      loadTime,
      cached: loadTime < 50, // Assume cached if loads very quickly
      error: false
    }

    // Try to get additional metrics from the image element
    if (event?.target && 'naturalWidth' in event.target) {
      const img = event.target as HTMLImageElement
      imageMetrics.size = img.naturalWidth * img.naturalHeight
    }

    setMetrics(imageMetrics)
    setIsLoaded(true)
    setIsLoading(false)
    setHasError(false)

    if (trackMetrics) {
      console.log(`📊 Image Performance: ${src}`, imageMetrics)
    }

    onLoad?.(imageMetrics)
  }, [src, trackMetrics, onLoad])

  const handleImageError = useCallback((event?: Event) => {
    const endTime = performance.now()
    const loadTime = startTimeRef.current ? endTime - startTimeRef.current : 0

    const errorMetrics: ImagePerformanceMetrics = {
      loadTime,
      cached: false,
      error: true
    }

    setMetrics(errorMetrics)
    setIsLoaded(false)
    setIsLoading(false)
    setHasError(true)

    const error = new Error(`Failed to load image: ${src}`)
    
    if (trackMetrics) {
      console.warn(`⚠️ Image Load Error: ${src}`, errorMetrics)
    }

    onError?.(error)
  }, [src, trackMetrics, onError])

  // Create image element and track loading
  useEffect(() => {
    if (!src) return

    setIsLoading(true)
    setIsLoaded(false)
    setHasError(false)
    setMetrics(null)

    startTimeRef.current = performance.now()

    // Create image element for tracking
    const img = new Image()
    imageRef.current = img

    img.onload = handleImageLoad
    img.onerror = handleImageError

    // Set timeout to prevent hanging
    const timeout = setTimeout(() => {
      handleImageError()
    }, 10000)

    img.src = src

    return () => {
      clearTimeout(timeout)
      if (imageRef.current) {
        imageRef.current.onload = null
        imageRef.current.onerror = null
        imageRef.current = null
      }
    }
  }, [src, handleImageLoad, handleImageError])

  return {
    isLoading,
    isLoaded,
    hasError,
    metrics,
    // Helper functions
    preloadImage: (imageSrc: string) => imageOptimizationService.preloadImage(imageSrc, priority),
    preloadImages: (imageSrcs: string[]) => imageOptimizationService.preloadImages(imageSrcs, priority),
    getCacheStats: () => imageOptimizationService.getCacheStats()
  }
}

// Hook for batch image preloading
export function useImagePreloader() {
  const [preloadedImages, setPreloadedImages] = useState<Set<string>>(new Set())
  const [isPreloading, setIsPreloading] = useState(false)

  const preloadImages = useCallback(async (images: string[], priority: boolean = false) => {
    if (!images.length) return

    setIsPreloading(true)

    try {
      await imageOptimizationService.preloadImages(images, priority)
      
      setPreloadedImages(prev => {
        const newSet = new Set(prev)
        images.forEach(img => newSet.add(img))
        return newSet
      })
    } finally {
      setIsPreloading(false)
    }
  }, [])

  const preloadCriticalImages = useCallback((images: string[]) => {
    imageOptimizationService.preloadCriticalImages(images)
    
    setPreloadedImages(prev => {
      const newSet = new Set(prev)
      images.forEach(img => newSet.add(img))
      return newSet
    })
  }, [])

  const isImagePreloaded = useCallback((src: string) => {
    return preloadedImages.has(src)
  }, [preloadedImages])

  return {
    preloadImages,
    preloadCriticalImages,
    isImagePreloaded,
    isPreloading,
    preloadedCount: preloadedImages.size,
    getCacheStats: () => imageOptimizationService.getCacheStats()
  }
}

// Hook for responsive image sizes
export function useResponsiveImageSizes(breakpoints?: { [key: string]: string }) {
  return imageOptimizationService.getResponsiveSizes(breakpoints)
}

// Hook for image optimization
export function useImageOptimization() {
  const optimizeUrl = useCallback((src: string, options?: {
    quality?: number
    width?: number
    height?: number
    format?: 'webp' | 'jpeg' | 'png'
  }) => {
    return imageOptimizationService.optimizeImageUrl(src, options)
  }, [])

  const generateBlurPlaceholder = useCallback((
    width?: number,
    height?: number,
    color?: string
  ) => {
    return imageOptimizationService.generateBlurPlaceholder(width, height, color)
  }, [])

  return {
    optimizeUrl,
    generateBlurPlaceholder,
    getCacheStats: () => imageOptimizationService.getCacheStats()
  }
}
