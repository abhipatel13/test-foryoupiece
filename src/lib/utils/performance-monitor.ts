'use client'

/**
 * Performance monitoring utility for admin interface components
 * Tracks loading times, errors, and resource usage
 */

interface PerformanceMetric {
  name: string
  startTime: number
  endTime?: number
  duration?: number
  metadata?: Record<string, any>
  error?: string
}

interface ComponentMetrics {
  [componentName: string]: {
    loadTimes: number[]
    errorCount: number
    lastError?: string
    averageLoadTime: number
    maxLoadTime: number
    minLoadTime: number
  }
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map()
  private componentMetrics: ComponentMetrics = {}
  private errorLog: Array<{ timestamp: number; error: string; component: string }> = []
  private maxLogSize = 100

  /**
   * Start tracking a performance metric
   */
  startMetric(name: string, metadata?: Record<string, any>): string {
    const metricId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    this.metrics.set(metricId, {
      name,
      startTime: performance.now(),
      metadata
    })

    return metricId
  }

  /**
   * End tracking a performance metric
   */
  endMetric(metricId: string, error?: string): PerformanceMetric | null {
    const metric = this.metrics.get(metricId)
    if (!metric) return null

    const endTime = performance.now()
    const duration = endTime - metric.startTime

    metric.endTime = endTime
    metric.duration = duration
    if (error) metric.error = error

    // Update component metrics
    this.updateComponentMetrics(metric.name, duration, error)

    // Log slow operations (> 1 second)
    if (duration > 1000) {
      console.warn(`🐌 Slow operation detected: ${metric.name} took ${duration.toFixed(2)}ms`, metric.metadata)
    }

    // Log errors
    if (error) {
      this.logError(metric.name, error)
      console.error(`❌ Performance metric error: ${metric.name}`, error)
    }

    this.metrics.delete(metricId)
    return metric
  }

  /**
   * Update component-specific metrics
   */
  private updateComponentMetrics(componentName: string, duration: number, error?: string) {
    if (!this.componentMetrics[componentName]) {
      this.componentMetrics[componentName] = {
        loadTimes: [],
        errorCount: 0,
        averageLoadTime: 0,
        maxLoadTime: 0,
        minLoadTime: Infinity
      }
    }

    const metrics = this.componentMetrics[componentName]
    
    if (!error) {
      metrics.loadTimes.push(duration)
      
      // Keep only last 50 measurements
      if (metrics.loadTimes.length > 50) {
        metrics.loadTimes.shift()
      }

      // Update statistics
      metrics.averageLoadTime = metrics.loadTimes.reduce((a, b) => a + b, 0) / metrics.loadTimes.length
      metrics.maxLoadTime = Math.max(metrics.maxLoadTime, duration)
      metrics.minLoadTime = Math.min(metrics.minLoadTime, duration)
    } else {
      metrics.errorCount++
      metrics.lastError = error
    }
  }

