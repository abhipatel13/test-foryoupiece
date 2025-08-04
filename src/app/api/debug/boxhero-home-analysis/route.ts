import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { BoxHeroService } from '@/infrastructure/services/BoxHeroService';

/**
 * Comprehensive analysis of Home category discrepancy between BoxHero and our database
 * BoxHero shows 36 SKUs in Home category, but we only display 19 products
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Starting BoxHero Home category analysis...');
    
    const supabase = createServiceRoleClient();
    const boxHeroService = new BoxHeroService('a827b827-36f7-4e0e-b66b-db6990469aaa');
    
    // 1. Get all BoxHero items with their labels/categories
    console.log('📦 Fetching all BoxHero items...');
    const boxHeroResult = await boxHeroService.getAllItems();
    
    if (!boxHeroResult.success) {
      throw new Error(`BoxHero API error: ${boxHeroResult.error.message}`);
    }
    
    const allBoxHeroItems = boxHeroResult.data;
    console.log(`📊 Found ${allBoxHeroItems.length} total BoxHero items`);
    
    // 2. Filter BoxHero items that should be in Home category
    const boxHeroHomeItems = allBoxHeroItems.filter(item => {
      // Check if item has Home category in its attributes/labels
      const attrs = item.attrs || [];
      
      // Look for category attributes that indicate "Home"
      const hasHomeCategory = attrs.some(attr => {
        const value = attr.value?.toString().toLowerCase() || '';
        const name = attr.name?.toLowerCase() || '';
        
        return (
          value.includes('home') ||
          value.includes('household') ||
          value.includes('cleaning') ||
          value.includes('kitchen') ||
          value.includes('bathroom') ||
          name.includes('category') && value.includes('home')
        );
      });
      
      // Also check product name for home-related keywords
      const name = item.name.toLowerCase();
      const hasHomeKeywords = (
        name.includes('room fragrance') ||
        name.includes('toilet fragrance') ||
        name.includes('fabric') ||
        name.includes('cleaner') ||
        name.includes('mold remover') ||
        name.includes('febreze') ||
        name.includes('aroma') ||
        name.includes('closet') ||
        name.includes('oil stain removal')
      );
      
      return hasHomeCategory || hasHomeKeywords;
    });
    
    console.log(`🏠 Found ${boxHeroHomeItems.length} BoxHero items that should be in Home category`);
    
    // 3. Get our current Home category products from database
    const { data: categories } = await supabase
      .from('categories')
      .select('id, slug')
      .eq('slug', 'home')
      .single();
    
    if (!categories) {
      throw new Error('Home category not found in database');
    }
    
    const { data: ourHomeProducts } = await supabase
      .from('products')
      .select('id, sku, name_en, metadata')
      .eq('is_active', true)
      .eq('category_id', categories.id);
    
    console.log(`🏠 Found ${ourHomeProducts?.length || 0} products in our Home category`);
    
    // 4. Get all our products for comparison
    const { data: allOurProducts } = await supabase
      .from('products')
      .select('id, sku, name_en, category_id, metadata')
      .eq('is_active', true);
    
    // 5. Analyze discrepancies
    const analysis = {
      boxHeroHomeCount: boxHeroHomeItems.length,
      ourHomeCount: ourHomeProducts?.length || 0,
      discrepancy: boxHeroHomeItems.length - (ourHomeProducts?.length || 0),
      
      // BoxHero items that should be in Home but are missing from our database
      missingFromDatabase: [] as any[],
      
      // BoxHero items that should be in Home but are in different categories in our database
      miscategorizedInOurDatabase: [] as any[],
      
      // BoxHero items that should be in Home but are uncategorized in our database
      uncategorizedInOurDatabase: [] as any[],
      
      // Products in our Home category that don't exist in BoxHero
      extraInOurDatabase: [] as any[],
      
      // Detailed breakdown
      boxHeroHomeItems: boxHeroHomeItems.map(item => ({
        id: item.id,
        sku: item.sku,
        name: item.name,
        attrs: item.attrs,
        photo_url: item.photo_url
      })),
      
      ourHomeProducts: ourHomeProducts?.map(product => ({
        id: product.id,
        sku: product.sku,
        name: product.name_en,
        boxhero_id: product.metadata?.boxhero_id
      })) || []
    };
    
    // 6. Compare BoxHero Home items with our database
    for (const boxHeroItem of boxHeroHomeItems) {
      // Try to find this item in our database by SKU or BoxHero ID
      const ourProduct = allOurProducts?.find(product => 
        product.sku === boxHeroItem.sku ||
        product.metadata?.boxhero_id === boxHeroItem.id ||
        product.name_en.toLowerCase() === boxHeroItem.name.toLowerCase()
      );
      
      if (!ourProduct) {
        // Item exists in BoxHero Home but not in our database at all
        analysis.missingFromDatabase.push({
          boxhero_id: boxHeroItem.id,
          sku: boxHeroItem.sku,
          name: boxHeroItem.name,
          attrs: boxHeroItem.attrs
        });
      } else if (!ourProduct.category_id) {
        // Item exists in our database but is uncategorized
        analysis.uncategorizedInOurDatabase.push({
          our_id: ourProduct.id,
          sku: ourProduct.sku,
          name: ourProduct.name_en,
          boxhero_id: boxHeroItem.id
        });
      } else if (ourProduct.category_id !== categories.id) {
        // Item exists in our database but in wrong category
        analysis.miscategorizedInOurDatabase.push({
          our_id: ourProduct.id,
          sku: ourProduct.sku,
          name: ourProduct.name_en,
          current_category_id: ourProduct.category_id,
          boxhero_id: boxHeroItem.id
        });
      }
    }
    
    // 7. Check for products in our Home category that don't exist in BoxHero
    for (const ourProduct of ourHomeProducts || []) {
      const boxHeroItem = boxHeroHomeItems.find(item =>
        item.sku === ourProduct.sku ||
        item.id === ourProduct.metadata?.boxhero_id ||
        item.name.toLowerCase() === ourProduct.name_en.toLowerCase()
      );
      
      if (!boxHeroItem) {
        analysis.extraInOurDatabase.push({
          our_id: ourProduct.id,
          sku: ourProduct.sku,
          name: ourProduct.name_en,
          boxhero_id: ourProduct.metadata?.boxhero_id
        });
      }
    }
    
    console.log('✅ BoxHero Home category analysis completed');
    
    return NextResponse.json({
      success: true,
      analysis,
      summary: {
        boxHeroExpected: boxHeroHomeItems.length,
        currentlyDisplayed: ourHomeProducts?.length || 0,
        missing: analysis.discrepancy,
        breakdown: {
          missingFromDatabase: analysis.missingFromDatabase.length,
          miscategorized: analysis.miscategorizedInOurDatabase.length,
          uncategorized: analysis.uncategorizedInOurDatabase.length,
          extraInOurDb: analysis.extraInOurDatabase.length
        }
      },
      recommendations: [
        'Sync missing products from BoxHero to database',
        'Recategorize miscategorized products to Home category',
        'Categorize uncategorized products that should be in Home',
        'Review products in our Home category that don\'t exist in BoxHero'
      ]
    });
    
  } catch (error) {
    console.error('❌ BoxHero Home analysis error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to analyze BoxHero Home category',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
