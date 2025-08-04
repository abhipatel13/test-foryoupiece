import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { BoxHeroService } from '@/infrastructure/services/BoxHeroService';

/**
 * Automated product categorization system that runs during BoxHero sync
 * Ensures all products are categorized based on their BoxHero category attribute
 * This will be called automatically during sync operations to maintain accuracy
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🤖 Starting automated product categorization...');
    
    const supabase = createServiceRoleClient();
    const boxHeroService = new BoxHeroService('a827b827-36f7-4e0e-b66b-db6990469aaa');
    
    // Get request parameters
    const { targetSKUs, dryRun = false } = await request.json();
    
    // 1. Get all BoxHero items or specific SKUs
    console.log('📦 Fetching BoxHero items...');
    const boxHeroResult = await boxHeroService.getAllItems();
    
    if (!boxHeroResult.success) {
      throw new Error(`BoxHero API error: ${boxHeroResult.error.message}`);
    }
    
    let boxHeroItems = boxHeroResult.data;
    
    // Filter to specific SKUs if provided
    if (targetSKUs && targetSKUs.length > 0) {
      boxHeroItems = boxHeroItems.filter(item => targetSKUs.includes(item.sku));
      console.log(`🎯 Filtering to ${boxHeroItems.length} specific SKUs`);
    }
    
    // 2. Get all our categories
    const { data: categories } = await supabase
      .from('categories')
      .select('id, slug, name_en');
    
    if (!categories) {
      throw new Error('Failed to fetch categories');
    }
    
    const categoryMap = new Map(categories.map(cat => [cat.slug, cat.id]));
    
    // 3. Process each BoxHero item
    let processedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    
    for (const boxHeroItem of boxHeroItems) {
      try {
        processedCount++;
        
        const attrs = boxHeroItem.attrs || [];
        
        // Find category attribute
        const categoryAttr = attrs.find((attr: any) => 
          attr.name?.toLowerCase() === 'category'
        );
        
        if (!categoryAttr?.value) {
          skippedCount++;
          continue;
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
            skippedCount++;
            continue;
        }
        
        const targetCategoryId = categoryMap.get(targetCategorySlug);
        if (!targetCategoryId) {
          errors.push(`Category not found: ${targetCategorySlug} for SKU: ${boxHeroItem.sku}`);
          errorCount++;
          continue;
        }
        
        // Find corresponding product in our database
        const { data: product } = await supabase
          .from('products')
          .select('id, name_en, category_id')
          .eq('sku', boxHeroItem.sku)
          .eq('is_active', true)
          .single();
        
        if (!product) {
          skippedCount++;
          continue;
        }
        
        // Check if product needs category update
        if (product.category_id !== targetCategoryId) {
          if (!dryRun) {
            const { error } = await supabase
              .from('products')
              .update({ category_id: targetCategoryId })
              .eq('id', product.id);
            
            if (error) {
              errors.push(`Failed to update ${boxHeroItem.sku}: ${error.message}`);
              errorCount++;
            } else {
              updatedCount++;
              console.log(`✅ Auto-categorized ${product.name_en} (${boxHeroItem.sku}) to ${targetCategorySlug}`);
            }
          } else {
            updatedCount++;
            console.log(`🔍 [DRY RUN] Would categorize ${product.name_en} (${boxHeroItem.sku}) to ${targetCategorySlug}`);
          }
        }
        
      } catch (itemError) {
        errors.push(`Error processing ${boxHeroItem.sku}: ${itemError instanceof Error ? itemError.message : 'Unknown error'}`);
        errorCount++;
      }
    }
    
    console.log(`✅ Automated categorization completed. ${dryRun ? '[DRY RUN] ' : ''}Updated ${updatedCount} products.`);
    
    return NextResponse.json({
      success: true,
      dryRun,
      summary: {
        processedCount,
        updatedCount,
        skippedCount,
        errorCount
      },
      errors: errors.slice(0, 10),
      message: `${dryRun ? '[DRY RUN] ' : ''}Successfully processed ${processedCount} items, updated ${updatedCount} products`
    });
    
  } catch (error) {
    console.error('❌ Automated categorization error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to auto-categorize products',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check categorization status
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient();
    
    // Get category counts
    const { data: categoryStats } = await supabase
      .from('products')
      .select('category_id, categories(slug, name_en)')
      .eq('is_active', true);
    
    if (!categoryStats) {
      throw new Error('Failed to fetch category statistics');
    }
    
    const counts: any = {};
    
    for (const item of categoryStats) {
      if (item.category_id && item.categories) {
        const category = item.categories as any;
        const slug = category.slug;
        
        if (!counts[slug]) {
          counts[slug] = {
            name: category.name_en,
            count: 0
          };
        }
        counts[slug].count++;
      }
    }
    
    return NextResponse.json({
      success: true,
      categoryCounts: counts,
      totalProducts: categoryStats.length
    });
    
  } catch (error) {
    console.error('❌ Category status check error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to check category status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
