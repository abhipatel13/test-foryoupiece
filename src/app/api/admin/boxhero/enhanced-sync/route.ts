import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { EnhancedSyncService } from '@/lib/enhanced-sync-service'
import { withAdminAuth } from '@/lib/auth/admin-middleware'

/**
 * POST /api/admin/boxhero/enhanced-sync
 * Trigger enhanced BoxHero sync with comprehensive reporting
 */
export const POST = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('🚀 Enhanced BoxHero sync triggered by admin:', adminUser.id)

    const body = await request.json().catch(() => ({}))
    const {
      syncImages = true,
      syncCategories = true,
      syncProducts = false, // Not implemented yet
      dryRun = false
    } = body

    const syncService = new EnhancedSyncService()
    
    // Start enhanced sync
    const syncReport = await syncService.startEnhancedSync(
      `admin:${adminUser.id}`,
      {
        syncImages,
        syncCategories,
        syncProducts,
        dryRun
      }
    )

    console.log('✅ Enhanced sync completed:', {
      id: syncReport.id,
      status: syncReport.status,
      duration: syncReport.duration,
      changes: syncReport.metrics.changes
    })

    // Tag-based revalidation for server caches
    try {
      revalidateTag('products')
      revalidateTag('categories')
      revalidateTag('inventory')
    } catch (e) {
      console.warn('⚠️ Tag revalidation failed:', e)
    }

    return NextResponse.json({
      success: true,
      message: 'Enhanced BoxHero sync completed successfully',
      data: {
        syncReport,
        summary: {
          status: syncReport.status,
          duration: syncReport.duration,
          categoriesProcessed: syncReport.metrics.changes.categoriesAdded + syncReport.metrics.changes.categoriesUpdated,
          errorsCount: syncReport.metrics.errors.filter(e => e.type === 'error').length,
          warningsCount: syncReport.metrics.errors.filter(e => e.type === 'warning').length,
          cacheInvalidations: syncReport.metrics.performance.cacheInvalidations
        }
      }
    })

  } catch (error) {
    console.error('❌ Enhanced sync failed:', error)

    return NextResponse.json(
      {
        success: false,
        message: 'Enhanced BoxHero sync failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
})

/**
 * GET /api/admin/boxhero/enhanced-sync
 * Get enhanced sync history and analytics
 */
export const GET = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const analytics = searchParams.get('analytics') === 'true'
    const days = parseInt(searchParams.get('days') || '30')

    const syncService = new EnhancedSyncService()

    // Get sync history
    const syncHistory = await syncService.getSyncHistory(limit)

    let performanceAnalytics = null
    if (analytics) {
      performanceAnalytics = await syncService.getSyncPerformanceAnalytics(days)
    }

    return NextResponse.json({
      success: true,
      data: {
        syncHistory,
        performanceAnalytics,
        meta: {
          limit,
          total: syncHistory.length,
          analyticsEnabled: analytics,
          analyticsDays: days
        }
      }
    })

  } catch (error) {
    console.error('❌ Failed to get enhanced sync data:', error)

    return NextResponse.json(
      {
        success: false,
        message: 'Failed to get enhanced sync data',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}, { rateLimitType: 'admin_boxhero_sync' })

/**
 * DELETE /api/admin/boxhero/enhanced-sync/[id]
 * Cancel a running sync (if possible)
 */
export const DELETE = withAdminAuth(async (
  request: NextRequest,
  { user, adminUser }
) => {
  try {
    // This would implement sync cancellation
    // For now, return not implemented
    return NextResponse.json(
      {
        success: false,
        message: 'Sync cancellation not implemented yet'
      },
      { status: 501 }
    )

  } catch (error) {
    console.error('❌ Failed to cancel sync:', error)

    return NextResponse.json(
      {
        success: false,
        message: 'Failed to cancel sync',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}, { rateLimitType: 'admin_boxhero_sync' })
