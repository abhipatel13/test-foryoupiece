import { NextRequest, NextResponse } from 'next/server';
import { BoxHeroService } from '@/infrastructure/services/BoxHeroService';
import { BoxHeroSyncService } from '@/application/services/BoxHeroSyncService';
import { BoxHeroSyncService as CategoriesSync } from '@/lib/boxhero-sync';
import { SupabaseProductRepository } from '@/infrastructure/repositories/SupabaseProductRepository';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { withAdminAuth } from '@/lib/auth/admin-middleware';
import { autoCategorizeProducts } from '@/lib/services/autoCategorize';

// API token for BoxHero - loaded from environment variables
const BOXHERO_API_TOKEN = process.env.BOXHERO_API_TOKEN;

/**
 * Test BoxHero connection
 */
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    if (!BOXHERO_API_TOKEN) {
      console.error('❌ BOXHERO_API_TOKEN environment variable is not set');
      return NextResponse.json({
        success: false,
        error: 'BoxHero API token not configured'
      }, { status: 500 });
    }

    const boxHeroService = new BoxHeroService(BOXHERO_API_TOKEN);
    const result = await boxHeroService.testConnection();

    if (result.success) {
      // Also get basic info
      const [locationsResult, categoriesResult] = await Promise.all([
        boxHeroService.getLocations(),
        boxHeroService.getCategories()
      ]);

      return NextResponse.json({
        success: true,
        connected: true,
        locations: locationsResult.success ? locationsResult.data : [],
        categories: categoriesResult.success ? categoriesResult.data : [],
      });
    } else {
      return NextResponse.json({
        success: false,
        connected: false,
        error: result.error.message,
      }, { status: 400 });
    }
  } catch (error) {
    console.error('BoxHero connection test failed:', error);
    return NextResponse.json({
      success: false,
      connected: false,
      error: 'Connection test failed',
    }, { status: 500 });
  }
});

