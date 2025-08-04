import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth/admin-middleware'

/**
 * Test endpoint for admin rate limiting
 * GET /api/admin/rate-limit-test
 * 
 * This endpoint can be used to test the rate limiting functionality
 * by making multiple requests quickly to trigger rate limits.
 */
export const GET = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('🧪 Rate limit test endpoint called by admin:', adminUser.id)
    
    const url = new URL(request.url)
    const testType = url.searchParams.get('type') || 'default'
    
    // Simulate different types of operations
    const responses = {
      default: {
        message: 'Rate limit test successful',
        timestamp: new Date().toISOString(),
        adminUser: {
          id: adminUser.id,
          role: adminUser.role
        },
        rateLimitInfo: 'Check response headers for rate limit information'
      },
      heavy: {
        message: 'Heavy operation test successful',
        timestamp: new Date().toISOString(),
        operation: 'Simulated heavy database operation',
        processingTime: '250ms'
      },
      bulk: {
        message: 'Bulk operation test successful',
        timestamp: new Date().toISOString(),
        operation: 'Simulated bulk data processing',
        itemsProcessed: 100
      }
    }
    
    const response = responses[testType as keyof typeof responses] || responses.default
    
    return NextResponse.json({
      success: true,
      data: response,
      testType,
      requestInfo: {
        method: request.method,
        url: request.url,
        userAgent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('❌ Rate limit test error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: 'Rate limit test failed'
    }, { status: 500 })
  }
})

/**
 * Test endpoint for BoxHero sync rate limiting
 * POST /api/admin/rate-limit-test
 */
export const POST = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('🧪 BoxHero sync rate limit test called by admin:', adminUser.id)
    
    const body = await request.json().catch(() => ({}))
    const { operation = 'test_sync', duration = 1000 } = body
    
    // Simulate sync operation delay
    await new Promise(resolve => setTimeout(resolve, Math.min(duration, 5000)))
    
    return NextResponse.json({
      success: true,
      message: 'BoxHero sync rate limit test successful',
      operation,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      adminUser: {
        id: adminUser.id,
        role: adminUser.role
      }
    })
    
  } catch (error) {
    console.error('❌ BoxHero sync rate limit test error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: 'BoxHero sync rate limit test failed'
    }, { status: 500 })
  }
}, { rateLimitType: 'admin_boxhero_sync' })

/**
 * Test endpoint for bulk operations rate limiting
 * PUT /api/admin/rate-limit-test
 */
export const PUT = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('🧪 Bulk operations rate limit test called by admin:', adminUser.id)
    
    const body = await request.json().catch(() => ({}))
    const { itemCount = 10, operationType = 'update' } = body
    
    // Simulate bulk operation
    const results = Array.from({ length: Math.min(itemCount, 100) }, (_, i) => ({
      id: i + 1,
      operation: operationType,
      status: 'success',
      timestamp: new Date().toISOString()
    }))
    
    return NextResponse.json({
      success: true,
      message: 'Bulk operations rate limit test successful',
      operationType,
      itemsProcessed: results.length,
      results,
      timestamp: new Date().toISOString(),
      adminUser: {
        id: adminUser.id,
        role: adminUser.role
      }
    })
    
  } catch (error) {
    console.error('❌ Bulk operations rate limit test error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: 'Bulk operations rate limit test failed'
    }, { status: 500 })
  }
}, { rateLimitType: 'admin_bulk_operations' })
