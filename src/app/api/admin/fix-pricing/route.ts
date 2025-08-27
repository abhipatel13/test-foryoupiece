import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Fix pricing by updating all products with correct USD prices from BoxHero
 * POST /api/admin/fix-pricing
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Starting pricing fix...');

    // Create Supabase service role client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get BoxHero API token
    const boxHeroToken = process.env.BOXHERO_API_TOKEN;
    if (!boxHeroToken) {
      throw new Error('BoxHero API token not configured');
    }

    console.log('📡 Fetching BoxHero items...');

    // Fetch all BoxHero items
    const boxHeroItems: unknown[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const url = new URL('https://rest.boxhero-app.com/v1/items');
      url.searchParams.set('limit', '100');
      if (cursor) {
        url.searchParams.set('cursor', cursor);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${boxHeroToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`BoxHero API error: ${response.status}`);
      }

      const data = await response.json();
      boxHeroItems.push(...data.items);
      
      hasMore = data.has_more;
      cursor = data.cursor;
      
      console.log(`📦 Fetched ${data.items.length} items, total: ${boxHeroItems.length}`);
    }

    console.log(`✅ Fetched ${boxHeroItems.length} BoxHero items`);

    // Update prices in database
    let updated = 0;
    let errors = 0;

    for (const item of boxHeroItems) {
      try {
        if (!item.sku || !item.price) {
          continue;
        }

        const usdPrice = parseFloat(item.price);
        if (isNaN(usdPrice) || usdPrice <= 0) {
          continue;
        }

        // Update product price by SKU and clear stale compare_at_price to prevent false discounts
        const { error } = await supabase
          .from('products')
          .update({
            price: usdPrice,
            compare_at_price: null,
            updated_at: new Date().toISOString()
          })
          .eq('sku', item.sku);

        if (error) {
          console.error(`❌ Failed to update ${item.sku}:`, error);
          errors++;
        } else {
          console.log(`✅ Updated ${item.name}: $${usdPrice}`);
          updated++;
        }
      } catch (error) {
        console.error(`❌ Error processing ${item.name}:`, error);
        errors++;
      }
    }

    console.log(`🎯 Pricing fix complete: ${updated} updated, ${errors} errors`);

    return NextResponse.json({
      success: true,
      message: 'Pricing fix completed',
      stats: {
        totalItems: boxHeroItems.length,
        updated,
        errors,
      },
    });

  } catch (error) {
    console.error('❌ Pricing fix error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fix pricing',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