/**
 * Perform BoxHero sync
 */
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    // Authentication is handled by the frontend admin guard
    // The API endpoint is protected by the admin route structure
    console.log('🔐 Admin API endpoint accessed - authentication handled by frontend');

    const body = await request.json();
    const {
      action,
      locationIds,
      dryRun = false,
      updateExisting = true,
      addNew = true,
      syncStock = true
    } = body;

    // Debug: Log what we received
    console.log('🔍 API received:', { action, dryRun, updateExisting, addNew, syncStock });

    if (!BOXHERO_API_TOKEN) {
      console.error('❌ BOXHERO_API_TOKEN environment variable is not set');
      return NextResponse.json({
        success: false,
        error: 'BoxHero API token not configured'
      }, { status: 500 });
    }

    // Initialize services with service role client (bypasses RLS)
    const boxHeroService = new BoxHeroService(BOXHERO_API_TOKEN);
    const serviceRoleClient = createServiceRoleClient();
    console.log('🔍 Service role client created:', !!serviceRoleClient);
    console.log('🔍 Service role key available:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Temporarily disable RLS for products table during sync
    console.log('🔓 Temporarily disabling RLS for products table...');
    await serviceRoleClient.from('products').select('id').limit(1); // Test connection

    const productRepository = new SupabaseProductRepository(serviceRoleClient);
    const syncService = new BoxHeroSyncService(boxHeroService, productRepository);

    switch (action) {
      case 'categories-sync': {
        const res = await CategoriesSync.syncCategoriesComprehensive('admin_interface', true)
        if (res.success) {
          return NextResponse.json({ success: true, report: res })
        }
        return NextResponse.json({ success: false, error: res.error || 'Category sync failed' }, { status: 400 })
      }
      case 'full-sync': {
        const result = await syncService.performSync({
          locationIds,
          dryRun,
          updateExisting,
          addNew,
          syncStock,
        });

        if (result.success) {
          // Auto-categorize products after successful sync (awaited with service role)
          console.log('🤖 Running auto-categorization after sync (awaited)...');
          try {
            const changedSkus = Array.isArray((result as any).data?.mappings)
              ? (result as any).data.mappings
                  .filter((m: any) => m && m.sku && m.action !== 'skip')
                  .map((m: any) => m.sku)
              : undefined;

            const autoRes = await autoCategorizeProducts({
              boxHeroToken: BOXHERO_API_TOKEN!,
              targetSKUs: changedSkus && changedSkus.length > 0 ? changedSkus : undefined,
              dryRun: false,
            });

            return NextResponse.json({
              success: true,
              report: {
                ...result.data,
                autoCategorization: autoRes.success ? autoRes.summary : { errorCount: 1, warning: 'Auto-categorization failed' },
              },
            });
          } catch (autoCategorizeError) {
            console.warn('⚠️ Auto-categorization error:', autoCategorizeError);
            return NextResponse.json({
              success: true,
              report: {
                ...result.data,
                autoCategorization: {
                  error: 'Auto-categorization failed',
                  warning: 'Sync completed but auto-categorization encountered an error',
                },
              },
            });
          }
        } else {
          return NextResponse.json({
            success: false,
            error: result.error.message,
          }, { status: 400 });
        }
      }

      case 'stock-sync': {
        const result = await syncService.syncStockOnly(locationIds);

        if (result.success) {
          return NextResponse.json({
            success: true,
            updated: result.data.updated,
            errors: result.data.errors,
          });
        } else {
          return NextResponse.json({
            success: false,
            error: result.error.message,
          }, { status: 400 });
        }
      }

      case 'test-connection': {
        const result = await boxHeroService.testConnection();

        return NextResponse.json({
          success: result.success,
          connected: result.success,
          error: result.success ? null : result.error.message,
        });
      }

      case 'get-locations': {
        const result = await boxHeroService.getLocations();

        if (result.success) {
          return NextResponse.json({
            success: true,
            locations: result.data,
          });
        } else {
          return NextResponse.json({
            success: false,
            error: result.error.message,
          }, { status: 400 });
        }
      }

      case 'get-categories': {
        const result = await boxHeroService.getCategories();

        if (result.success) {
          return NextResponse.json({
            success: true,
            categories: result.data,
          });
        } else {
          return NextResponse.json({
            success: false,
            error: result.error.message,
          }, { status: 400 });
        }
      }

      case 'preview-sync': {
        // Dry run to preview what would be synced
        const result = await syncService.performSync({
          locationIds,
          dryRun: true,
          updateExisting,
          addNew,
          syncStock,
        });

        if (result.success) {
          return NextResponse.json({
            success: true,
            preview: {
              totalItems: result.data.totalBoxHeroItems,
              mappings: result.data.mappings,
              wouldCreate: result.data.mappings.filter(m => m.action === 'create').length,
              wouldUpdate: result.data.mappings.filter(m => m.action === 'update').length,
              wouldSkip: result.data.mappings.filter(m => m.action === 'skip').length,
            },
          });
        } else {
          return NextResponse.json({
            success: false,
            error: result.error.message,
          }, { status: 400 });
        }
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action',
        }, { status: 400 });
    }
  } catch (error) {
    console.error('BoxHero sync API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
    }, { status: 500 });
  }
});

/**
 * Record sale in BoxHero (for when products are purchased)
 */
export const PUT = withAdminAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { productId, quantity, locationId, reference } = body;

    if (!productId || !quantity) {
      return NextResponse.json({
        success: false,
        error: 'Product ID and quantity are required',
      }, { status: 400 });
    }

    // Initialize services
    const boxHeroService = new BoxHeroService(BOXHERO_API_TOKEN);
    const productRepository = new SupabaseProductRepository();
    const syncService = new BoxHeroSyncService(boxHeroService, productRepository);

    const result = await syncService.recordSale(
      productId,
      quantity,
      locationId,
      reference
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Sale recorded in BoxHero',
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error.message,
      }, { status: 400 });
    }
  } catch (error) {
    console.error('BoxHero record sale error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to record sale',
    }, { status: 500 });
  }
});

/**
 * Get sync statistics and history
 */
export const PATCH = withAdminAuth(async (request: NextRequest) => {
  try {
    // In a real implementation, this would fetch from a sync_logs table
    // For now, return mock data
    const stats = {
      total_syncs: 0,
      successful_syncs: 0,
      failed_syncs: 0,
      total_items_processed: 0,
      total_items_added: 0,
      total_items_updated: 0,
      avg_sync_duration: '00:00:00',
    };

    const history: any[] = [];

    return NextResponse.json({
      success: true,
      stats,
      history,
    });
  } catch (error) {
    console.error('BoxHero stats error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get sync statistics',
    }, { status: 500 });
  }
});
