import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { withAdminAuth } from '@/lib/auth/admin-middleware';

/**
 * Fix Health & Personal Care category - missing 22 products
 * Based on analysis: BoxHero 52 vs Our 30 (-22 missing)
 */
export const POST = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('🔧 Starting Health & Personal Care category fix...');
    // Disable in production unless explicitly enabled
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEBUG_ENDPOINTS !== 'true') {
      return NextResponse.json({ success: false, error: 'Endpoint disabled in production' }, { status: 404 });
    }
    
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
    
    // Audit log successful debug operation
    try {
      await supabase.rpc('log_admin_activity', {
        p_admin_user_id: adminUser?.id || null,
        p_action_type: 'debug_fix_health_personal_care',
        p_action_description: `Updated ${updatedCount} products (notFound: ${notFoundCount}, errors: ${errors.length})`,
        p_resource_type: 'debug_endpoint',
        p_resource_name: 'fix-health-personal-care',
        p_metadata: { endpoint: request.nextUrl?.pathname, method: request.method }
      });
    } catch {}

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

    // Audit log failure
    try {
      const adminClient = createServiceRoleClient();
      await adminClient.rpc('log_admin_activity', {
        p_admin_user_id: (typeof adminUser !== 'undefined' && adminUser?.id) ? adminUser.id : null,
        p_action_type: 'debug_fix_health_personal_care',
        p_action_description: 'Failed to fix Health & Personal Care category',
        p_resource_type: 'debug_endpoint',
        p_resource_name: 'fix-health-personal-care',
        p_metadata: { error: error instanceof Error ? error.message : 'Unknown error', endpoint: request.nextUrl?.pathname, method: request.method }
      });
    } catch {}

    return NextResponse.json(
      {
        error: 'Failed to fix Health & Personal Care category',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}, { rateLimitType: 'admin_bulk_operations' })
