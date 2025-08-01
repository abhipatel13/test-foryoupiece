import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { withAdminAuth } from '@/lib/auth/admin-middleware';

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

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Product ID is required',
      }, { status: 400 });
    }

    // Use Supabase service role client (bypasses RLS)
    const supabase = createServiceRoleClient();

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
      console.error('Database error:', error);
      
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          success: false,
          error: 'Product not found',
        }, { status: 404 });
      }

      return NextResponse.json({
        success: false,
        error: error.message,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: product,
    });

  } catch (error) {
    console.error('Failed to fetch product:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
    }, { status: 500 });
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

    // Use Supabase service role client (bypasses RLS)
    const supabase = createServiceRoleClient();

    if (!supabase) {
      console.error('❌ Failed to create service role client for product update');
      return NextResponse.json({
        success: false,
        error: 'Service configuration error'
      }, { status: 500 });
    }

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

    return NextResponse.json({
      success: true,
      data: updatedProduct,
      message: 'Product updated successfully',
    });

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
 * Delete a product by ID (Admin)
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

    // Use Supabase service role client (bypasses RLS)
    const supabase = createServiceRoleClient();

    // Soft delete by setting is_active to false
    const { data: deletedProduct, error } = await supabase
      .from('products')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Database delete error:', error);
      
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          success: false,
          error: 'Product not found',
        }, { status: 404 });
      }

      return NextResponse.json({
        success: false,
        error: error.message,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: deletedProduct,
      message: 'Product deleted successfully',
    });

  } catch (error) {
    console.error('Failed to delete product:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
    }, { status: 500 });
  }
});
