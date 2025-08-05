'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  fill?: boolean
  className?: string
  sizes?: string
  priority?: boolean
  quality?: number
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
  onLoad?: () => void
  onError?: () => void
  lazy?: boolean
  threshold?: number
  fallbackSrc?: string
}

// Generate a simple blur placeholder
const generateBlurDataURL = (width: number = 8, height: number = 8) => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  
  if (ctx) {
    // Create a simple gradient blur effect
    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, '#f3f4f6')
    gradient.addColorStop(1, '#e5e7eb')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  }
  
  return canvas.toDataURL('image/jpeg', 0.1)
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  fill = false,
  className,
  sizes,
  priority = false,
  quality = 75,
  placeholder = 'blur',
  blurDataURL,
  onLoad,
  onError,
  lazy = true,
  threshold = 0.1,
  fallbackSrc,
  ...props
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [isInView, setIsInView] = useState(!lazy || priority)
  const [currentSrc, setCurrentSrc] = useState(src)
  const imgRef = useRef<HTMLDivElement>(null)

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!lazy || priority || isInView) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true)
            observer.disconnect()
          }
        })
      },
      {
        threshold,
        rootMargin: '50px', // Start loading 50px before the image comes into view
      }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => observer.disconnect()
  }, [lazy, priority, isInView, threshold])

  // Handle image load
  const handleLoad = () => {
    setIsLoaded(true)
    onLoad?.()
  }

  // Handle image error with fallback
  const handleError = () => {
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc)
      setHasError(false)
    } else {
      setHasError(true)
    }
    onError?.()
  }

  // Generate blur placeholder if not provided
  const defaultBlurDataURL = blurDataURL || (typeof window !== 'undefined' ? generateBlurDataURL() : undefined)

  // Don't render image until it's in view (for lazy loading)
  if (!isInView) {
    return (
      <div
        ref={imgRef}
        className={cn(
          'bg-gray-100 animate-pulse',
          fill ? 'absolute inset-0' : '',
          className
        )}
        style={
          !fill && width && height
            ? { width: `${width}px`, height: `${height}px` }
            : undefined
        }
      />
    )
  }

  // Error state
  if (hasError) {
    return (
      <div
        className={cn(
          'bg-gray-100 flex items-center justify-center text-gray-400',
          fill ? 'absolute inset-0' : '',
          className
        )}
        style={
          !fill && width && height
            ? { width: `${width}px`, height: `${height}px` }
            : undefined
        }
      >
        <div className="text-center">
          <svg
            className="w-8 h-8 mx-auto mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="text-xs">Image unavailable</span>
        </div>
      </div>
    )
  }

  return (
    <div ref={imgRef} className={fill ? 'relative' : undefined}>
      <Image
        src={currentSrc}
        alt={alt}
        width={width}
        height={height}
        fill={fill}
        className={cn(
          'transition-opacity duration-300',
          isLoaded ? 'opacity-100' : 'opacity-0',
          className
        )}
        sizes={sizes}
        priority={priority}
        quality={quality}
        placeholder={placeholder}
        blurDataURL={defaultBlurDataURL}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />
    </div>
  )
}

// Preload utility for critical images
export const preloadImage = (src: string, priority: boolean = false) => {
  if (typeof window === 'undefined') return

  const link = document.createElement('link')
  link.rel = priority ? 'preload' : 'prefetch'
  link.as = 'image'
  link.href = src
  
  // Add to head
  document.head.appendChild(link)
  
  // Clean up after a delay
  setTimeout(() => {
    if (document.head.contains(link)) {
      document.head.removeChild(link)
    }
  }, 10000)
}

// Batch preload utility
export const preloadImages = (srcs: string[], priority: boolean = false) => {
  srcs.forEach(src => preloadImage(src, priority))
}
