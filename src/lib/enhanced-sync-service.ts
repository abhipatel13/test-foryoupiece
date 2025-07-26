/**
 * Enhanced BoxHero Sync Service with Comprehensive Reporting
 * Provides detailed sync reporting, cache invalidation, and activity logging
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { boxHeroApi } from '@/lib/boxhero-api'
import { CategoriesService } from '@/lib/categories-service'

export interface SyncMetrics {
  before: {
    products: number
    categories: number
    totalStock: number
    lastSync: string | null
  }
  after: {
    products: number
    categories: number
    totalStock: number
    lastSync: string
  }
  changes: {
    productsAdded: number
    productsUpdated: number
    productsRemoved: number
    categoriesAdded: number
    categoriesUpdated: number
    categoriesRemoved: number
    inventoryAdjustments: number
  }
  performance: {
    duration: number
    apiCalls: number
    dataTransferredKB: number
    cacheInvalidations: number
  }
  errors: Array<{
    type: 'error' | 'warning'
    message: string
    details?: any
    timestamp: string
  }>
}

export interface SyncReport {
  id: string
  syncId: string
  status: 'started' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
  startedAt: string
  completedAt?: string
  duration?: number
  metrics: SyncMetrics
  triggeredBy: string
  syncOptions: any
}

export class EnhancedSyncService {
  private supabase = createServiceRoleClient()
  private currentSyncReport: SyncReport | null = null

  /**
   * Start a comprehensive sync with enhanced reporting
   */
  async startEnhancedSync(
    triggeredBy: string = 'manual',
    options: {
      syncImages?: boolean
      syncCategories?: boolean
      syncProducts?: boolean
      dryRun?: boolean
    } = {}
  ): Promise<SyncReport> {
    const startTime = Date.now()
    
    // Create initial sync log
    const { data: syncLog } = await this.supabase
      .from('sync_logs')
      .insert({
        sync_type: 'boxhero_enhanced',
        status: 'started',
        triggered_by: triggeredBy
      })
      .select()
      .single()

    if (!syncLog) {
      throw new Error('Failed to create sync log')
    }

    // Get before metrics
    const beforeMetrics = await this.getSystemMetrics()

    // Create enhanced sync report
    const syncReport: SyncReport = {
      id: crypto.randomUUID(),
      syncId: syncLog.id,
      status: 'started',
      startedAt: new Date().toISOString(),
      metrics: {
        before: beforeMetrics,
        after: beforeMetrics, // Will be updated
        changes: {
          productsAdded: 0,
          productsUpdated: 0,
          productsRemoved: 0,
          categoriesAdded: 0,
          categoriesUpdated: 0,
          categoriesRemoved: 0,
          inventoryAdjustments: 0
        },
        performance: {
          duration: 0,
          apiCalls: 0,
          dataTransferredKB: 0,
          cacheInvalidations: 0
        },
        errors: []
      },
      triggeredBy,
      syncOptions: options
    }

    // Store in database
    await this.supabase
      .from('sync_reports')
      .insert({
        id: syncReport.id,
        sync_id: syncLog.id,
        sync_type: 'boxhero_enhanced',
        status: 'started',
        before_stats: beforeMetrics,
        triggered_by: triggeredBy,
        sync_options: options
      })

    this.currentSyncReport = syncReport

    try {
      // Log admin activity
      await this.logAdminActivity(
        null, // Will be set by caller if available
        'sync_triggered',
        `Enhanced BoxHero sync started with options: ${JSON.stringify(options)}`,
        'sync',
        syncReport.id,
        'Enhanced Sync'
      )

      // Perform the actual sync
      await this.performEnhancedSync(syncReport, options)

      // Get after metrics
      const afterMetrics = await this.getSystemMetrics()
      syncReport.metrics.after = afterMetrics

      // Calculate final metrics
      const duration = Date.now() - startTime
      syncReport.duration = duration
      syncReport.metrics.performance.duration = duration
      syncReport.status = 'completed'
      syncReport.completedAt = new Date().toISOString()

      // Update database
      await this.updateSyncReport(syncReport)

      // Invalidate relevant caches
      await this.invalidateRelevantCaches(syncReport.id, 'sync_completed')

      return syncReport

    } catch (error) {
      // Handle sync failure
      syncReport.status = 'failed'
      syncReport.completedAt = new Date().toISOString()
      syncReport.duration = Date.now() - startTime
      syncReport.metrics.errors.push({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown sync error',
        details: error,
        timestamp: new Date().toISOString()
      })

      await this.updateSyncReport(syncReport)
      throw error
    }
  }

  /**
   * Get current system metrics for before/after comparison
   */
  private async getSystemMetrics() {
    const [productsResult, categoriesResult, stockResult, lastSyncResult] = await Promise.all([
      this.supabase.from('products').select('id', { count: 'exact', head: true }),
      this.supabase.from('categories').select('id', { count: 'exact', head: true }),
      this.supabase.from('products').select('stock_quantity'),
      this.supabase
        .from('sync_logs')
        .select('created_at')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
    ])

    const totalStock = stockResult.data?.reduce((sum, p) => sum + (p.stock_quantity || 0), 0) || 0

    return {
      products: productsResult.count || 0,
      categories: categoriesResult.count || 0,
      totalStock,
      lastSync: lastSyncResult.data?.created_at || null
    }
  }

  /**
   * Perform the actual enhanced sync with detailed tracking
   */
  private async performEnhancedSync(
    syncReport: SyncReport,
    options: any
  ): Promise<void> {
    syncReport.status = 'in_progress'
    await this.updateSyncReport(syncReport)

    // Test BoxHero connection
    const isConnected = await boxHeroApi.testConnection()
    if (!isConnected) {
      throw new Error('Failed to connect to BoxHero API')
    }
    syncReport.metrics.performance.apiCalls++

    // Sync categories if requested
    if (options.syncCategories !== false) {
      await this.syncCategoriesWithTracking(syncReport)
    }

    // Sync products if requested
    if (options.syncProducts !== false) {
      await this.syncProductsWithTracking(syncReport)
    }

    // Sync images if requested
    if (options.syncImages !== false) {
      await this.syncImagesWithTracking(syncReport)
    }
  }

  /**
   * Sync categories with detailed tracking
   */
  private async syncCategoriesWithTracking(syncReport: SyncReport): Promise<void> {
    try {
      console.log('📊 Enhanced sync: Processing categories...')
      
      // Get categories from BoxHero
      const boxHeroCategories = await boxHeroApi.getCategories()
      syncReport.metrics.performance.apiCalls++
      
      if (!boxHeroCategories || boxHeroCategories.length === 0) {
        syncReport.metrics.errors.push({
          type: 'warning',
          message: 'No categories received from BoxHero API',
          timestamp: new Date().toISOString()
        })
        return
      }

      // Process categories and track changes
      const beforeCount = syncReport.metrics.before.categories
      
      // Clear existing BoxHero categories
      await CategoriesService.clearBoxHeroCategories()
      
      // Convert and insert new categories
      const localCategories = boxHeroCategories.map((cat, index) => ({
        id: crypto.randomUUID(),
        name: cat.name,
        slug: cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        emoji: this.getCategoryEmoji(cat.name),
        item_count: cat.count || 0,
        description: `${cat.name} products from BoxHero`,
        is_active: true,
        sort_order: index + 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }))

      await CategoriesService.upsertBoxHeroCategories(localCategories)
      
      // Update metrics
      const afterCount = localCategories.length
      syncReport.metrics.changes.categoriesAdded = Math.max(0, afterCount - beforeCount)
      syncReport.metrics.changes.categoriesUpdated = Math.min(beforeCount, afterCount)
      
      console.log(`✅ Enhanced sync: Processed ${localCategories.length} categories`)
      
    } catch (error) {
      syncReport.metrics.errors.push({
        type: 'error',
        message: `Category sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error,
        timestamp: new Date().toISOString()
      })
      throw error
    }
  }

  /**
   * Sync products with detailed tracking (placeholder for now)
   */
  private async syncProductsWithTracking(syncReport: SyncReport): Promise<void> {
    // This would implement product sync with detailed tracking
    // For now, we'll focus on categories and add product sync later
    console.log('📦 Enhanced sync: Product sync not implemented yet')
  }

  /**
   * Sync images with detailed tracking
   */
  private async syncImagesWithTracking(syncReport: SyncReport): Promise<void> {
    try {
      console.log('🖼️ Enhanced sync: Processing images...')
      
      // Trigger image refresh
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
      const response = await fetch(`${baseUrl}/api/categories/random-images?refresh=true`)
      
      if (response.ok) {
        const data = await response.json()
        const imageCount = data.images ? Object.keys(data.images).length : 0
        syncReport.metrics.changes.inventoryAdjustments += imageCount
        console.log(`✅ Enhanced sync: Updated ${imageCount} category images`)
      } else {
        syncReport.metrics.errors.push({
          type: 'warning',
          message: 'Failed to refresh category images',
          timestamp: new Date().toISOString()
        })
      }
      
    } catch (error) {
      syncReport.metrics.errors.push({
        type: 'error',
        message: `Image sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error,
        timestamp: new Date().toISOString()
      })
    }
  }

  /**
   * Update sync report in database
   */
  private async updateSyncReport(syncReport: SyncReport): Promise<void> {
    await this.supabase
      .from('sync_reports')
      .update({
        status: syncReport.status,
        completed_at: syncReport.completedAt,
        duration_ms: syncReport.duration,
        after_stats: syncReport.metrics.after,
        products_added: syncReport.metrics.changes.productsAdded,
        products_updated: syncReport.metrics.changes.productsUpdated,
        products_removed: syncReport.metrics.changes.productsRemoved,
        categories_added: syncReport.metrics.changes.categoriesAdded,
        categories_updated: syncReport.metrics.changes.categoriesUpdated,
        categories_removed: syncReport.metrics.changes.categoriesRemoved,
        inventory_adjustments: syncReport.metrics.changes.inventoryAdjustments,
        errors_count: syncReport.metrics.errors.filter(e => e.type === 'error').length,
        warnings_count: syncReport.metrics.errors.filter(e => e.type === 'warning').length,
        errors_details: syncReport.metrics.errors.filter(e => e.type === 'error'),
        warnings_details: syncReport.metrics.errors.filter(e => e.type === 'warning'),
        api_calls_made: syncReport.metrics.performance.apiCalls,
        data_transferred_kb: syncReport.metrics.performance.dataTransferredKB,
        cache_invalidations: syncReport.metrics.performance.cacheInvalidations
      })
      .eq('id', syncReport.id)
  }

  /**
   * Log admin activity
   */
  private async logAdminActivity(
    adminUserId: string | null,
    actionType: string,
    description: string,
    resourceType?: string,
    resourceId?: string,
    resourceName?: string
  ): Promise<void> {
    await this.supabase.rpc('log_admin_activity', {
      p_admin_user_id: adminUserId,
      p_action_type: actionType,
      p_action_description: description,
      p_resource_type: resourceType,
      p_resource_id: resourceId,
      p_resource_name: resourceName
    })
  }

  /**
   * Invalidate relevant caches after sync
   */
  private async invalidateRelevantCaches(syncReportId: string, reason: string): Promise<void> {
    const cacheTypes = [
      'dashboard_stats',
      'categories',
      'products',
      'category_images',
      'product_counts'
    ]

    for (const cacheType of cacheTypes) {
      await this.supabase.rpc('log_cache_invalidation', {
        p_cache_key: `${cacheType}_*`,
        p_cache_type: cacheType,
        p_invalidation_reason: reason,
        p_triggered_by: 'enhanced_sync',
        p_sync_report_id: syncReportId
      })
    }

    this.currentSyncReport!.metrics.performance.cacheInvalidations = cacheTypes.length
  }

  /**
   * Get category emoji based on name
   */
  private getCategoryEmoji(categoryName: string): string {
    const emojiMap: { [key: string]: string } = {
      'hair': '💇',
      'bath': '🛁',
      'body': '🧴',
      'skincare': '✨',
      'makeup': '💄',
      'health': '🏥',
      'personal': '🧘',
      'care': '💊',
      'food': '🍱',
      'beverage': '🥤',
      'home': '🏠',
      'kitchen': '🍳',
      'beauty': '💅'
    }

    const lowerName = categoryName.toLowerCase()
    for (const [key, emoji] of Object.entries(emojiMap)) {
      if (lowerName.includes(key)) {
        return emoji
      }
    }
    return '📦' // Default emoji
  }

  /**
   * Get sync history with enhanced details
   */
  async getSyncHistory(limit: number = 10): Promise<SyncReport[]> {
    const { data } = await this.supabase
      .from('sync_reports')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit)

    return data || []
  }

  /**
   * Get sync performance analytics
   */
  async getSyncPerformanceAnalytics(days: number = 30) {
    const { data } = await this.supabase
      .from('sync_reports')
      .select('*')
      .gte('started_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('started_at', { ascending: false })

    if (!data) return null

    const totalSyncs = data.length
    const successfulSyncs = data.filter(s => s.status === 'completed').length
    const failedSyncs = data.filter(s => s.status === 'failed').length
    const avgDuration = data.reduce((sum, s) => sum + (s.duration_ms || 0), 0) / totalSyncs

    return {
      totalSyncs,
      successfulSyncs,
      failedSyncs,
      successRate: (successfulSyncs / totalSyncs) * 100,
      avgDuration: Math.round(avgDuration),
      recentSyncs: data.slice(0, 5)
    }
  }
}
