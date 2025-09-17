import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { withAdminAuth } from '@/lib/auth/admin-middleware';

/**
 * Fix Home category by directly updating products based on their SKUs from BoxHero analysis
 * This addresses the specific issue where 38 Home products are missing from the category
 */
export const POST = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('🔧 Starting Home category fix...');
    // Disable in production unless explicitly enabled
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEBUG_ENDPOINTS !== 'true') {
      return NextResponse.json({ success: false, error: 'Endpoint disabled in production' }, { status: 404 });
    }
    
    const supabase = createServiceRoleClient();
    
    // Get the Home category ID
    const { data: homeCategory } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', 'home')
      .single();
    
    if (!homeCategory) {
      throw new Error('Home category not found');
    }
    
    // List of SKUs that should be in Home category based on BoxHero analysis
    const homeSKUs = [
      'SKU-9J90UT8W',    // Kabi Killer Mold Remover 400g
      'SKU-K3YPZRNJ',    // Kabi Killer Mold Remover, Pack of 2
      'SKU-XYYOWAF0',    // Premium Aroma, Simple Modern Urban Luxe, Room Fragrance 400ml
      'SKU-LK2XB3H4',    // Premium Aroma, Eternal Gift, Room Fragrance 400ml
      'SKU-GSVJUNCL',    // Premium Aroma For Closet Osmanthus Scent 12pcs
      'SKU-VQGDDXVR',    // Kabi Killer Mold Remover, Pack of 3
      'SKU-D17515YH',    // Febreze Disinfecting and Deodorizing Spray for Cloth 370ml
      'SKU-E597KYA0',    // Seria Oil Stain Removal Sheets, Kitchen Cleaning Sheets, 46 Sheets
      'SKU-O9Z4USKE',    // Premium Aroma, Simple Modern Velvet Musk, Room Fragrance 400ml
      'SKU-YJIVTL0L',    // Premium Aroma, Grace Beaute, Room Fragrance 400ml
      'SKU-2S626NGR',    // Premium Aroma, Osmanthus Scent, Room Fragrance 400ml
      'SKU-NCDFT7TC',    // Premium Aroma For Closet, Hanging Type, Osmanthus Scent 1 piece
      'SKU-YFU5L8SL',    // Sarasati Lingerie Detergent, For Menstrual Blood Scent, Soap Scent 120ml
      'SKU-T4GU5P5Y',    // FLAIR Fabric Softener Savon de Savon Scent 940ml
      'SKU-KJDXFF47',    // FLAIR Fabric Softener Floral Sweet Scent 940ml
      'SKU-4C8EX70J',    // Laundrin' Fabric Mist, Classic Floral Scent, 370ml
      'SKU-P3OHZLOM',    // Replica Notes Fabric Mist, Sensual Fruity Scent, 300ml
      'SKU-CV7H155A',    // Premium Aroma, Fruity, Room Fragrance 400ml
      'SKU-PU5MJ46I',    // Premium Aroma, Crystal Snow, Toilet Fragrance 400ml
      'SKU-T481SJMW',    // Premium Aroma, Sweet Orange and Bergamot, Room Fragrance 400ml
      'SKU-IQUGKABF',    // Premium Aroma, Crystal Snow, Room Fragrance 400ml
      'SKU-A5KF1HLH',    // IROKA Fabric Mist Naked Lily Fragrance 200ml
      'SKU-CKZ72LQ7',    // Premium Aroma, Simple Modern Urban Luxe, Toilet Fragrance 400ml
      'SKU-95DHCTW2',    // Premium Aroma, Urban Romance, Toilet Fragrance 400ml
      'SKU-N5QDZK6T',    // Premium Aroma, Velvet Musk, Room and Toilet Set, 400ml x 2
      'SKU-TORCH2ND',    // Premium Aroma, Sakura Scent, Room Fragrance 400ml
      'SKU-QJPLBYLG',    // Premium Aroma, Sakura Scent, Toilet Fragrance 400ml
      'SKU-SQUDCJAP',    // Premium Aroma, Moonlight Savon, Room Fragrance 400ml
      'SKU-AOWU990A',    // Laundrin' Fabric Mist, Sakura Scent, 370ml
      'SKU-ZM5U7JN6',    // Febreze Premium Disinfecting and Deodorizing, Sakura Scent, 370ml
      'SKU-AOL8SGG3',    // Premium Aroma Urban Luxe, Diffuser Type
      'SKU-9FDKF18J',    // Premium Aroma Sakura Scent, Diffuser Type
      'SKU-ASPUDU7E',    // Premium Aroma Mimosa, Diffuser Type
      'SKU-J2FHD7S5',    // Laundrin' Fabric Softener, Classic Floral Scent 1920ml
      'SKU-AL2AAZNR',    // Premium Aroma, Mimosa, Room Fragrance 400ml
      'SKU-PS97HY4I'     // Replica Notes Fabric Mist, Feminine Flower, 300ml
    ];
    
    let updatedCount = 0;
    let notFoundCount = 0;
    let errors: string[] = [];
    
    console.log(`🔄 Processing ${homeSKUs.length} SKUs for Home category...`);
    
    for (const sku of homeSKUs) {
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
        if (product.category_id !== homeCategory.id) {
          const { error } = await supabase
            .from('products')
            .update({ category_id: homeCategory.id })
            .eq('sku', sku);
          
          if (error) {
            errors.push(`Failed to update ${sku}: ${error.message}`);
          } else {
            updatedCount++;
            console.log(`✅ Updated ${product.name_en} to Home category`);
          }
        } else {
          console.log(`✓ ${product.name_en} already in Home category`);
        }
        
      } catch (error) {
        errors.push(`Error processing ${sku}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    console.log(`✅ Home category fix completed. Updated ${updatedCount} products.`);
    
    // Audit log successful debug operation
    try {
      await supabase.rpc('log_admin_activity', {
        p_admin_user_id: adminUser?.id || null,
        p_action_type: 'debug_fix_home_category',
        p_action_description: `Updated ${updatedCount} products (notFound: ${notFoundCount}, errors: ${errors.length})`,
        p_resource_type: 'debug_endpoint',
        p_resource_name: 'fix-home-category',
        p_metadata: { endpoint: request.nextUrl?.pathname, method: request.method }
      });
    } catch {}

    return NextResponse.json({
      success: true,
      updatedCount,
      notFoundCount,
      totalProcessed: homeSKUs.length,
      errors,
      message: `Successfully updated ${updatedCount} products to Home category`,
      summary: {
        expected: homeSKUs.length,
        updated: updatedCount,
        notFound: notFoundCount,
        errors: errors.length
      }
    });
    
  } catch (error) {
    console.error('❌ Home category fix error:', error);

    // Audit log failure
    try {
      const adminClient = createServiceRoleClient();
      await adminClient.rpc('log_admin_activity', {
        p_admin_user_id: (typeof adminUser !== 'undefined' && adminUser?.id) ? adminUser.id : null,
        p_action_type: 'debug_fix_home_category',
        p_action_description: 'Failed to fix Home category',
        p_resource_type: 'debug_endpoint',
        p_resource_name: 'fix-home-category',
        p_metadata: { error: error instanceof Error ? error.message : 'Unknown error', endpoint: request.nextUrl?.pathname, method: request.method }
      });
    } catch {}

    return NextResponse.json(
      {
        error: 'Failed to fix Home category',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}, { rateLimitType: 'admin_bulk_operations' })
