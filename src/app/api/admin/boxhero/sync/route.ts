import { NextRequest, NextResponse } from 'next/server';
import { BoxHeroSyncService } from '@/lib/boxhero-sync';

/**
 * POST /api/admin/boxhero/sync
 * Manually trigger comprehensive BoxHero sync (categories + images + product counts)
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Manual BoxHero comprehensive sync triggered via API');

    // Get the user who triggered the sync (optional)
    const body = await request.json().catch(() => ({}));
    const triggeredBy = body.triggeredBy || 'api';
    const syncImages = body.syncImages !== false; // Default to true

    // Perform comprehensive sync (categories + images + counts)
    const result = await BoxHeroSyncService.syncCategoriesComprehensive(triggeredBy, syncImages);
    
    if (result.success) {
      console.log(`✅ Comprehensive sync completed: ${result.categoriesSynced} categories, ${result.imagesUpdated} images, ${result.totalItemsProcessed} items`);

      return NextResponse.json({
        success: true,
        message: 'BoxHero comprehensive sync completed successfully',
        data: {
          categoriesSynced: result.categoriesSynced,
          totalItemsProcessed: result.totalItemsProcessed,
          imagesUpdated: result.imagesUpdated,
          duration: result.duration,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      console.error(`❌ Comprehensive sync failed: ${result.error}`);

      return NextResponse.json(
        {
          success: false,
          message: 'BoxHero comprehensive sync failed',
          error: result.error,
          data: {
            duration: result.duration,
            timestamp: new Date().toISOString()
          }
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Manual sync API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        message: 'Failed to trigger BoxHero sync',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/boxhero/sync
 * Get sync status and history
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📊 Fetching BoxHero sync status...');
    
    const status = await BoxHeroSyncService.getSyncStatus();
    
    return NextResponse.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Sync status API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        message: 'Failed to get sync status',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
