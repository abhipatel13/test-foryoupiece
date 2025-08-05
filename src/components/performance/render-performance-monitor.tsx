'use client'

import { useEffect, useRef, useState } from 'react'

interface RenderMetrics {
  componentName: string
  renderCount: number
  lastRenderTime: number
  averageRenderTime: number
  totalRenderTime: number
  slowRenders: number
}

interface RenderPerformanceMonitorProps {
  componentName: string
  enabled?: boolean
  slowThreshold?: number
  onSlowRender?: (metrics: RenderMetrics) => void
  children: React.ReactNode
}

export function RenderPerformanceMonitor({
  componentName,
  enabled = process.env.NODE_ENV === 'development',
  slowThreshold = 16, // 16ms = 60fps threshold
  onSlowRender,
  children
}: RenderPerformanceMonitorProps) {
  const renderStartTime = useRef<number>(0)
  const metricsRef = useRef<RenderMetrics>({
    componentName,
    renderCount: 0,
    lastRenderTime: 0,
    averageRenderTime: 0,
    totalRenderTime: 0,
    slowRenders: 0
  })

  // Start timing before render
  if (enabled) {
    renderStartTime.current = performance.now()
  }

  useEffect(() => {
    if (!enabled) return

    const endTime = performance.now()
    const renderTime = endTime - renderStartTime.current
    const metrics = metricsRef.current

    // Update metrics
    metrics.renderCount++
    metrics.lastRenderTime = renderTime
    metrics.totalRenderTime += renderTime
    metrics.averageRenderTime = metrics.totalRenderTime / metrics.renderCount

    // Track slow renders
    if (renderTime > slowThreshold) {
      metrics.slowRenders++
      console.warn(`🐌 Slow render detected: ${componentName} took ${renderTime.toFixed(2)}ms`)
      onSlowRender?.(metrics)
    }

    // Log metrics periodically (every 10 renders)
    if (metrics.renderCount % 10 === 0) {
      console.log(`📊 Render Performance: ${componentName}`, {
        renders: metrics.renderCount,
        avgTime: `${metrics.averageRenderTime.toFixed(2)}ms`,
        slowRenders: metrics.slowRenders,
        slowRenderRate: `${((metrics.slowRenders / metrics.renderCount) * 100).toFixed(1)}%`
      })
    }
  })

  return <>{children}</>
}

// Hook for component-level performance monitoring
export function useRenderPerformance(
  componentName: string,
  enabled: boolean = process.env.NODE_ENV === 'development'
) {
  const renderCountRef = useRef(0)
  const renderTimesRef = useRef<number[]>([])
  const lastRenderTimeRef = useRef<number>(0)

  useEffect(() => {
    if (!enabled) return

    const endTime = performance.now()
    const renderTime = endTime - lastRenderTimeRef.current
    
    if (lastRenderTimeRef.current > 0) {
      renderCountRef.current++
      renderTimesRef.current.push(renderTime)
      
      // Keep only last 50 render times for average calculation
      if (renderTimesRef.current.length > 50) {
        renderTimesRef.current.shift()
      }

      // Log slow renders
      if (renderTime > 16) {
        console.warn(`🐌 ${componentName} slow render: ${renderTime.toFixed(2)}ms`)
      }
    }

    lastRenderTimeRef.current = performance.now()
  })

  const getMetrics = () => {
    const times = renderTimesRef.current
    const avgTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0
    const slowRenders = times.filter(time => time > 16).length

    return {
      componentName,
      renderCount: renderCountRef.current,
      averageRenderTime: avgTime,
      slowRenders,
      slowRenderRate: renderCountRef.current > 0 ? (slowRenders / renderCountRef.current) * 100 : 0
    }
  }

  return { getMetrics }
}

// Performance profiler for measuring component trees
export function PerformanceProfiler({
  id,
  onRender,
  children
}: {
  id: string
  onRender?: (id: string, phase: 'mount' | 'update', actualDuration: number) => void
  children: React.ReactNode
}) {
  const [renderCount, setRenderCount] = useState(0)
  const mountTimeRef = useRef<number>(0)

  useEffect(() => {
    mountTimeRef.current = performance.now()
  }, [])

  useEffect(() => {
    const renderTime = performance.now() - mountTimeRef.current
    const phase = renderCount === 0 ? 'mount' : 'update'
    
    setRenderCount(prev => prev + 1)
    
    if (onRender) {
      onRender(id, phase, renderTime)
    }

    // Log performance in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`⚡ ${id} ${phase}: ${renderTime.toFixed(2)}ms`)
    }

    mountTimeRef.current = performance.now()
  })

  return <>{children}</>
}

// Global performance metrics collector
class PerformanceMetricsCollector {
  private metrics = new Map<string, RenderMetrics>()
  private enabled = process.env.NODE_ENV === 'development'

  recordRender(componentName: string, renderTime: number) {
    if (!this.enabled) return

    const existing = this.metrics.get(componentName) || {
      componentName,
      renderCount: 0,
      lastRenderTime: 0,
      averageRenderTime: 0,
      totalRenderTime: 0,
      slowRenders: 0
    }

    existing.renderCount++
    existing.lastRenderTime = renderTime
    existing.totalRenderTime += renderTime
    existing.averageRenderTime = existing.totalRenderTime / existing.renderCount

    if (renderTime > 16) {
      existing.slowRenders++
    }

    this.metrics.set(componentName, existing)
  }

  getMetrics(componentName?: string) {
    if (componentName) {
      return this.metrics.get(componentName)
    }
    return Array.from(this.metrics.values())
  }

  getSlowComponents(threshold: number = 16) {
    return Array.from(this.metrics.values())
      .filter(metric => metric.averageRenderTime > threshold)
      .sort((a, b) => b.averageRenderTime - a.averageRenderTime)
  }

  reset() {
    this.metrics.clear()
  }

  logSummary() {
    if (!this.enabled) return

    const allMetrics = Array.from(this.metrics.values())
    const slowComponents = this.getSlowComponents()

    console.group('📊 Render Performance Summary')
    console.table(allMetrics.map(m => ({
      Component: m.componentName,
      Renders: m.renderCount,
      'Avg Time (ms)': m.averageRenderTime.toFixed(2),
      'Slow Renders': m.slowRenders,
      'Slow Rate (%)': ((m.slowRenders / m.renderCount) * 100).toFixed(1)
    })))

    if (slowComponents.length > 0) {
      console.warn('🐌 Slow Components:', slowComponents)
    }
    console.groupEnd()
  }
}

export const performanceMetrics = new PerformanceMetricsCollector()

// Auto-log summary every 30 seconds in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  setInterval(() => {
    performanceMetrics.logSummary()
  }, 30000)
}
