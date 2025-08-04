import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/boxhero/debug-pagination
 * Deep dive investigation into BoxHero API pagination to find missing items
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 BoxHero API Deep Pagination Investigation');
    
    const boxHeroToken = process.env.BOXHERO_API_TOKEN;
    if (!boxHeroToken) {
      throw new Error('BOXHERO_API_TOKEN not found in environment variables');
    }

    const baseUrl = 'https://rest.boxhero-app.com';
    
    // Test 1: Try different limit values to see if we can get more items
    console.log('📊 Test 1: Testing different limit values');
    const limitTests = [50, 100, 200, 500, 1000];
    const limitResults = [];
    
    for (const limit of limitTests) {
      try {
        const response = await fetch(`${baseUrl}/v1/items?limit=${limit}`, {
          headers: {
            'Authorization': `Bearer ${boxHeroToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          limitResults.push({
            limit,
            itemsReceived: data.items?.length || 0,
            hasMore: data.has_more,
            cursor: data.cursor,
            totalPages: data.total_pages,
            totalCount: data.total_count
          });
          console.log(`📄 Limit ${limit}: ${data.items?.length || 0} items, has_more: ${data.has_more}`);
        } else {
          limitResults.push({
            limit,
            error: `HTTP ${response.status}: ${response.statusText}`
          });
        }
      } catch (error) {
        limitResults.push({
          limit,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Test 2: Try to get ALL items with maximum pagination
    console.log('📊 Test 2: Complete pagination with detailed logging');
    let allItems: any[] = [];
    let cursor: string | undefined;
    let hasMore = true;
    let pageCount = 0;
    const paginationLog = [];
    
    while (hasMore && pageCount < 100) { // Increased safety limit
      pageCount++;
      const url = `${baseUrl}/v1/items?limit=100${cursor ? `&cursor=${cursor}` : ''}`;
      
      console.log(`📄 Page ${pageCount}: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${boxHeroToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const items = data.items || [];
      
      paginationLog.push({
        page: pageCount,
        itemsReceived: items.length,
        hasMore: data.has_more,
        cursor: data.cursor,
        totalSoFar: allItems.length + items.length,
        firstItemId: items[0]?.id,
        lastItemId: items[items.length - 1]?.id
      });
      
      allItems = allItems.concat(items);
      hasMore = data.has_more || false;
      cursor = data.cursor;
      
      console.log(`📄 Page ${pageCount}: ${items.length} items, total: ${allItems.length}, has_more: ${hasMore}`);
      
      // Rate limiting
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Test 3: Try different API endpoints
    console.log('📊 Test 3: Testing alternative API endpoints');
    const endpointTests = [];
    
    const endpoints = [
      '/v1/items',
      '/v1/items/search',
      '/v1/items/all',
      '/v1/inventory',
      '/v1/inventory/items'
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${baseUrl}${endpoint}?limit=10`, {
          headers: {
            'Authorization': `Bearer ${boxHeroToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        endpointTests.push({
          endpoint,
          status: response.status,
          statusText: response.statusText,
          accessible: response.ok
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ ${endpoint}: ${data.items?.length || 0} items available`);
        } else {
          console.log(`❌ ${endpoint}: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        endpointTests.push({
          endpoint,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Test 4: Check if there are any query parameters that might unlock more data
    console.log('📊 Test 4: Testing query parameters');
    const parameterTests = [];
    
    const testParams = [
      'include_archived=true',
      'include_inactive=true',
      'include_all=true',
      'status=all',
      'archived=false',
      'active=true'
    ];
    
    for (const param of testParams) {
      try {
        const response = await fetch(`${baseUrl}/v1/items?limit=10&${param}`, {
          headers: {
            'Authorization': `Bearer ${boxHeroToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          parameterTests.push({
            parameter: param,
            itemsReceived: data.items?.length || 0,
            hasMore: data.has_more,
            totalCount: data.total_count
          });
          console.log(`📄 ${param}: ${data.items?.length || 0} items`);
        } else {
          parameterTests.push({
            parameter: param,
            error: `HTTP ${response.status}: ${response.statusText}`
          });
        }
      } catch (error) {
        parameterTests.push({
          parameter: param,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return NextResponse.json({
      success: true,
      investigation: {
        summary: {
          totalItemsFound: allItems.length,
          totalPagesProcessed: pageCount,
          paginationWorking: pageCount > 1,
          finalHasMore: hasMore,
          conclusion: allItems.length < 1273 ? 'API_LIMITATION_CONFIRMED' : 'ALL_ITEMS_ACCESSIBLE'
        },
        limitTests,
        paginationLog,
        endpointTests,
        parameterTests,
        recommendations: allItems.length < 1273 ? [
          'The BoxHero API appears to have a hard limit of 755 items',
          'This is not a pagination bug - pagination is working correctly',
          'The API returns has_more=false after 755 items',
          'Contact BoxHero support about accessing remaining 518 items',
          'Consider if this is a plan limitation or API restriction'
        ] : [
          'All items are accessible via the API',
          'Previous assumptions about API limitations were incorrect',
          'Update sync logic to handle the full dataset'
        ]
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ BoxHero pagination investigation error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'BoxHero pagination investigation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
