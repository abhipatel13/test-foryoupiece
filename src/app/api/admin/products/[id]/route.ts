import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { withAdminAuth } from '@/lib/auth/admin-middleware';
import {
  handleDatabaseError,
  handleValidationError,
  handleGenericError
} from '@/lib/security/error-sanitizer';

/**
 * SECURITY FIX: Validate UUID format to prevent injection attacks
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * SECURITY FIX: Validate product ownership and access control
 * Ensures the product exists and the admin has proper access rights
 */
async function validateProductAccess(
  productId: string,
  adminUser: any,
  supabase: any
): Promise<{ valid: boolean; error?: string; product?: any }> {
  // First validate UUID format
  if (!isValidUUID(productId)) {
    return {
      valid: false,
      error: 'Invalid product ID format'
    };
  }

  try {
    // Check if product exists and get basic info
    const { data: product, error } = await supabase
      .from('products')
      .select('id, sku, name_en, is_active, created_at')
      .eq('id', productId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return {
          valid: false,
          error: 'Product not found'
        };
      }
      return {
        valid: false,
        error: 'Database error during validation'
      };
    }

    // Additional access control checks can be added here
    // For now, we verify the product exists and admin has proper role
    if (adminUser.role !== 'super_admin' && adminUser.role !== 'admin') {
      return {
        valid: false,
        error: 'Insufficient permissions'
      };
    }

    return {
      valid: true,
      product
    };

  } catch (error) {
    console.error('Product access validation error:', error);
    return {
      valid: false,
      error: 'Access validation failed'
    };
  }
}

/**
 * Get a single product by ID (Admin)
 * GET /api/admin/products/[id]
 */
