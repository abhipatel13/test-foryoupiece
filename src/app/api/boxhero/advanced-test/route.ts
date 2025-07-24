import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/boxhero/advanced-test
 * Advanced techniques to try to access all 1,273 items from BoxHero
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🚀 BoxHero API Advanced Access Techniques');
    
    const boxHeroToken = process.env.BOXHERO_API_TOKEN;
    if (!boxHeroToken) {
      throw new Error('BOXHERO_API_TOKEN not found in environment variables');
    }

    const baseUrl = 'https://rest.boxhero-app.com';
    const results = [];
    
    // Technique 1: Try starting from different cursors/offsets
    console.log('🔍 Technique 1: Testing different starting points');
    const startingPoints = [
      null, // Normal start
      '34605142', // Last item ID from previous test
      '35000000', // Try a higher ID
      '40000000', // Even higher
      '50000000'  // Much higher
    ];
    
    for (const startCursor of startingPoints) {
      try {
        const url = `${baseUrl}/v1/items?limit=100${startCursor ? `&cursor=${startCursor}` : ''}`;
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${boxHeroToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          results.push({
            technique: 'different_starting_points',
            startCursor,
            itemsReceived: data.items?.length || 0,
            hasMore: data.has_more,
            firstItemId: data.items?.[0]?.id,
            lastItemId: data.items?.[data.items?.length - 1]?.id
          });
          console.log(`📄 Start ${startCursor || 'null'}: ${data.items?.length || 0} items`);
        } else {
          results.push({
            technique: 'different_starting_points',
            startCursor,
            error: `HTTP ${response.status}: ${response.statusText}`
          });
        }
      } catch (error) {
        results.push({
          technique: 'different_starting_points',
          startCursor,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Technique 2: Try reverse pagination (if supported)
    console.log('🔍 Technique 2: Testing reverse pagination');
    try {
      const response = await fetch(`${baseUrl}/v1/items?limit=100&order=desc`, {
        headers: {
          'Authorization': `Bearer ${boxHeroToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        results.push({
          technique: 'reverse_pagination',
          itemsReceived: data.items?.length || 0,
          hasMore: data.has_more,
          firstItemId: data.items?.[0]?.id,
          lastItemId: data.items?.[data.items?.length - 1]?.id
        });
        console.log(`📄 Reverse: ${data.items?.length || 0} items`);
      } else {
        results.push({
          technique: 'reverse_pagination',
          error: `HTTP ${response.status}: ${response.statusText}`
        });
      }
    } catch (error) {
      results.push({
        technique: 'reverse_pagination',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Technique 3: Try date-based filtering to access different time periods
    console.log('🔍 Technique 3: Testing date-based filtering');
    const dateFilters = [
      'created_after=2023-01-01',
      'created_before=2024-01-01',
      'updated_after=2024-01-01',
      'modified_since=2023-01-01'
    ];
    
    for (const dateFilter of dateFilters) {
      try {
        const response = await fetch(`${baseUrl}/v1/items?limit=100&${dateFilter}`, {
          headers: {
            'Authorization': `Bearer ${boxHeroToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          results.push({
            technique: 'date_filtering',
            filter: dateFilter,
            itemsReceived: data.items?.length || 0,
            hasMore: data.has_more
          });
          console.log(`📄 ${dateFilter}: ${data.items?.length || 0} items`);
        } else {
          results.push({
            technique: 'date_filtering',
            filter: dateFilter,
            error: `HTTP ${response.status}: ${response.statusText}`
          });
        }
      } catch (error) {
        results.push({
          technique: 'date_filtering',
          filter: dateFilter,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Technique 4: Try different sorting orders
    console.log('🔍 Technique 4: Testing different sort orders');
    const sortOrders = [
      'sort=id',
      'sort=name',
      'sort=created_at',
      'sort=updated_at',
      'order_by=id',
      'order_by=name'
    ];
    
    for (const sortOrder of sortOrders) {
      try {
        const response = await fetch(`${baseUrl}/v1/items?limit=100&${sortOrder}`, {
          headers: {
            'Authorization': `Bearer ${boxHeroToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          results.push({
            technique: 'sort_orders',
            sortOrder,
            itemsReceived: data.items?.length || 0,
            hasMore: data.has_more,
            firstItemId: data.items?.[0]?.id,
            lastItemId: data.items?.[data.items?.length - 1]?.id
          });
          console.log(`📄 ${sortOrder}: ${data.items?.length || 0} items`);
        } else {
          results.push({
            technique: 'sort_orders',
            sortOrder,
            error: `HTTP ${response.status}: ${response.statusText}`
          });
        }
      } catch (error) {
        results.push({
          technique: 'sort_orders',
          sortOrder,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Technique 5: Try to get account/plan information
    console.log('🔍 Technique 5: Testing account information endpoints');
    const infoEndpoints = [
      '/v1/account',
      '/v1/user',
      '/v1/plan',
      '/v1/limits',
      '/v1/quota',
      '/v1/info'
    ];
    
    for (const endpoint of infoEndpoints) {
      try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          headers: {
            'Authorization': `Bearer ${boxHeroToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          results.push({
            technique: 'account_info',
            endpoint,
            accessible: true,
            data: data
          });
          console.log(`✅ ${endpoint}: Accessible`);
        } else {
          results.push({
            technique: 'account_info',
            endpoint,
            accessible: false,
            status: response.status
          });
          console.log(`❌ ${endpoint}: ${response.status}`);
        }
      } catch (error) {
        results.push({
          technique: 'account_info',
          endpoint,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return NextResponse.json({
      success: true,
      advancedTesting: {
        summary: {
          totalTechniques: 5,
          resultsGenerated: results.length,
          conclusion: 'Advanced techniques tested to bypass 755-item limit'
        },
        results,
        analysis: {
          differentStartingPoints: results.filter(r => r.technique === 'different_starting_points'),
          reversePagination: results.filter(r => r.technique === 'reverse_pagination'),
          dateFiltering: results.filter(r => r.technique === 'date_filtering'),
          sortOrders: results.filter(r => r.technique === 'sort_orders'),
          accountInfo: results.filter(r => r.technique === 'account_info')
        },
        recommendations: [
          'If no technique yields more than 755 items, this confirms API limitation',
          'Check account info endpoints for plan limitations',
          'Contact BoxHero support with specific findings',
          'Consider if this is a free tier limitation'
        ]
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ BoxHero advanced testing error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'BoxHero advanced testing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
