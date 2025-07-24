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

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Product ID is required',
      }, { status: 400 });
    }

    const body = await request.json();
    
    // Validate required fields
    if (!body.sku || !body.name_en) {
      return NextResponse.json({
        success: false,
        error: 'SKU and English name are required',
      }, { status: 400 });
    }

    // Validate price
    if (typeof body.price !== 'number' || body.price < 0) {
      return NextResponse.json({
        success: false,
        error: 'Price must be a positive number',
      }, { status: 400 });
    }

    // Validate stock quantity
    if (typeof body.stock_quantity !== 'number' || body.stock_quantity < 0) {
      return NextResponse.json({
        success: false,
        error: 'Stock quantity must be a positive number',
      }, { status: 400 });
    }

    // Use Supabase service role client (bypasses RLS)
    const supabase = createServiceRoleClient();

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
      compare_at_price: body.compare_at_price || null,
      cost_price: body.cost_price || null,
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
      console.error('Database update error:', updateError);
      
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

    return NextResponse.json({
      success: true,
      data: updatedProduct,
      message: 'Product updated successfully',
    });

  } catch (error) {
    console.error('Failed to update product:', error);
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
