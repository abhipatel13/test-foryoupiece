import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { CategoriesService } from '@/lib/categories-service';

/**
 * Fix category data accuracy issues
 * Recategorizes miscategorized products and categorizes uncategorized products
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Starting category recategorization fix...');
    
    const supabase = createServiceRoleClient();
    
    // Get all categories for reference
    const categories = await CategoriesService.getCategories();
    const categoryMap = new Map(categories.map(cat => [cat.slug, cat.id]));
    
    let fixedCount = 0;
    let errors: string[] = [];
    
    // 1. Fix miscategorized products in Home category
    console.log('🏠 Fixing Home category miscategorizations...');
    
    const homeId = categoryMap.get('home');
    const bathBodyId = categoryMap.get('bath-body');
    const healthId = categoryMap.get('health-personal-care');
    
    if (!homeId || !bathBodyId || !healthId) {
      throw new Error('Required categories not found');
    }
    
    // Get all Home category products
    const { data: homeProducts } = await supabase
      .from('products')
      .select('id, sku, name_en, tags')
      .eq('is_active', true)
      .eq('category_id', homeId);
    
    // Recategorize perfumes/fragrances to Bath & Body
    const perfumeProducts = homeProducts?.filter(product => {
      const name = product.name_en.toLowerCase();
      const tags = product.tags?.join(' ').toLowerCase() || '';
      return (name.includes('perfume') || name.includes('parfum') || 
              name.includes('fiancée') || name.includes('aqua savon') ||
              tags.includes('body mist') || tags.includes('fiancée') || 
              tags.includes('aqua savon'));
    }) || [];
    
    for (const product of perfumeProducts) {
      const { error } = await supabase
        .from('products')
        .update({ category_id: bathBodyId })
        .eq('id', product.id);
      
      if (error) {
        errors.push(`Failed to recategorize ${product.name_en}: ${error.message}`);
      } else {
        fixedCount++;
        console.log(`✅ Moved ${product.name_en} to Bath & Body`);
      }
    }
    
    // Recategorize health supplements to Health & Personal Care
    const healthProducts = homeProducts?.filter(product => {
      const name = product.name_en.toLowerCase();
      const tags = product.tags?.join(' ').toLowerCase() || '';
      return (name.includes('mct oil') || name.includes('supplement') ||
              tags.includes('health') || tags.includes('supplements'));
    }) || [];
    
    for (const product of healthProducts) {
      const { error } = await supabase
        .from('products')
        .update({ category_id: healthId })
        .eq('id', product.id);
      
      if (error) {
        errors.push(`Failed to recategorize ${product.name_en}: ${error.message}`);
      } else {
        fixedCount++;
        console.log(`✅ Moved ${product.name_en} to Health & Personal Care`);
      }
    }
    
    // 2. Categorize uncategorized products
    console.log('📦 Categorizing uncategorized products...');
    
    const { data: uncategorizedProducts } = await supabase
      .from('products')
      .select('id, sku, name_en, tags')
      .eq('is_active', true)
      .is('category_id', null)
      .limit(50); // Process in batches
    
    for (const product of uncategorizedProducts || []) {
      const name = product.name_en.toLowerCase();
      const tags = product.tags?.join(' ').toLowerCase() || '';
      
      let targetCategoryId: string | null = null;
      
      // Categorization logic based on product name and tags
      if (tags.includes('makeup') || tags.includes('canmake') || 
          name.includes('mascara') || name.includes('foundation') || 
          name.includes('highlighter') || name.includes('cheeks')) {
        targetCategoryId = categoryMap.get('makeup') || null;
      }
      else if (tags.includes('home') || tags.includes('cleaner') || 
               tags.includes('home fragrance') || name.includes('mold remover') ||
               name.includes('room fragrance') || name.includes('toilet fragrance')) {
        targetCategoryId = categoryMap.get('home') || null;
      }
      else if (tags.includes('health') || tags.includes('supplements') || 
               tags.includes('deodorant') || tags.includes('oral care') ||
               name.includes('dhc') || name.includes('breath care') ||
               name.includes('muhi') || name.includes('eye drops')) {
        targetCategoryId = categoryMap.get('health-personal-care') || null;
      }
      else if (tags.includes('skincare') || tags.includes('lip care') ||
               name.includes('lip scrub') || name.includes('face mask')) {
        targetCategoryId = categoryMap.get('skincare') || null;
      }
      else if (tags.includes('food') || tags.includes('matcha') || 
               tags.includes('tea') || name.includes('matcha') ||
               name.includes('tea')) {
        targetCategoryId = categoryMap.get('food-beverage') || null;
      }
      else if (tags.includes('bath') || tags.includes('body') ||
               name.includes('body wash') || name.includes('lotion')) {
        targetCategoryId = categoryMap.get('bath-body') || null;
      }
      else if (tags.includes('hair') || name.includes('shampoo') ||
               name.includes('hair')) {
        targetCategoryId = categoryMap.get('hair') || null;
      }
      
      if (targetCategoryId) {
        const { error } = await supabase
          .from('products')
          .update({ category_id: targetCategoryId })
          .eq('id', product.id);
        
        if (error) {
          errors.push(`Failed to categorize ${product.name_en}: ${error.message}`);
        } else {
          fixedCount++;
          const categoryName = categories.find(c => c.id === targetCategoryId)?.name_en || 'Unknown';
          console.log(`✅ Categorized ${product.name_en} as ${categoryName}`);
        }
      }
    }
    
    console.log(`✅ Categorization fix completed. Fixed ${fixedCount} products.`);
    
    return NextResponse.json({
      success: true,
      fixedCount,
      errors,
      message: `Successfully recategorized ${fixedCount} products`,
      recommendations: [
        'Run category analysis again to verify fixes',
        'Check category counts on frontend',
        'Test category filtering functionality'
      ]
    });
    
  } catch (error) {
    console.error('❌ Categorization fix error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to fix categorization',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
