import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { withAdminAuth } from '@/lib/auth/admin-middleware'
import {
  handleDatabaseError,
  handleValidationError,
  handleGenericError
} from '@/lib/security/error-sanitizer';

/**
 * Get products with filtering and pagination (Admin endpoint with soft deletion support)
 * GET /api/admin/products
 * Query params:
 * - limit: number of products per page
 * - offset: pagination offset
 * - include_deleted: 'true' to include soft-deleted products
 * - include_inactive: 'true' to include inactive products
 * - status_filter: 'all', 'active', 'inactive', 'deleted'
 */
export const GET = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('🔍 Admin Products API called');

    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;
    const includeDeleted = searchParams.get('include_deleted') === 'true';
    const includeInactive = searchParams.get('include_inactive') === 'true';
    const statusFilter = searchParams.get('status_filter') || 'all';
    const search = (searchParams.get('search') || '').trim();

    console.log('📊 Query params:', {
      limit,
      offset,
      includeDeleted,
      includeInactive,
      statusFilter,
      hasSearch: !!search
    });

    // Use Supabase service role client (bypasses RLS)
    const supabase = createServiceRoleClient();

    console.log('🔗 Supabase client created');

    // Check if soft deletion columns exist by attempting a simple query
    let hasSoftDeletionColumns = false;
    try {
      const { error: testError } = await supabase
        .from('products')
        .select('is_deleted')
        .limit(0); // Limit 0 to avoid fetching data but still check schema

      // If no error, the column exists
      hasSoftDeletionColumns = !testError;

      if (testError && testError.code === '42703') {
        // Column does not exist error
        console.log('⚠️ Soft deletion columns not found, using legacy mode');
        hasSoftDeletionColumns = false;
      } else if (testError) {
        // Other error, assume columns don't exist for safety
        console.log('⚠️ Column detection error, using legacy mode:', testError.message);
        hasSoftDeletionColumns = false;
      } else {
        console.log('✅ Soft deletion columns detected');
        hasSoftDeletionColumns = true;
      }
    } catch (error) {
      console.log('⚠️ Column detection failed, using legacy mode:', error);
      hasSoftDeletionColumns = false;
    }

    // Build query based on filters and column availability
    let query = supabase
      .from('products')
      .select('*', { count: 'exact' });

    // Apply status filters based on available columns
    if (hasSoftDeletionColumns) {
      // New behavior with soft deletion support
      switch (statusFilter) {
        case 'active':
          // Include rows where is_deleted is FALSE or NULL to avoid excluding legacy rows
          query = query.eq('is_active', true).or('is_deleted.is.false,is_deleted.is.null');
          break;
        case 'inactive':
          // Include rows where is_deleted is FALSE or NULL to avoid excluding legacy rows
          query = query.eq('is_active', false).or('is_deleted.is.false,is_deleted.is.null');
          break;
        case 'deleted':
          query = query.eq('is_deleted', true);
          break;
        case 'all':
        default:
          // For 'all', include both active and inactive, but exclude deleted unless explicitly included
          if (!includeDeleted) {
            // Treat NULL as not-deleted to maintain backward compatibility
            query = query.or('is_deleted.is.false,is_deleted.is.null');
          }
          // Do NOT filter is_active for 'all'
          break;
      }
    } else {
      // Legacy behavior without soft deletion columns
      switch (statusFilter) {
        case 'active':
          query = query.eq('is_active', true);
          break;
        case 'inactive':
          query = query.eq('is_active', false);
          break;
        case 'deleted':
          // Return empty result since no soft deletion support
          console.log('📝 Deleted filter requested but soft deletion not available');
          return NextResponse.json({
            success: true,
            data: [],
            pagination: { total: 0, limit, offset },
            message: 'Soft deletion not available - please apply database migration'
          });
        case 'all':
        default:
          // 'all' means all active/inactive
          // No filter on is_active
          break;
      }
    }

    // Apply search across SKU and names if provided
    if (search) {
      const pattern = `%${search}%`
      query = query.or(`sku.ilike.${pattern},name_en.ilike.${pattern},name_ja.ilike.${pattern}`)
    }

    const { data: products, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    console.log('📦 Database query result:', {
      productsCount: products?.length,
      totalCount: count,
      error: error?.message,
      hasSoftDeletionColumns
    });

    if (error) {
      return handleDatabaseError(error, {
        operation: 'fetch_products',
        limit,
        offset,
        userId: user.id
      }, 'products fetch');
    }

    console.log('✅ Products loaded successfully:', {
      count: products?.length,
      total: count,
      softDeletionAvailable: hasSoftDeletionColumns
    });

    // Add soft deletion fields with default values if columns don't exist
    const enhancedProducts = products?.map(product => ({
      ...product,
      is_deleted: hasSoftDeletionColumns ? product.is_deleted : false,
      deleted_at: hasSoftDeletionColumns ? product.deleted_at : null,
      deleted_by: hasSoftDeletionColumns ? product.deleted_by : null,
      deleted_reason: hasSoftDeletionColumns ? product.deleted_reason : null
    })) || [];

    return NextResponse.json({
      success: true,
      data: enhancedProducts,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
      meta: {
        softDeletionAvailable: hasSoftDeletionColumns,
        message: hasSoftDeletionColumns ? null : 'Soft deletion features require database migration'
      }
    });

  } catch (error) {
    return handleGenericError(error, {
      operation: 'fetch_products',
      userId: user.id
    });
  }
});

