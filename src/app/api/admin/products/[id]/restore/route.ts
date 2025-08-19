import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { withAdminAuth } from '@/lib/auth/admin-middleware';

/**
 * Restore a deleted product by ID (Super Admin Only)
 * PUT /api/admin/products/[id]/restore
 */
export const PUT = withAdminAuth(async (
  request: NextRequest,
  { user, adminUser },
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Product ID is required',
      }, { status: 400 });
    }

    // ENHANCED SECURITY: Only super_admin can restore products
    if (adminUser.role !== 'super_admin') {
      console.warn(`🚫 Product restoration denied - insufficient permissions:`, {
        userId: user.id,
        email: adminUser.email,
        role: adminUser.role,
        productId: id,
        timestamp: new Date().toISOString()
      });
      return NextResponse.json({
        success: false,
        error: 'Only super administrators can restore products',
        security: {
          validated: false,
          reason: 'Insufficient permissions for restoration',
          requiredRole: 'super_admin',
          currentRole: adminUser.role,
          admin: adminUser.email,
          operation: 'RESTORE',
          timestamp: new Date().toISOString()
        }
      }, { status: 403 });
    }

    // Use Supabase service role client (bypasses RLS)
    const supabase = createServiceRoleClient();

    // Check if product exists and is deleted
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('id, sku, name_en, is_active, is_deleted, deleted_at, deleted_by')
      .eq('id', id)
      .single();

    if (fetchError || !product) {
      return NextResponse.json({
        success: false,
        error: 'Product not found',
      }, { status: 404 });
    }

    if (!product.is_deleted) {
      return NextResponse.json({
        success: false,
        error: 'Product is not deleted and cannot be restored',
      }, { status: 400 });
    }

    console.log('🔄 Starting product restoration process:', {
      productId: id,
      sku: product.sku,
      name: product.name_en,
      adminEmail: adminUser.email,
      timestamp: new Date().toISOString()
    });

    // Restore the product
    const now = new Date().toISOString();
    const { data: restoredProduct, error: restoreError } = await supabase
      .from('products')
      .update({ 
        is_active: true,
        is_deleted: false,
        deleted_at: null,
        deleted_by: null,
        deleted_reason: null,
        updated_at: now
      })
      .eq('id', id)
      .select()
      .single();

    if (restoreError) {
      console.error('❌ Product restoration failed:', restoreError);
      
      // Log failed restoration attempt
      await supabase.rpc('log_admin_action', {
        p_actor_user_id: user.id,
        p_actor_email: adminUser.email,
        p_actor_role: adminUser.role,
        p_action: 'product_restore',
        p_resource_id: id,
        p_resource_sku: product.sku,
        p_resource_name: product.name_en,
        p_success: false,
        p_error_message: restoreError.message
      });

      return NextResponse.json({
        success: false,
        error: restoreError.message,
      }, { status: 500 });
    }

    // Log successful restoration
    await supabase.rpc('log_admin_action', {
      p_actor_user_id: user.id,
      p_actor_email: adminUser.email,
      p_actor_role: adminUser.role,
      p_action: 'product_restore',
      p_resource_id: id,
      p_resource_sku: product.sku,
      p_resource_name: product.name_en,
      p_success: true,
      p_metadata: {
        restored_at: now,
        previously_deleted_at: product.deleted_at,
        previously_deleted_by: product.deleted_by
      }
    });

    console.log('✅ Product restoration completed successfully:', {
      productId: id,
      sku: product.sku,
      restoredAt: now
    });

    return NextResponse.json({
      success: true,
      data: restoredProduct,
      message: 'Product restored successfully',
    });

  } catch (error) {
    console.error('❌ Failed to restore product:', error);
    
    // Log failed restoration attempt if we have the necessary info
    try {
      const supabase = createServiceRoleClient();
      await supabase.rpc('log_admin_action', {
        p_actor_user_id: user.id,
        p_actor_email: adminUser.email,
        p_actor_role: adminUser.role,
        p_action: 'product_restore',
        p_resource_id: id,
        p_success: false,
        p_error_message: error instanceof Error ? error.message : 'Unknown error'
      });
    } catch (logError) {
      console.error('Failed to log restoration error:', logError);
    }

    return NextResponse.json({
      success: false,
      error: 'Internal server error',
    }, { status: 500 });
  }
});
