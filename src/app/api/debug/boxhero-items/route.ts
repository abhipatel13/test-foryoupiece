import { NextRequest, NextResponse } from 'next/server';

/**
 * Debug endpoint to check raw BoxHero API response
 * GET /api/debug/boxhero-items
 */
export async function GET(request: NextRequest) {
  try {
    const apiToken = process.env.BOXHERO_API_TOKEN;
    
    if (!apiToken) {
      return NextResponse.json({
        success: false,
        error: 'BoxHero API token not configured',
      }, { status: 500 });
    }

    console.log('🔍 Fetching BoxHero items for debugging...');

    const response = await fetch('https://rest.boxhero-app.com/v1/items?limit=3', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`BoxHero API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log('📦 Raw BoxHero API response:', JSON.stringify(data, null, 2));

    return NextResponse.json({
      success: true,
      data: data,
      debug: {
        itemCount: data.items?.length || 0,
        firstItem: data.items?.[0] || null,
        priceFields: data.items?.map((item: unknown) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          cost: item.cost,
          priceType: typeof item.price,
          costType: typeof item.cost,
        })) || [],
      },
    });

  } catch (error) {
    console.error('❌ BoxHero debug API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch BoxHero items',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
