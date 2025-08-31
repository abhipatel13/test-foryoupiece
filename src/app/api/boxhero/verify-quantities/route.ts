import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth/admin-middleware';

/**
 * GET /api/boxhero/verify-quantities
 * Investigate if 1,273 represents total quantities, not unique items
 */
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
  try {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEBUG_ENDPOINTS !== 'true') {
      return NextResponse.json({ success: false, error: 'Endpoint disabled in production' }, { status: 404 });
    }

    console.log('🔍 BoxHero API Quantity Investigation - Testing the Theory');
    console.log('📊 Theory: 755 = unique products, 1,273 = total inventory quantities');

    const boxHeroToken = process.env.BOXHERO_API_TOKEN;
    if (!boxHeroToken) {
      throw new Error('BOXHERO_API_TOKEN not found in environment variables');
    }

    const baseUrl = 'https://rest.boxhero-app.com';

    // Step 1: Get first page to examine data structure
    console.log('📄 Step 1: Examining API response structure...');
    const firstPageResponse = await fetch(`${baseUrl}/v1/items?limit=10`, {
      headers: {
        'Authorization': `Bearer ${boxHeroToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!firstPageResponse.ok) {
      throw new Error(`HTTP ${firstPageResponse.status}: ${firstPageResponse.statusText}`);
    }

    const firstPageData = await firstPageResponse.json();
    const sampleItems = firstPageData.items || [];

    console.log(`📦 Sample items structure analysis:`);
    console.log(`- Total sample items: ${sampleItems.length}`);

    // Analyze the structure of the first few items
    const structureAnalysis = sampleItems.slice(0, 3).map((item: any, index: number) => {
      const quantityFields = {};
      const allFields = Object.keys(item);

      // Look for quantity-related fields
      const quantityKeywords = ['quantity', 'stock', 'inventory', 'count', 'amount', 'total', 'available'];
      const potentialQuantityFields = allFields.filter(field =>
        quantityKeywords.some(keyword => field.toLowerCase().includes(keyword))
      );

      potentialQuantityFields.forEach(field => {
        quantityFields[field] = item[field];
      });

      return {
        itemIndex: index + 1,
        id: item.id,
        name: item.name?.substring(0, 50) + '...',
        sku: item.sku,
        allFields: allFields.length,
        potentialQuantityFields,
        quantityValues: quantityFields,
        locations: item.locations || 'No locations field'
      };
    });

    // Step 2: Get ALL items and calculate total quantities
    console.log('📄 Step 2: Retrieving ALL items to calculate total quantities...');
    let allItems: any[] = [];
    let cursor: string | undefined;
    let hasMore = true;
    let pageCount = 0;

    while (hasMore && pageCount < 20) { // Safety limit
      pageCount++;
      const url = `${baseUrl}/v1/items?limit=100${cursor ? `&cursor=${cursor}` : ''}`;

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

      allItems = allItems.concat(items);
      hasMore = data.has_more || false;
      cursor = data.cursor;

      console.log(`📄 Page ${pageCount}: ${items.length} items, total: ${allItems.length}`);

      // Rate limiting
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`📦 Total unique products retrieved: ${allItems.length}`);

    // Step 3: Analyze quantity fields across all items
    console.log('📄 Step 3: Analyzing quantity fields across all items...');

    const quantityAnalysis = {
      totalUniqueProducts: allItems.length,
      quantityFieldsFound: new Set(),
      quantityCalculations: {},
      locationAnalysis: {
        itemsWithLocations: 0,
        totalLocationEntries: 0,
        locationQuantitySum: 0
      },
      sampleItemsWithQuantities: []
    };

    // Analyze each item for quantity information
    allItems.forEach((item, index) => {
      // Look for direct quantity fields
      const quantityKeywords = ['quantity', 'stock', 'inventory', 'count', 'amount', 'total', 'available'];
      Object.keys(item).forEach(field => {
        if (quantityKeywords.some(keyword => field.toLowerCase().includes(keyword))) {
          quantityAnalysis.quantityFieldsFound.add(field);
          if (!quantityAnalysis.quantityCalculations[field]) {
            quantityAnalysis.quantityCalculations[field] = 0;
          }
          const value = parseFloat(item[field]) || 0;
          quantityAnalysis.quantityCalculations[field] += value;
        }
      });

      // Analyze locations array (common in inventory APIs)
      if (item.locations && Array.isArray(item.locations)) {
        quantityAnalysis.locationAnalysis.itemsWithLocations++;
        quantityAnalysis.locationAnalysis.totalLocationEntries += item.locations.length;

        item.locations.forEach((location: any) => {
          if (location.quantity !== undefined) {
            const qty = parseFloat(location.quantity) || 0;
            quantityAnalysis.locationAnalysis.locationQuantitySum += qty;
          }
        });
      }

      // Collect sample items for detailed analysis (first 10)
      if (index < 10) {
        const itemAnalysis = {
          id: item.id,
          name: item.name?.substring(0, 30) + '...',
          sku: item.sku,
          directQuantityFields: {},
          locations: item.locations || null,
          locationQuantities: []
        };

        // Extract direct quantity fields
        Object.keys(item).forEach(field => {
          if (quantityKeywords.some(keyword => field.toLowerCase().includes(keyword))) {
            itemAnalysis.directQuantityFields[field] = item[field];
          }
        });

        // Extract location quantities
        if (item.locations && Array.isArray(item.locations)) {
          itemAnalysis.locationQuantities = item.locations.map((loc: any) => ({
            locationId: loc.id || loc.location_id,
            locationName: loc.name,
            quantity: loc.quantity
          }));
        }

        quantityAnalysis.sampleItemsWithQuantities.push(itemAnalysis);
      }
    });

    // Step 4: Calculate the most likely total quantity
    console.log('📄 Step 4: Calculating total inventory quantities...');

    const totalQuantityCalculations = {
      fromLocationQuantities: quantityAnalysis.locationAnalysis.locationQuantitySum,
      fromDirectFields: quantityAnalysis.quantityCalculations,
      mostLikelyTotal: 0,
      explanation: ''
    };

    // Determine the most likely total
    if (quantityAnalysis.locationAnalysis.locationQuantitySum > 0) {
      totalQuantityCalculations.mostLikelyTotal = quantityAnalysis.locationAnalysis.locationQuantitySum;
      totalQuantityCalculations.explanation = 'Sum of quantities from location arrays';
    } else if (Object.keys(quantityAnalysis.quantityCalculations).length > 0) {
      const maxField = Object.entries(quantityAnalysis.quantityCalculations)
        .reduce((max, [field, value]) => value > max.value ? { field, value } : max, { field: '', value: 0 });
      totalQuantityCalculations.mostLikelyTotal = maxField.value;
      totalQuantityCalculations.explanation = `Sum of '${maxField.field}' field across all items`;
    }

    console.log(`📊 Total quantity calculation: ${totalQuantityCalculations.mostLikelyTotal}`);
    console.log(`📊 Expected total: 1,273`);
    console.log(`📊 Difference: ${Math.abs(totalQuantityCalculations.mostLikelyTotal - 1273)}`);

    // Step 5: Verify the theory
    const theoryVerification = {
      uniqueProductsRetrieved: allItems.length,
      expectedUniqueProducts: 755,
      calculatedTotalQuantity: totalQuantityCalculations.mostLikelyTotal,
      expectedTotalQuantity: 1273,
      theoryConfirmed: false,
      confidence: 'low',
      explanation: ''
    };

    const productCountMatch = Math.abs(allItems.length - 755) <= 5; // Allow small variance
    const quantityMatch = Math.abs(totalQuantityCalculations.mostLikelyTotal - 1273) <= 50; // Allow reasonable variance

    if (productCountMatch && quantityMatch) {
      theoryVerification.theoryConfirmed = true;
      theoryVerification.confidence = 'high';
      theoryVerification.explanation = 'Theory confirmed: 755 represents unique products, 1,273 represents total inventory quantities';
    } else if (productCountMatch) {
      theoryVerification.confidence = 'medium';
      theoryVerification.explanation = 'Product count matches, but quantity calculation needs refinement';
    } else {
      theoryVerification.explanation = 'Theory not confirmed with current data analysis';
    }

    return NextResponse.json({
      success: true,
      investigation: {
        theory: '755 = unique products, 1,273 = total inventory quantities',
        structureAnalysis,
        quantityAnalysis,
        totalQuantityCalculations,
        theoryVerification,
        recommendations: theoryVerification.theoryConfirmed ? [
          'Update admin dashboard to show correct metrics',
          'Remove "missing items" and "data loss" warnings',
          'Update documentation to reflect correct understanding',
          'Modify code comments about "API limitations"'
        ] : [
          'Further investigation needed to understand quantity structure',
          'Check BoxHero documentation for quantity field definitions',
          'Contact BoxHero support for clarification on data structure'
        ]
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ BoxHero quantity investigation error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'BoxHero quantity investigation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
