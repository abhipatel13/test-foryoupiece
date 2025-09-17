import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { withAdminAuth } from '@/lib/auth/admin-middleware';

/**
 * Categorize products based on their BoxHero metadata attributes
 * This specifically addresses the Home category discrepancy issue
 */
export const POST = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('🔄 Starting BoxHero-based product categorization...');
    // Disable in production unless explicitly enabled
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEBUG_ENDPOINTS !== 'true') {
      return NextResponse.json({ success: false, error: 'Endpoint disabled in production' }, { status: 404 });
    }
    
    const supabase = createServiceRoleClient();
    
    // Get all categories for reference
    const { data: categories } = await supabase
      .from('categories')
      .select('id, slug, name_en');
    
    if (!categories) {
      throw new Error('Failed to fetch categories');
    }
    
    const categoryMap = new Map(categories.map(cat => [cat.slug, cat.id]));
    
    let categorizedCount = 0;
    let errors: string[] = [];
    
    // Get all products with BoxHero metadata that are uncategorized or need recategorization
    const { data: products } = await supabase
      .from('products')
      .select('id, sku, name_en, metadata, category_id')
      .eq('is_active', true)
      .not('metadata', 'is', null);
    
    if (!products) {
      throw new Error('Failed to fetch products');
    }
    
    console.log(`📦 Found ${products.length} products with BoxHero metadata`);
    
    for (const product of products) {
      try {
        const metadata = product.metadata as any;
        const boxheroAttrs = metadata?.boxhero_attrs;
        
        if (!boxheroAttrs || !Array.isArray(boxheroAttrs)) {
          continue;
        }
        
        // Find category attribute from BoxHero
        const categoryAttr = boxheroAttrs.find((attr: any) => 
          attr.name?.toLowerCase() === 'category'
        );
        
        if (!categoryAttr?.value) {
          continue;
        }
        
        const boxheroCategory = categoryAttr.value.toString().toLowerCase();
        let targetCategoryId: string | null = null;
        
        // Map BoxHero categories to our categories
        switch (boxheroCategory) {
          case 'home':
            targetCategoryId = categoryMap.get('home') || null;
            break;
          case 'hair':
            targetCategoryId = categoryMap.get('hair') || null;
            break;
          case 'bath & body':
            targetCategoryId = categoryMap.get('bath-body') || null;
            break;
          case 'skincare':
            targetCategoryId = categoryMap.get('skincare') || null;
            break;
          case 'makeup':
            targetCategoryId = categoryMap.get('makeup') || null;
            break;
          case 'health & personal care':
            targetCategoryId = categoryMap.get('health-personal-care') || null;
            break;
          case 'food & beverage':
            targetCategoryId = categoryMap.get('food-beverage') || null;
            break;
          default:
            // Try to match partial names
            if (boxheroCategory.includes('home')) {
              targetCategoryId = categoryMap.get('home') || null;
            } else if (boxheroCategory.includes('hair')) {
              targetCategoryId = categoryMap.get('hair') || null;
            } else if (boxheroCategory.includes('bath') || boxheroCategory.includes('body')) {
              targetCategoryId = categoryMap.get('bath-body') || null;
            } else if (boxheroCategory.includes('skin')) {
              targetCategoryId = categoryMap.get('skincare') || null;
            } else if (boxheroCategory.includes('makeup')) {
              targetCategoryId = categoryMap.get('makeup') || null;
            } else if (boxheroCategory.includes('health') || boxheroCategory.includes('personal')) {
              targetCategoryId = categoryMap.get('health-personal-care') || null;
            } else if (boxheroCategory.includes('food') || boxheroCategory.includes('beverage')) {
              targetCategoryId = categoryMap.get('food-beverage') || null;
            }
            break;
        }
        
        // Only update if we found a target category and it's different from current
        if (targetCategoryId && targetCategoryId !== product.category_id) {
          const { error } = await supabase
            .from('products')
            .update({ category_id: targetCategoryId })
            .eq('id', product.id);
          
          if (error) {
            errors.push(`Failed to categorize ${product.name_en}: ${error.message}`);
          } else {
            categorizedCount++;
            const categoryName = categories.find(c => c.id === targetCategoryId)?.name_en || 'Unknown';
            console.log(`✅ Categorized ${product.name_en} as ${categoryName} (BoxHero: ${boxheroCategory})`);
          }
        }
        
      } catch (itemError) {
        errors.push(`Error processing ${product.name_en}: ${itemError instanceof Error ? itemError.message : 'Unknown error'}`);
      }
    }
    
    console.log(`✅ BoxHero categorization completed. Categorized ${categorizedCount} products.`);
    
    // Audit log successful debug operation
    try {
      await supabase.rpc('log_admin_activity', {
        p_admin_user_id: adminUser?.id || null,
        p_action_type: 'debug_categorize_boxhero_products',
        p_action_description: `Categorized ${categorizedCount} products (total processed: ${products.length}, errors: ${errors.length})`,
        p_resource_type: 'debug_endpoint',
        p_resource_name: 'categorize-boxhero-products',
        p_metadata: { endpoint: request.nextUrl?.pathname, method: request.method }
      });
    } catch {}

    return NextResponse.json({
      success: true,
      categorizedCount,
      totalProcessed: products.length,
      errors,
      message: `Successfully categorized ${categorizedCount} products based on BoxHero metadata`,
      recommendations: [
        'Run Home category analysis again to verify fixes',
        'Check all category counts on frontend',
        'Verify products are displaying in correct categories'
      ]
    });
    
  } catch (error) {
    console.error('❌ BoxHero categorization error:', error);

    // Audit log failure
    try {
      const adminClient = createServiceRoleClient();
      await adminClient.rpc('log_admin_activity', {
        p_admin_user_id: (typeof adminUser !== 'undefined' && adminUser?.id) ? adminUser.id : null,
        p_action_type: 'debug_categorize_boxhero_products',
        p_action_description: 'Failed to categorize products using BoxHero metadata',
        p_resource_type: 'debug_endpoint',
        p_resource_name: 'categorize-boxhero-products',
        p_metadata: { error: error instanceof Error ? error.message : 'Unknown error', endpoint: request.nextUrl?.pathname, method: request.method }
      });
    } catch {}

    return NextResponse.json(
      {
        error: 'Failed to categorize products using BoxHero metadata',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}, { rateLimitType: 'admin_bulk_operations' })
