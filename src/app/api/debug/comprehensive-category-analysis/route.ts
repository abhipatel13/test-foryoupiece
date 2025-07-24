import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { BoxHeroService } from '@/infrastructure/services/BoxHeroService';

/**
 * Comprehensive analysis of ALL category discrepancies between BoxHero and our database
 * Analyzes Hair, Bath & Body, Skincare, Health & Personal Care, Food & Beverage, Makeup, and Home
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Starting comprehensive category analysis...');

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
    
    // 2. Get all categories from our database
    const { data: categories } = await supabase
      .from('categories')
      .select('id, slug, name_en');
    
    if (!categories) {
      throw new Error('Failed to fetch categories');
    }
    
    // 3. Get all our products from database
    const { data: allOurProducts } = await supabase
      .from('products')
      .select('id, sku, name_en, category_id, metadata')
      .eq('is_active', true);
    
    // 4. Define category mapping logic
    const categorizeBoxHeroItem = (item: any) => {
      const attrs = item.attrs || [];
      
      // Look for category attribute
      const categoryAttr = attrs.find((attr: any) => 
        attr.name?.toLowerCase() === 'category'
      );
      
      if (categoryAttr?.value) {
        const category = categoryAttr.value.toString().toLowerCase();
        
        // Direct mapping
        switch (category) {
          case 'hair': return 'hair';
          case 'bath & body': return 'bath-body';
          case 'skincare': return 'skincare';
          case 'makeup': return 'makeup';
          case 'health & personal care': return 'health-personal-care';
          case 'food & beverage': return 'food-beverage';
          case 'home': return 'home';
        }
        
        // Partial matching
        if (category.includes('hair')) return 'hair';
        if (category.includes('bath') || category.includes('body')) return 'bath-body';
        if (category.includes('skin')) return 'skincare';
        if (category.includes('makeup')) return 'makeup';
        if (category.includes('health') || category.includes('personal')) return 'health-personal-care';
        if (category.includes('food') || category.includes('beverage')) return 'food-beverage';
        if (category.includes('home')) return 'home';
      }
      
      // Fallback to product name analysis
      const name = item.name.toLowerCase();
      if (name.includes('shampoo') || name.includes('conditioner') || name.includes('hair')) return 'hair';
      if (name.includes('soap') || name.includes('body') || name.includes('bath')) return 'bath-body';
      if (name.includes('cream') || name.includes('serum') || name.includes('moisturizer')) return 'skincare';
      if (name.includes('lipstick') || name.includes('foundation') || name.includes('mascara')) return 'makeup';
      if (name.includes('vitamin') || name.includes('supplement')) return 'health-personal-care';
      if (name.includes('snack') || name.includes('drink') || name.includes('tea')) return 'food-beverage';
      if (name.includes('fragrance') || name.includes('cleaner') || name.includes('fabric')) return 'home';
      
      return null;
    };
    
    // 5. Analyze each category
    const categoryAnalysis: any = {};
    
    for (const category of categories) {
      console.log(`🔍 Analyzing ${category.name_en} category...`);
      
      // Get BoxHero items for this category
      const boxHeroItemsForCategory = allBoxHeroItems.filter(item => 
        categorizeBoxHeroItem(item) === category.slug
      );
      
      // Get our products for this category
      const ourProductsForCategory = allOurProducts?.filter(product => 
        product.category_id === category.id
      ) || [];
      
      // Find discrepancies
      const missingFromDatabase: any[] = [];
      const miscategorizedInOurDatabase: any[] = [];
      const uncategorizedInOurDatabase: any[] = [];
      const extraInOurDatabase: any[] = [];
      
      // Check each BoxHero item
      for (const boxHeroItem of boxHeroItemsForCategory) {
        const ourProduct = allOurProducts?.find(product => 
          product.sku === boxHeroItem.sku ||
          product.metadata?.boxhero_id === boxHeroItem.id ||
          product.name_en.toLowerCase() === boxHeroItem.name.toLowerCase()
        );
        
        if (!ourProduct) {
          missingFromDatabase.push({
            boxhero_id: boxHeroItem.id,
            sku: boxHeroItem.sku,
            name: boxHeroItem.name,
            expected_category: category.slug
          });
        } else if (!ourProduct.category_id) {
          uncategorizedInOurDatabase.push({
            our_id: ourProduct.id,
            sku: ourProduct.sku,
            name: ourProduct.name_en,
            boxhero_id: boxHeroItem.id,
            expected_category: category.slug
          });
        } else if (ourProduct.category_id !== category.id) {
          const currentCategory = categories.find(c => c.id === ourProduct.category_id);
          miscategorizedInOurDatabase.push({
            our_id: ourProduct.id,
            sku: ourProduct.sku,
            name: ourProduct.name_en,
            current_category: currentCategory?.slug || 'unknown',
            expected_category: category.slug,
            boxhero_id: boxHeroItem.id
          });
        }
      }
      
      // Check for products in our category that don't exist in BoxHero
      for (const ourProduct of ourProductsForCategory) {
        const boxHeroItem = boxHeroItemsForCategory.find(item =>
          item.sku === ourProduct.sku ||
          item.id === ourProduct.metadata?.boxhero_id ||
          item.name.toLowerCase() === ourProduct.name_en.toLowerCase()
        );
        
        if (!boxHeroItem) {
          extraInOurDatabase.push({
            our_id: ourProduct.id,
            sku: ourProduct.sku,
            name: ourProduct.name_en,
            current_category: category.slug
          });
        }
      }
      
      categoryAnalysis[category.slug] = {
        category_name: category.name_en,
        boxhero_count: boxHeroItemsForCategory.length,
        our_count: ourProductsForCategory.length,
        discrepancy: boxHeroItemsForCategory.length - ourProductsForCategory.length,
        issues: {
          missing_from_database: missingFromDatabase.length,
          miscategorized: miscategorizedInOurDatabase.length,
          uncategorized: uncategorizedInOurDatabase.length,
          extra_in_our_db: extraInOurDatabase.length
        },
        details: {
          missingFromDatabase,
          miscategorizedInOurDatabase,
          uncategorizedInOurDatabase,
          extraInOurDatabase
        }
      };
      
      console.log(`✅ ${category.name_en}: BoxHero=${boxHeroItemsForCategory.length}, Ours=${ourProductsForCategory.length}, Discrepancy=${boxHeroItemsForCategory.length - ourProductsForCategory.length}`);
    }
    
    // 6. Generate summary
    const summary = {
      total_categories: categories.length,
      categories_with_discrepancies: Object.values(categoryAnalysis).filter((cat: any) => cat.discrepancy !== 0).length,
      total_missing_products: Object.values(categoryAnalysis).reduce((sum: number, cat: any) => sum + cat.issues.missing_from_database, 0),
      total_miscategorized: Object.values(categoryAnalysis).reduce((sum: number, cat: any) => sum + cat.issues.miscategorized, 0),
      total_uncategorized: Object.values(categoryAnalysis).reduce((sum: number, cat: any) => sum + cat.issues.uncategorized, 0)
    };
    
    console.log('✅ Comprehensive category analysis completed');
    
    return NextResponse.json({
      success: true,
      summary,
      categoryAnalysis,
      recommendations: [
        'Fix missing products by running sync or manual import',
        'Recategorize miscategorized products to correct categories',
        'Assign categories to uncategorized products',
        'Review extra products that don\'t exist in BoxHero',
        'Run comprehensive fix to resolve all discrepancies'
      ]
    });
    
  } catch (error) {
    console.error('❌ Comprehensive category analysis error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to analyze categories',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
