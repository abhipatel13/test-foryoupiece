import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { BoxHeroService } from '@/infrastructure/services/BoxHeroService';

/**
 * Comprehensive fix for ALL category discrepancies
 * Recategorizes products based on BoxHero metadata to match inventory exactly
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Starting comprehensive category fix...');
    
    const supabase = createServiceRoleClient();
    const boxHeroService = new BoxHeroService('a827b827-36f7-4e0e-b66b-db6990469aaa');
    
    // Get all BoxHero items
    const boxHeroResult = await boxHeroService.getAllItems();
    if (!boxHeroResult.success) {
      throw new Error(`BoxHero API error: ${boxHeroResult.error.message}`);
    }
    
    const allBoxHeroItems = boxHeroResult.data;
    
    // Get all categories
    const { data: categories } = await supabase
      .from('categories')
      .select('id, slug, name_en');
    
    if (!categories) {
      throw new Error('Failed to fetch categories');
    }
    
    const categoryMap = new Map(categories.map(cat => [cat.slug, cat.id]));
    
    // Get all our products
    const { data: allOurProducts } = await supabase
      .from('products')
      .select('id, sku, name_en, category_id, metadata')
      .eq('is_active', true);
    
    if (!allOurProducts) {
      throw new Error('Failed to fetch products');
    }
    
    let totalUpdated = 0;
    let totalErrors = 0;
    const categoryUpdates: any = {};
    const errors: string[] = [];
    
    // Initialize category counters
    categories.forEach(cat => {
      categoryUpdates[cat.slug] = {
        name: cat.name_en,
        updated: 0,
        skipped: 0,
        errors: 0
      };
    });
    
    console.log(`🔄 Processing ${allBoxHeroItems.length} BoxHero items...`);
    
    // Process each BoxHero item
    for (const boxHeroItem of allBoxHeroItems) {
      try {
        const attrs = boxHeroItem.attrs || [];
        
        // Find category attribute
        const categoryAttr = attrs.find((attr: any) => 
          attr.name?.toLowerCase() === 'category'
        );
        
        if (!categoryAttr?.value) {
          continue; // Skip items without category
        }
        
        const boxheroCategory = categoryAttr.value.toString().toLowerCase();
        let targetCategorySlug: string | null = null;
        
        // Map BoxHero categories to our categories
        switch (boxheroCategory) {
          case 'hair':
            targetCategorySlug = 'hair';
            break;
          case 'bath & body':
            targetCategorySlug = 'bath-body';
            break;
          case 'skincare':
            targetCategorySlug = 'skincare';
            break;
          case 'health & personal care':
            targetCategorySlug = 'health-personal-care';
            break;
          case 'food & beverage':
            targetCategorySlug = 'food-beverage';
            break;
          case 'makeup':
            targetCategorySlug = 'makeup';
            break;
          case 'home':
            targetCategorySlug = 'home';
            break;
          default:
            continue; // Skip unknown categories
        }
        
        const targetCategoryId = categoryMap.get(targetCategorySlug);
        if (!targetCategoryId) {
          continue;
        }
        
        // Find corresponding product in our database
        const ourProduct = allOurProducts.find(product => 
          product.sku === boxHeroItem.sku ||
          product.metadata?.boxhero_id === boxHeroItem.id ||
          product.name_en.toLowerCase() === boxHeroItem.name.toLowerCase()
        );
        
        if (!ourProduct) {
          // Product doesn't exist in our database - this would need a sync
          continue;
        }
        
        // Check if product needs category update
        if (ourProduct.category_id !== targetCategoryId) {
          const { error } = await supabase
            .from('products')
            .update({ category_id: targetCategoryId })
            .eq('id', ourProduct.id);
          
          if (error) {
            errors.push(`Failed to update ${ourProduct.name_en} (${ourProduct.sku}): ${error.message}`);
            categoryUpdates[targetCategorySlug].errors++;
            totalErrors++;
          } else {
            categoryUpdates[targetCategorySlug].updated++;
            totalUpdated++;
            console.log(`✅ Updated ${ourProduct.name_en} to ${targetCategorySlug}`);
          }
        } else {
          categoryUpdates[targetCategorySlug].skipped++;
        }
        
      } catch (itemError) {
        errors.push(`Error processing ${boxHeroItem.name}: ${itemError instanceof Error ? itemError.message : 'Unknown error'}`);
        totalErrors++;
      }
    }
    
    // Also handle products that might be miscategorized (not in BoxHero but in our database)
    console.log('🔄 Checking for miscategorized products...');
    
    for (const ourProduct of allOurProducts) {
      if (!ourProduct.category_id) continue; // Skip uncategorized products
      
      // Find corresponding BoxHero item
      const boxHeroItem = allBoxHeroItems.find(item =>
        item.sku === ourProduct.sku ||
        item.id === ourProduct.metadata?.boxhero_id ||
        item.name.toLowerCase() === ourProduct.name_en.toLowerCase()
      );
      
      if (boxHeroItem) {
        const attrs = boxHeroItem.attrs || [];
        const categoryAttr = attrs.find((attr: any) => 
          attr.name?.toLowerCase() === 'category'
        );
        
        if (categoryAttr?.value) {
          const boxheroCategory = categoryAttr.value.toString().toLowerCase();
          let correctCategorySlug: string | null = null;
          
          switch (boxheroCategory) {
            case 'hair': correctCategorySlug = 'hair'; break;
            case 'bath & body': correctCategorySlug = 'bath-body'; break;
            case 'skincare': correctCategorySlug = 'skincare'; break;
            case 'health & personal care': correctCategorySlug = 'health-personal-care'; break;
            case 'food & beverage': correctCategorySlug = 'food-beverage'; break;
            case 'makeup': correctCategorySlug = 'makeup'; break;
            case 'home': correctCategorySlug = 'home'; break;
          }
          
          if (correctCategorySlug) {
            const correctCategoryId = categoryMap.get(correctCategorySlug);
            
            if (correctCategoryId && ourProduct.category_id !== correctCategoryId) {
              const { error } = await supabase
                .from('products')
                .update({ category_id: correctCategoryId })
                .eq('id', ourProduct.id);
              
              if (error) {
                errors.push(`Failed to recategorize ${ourProduct.name_en}: ${error.message}`);
                totalErrors++;
              } else {
                categoryUpdates[correctCategorySlug].updated++;
                totalUpdated++;
                console.log(`✅ Recategorized ${ourProduct.name_en} to ${correctCategorySlug}`);
              }
            }
          }
        }
      }
    }
    
    console.log(`✅ Category fix completed. Updated ${totalUpdated} products.`);
    
    return NextResponse.json({
      success: true,
      totalUpdated,
      totalErrors,
      categoryUpdates,
      errors: errors.slice(0, 10), // Limit errors shown
      message: `Successfully updated ${totalUpdated} products across all categories`,
      summary: {
        processedItems: allBoxHeroItems.length,
        totalProducts: allOurProducts.length,
        categoriesProcessed: categories.length
      }
    });
    
  } catch (error) {
    console.error('❌ Comprehensive category fix error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to fix categories',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
