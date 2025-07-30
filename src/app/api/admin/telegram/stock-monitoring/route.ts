import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { withAdminAuth } from '@/lib/auth/admin-middleware';

interface StockStats {
  totalUpdates: number;
  successfulUpdates: number;
  failedUpdates: number;
  totalProductsUpdated: number;
  averageProcessingTime: number;
}

/**
 * Admin Telegram Stock Monitoring API
 * GET /api/admin/telegram/stock-monitoring
 */
export const GET = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('📊 Admin Telegram stock monitoring request received');

    const serviceClient = createServiceRoleClient();
    if (!serviceClient) {
      console.error('❌ Failed to create service role client');
      return NextResponse.json({
        success: false,
        error: 'Service configuration error'
      }, { status: 500 });
    }

    // Fetch recent stock updates
    const { data: recentUpdates, error: updatesError } = await serviceClient
      .from('telegram_stock_updates')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (updatesError) {
      console.error('❌ Error fetching recent updates:', updatesError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch recent updates'
      }, { status: 500 });
    }

    // Calculate statistics
    const { data: allUpdates, error: statsError } = await serviceClient
      .from('telegram_stock_updates')
      .select('processing_status, products_updated, processing_time_ms')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

    if (statsError) {
      console.error('❌ Error fetching stats:', statsError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch statistics'
      }, { status: 500 });
    }

    const stats: StockStats = {
      totalUpdates: allUpdates?.length || 0,
      successfulUpdates: allUpdates?.filter(u => u.processing_status === 'completed').length || 0,
      failedUpdates: allUpdates?.filter(u => u.processing_status === 'failed').length || 0,
      totalProductsUpdated: allUpdates?.reduce((sum, u) => sum + (u.products_updated || 0), 0) || 0,
      averageProcessingTime: allUpdates?.length > 0 
        ? Math.round(allUpdates.reduce((sum, u) => sum + (u.processing_time_ms || 0), 0) / allUpdates.length)
        : 0
    };

    console.log('✅ Successfully fetched Telegram stock monitoring data');

    return NextResponse.json({
      success: true,
      data: {
        stats,
        recentUpdates: recentUpdates || []
      }
    });

  } catch (error) {
    console.error('❌ Admin Telegram stock monitoring error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});
