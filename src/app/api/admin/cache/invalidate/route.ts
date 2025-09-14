export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag, revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { withAdminAuth } from '@/lib/auth/admin-middleware'

/**
 * POST /api/admin/cache/invalidate
 * Invalidate specific caches and refresh data
 */
export const POST = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('🔄 Cache invalidation triggered by admin:', adminUser.id)

    const body = await request.json().catch(() => ({}))
    const {
      cacheTypes = ['all'], // 'all', 'dashboard', 'products', 'categories', 'images'
      reason = 'manual_refresh',
      forceRefresh = true
    } = body

    const supabase = createServiceRoleClient()
    const invalidationResults: any[] = []
    const startTime = Date.now()

    // Define cache invalidation strategies
    const cacheStrategies = {
      dashboard: async () => {
        // Invalidate dashboard stats cache
        console.log('📊 Invalidating dashboard cache...')

        // Log cache invalidation
        await supabase.rpc('log_cache_invalidation', {
          p_cache_key: 'dashboard_stats',
          p_cache_type: 'dashboard',
          p_invalidation_reason: reason,
          p_triggered_by: `admin:${adminUser.id}`
        })

        return { type: 'dashboard', status: 'invalidated', records: 1 }
      },

      products: async () => {
        console.log('📦 Invalidating products cache...')

        // Get product count for metrics
        const { count } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true })

        // Log cache invalidation
        await supabase.rpc('log_cache_invalidation', {
          p_cache_key: 'products_*',
          p_cache_type: 'products',
          p_invalidation_reason: reason,
          p_triggered_by: `admin:${adminUser.id}`
        })

        return { type: 'products', status: 'invalidated', records: count || 0 }
      },

      categories: async () => {
        console.log('📂 Invalidating categories cache...')

        // Get category count for metrics
        const { count } = await supabase
          .from('categories')
          .select('*', { count: 'exact', head: true })

        // Refresh category images if requested
        if (forceRefresh) {
          try {
            const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
            const response = await fetch(`${baseUrl}/api/categories/random-images?refresh=true`, {
              method: 'GET',
              headers: { 'Cache-Control': 'no-cache' }
            })

            if (!response.ok) {
              console.warn('⚠️ Failed to refresh category images')
            }
          } catch (error) {
            console.warn('⚠️ Category image refresh error:', error)
          }
        }

        // Log cache invalidation
        await supabase.rpc('log_cache_invalidation', {
          p_cache_key: 'categories_*',
          p_cache_type: 'categories',
          p_invalidation_reason: reason,
          p_triggered_by: `admin:${adminUser.id}`
        })

        return { type: 'categories', status: 'invalidated', records: count || 0 }
      },

      images: async () => {
        console.log('🖼️ Invalidating images cache...')

        // Force refresh category images
        try {
          const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
          const response = await fetch(`${baseUrl}/api/categories/random-images?refresh=true`, {
            method: 'GET',
            headers: { 'Cache-Control': 'no-cache' }
          })

          let imageCount = 0
          if (response.ok) {
            const data = await response.json()
            imageCount = data.images ? Object.keys(data.images).length : 0
          }

          // Log cache invalidation
          await supabase.rpc('log_cache_invalidation', {
            p_cache_key: 'category_images',
            p_cache_type: 'images',
            p_invalidation_reason: reason,
            p_triggered_by: `admin:${adminUser.id}`
          })

          return { type: 'images', status: 'refreshed', records: imageCount }
        } catch (error) {
          return { type: 'images', status: 'error', error: error instanceof Error ? error.message : 'Unknown error' }
        }
      },

      analytics: async () => {
        console.log('📈 Invalidating analytics cache...')

        // Log cache invalidation
        await supabase.rpc('log_cache_invalidation', {
          p_cache_key: 'analytics_*',
          p_cache_type: 'analytics',
          p_invalidation_reason: reason,
          p_triggered_by: `admin:${adminUser.id}`
        })

        return { type: 'analytics', status: 'invalidated', records: 1 }
      }
    }

    // Process cache invalidations
    const typesToProcess = cacheTypes.includes('all')
      ? Object.keys(cacheStrategies)
      : cacheTypes.filter((type: string) => type in cacheStrategies)

    for (const cacheType of typesToProcess) {
      try {
        const strategy = cacheStrategies[cacheType as keyof typeof cacheStrategies]
        const result = await strategy()
        invalidationResults.push(result)
      } catch (error) {
        invalidationResults.push({
          type: cacheType,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Log admin activity
    await supabase.rpc('log_admin_activity', {
      p_admin_user_id: adminUser.id,
      p_action_type: 'cache_invalidation',
      p_action_description: `Cache invalidation performed for types: ${typesToProcess.join(', ')}`,
      p_resource_type: 'cache',
      p_metadata: JSON.stringify({
        cacheTypes: typesToProcess,
        reason,
        forceRefresh,
        results: invalidationResults
      })
    })

    const duration = Date.now() - startTime

    console.log('✅ Cache invalidation completed:', {
      types: typesToProcess,
      duration,
      results: invalidationResults
    })

    {
      // Revalidate Next.js caches/tags affected by selected types
      try {
        const set = new Set(typesToProcess)
        if (set.has('products')) revalidateTag('products')
        if (set.has('categories')) revalidateTag('categories')
        if (set.has('analytics')) revalidateTag('analytics')
        if (set.has('dashboard')) revalidatePath('/en/fyponly-admin')
      } catch {}

      const response = NextResponse.json({
        success: true,
        message: 'Cache invalidation completed',
        data: {
          invalidationResults,
          summary: {
            typesProcessed: typesToProcess.length,
            totalRecordsAffected: invalidationResults.reduce((sum, r) => sum + (r.records || 0), 0),
            duration,
            errors: invalidationResults.filter(r => r.status === 'error').length
          },
          timestamp: new Date().toISOString()
        }
      })
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
      response.headers.set('Vary', 'Cookie, Authorization, Accept-Encoding')
      return response
    }

  } catch (error) {
    console.error('❌ Cache invalidation failed:', error)

    {
      const response = NextResponse.json(
        {
          success: false,
          message: 'Cache invalidation failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      )
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
      response.headers.set('Vary', 'Cookie, Authorization, Accept-Encoding')
      return response
    }
  }
})

/**
 * GET /api/admin/cache/invalidate
 * Get cache invalidation history and statistics
 */
export const GET = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const cacheType = searchParams.get('type')
    const days = parseInt(searchParams.get('days') || '7')

    const supabase = createServiceRoleClient()

    // Build query
    let query = supabase
      .from('cache_invalidation_logs')
      .select('*')
      .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(limit)

    if (cacheType) {
      query = query.eq('cache_type', cacheType)
    }

    const { data: invalidationLogs } = await query

    // Get summary statistics
    const { data: summaryData } = await supabase
      .from('cache_invalidation_logs')
      .select('cache_type, triggered_by')
      .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())

    const summary = {
      totalInvalidations: summaryData?.length || 0,
      byType: {} as Record<string, number>,
      byTrigger: {} as Record<string, number>
    }

    summaryData?.forEach(log => {
      summary.byType[log.cache_type] = (summary.byType[log.cache_type] || 0) + 1
      summary.byTrigger[log.triggered_by] = (summary.byTrigger[log.triggered_by] || 0) + 1
    })

    {
      const response = NextResponse.json({
        success: true,
        data: {
          invalidationLogs: invalidationLogs || [],
          summary,
          meta: {
            limit,
            days,
            cacheType: cacheType || 'all'
          }
        }
      })
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
      response.headers.set('Vary', 'Cookie, Authorization, Accept-Encoding')
      return response
    }

  } catch (error) {
    console.error('❌ Failed to get cache invalidation data:', error)

    {
      const response = NextResponse.json(
        {
          success: false,
          message: 'Failed to get cache invalidation data',
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      )
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
      response.headers.set('Vary', 'Cookie, Authorization, Accept-Encoding')
      return response
    }
  }
})
