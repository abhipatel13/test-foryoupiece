import { NextRequest, NextResponse } from 'next/server';

/**
 * Trigger pricing fix via GET request
 * GET /api/admin/fix-pricing-trigger
 */
export async function GET(request: NextRequest) {
  try {
    // Make internal POST request to fix-pricing endpoint
    const response = await fetch(`${request.nextUrl.origin}/api/admin/fix-pricing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    
    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Pricing fix trigger error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to trigger pricing fix',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