export const GET = withAdminAuth(async (
  request: NextRequest,
  { user, adminUser },
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;

    // PHASE 1 FIX: Extract cache-busting parameters for logging
    const url = new URL(request.url);
    const timestamp = url.searchParams.get('timestamp');
    const refresh = url.searchParams.get('refresh');

    console.log('🔄 Admin product fetch request:', {
      productId: id,
      timestamp,
      refresh,
      cacheBusting: !!timestamp,
      forceRefresh: refresh === 'true',
      requestTime: new Date().toISOString()
    });

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Product ID is required',
      }, { status: 400 });
    }

    // Use Supabase service role client (bypasses RLS)
    const supabase = createServiceRoleClient();

    // SECURITY FIX: Validate product access and ownership
    const validation = await validateProductAccess(id, adminUser, supabase);
    if (!validation.valid) {
      console.warn(`🚫 Admin access denied for product ${id}: ${validation.error}`);
      return NextResponse.json({
        success: false,
        error: validation.error,
        security: {
          validated: false,
          reason: validation.error,
          admin: adminUser.email,
          timestamp: new Date().toISOString()
        }
      }, { status: validation.error === 'Product not found' ? 404 : 403 });
    }

    if (!supabase) {
      console.error('❌ Failed to create service role client for product fetch');
      return NextResponse.json({
        success: false,
        error: 'Service configuration error'
      }, { status: 500 });
    }

    const { data: product, error } = await supabase
      .from('products')
      .select(`
        *,
        categories (
          id,
          name_en,
          name_ja,
          slug
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      return handleDatabaseError(error, {
        operation: 'fetch_product',
        productId: id,
        userId: user.id
      }, 'product fetch');
    }

    // PHASE 1 FIX: Add cache-busting headers to prevent browser caching
    // SECURITY FIX: Include security validation information in response
    const response = NextResponse.json({
      success: true,
      data: product,
      security: {
        validated: true,
        admin: adminUser.email,
        productId: id,
        timestamp: new Date().toISOString(),
        accessLevel: adminUser.role
      }
    });

    // Prevent caching of admin product data
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    console.log('✅ Product fetched successfully with cache-busting headers:', {
      productId: id,
      price: product.price,
      is_best_seller: product.is_best_seller,
      best_seller_position: product.best_seller_position,
      is_trending: product.is_trending,
      trending_position: product.trending_position,
      timestamp: new Date().toISOString()
    });

    return response;

  } catch (error) {
    return handleGenericError(error, {
      operation: 'fetch_product',
      productId: (await params).id,
      userId: user.id
    });
  }
});

/**
 * Update a product by ID (Admin)
 * PUT /api/admin/products/[id]
 */
export const PUT = withAdminAuth(async (
  request: NextRequest,
  { user, adminUser },
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;

    console.log('🔄 Product update request received:', {
      productId: id,
      userId: user.id,
      adminRole: adminUser.role
    });

    if (!id) {
      console.error('❌ Product update failed: Missing product ID');
      return NextResponse.json({
        success: false,
        error: 'Product ID is required',
      }, { status: 400 });
    }

    // Use Supabase service role client
    const supabase = createServiceRoleClient();

    // SECURITY FIX: Validate product access before allowing updates
    const validation = await validateProductAccess(id, adminUser, supabase);
    if (!validation.valid) {
      console.warn(`🚫 Admin update access denied for product ${id}: ${validation.error}`);
      return NextResponse.json({
        success: false,
        error: validation.error,
        security: {
          validated: false,
          reason: validation.error,
          admin: adminUser.email,
          operation: 'UPDATE',
          timestamp: new Date().toISOString()
        }
      }, { status: validation.error === 'Product not found' ? 404 : 403 });
    }

    const body = await request.json();

    console.log('📝 Product update data received:', {
      sku: body.sku,
      name_en: body.name_en,
      price: `${body.price} (${typeof body.price})`,
      stock_quantity: `${body.stock_quantity} (${typeof body.stock_quantity})`,
      dataTypes: {
        price: typeof body.price,
        stock_quantity: typeof body.stock_quantity,
        compare_at_price: typeof body.compare_at_price,
        cost_price: typeof body.cost_price
      }
    });

    // Validate required fields
    if (!body.sku || !body.name_en) {
      console.error('❌ Product update failed: Missing required fields', {
        sku: body.sku,
        name_en: body.name_en
      });
      return NextResponse.json({
        success: false,
        error: 'SKU and English name are required',
      }, { status: 400 });
    }

    // Validate price
    if (typeof body.price !== 'number' || body.price < 0) {
      console.error('❌ Product update failed: Invalid price', {
        price: body.price,
        type: typeof body.price,
        isNumber: typeof body.price === 'number',
        isPositive: body.price >= 0
      });
      return NextResponse.json({
        success: false,
        error: `Price must be a positive number. Received: ${body.price} (${typeof body.price})`,
      }, { status: 400 });
    }

    // Validate stock quantity
    if (typeof body.stock_quantity !== 'number' || body.stock_quantity < 0) {
      console.error('❌ Product update failed: Invalid stock quantity', {
        stock_quantity: body.stock_quantity,
        type: typeof body.stock_quantity,
        isNumber: typeof body.stock_quantity === 'number',
        isPositive: body.stock_quantity >= 0
      });
      return NextResponse.json({
        success: false,
        error: `Stock quantity must be a positive number. Received: ${body.stock_quantity} (${typeof body.stock_quantity})`,
      }, { status: 400 });
    }

    // Validate compare_at_price constraint (must be >= price)
    if (body.compare_at_price !== null && body.compare_at_price !== undefined && body.compare_at_price !== 0) {
      if (typeof body.compare_at_price !== 'number' || body.compare_at_price < body.price) {
        console.error('❌ Product update failed: Invalid compare_at_price', {
          price: body.price,
          compare_at_price: body.compare_at_price,
          type: typeof body.compare_at_price,
          isValid: body.compare_at_price >= body.price
        });
        return NextResponse.json({
          success: false,
          error: `Compare at price must be greater than or equal to the regular price. Regular price: $${body.price}, Compare at price: $${body.compare_at_price}`,
        }, { status: 400 });
      }
    }

    // Validate cost_price
    if (body.cost_price !== null && body.cost_price !== undefined && body.cost_price !== 0) {
      if (typeof body.cost_price !== 'number' || body.cost_price < 0) {
        console.error('❌ Product update failed: Invalid cost_price', {
          cost_price: body.cost_price,
          type: typeof body.cost_price,
          isNumber: typeof body.cost_price === 'number',
          isPositive: body.cost_price >= 0
        });
        return NextResponse.json({
          success: false,
          error: `Cost price must be a positive number. Received: ${body.cost_price} (${typeof body.cost_price})`,
        }, { status: 400 });
      }
    }

    // Validate points_rate
    if (body.points_rate !== null && body.points_rate !== undefined) {
      if (typeof body.points_rate !== 'number' || body.points_rate < 0 || body.points_rate > 20) {
        console.error('❌ Product update failed: Invalid points_rate', {
          points_rate: body.points_rate,
          type: typeof body.points_rate,
          isNumber: typeof body.points_rate === 'number',
          isInRange: body.points_rate >= 0 && body.points_rate <= 20
        });
        return NextResponse.json({
          success: false,
          error: `Points rate must be between 0% and 20%. Received: ${body.points_rate}%`,
        }, { status: 400 });
      }
    }

    // Note: supabase client already created above for validation

    // Prepare update data
    const updateData = {
      sku: body.sku,
      name_en: body.name_en,
      name_ja: body.name_ja || null,
      description_en: body.description_en || null,
      description_ja: body.description_ja || null,
      short_description_en: body.short_description_en || null,
      short_description_ja: body.short_description_ja || null,
      price: body.price,
      compare_at_price: (body.compare_at_price && body.compare_at_price > 0) ? body.compare_at_price : null,
      cost_price: (body.cost_price && body.cost_price > 0) ? body.cost_price : null,
      points_rate: body.points_rate ?? 1.00,
      stock_quantity: body.stock_quantity,
      low_stock_threshold: body.low_stock_threshold || 10,
      weight_grams: body.weight_grams || null,
      brand: body.brand || null,
      is_active: body.is_active ?? true,
      is_featured: body.is_featured ?? false,
      is_preorder: body.is_preorder ?? false,
      preorder_limit: body.preorder_limit || null,
      requires_shipping: body.requires_shipping ?? true,
      is_digital: body.is_digital ?? false,
      track_inventory: body.track_inventory ?? true,
      allow_backorder: body.allow_backorder ?? false,
      seo_title: body.seo_title || null,
      seo_description: body.seo_description || null,
      is_trending: body.is_trending ?? false,
      is_best_seller: body.is_best_seller ?? false,
      // Ensure position is null when the corresponding flag is false
      trending_position: (body.is_trending ?? false) ? (body.trending_position || null) : null,
      best_seller_position: (body.is_best_seller ?? false) ? (body.best_seller_position || null) : null,
      updated_at: new Date().toISOString(),
    };

    // Check if SKU is unique (excluding current product)
    const { data: existingProduct, error: checkError } = await supabase
      .from('products')
      .select('id')
      .eq('sku', body.sku)
      .neq('id', id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking SKU uniqueness:', checkError);
      return NextResponse.json({
        success: false,
        error: 'Failed to validate SKU uniqueness',
      }, { status: 500 });
    }

    if (existingProduct) {
      return NextResponse.json({
        success: false,
        error: 'SKU already exists for another product',
      }, { status: 400 });
    }

    console.log('💾 Updating product in database:', {
      productId: id,
      updateData: {
        ...updateData,
        // Log key fields for debugging
        price: updateData.price,
        stock_quantity: updateData.stock_quantity
      }
    });

    // PRODUCTION DEBUG: Add enhanced logging for best seller fields
    console.log('🔍 PRODUCTION DEBUG: Best seller update details:', {
      productId: id,
      is_best_seller: updateData.is_best_seller,
      best_seller_position: updateData.best_seller_position,
      environment: process.env.NODE_ENV,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      serviceKeyLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length,
      timestamp: new Date().toISOString()
    });

    // Update the product
    const { data: updatedProduct, error: updateError } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        categories (
          id,
          name_en,
          name_ja,
          slug
        )
      `)
      .single();

    if (updateError) {
      console.error('❌ Database update error:', {
        error: updateError,
        code: updateError.code,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint
      });

      // PRODUCTION DEBUG: Enhanced error logging for best seller updates
      console.error('🔍 PRODUCTION DEBUG: Update failed with details:', {
        productId: id,
        updateData: {
          is_best_seller: updateData.is_best_seller,
          best_seller_position: updateData.best_seller_position,
          sku: updateData.sku,
          name_en: updateData.name_en
        },
        errorCode: updateError.code,
        errorMessage: updateError.message,
        errorDetails: updateError.details,
        errorHint: updateError.hint,
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
      });

      if (updateError.code === 'PGRST116') {
        return NextResponse.json({
          success: false,
          error: 'Product not found',
        }, { status: 404 });
      }

      return NextResponse.json({
        success: false,
        error: updateError.message,
      }, { status: 500 });
    }

    console.log('✅ Product updated successfully:', {
      productId: id,
      sku: updatedProduct.sku,
      name: updatedProduct.name_en,
      price: updatedProduct.price,
      stock_quantity: updatedProduct.stock_quantity
    });

    // PRODUCTION DEBUG: Log best seller fields in successful update
    console.log('🔍 PRODUCTION DEBUG: Best seller fields after update:', {
      productId: id,
      is_best_seller: updatedProduct.is_best_seller,
      best_seller_position: updatedProduct.best_seller_position,
      originalRequest: {
        is_best_seller: updateData.is_best_seller,
        best_seller_position: updateData.best_seller_position
      },
      fieldsMatch: {
        is_best_seller: updatedProduct.is_best_seller === updateData.is_best_seller,
        best_seller_position: updatedProduct.best_seller_position === updateData.best_seller_position
      },
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    });

    // PHASE 1 FIX: Add cache-busting headers to update response
    const response = NextResponse.json({
      success: true,
      data: updatedProduct,
      message: 'Product updated successfully',
    });

    // Prevent caching of admin update responses
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;

  } catch (error) {
    console.error('❌ Unexpected error updating product:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      productId: (await params).id
    });
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
    }, { status: 500 });
  }
});

