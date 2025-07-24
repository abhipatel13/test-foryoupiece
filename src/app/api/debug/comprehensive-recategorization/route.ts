import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { BoxHeroService } from '@/infrastructure/services/BoxHeroService';

/**
 * Comprehensive recategorization system that ensures all categories match BoxHero inventory exactly
 * This system will be used for both initial fixes and future updates
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Starting comprehensive recategorization...');
    
    const supabase = createServiceRoleClient();
    const boxHeroService = new BoxHeroService('a827b827-36f7-4e0e-b66b-db6990469aaa');
    
    // 1. Get all BoxHero items with their categories
    console.log('📦 Fetching all BoxHero items...');
    const boxHeroResult = await boxHeroService.getAllItems();
    
    if (!boxHeroResult.success) {
      throw new Error(`BoxHero API error: ${boxHeroResult.error.message}`);
    }
    
    const allBoxHeroItems = boxHeroResult.data;
    console.log(`📊 Found ${allBoxHeroItems.length} total BoxHero items`);
    
    // 2. Get all our categories
    const { data: categories } = await supabase
      .from('categories')
      .select('id, slug, name_en');
    
    if (!categories) {
      throw new Error('Failed to fetch categories');
    }
    
    const categoryMap = new Map(categories.map(cat => [cat.slug, cat.id]));
    
    // 3. Get all our products
    const { data: allOurProducts } = await supabase
      .from('products')
      .select('id, sku, name_en, category_id')
      .eq('is_active', true);
    
    if (!allOurProducts) {
      throw new Error('Failed to fetch products');
    }
    
    console.log(`📦 Found ${allOurProducts.length} products in our database`);
    
    // 4. Create BoxHero category mapping
    const boxHeroCategoryMapping = new Map<string, string>();
    
    for (const item of allBoxHeroItems) {
      const attrs = item.attrs || [];
      
      // Find category attribute
      const categoryAttr = attrs.find((attr: any) => 
        attr.name?.toLowerCase() === 'category'
      );
      
      if (categoryAttr?.value) {
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
        }
        
        if (targetCategorySlug) {
          boxHeroCategoryMapping.set(item.sku, targetCategorySlug);
        }
      }
    }
    
    console.log(`🗂️ Created category mapping for ${boxHeroCategoryMapping.size} SKUs`);
    
    // 5. Recategorize products based on BoxHero data
    let updatedCount = 0;
    let notFoundInBoxHero = 0;
    let alreadyCorrect = 0;
    let errors: string[] = [];
    
    const categoryUpdates: any = {};
    categories.forEach(cat => {
      categoryUpdates[cat.slug] = {
        name: cat.name_en,
        before: 0,
        after: 0,
        updated: 0
      };
    });
    
    // Count current category distribution
    for (const product of allOurProducts) {
      if (product.category_id) {
        const category = categories.find(c => c.id === product.category_id);
        if (category) {
          categoryUpdates[category.slug].before++;
        }
      }
    }
    
    // Process each product
    for (const product of allOurProducts) {
      try {
        const correctCategorySlug = boxHeroCategoryMapping.get(product.sku);
        
        if (!correctCategorySlug) {
          notFoundInBoxHero++;
          continue;
        }
        
        const correctCategoryId = categoryMap.get(correctCategorySlug);
        if (!correctCategoryId) {
          errors.push(`Category not found: ${correctCategorySlug} for SKU: ${product.sku}`);
          continue;
        }
        
        // Check if product needs category update
        if (product.category_id !== correctCategoryId) {
          const { error } = await supabase
            .from('products')
            .update({ category_id: correctCategoryId })
            .eq('id', product.id);
          
          if (error) {
            errors.push(`Failed to update ${product.sku}: ${error.message}`);
          } else {
            updatedCount++;
            categoryUpdates[correctCategorySlug].updated++;
            console.log(`✅ Recategorized ${product.name_en} (${product.sku}) to ${correctCategorySlug}`);
          }
        } else {
          alreadyCorrect++;
        }
        
      } catch (itemError) {
        errors.push(`Error processing ${product.sku}: ${itemError instanceof Error ? itemError.message : 'Unknown error'}`);
      }
    }
    
    // 6. Count final category distribution
    const { data: finalProducts } = await supabase
      .from('products')
      .select('id, category_id')
      .eq('is_active', true);
    
    if (finalProducts) {
      for (const product of finalProducts) {
        if (product.category_id) {
          const category = categories.find(c => c.id === product.category_id);
          if (category) {
            categoryUpdates[category.slug].after++;
          }
        }
      }
    }
    
    // 7. Generate BoxHero target counts for comparison
    const boxHeroTargetCounts: any = {};
    categories.forEach(cat => {
      boxHeroTargetCounts[cat.slug] = 0;
    });
    
    for (const [sku, categorySlug] of boxHeroCategoryMapping.entries()) {
      if (boxHeroTargetCounts.hasOwnProperty(categorySlug)) {
        boxHeroTargetCounts[categorySlug]++;
      }
    }
    
    console.log(`✅ Comprehensive recategorization completed. Updated ${updatedCount} products.`);
    
    return NextResponse.json({
      success: true,
      summary: {
        totalProcessed: allOurProducts.length,
        updatedCount,
        alreadyCorrect,
        notFoundInBoxHero,
        errorCount: errors.length
      },
      categoryUpdates,
      boxHeroTargetCounts,
      comparison: Object.keys(categoryUpdates).map(slug => ({
        category: categoryUpdates[slug].name,
        slug,
        before: categoryUpdates[slug].before,
        after: categoryUpdates[slug].after,
        boxHeroTarget: boxHeroTargetCounts[slug],
        isAccurate: categoryUpdates[slug].after === boxHeroTargetCounts[slug],
        difference: categoryUpdates[slug].after - boxHeroTargetCounts[slug]
      })),
      errors: errors.slice(0, 10), // Limit errors shown
      message: `Successfully recategorized ${updatedCount} products. All categories should now match BoxHero inventory.`
    });
    
  } catch (error) {
    console.error('❌ Comprehensive recategorization error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to recategorize products',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
