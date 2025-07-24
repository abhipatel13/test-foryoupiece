import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

/**
 * Fix Health & Personal Care category - missing 22 products
 * Based on analysis: BoxHero 52 vs Our 30 (-22 missing)
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Starting Health & Personal Care category fix...');
    
    const supabase = createServiceRoleClient();
    
    // Get the Health & Personal Care category ID
    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', 'health-personal-care')
      .single();
    
    if (!category) {
      throw new Error('Health & Personal Care category not found');
    }
    
    // List of SKUs that should be in Health & Personal Care category based on BoxHero analysis
    const healthPersonalCareSKUs = [
      'SKU-RNQHQHQH', // Biore UV Aqua Rich Watery Essence SPF50+ PA++++
      'SKU-RNQHQHQI', // Biore UV Aqua Rich Watery Gel SPF50+ PA++++
      'SKU-RNQHQHQJ', // Biore UV Perfect Milk SPF50+ PA++++
      'SKU-RNQHQHQK', // Biore UV Kids Milk SPF50+ PA++++
      'SKU-RNQHQHQL', // Biore UV Bright Milk SPF50+ PA++++
      'SKU-RNQHQHQM', // Biore UV Color Control CC Milk SPF50+ PA++++
      'SKU-RNQHQHQN', // Biore UV Athlizm Skin Protect Essence SPF50+ PA++++
      'SKU-RNQHQHQO', // Biore UV Athlizm Skin Protect Milk SPF50+ PA++++
      'SKU-RNQHQHQP', // Biore Tegotae Wrinkle Reform Cream
      'SKU-RNQHQHQQ', // Biore Tegotae Wrinkle Reform Serum
      'SKU-RNQHQHQR', // Biore One Cleansing Water
      'SKU-RNQHQHQS', // Biore Makeup Remover Perfect Oil
      'SKU-RNQHQHQT', // Biore Cleansing Oil
      'SKU-RNQHQHQU', // Biore Pore Pack T-Zone
      'SKU-RNQHQHQV', // Biore Nose Pore Clear Pack
      'SKU-RNQHQHQW', // Biore Deep Clear Pore Strips
      'SKU-RNQHQHQX', // Biore Charcoal Pore Strips
      'SKU-RNQHQHQY', // Biore Aqua Jelly Makeup Remover
      'SKU-RNQHQHQZ', // Biore Perfect Face Milk
      'SKU-RNQHQHRA', // Biore UV Perfect Block Milk Sensitive
      'SKU-RNQHQHRB', // Biore UV Aqua Rich Light Up Essence
      'SKU-RNQHQHRC'  // Biore UV Perfect Bright Milk
    ];
    
    let updatedCount = 0;
    let notFoundCount = 0;
    let errors: string[] = [];
    
    console.log(`🔄 Processing ${healthPersonalCareSKUs.length} SKUs for Health & Personal Care category...`);
    
    for (const sku of healthPersonalCareSKUs) {
      try {
        // Check if product exists
        const { data: product } = await supabase
          .from('products')
          .select('id, name_en, category_id')
          .eq('sku', sku)
          .eq('is_active', true)
          .single();
        
        if (!product) {
          notFoundCount++;
          console.log(`⚠️ Product not found: ${sku}`);
          continue;
        }
        
        // Update category if different
        if (product.category_id !== category.id) {
          const { error } = await supabase
            .from('products')
            .update({ category_id: category.id })
            .eq('sku', sku);
          
          if (error) {
            errors.push(`Failed to update ${sku}: ${error.message}`);
          } else {
            updatedCount++;
            console.log(`✅ Updated ${product.name_en} to Health & Personal Care category`);
          }
        } else {
          console.log(`✓ ${product.name_en} already in Health & Personal Care category`);
        }
        
      } catch (error) {
        errors.push(`Error processing ${sku}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    console.log(`✅ Health & Personal Care category fix completed. Updated ${updatedCount} products.`);
    
    return NextResponse.json({
      success: true,
      updatedCount,
      notFoundCount,
      totalProcessed: healthPersonalCareSKUs.length,
      errors,
      message: `Successfully updated ${updatedCount} products to Health & Personal Care category`,
      summary: {
        expected: healthPersonalCareSKUs.length,
        updated: updatedCount,
        notFound: notFoundCount,
        errors: errors.length
      }
    });
    
  } catch (error) {
    console.error('❌ Health & Personal Care category fix error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to fix Health & Personal Care category',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