/**
 * Create a new product (Admin)
 * POST /api/admin/products
 */
export const POST = withAdminAuth(async (
  request: NextRequest,
  { user, adminUser }
) => {
  try {
    console.log('➕ Product creation request received:', {
      userId: user.id,
      adminRole: adminUser.role
    });

    const body = await request.json();

    console.log('📝 Product creation data received:', {
      sku: body.sku,
      name_en: body.name_en,
      price: `${body.price} (${typeof body.price})`,
      stock_quantity: `${body.stock_quantity} (${typeof body.stock_quantity})`,
    });

    // Validate required fields
    if (!body.sku || !body.name_en || !body.name_ja) {
      console.error('❌ Product creation failed: Missing required fields', {
        sku: body.sku,
        name_en: body.name_en,
        name_ja: body.name_ja
      });
      return NextResponse.json({
        success: false,
        error: 'SKU, English name, and Japanese name are required',
      }, { status: 400 });
    }

    // Validate price
    if (typeof body.price !== 'number' || body.price < 0) {
      console.error('❌ Product creation failed: Invalid price', {
        price: body.price,
        type: typeof body.price,
      });
      return NextResponse.json({
        success: false,
        error: `Price must be a positive number. Received: ${body.price} (${typeof body.price})`,
      }, { status: 400 });
    }

    // Validate stock quantity
    if (typeof body.stock_quantity !== 'number' || body.stock_quantity < 0) {
      console.error('❌ Product creation failed: Invalid stock quantity', {
        stock_quantity: body.stock_quantity,
        type: typeof body.stock_quantity,
      });
      return NextResponse.json({
        success: false,
        error: `Stock quantity must be a positive number. Received: ${body.stock_quantity} (${typeof body.stock_quantity})`,
      }, { status: 400 });
    }

    // Validate compare_at_price constraint (must be >= price)
    if (body.compare_at_price !== null && body.compare_at_price !== undefined && body.compare_at_price !== 0) {
      if (typeof body.compare_at_price !== 'number' || body.compare_at_price < body.price) {
        console.error('❌ Product creation failed: Invalid compare_at_price', {
          price: body.price,
          compare_at_price: body.compare_at_price,
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
        console.error('❌ Product creation failed: Invalid cost_price', {
          cost_price: body.cost_price,
        });
        return NextResponse.json({
          success: false,
          error: `Cost price must be a positive number. Received: ${body.cost_price} (${typeof body.cost_price})`,
        }, { status: 400 });
      }
    }

    // Use Supabase service role client (bypasses RLS)
    const supabase = createServiceRoleClient();

    // Check if SKU is unique
    const { data: existingProduct, error: checkError } = await supabase
      .from('products')
      .select('id')
      .eq('sku', body.sku)
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
        error: 'SKU already exists',
      }, { status: 400 });
    }

    // Prepare creation data
    const createData = {
      sku: body.sku,
      name_en: body.name_en,
      name_ja: body.name_ja,
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
      category_id: body.category_id || null,
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
      // Trending position is deprecated: always null
      trending_position: null,
      best_seller_position: body.best_seller_position || null,
    };

    console.log('💾 Creating product in database:', {
      sku: createData.sku,
      name_en: createData.name_en,
      price: createData.price,
      stock_quantity: createData.stock_quantity
    });

    // Create the product
    const { data: newProduct, error: createError } = await supabase
      .from('products')
      .insert(createData)
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

    if (createError) {
      return handleDatabaseError(createError, {
        operation: 'create_product',
        productData: {
          sku: body.sku,
          name_en: body.name_en,
          price: body.price
        },
        userId: user.id
      }, 'product creation');
    }

    console.log('✅ Product created successfully:', {
      productId: newProduct.id,
      sku: newProduct.sku,
      name: newProduct.name_en,
      price: newProduct.price,
      stock_quantity: newProduct.stock_quantity
    });

    return NextResponse.json({
      success: true,
      data: newProduct,
      message: 'Product created successfully',
    });

  } catch (error) {
    console.error('❌ Unexpected error creating product:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
    }, { status: 500 });
  }
}, { rateLimitType: 'admin_bulk_operations' });