/**
 * Delete a product by ID (Super Admin Only)
 * DELETE /api/admin/products/[id]
 */
export const DELETE = withAdminAuth(async (
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

    // ENHANCED SECURITY: Only super_admin can delete products
    if (adminUser.role !== 'super_admin') {
      console.warn(`🚫 Product deletion denied - insufficient permissions:`, {
        userId: user.id,
        email: adminUser.email,
        role: adminUser.role,
        productId: id,
        timestamp: new Date().toISOString()
      });
      return NextResponse.json({
        success: false,
        error: 'Only super administrators can delete products',
        security: {
          validated: false,
          reason: 'Insufficient permissions for deletion',
          requiredRole: 'super_admin',
          currentRole: adminUser.role,
          admin: adminUser.email,
          operation: 'DELETE',
          timestamp: new Date().toISOString()
        }
      }, { status: 403 });
    }

    // Use Supabase service role client (bypasses RLS)
    const supabase = createServiceRoleClient();

    // Validate product access before allowing deletion
    const validation = await validateProductAccess(id, adminUser, supabase);
    if (!validation.valid) {
      console.warn(`🚫 Admin delete access denied for product ${id}: ${validation.error}`);
      return NextResponse.json({
        success: false,
        error: validation.error,
        security: {
          validated: false,
          reason: validation.error,
          admin: adminUser.email,
          operation: 'DELETE',
          timestamp: new Date().toISOString()
        }
      }, { status: validation.error === 'Product not found' ? 404 : 403 });
    }

    const product = validation.product;

    // Get deletion reason from request body (optional)
    let deletionReason = null;
    try {
      const body = await request.json();
      deletionReason = body.reason || null;
    } catch {
      // No body or invalid JSON - continue without reason
    }

    console.log('🗑️ Starting product deletion process:', {
      productId: id,
      sku: product.sku,
      name: product.name_en,
      adminEmail: adminUser.email,
      reason: deletionReason,
      timestamp: new Date().toISOString()
    });

    // Begin comprehensive soft deletion process
    const now = new Date().toISOString();

    // Step 1: Update product with soft deletion fields
    const { data: deletedProduct, error: deleteError } = await supabase
      .from('products')
      .update({
        is_active: false,
        is_deleted: true,
        deleted_at: now,
        deleted_by: user.id,
        deleted_reason: deletionReason,
        updated_at: now
      })
      .eq('id', id)
      .select()
      .single();

    if (deleteError) {
      console.error('❌ Product deletion failed:', deleteError);

      // Log failed deletion attempt
      await supabase.rpc('log_admin_action', {
        p_actor_user_id: user.id,
        p_actor_email: adminUser.email,
        p_actor_role: adminUser.role,
        p_action: 'product_delete',
        p_resource_id: id,
        p_resource_sku: product.sku,
        p_resource_name: product.name_en,
        p_reason: deletionReason,
        p_success: false,
        p_error_message: deleteError.message,
        p_metadata: { step: 'product_update' }
      });

      if (deleteError.code === 'PGRST116') {
        return NextResponse.json({
          success: false,
          error: 'Product not found',
        }, { status: 404 });
      }

      return NextResponse.json({
        success: false,
        error: deleteError.message,
      }, { status: 500 });
    }

    console.log('✅ Product soft deletion completed:', {
      productId: id,
      sku: product.sku,
      deletedAt: now
    });

    // Step 2: Clean up related data
    const cleanupResults = {
      cartItems: 0,
      wishlistItems: 0,
      searchSuggestions: 0,
      trendingFlags: false
    };

    try {
      // Remove from active carts
      const { count: cartItemsRemoved } = await supabase
        .from('cart_items')
        .delete()
        .eq('product_id', id);
      cleanupResults.cartItems = cartItemsRemoved || 0;

      // Remove from wishlists
      const { count: wishlistItemsRemoved } = await supabase
        .from('wishlist_items')
        .delete()
        .eq('product_id', id);
      cleanupResults.wishlistItems = wishlistItemsRemoved || 0;

      // Deactivate search suggestions
      const { count: searchSuggestionsUpdated } = await supabase
        .from('search_suggestions')
        .update({ is_active: false })
        .eq('product_id', id);
      cleanupResults.searchSuggestions = searchSuggestionsUpdated || 0;

      // Clear trending and best seller flags
      if (deletedProduct.is_trending || deletedProduct.is_best_seller) {
        await supabase
          .from('products')
          .update({
            is_trending: false,
            is_best_seller: false,
            best_seller_position: null,
            updated_at: now
          })
          .eq('id', id);
        cleanupResults.trendingFlags = true;
      }

      console.log('🧹 Related data cleanup completed:', cleanupResults);

    } catch (cleanupError) {
      console.warn('⚠️ Some cleanup operations failed:', cleanupError);
      // Continue - cleanup failures shouldn't fail the deletion
    }

    // Step 3: Log successful deletion
    await supabase.rpc('log_admin_action', {
      p_actor_user_id: user.id,
      p_actor_email: adminUser.email,
      p_actor_role: adminUser.role,
      p_action: 'product_delete',
      p_resource_id: id,
      p_resource_sku: product.sku,
      p_resource_name: product.name_en,
      p_reason: deletionReason,
      p_success: true,
      p_metadata: {
        cleanup_results: cleanupResults,
        soft_deletion: true,
        deleted_at: now
      }
    });

    console.log('✅ Product deletion completed successfully:', {
      productId: id,
      sku: product.sku,
      cleanupResults
    });

    return NextResponse.json({
      success: true,
      data: {
        ...deletedProduct,
        cleanup_results: cleanupResults
      },
      message: 'Product deleted successfully',
    });

  } catch (error) {
    console.error('❌ Failed to delete product:', error);

    // Log failed deletion attempt if we have the necessary info
    try {
      const supabase = createServiceRoleClient();
      await supabase.rpc('log_admin_action', {
        p_actor_user_id: user.id,
        p_actor_email: adminUser.email,
        p_actor_role: adminUser.role,
        p_action: 'product_delete',
        p_resource_id: id,
        p_success: false,
        p_error_message: error instanceof Error ? error.message : 'Unknown error',
        p_metadata: { step: 'general_error' }
      });
    } catch (logError) {
      console.error('Failed to log deletion error:', logError);
    }

    return NextResponse.json({
      success: false,
      error: 'Internal server error',
    }, { status: 500 });
  }
});