  /**
   * Log error with timestamp
   */
  private logError(component: string, error: string) {
    this.errorLog.push({
      timestamp: Date.now(),
      error,
      component
    })

    // Keep log size manageable
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift()
    }
  }

  /**
   * Get performance statistics
   */
  getStats() {
    return {
      componentMetrics: { ...this.componentMetrics },
      activeMetrics: this.metrics.size,
      recentErrors: this.errorLog.slice(-10),
      totalErrors: this.errorLog.length
    }
  }

  /**
   * Get component-specific statistics
   */
  getComponentStats(componentName: string) {
    return this.componentMetrics[componentName] || null
  }

  /**
   * Clear all metrics
   */
  clearMetrics() {
    this.metrics.clear()
    this.componentMetrics = {}
    this.errorLog = []
  }

  /**
   * Track React component render performance
   */
  trackComponentRender<T>(componentName: string, renderFn: () => T): T {
    const metricId = this.startMetric(`${componentName}_render`)
    
    try {
      const result = renderFn()
      this.endMetric(metricId)
      return result
    } catch (error) {
      this.endMetric(metricId, error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }

  /**
   * Track async operations
   */
  async trackAsyncOperation<T>(operationName: string, operation: () => Promise<T>): Promise<T> {
    const metricId = this.startMetric(operationName)
    
    try {
      const result = await operation()
      this.endMetric(metricId)
      return result
    } catch (error) {
      this.endMetric(metricId, error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }

  /**
   * Track API calls
   */
  async trackApiCall<T>(endpoint: string, apiCall: () => Promise<T>): Promise<T> {
    const metricId = this.startMetric(`api_${endpoint}`, { endpoint })
    
    try {
      const result = await apiCall()
      this.endMetric(metricId)
      return result
    } catch (error) {
      this.endMetric(metricId, error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }

  /**
   * Get memory usage information
   */
  getMemoryUsage() {
    if (typeof window === 'undefined' || !(performance as any).memory) {
      return null
    }

    const memory = (performance as any).memory
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      usedPercentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
    }
  }

  /**
   * Check for memory leaks
   */
  checkMemoryLeaks() {
    const memory = this.getMemoryUsage()
    if (!memory) return false

    // Alert if memory usage is above 80%
    if (memory.usedPercentage > 80) {
      console.warn('🚨 High memory usage detected:', memory)
      return true
    }

    return false
  }

  /**
   * Generate performance report
   */
  generateReport() {
    const stats = this.getStats()
    const memory = this.getMemoryUsage()
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalComponents: Object.keys(stats.componentMetrics).length,
        activeMetrics: stats.activeMetrics,
        totalErrors: stats.totalErrors,
        memoryUsage: memory
      },
      componentPerformance: Object.entries(stats.componentMetrics).map(([name, metrics]) => ({
        component: name,
        averageLoadTime: Math.round(metrics.averageLoadTime),
        maxLoadTime: Math.round(metrics.maxLoadTime),
        minLoadTime: Math.round(metrics.minLoadTime),
        errorCount: metrics.errorCount,
        lastError: metrics.lastError,
        samples: metrics.loadTimes.length
      })),
      recentErrors: stats.recentErrors,
      recommendations: this.generateRecommendations(stats)
    }

    console.log('📊 Performance Report:', report)
    return report
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(stats: any): string[] {
    const recommendations: string[] = []

    // Check for slow components
    Object.entries(stats.componentMetrics).forEach(([name, metrics]: [string, any]) => {
      if (metrics.averageLoadTime > 500) {
        recommendations.push(`Consider optimizing ${name} - average load time: ${Math.round(metrics.averageLoadTime)}ms`)
      }
      
      if (metrics.errorCount > 5) {
        recommendations.push(`High error rate in ${name} - ${metrics.errorCount} errors detected`)
      }
    })

    // Check memory usage
    const memory = this.getMemoryUsage()
    if (memory && memory.usedPercentage > 70) {
      recommendations.push(`High memory usage detected: ${Math.round(memory.usedPercentage)}%`)
    }

    // Check for too many active metrics (potential memory leak)
    if (stats.activeMetrics > 20) {
      recommendations.push(`Too many active metrics: ${stats.activeMetrics} - potential memory leak`)
    }

    return recommendations
  }
}

// Singleton instance
let performanceMonitorInstance: PerformanceMonitor | null = null

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!performanceMonitorInstance) {
    performanceMonitorInstance = new PerformanceMonitor()
    
    // Set up periodic reporting in development
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      setInterval(() => {
        performanceMonitorInstance?.checkMemoryLeaks()
      }, 30000) // Check every 30 seconds
    }
  }
  return performanceMonitorInstance
}

// Utility functions
export const performanceUtils = {
  trackComponentRender: <T>(componentName: string, renderFn: () => T) => 
    getPerformanceMonitor().trackComponentRender(componentName, renderFn),
    
  trackAsyncOperation: <T>(operationName: string, operation: () => Promise<T>) => 
    getPerformanceMonitor().trackAsyncOperation(operationName, operation),
    
  trackApiCall: <T>(endpoint: string, apiCall: () => Promise<T>) => 
    getPerformanceMonitor().trackApiCall(endpoint, apiCall),
    
  generateReport: () => getPerformanceMonitor().generateReport(),
  
  getStats: () => getPerformanceMonitor().getStats(),
  
  clearMetrics: () => getPerformanceMonitor().clearMetrics()
}
