import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/cache/invalidate
 * Invalidate frontend React Query caches
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keys, reason } = body;

    console.log('🗑️ Cache invalidation requested:', { keys, reason });

    // This endpoint serves as a signal for the frontend to invalidate caches
    // The actual cache invalidation happens on the client side via React Query
    
    return NextResponse.json({
      success: true,
      message: 'Cache invalidation signal sent',
      data: {
        keys: keys || [],
        reason: reason || 'manual',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Cache invalidation error:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to invalidate cache',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
