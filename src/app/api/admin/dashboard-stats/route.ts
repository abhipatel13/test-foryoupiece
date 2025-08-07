import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { withAdminAuth } from '@/lib/auth/admin-middleware'
import { handleGenericError } from '@/lib/security/error-sanitizer';

/**
 * Get admin dashboard statistics (REAL-TIME - NO CACHING)
 * GET /api/admin/dashboard-stats
 */
export const GET = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('📊 Fetching REAL-TIME admin dashboard statistics...');

    // Use service role client to bypass RLS
    const supabase = createServiceRoleClient();

    if (!supabase) {
      console.error('❌ Failed to create service role client for dashboard stats');
      return NextResponse.json({
        success: false,
        error: 'Service configuration error'
      }, { status: 500 });
    }

    // Add cache-busting headers to ensure fresh data
    const headers = {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };

    // Get total orders
    console.log('📦 Fetching total orders...');
    const { count: totalOrders, error: ordersError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });

    if (ordersError) {
      console.error('❌ Error fetching total orders:', ordersError);
    }

    // Get total revenue from verified orders
    console.log('💰 Fetching total revenue...');
    const { data: revenueData, error: revenueError } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('payment_status', 'verified');

    if (revenueError) {
      console.error('❌ Error fetching revenue data:', revenueError);
    }

    const totalRevenue = revenueData?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;

    // Get total products
    console.log('📦 Fetching total products...');
    const { count: totalProducts, error: productsError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    if (productsError) {
      console.error('❌ Error fetching total products:', productsError);
    }

    // Get total users
    console.log('👥 Fetching total users...');
    const { count: totalUsers, error: usersError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (usersError) {
      console.error('❌ Error fetching total users:', usersError);
    }

    // Get pending orders
    console.log('⏳ Fetching pending orders...');
    const { count: pendingOrders, error: pendingError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('payment_status', 'pending');

    if (pendingError) {
      console.error('❌ Error fetching pending orders:', pendingError);
    }

    // Get low stock products
    console.log('⚠️ Fetching low stock products...');
    const { count: lowStockProducts, error: lowStockError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .or('stock_status.eq.low_stock,stock_status.eq.out_of_stock');

    if (lowStockError) {
      console.error('❌ Error fetching low stock products:', lowStockError);
    }

    // Get BoxHero sync information from MANUAL SYNC REPORTS ONLY (NO AUTO-CALCULATION)
    console.log('📊 Fetching BoxHero sync info from manual sync reports ONLY...');
    let boxHeroSync = null;
    try {
      // Try to get from sync_reports table first (enhanced reporting)
      const { data: syncReport, error: reportError } = await supabase
        .from('sync_reports')
        .select('*')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .single();

      if (!reportError && syncReport && syncReport.after_stats) {
        // Use metrics from the enhanced sync report
        const afterStats = syncReport.after_stats as any;
        console.log('✅ Using BoxHero sync metrics from enhanced sync report:', {
          uniqueProducts: afterStats.products || 0,
          totalQuantity: afterStats.total_stock || 0,
          lastSync: syncReport.completed_at,
          syncStatus: syncReport.status
        });

        boxHeroSync = {
          uniqueProducts: afterStats.products || 0,     // From actual BoxHero sync
          totalQuantity: afterStats.total_stock || 0,   // From actual BoxHero sync
          syncStatus: syncReport.status || 'COMPLETED',
          lastSync: syncReport.completed_at,
          lastVerified: syncReport.completed_at
        };
      } else {
        // Fallback to basic sync_logs table
        const { data: syncStatus, error: syncError } = await supabase
          .from('sync_logs')
          .select('*')
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!syncError && syncStatus) {
          console.log('✅ Using BoxHero sync metrics from basic sync log (fallback):', {
            totalItemsProcessed: syncStatus.total_items_processed || 0,
            lastSync: syncStatus.created_at,
            syncStatus: syncStatus.status
          });

          boxHeroSync = {
            uniqueProducts: syncStatus.total_items_processed || 0, // Fallback: use total items as unique products
            totalQuantity: 0, // Not available in basic sync logs
            syncStatus: syncStatus.status || 'COMPLETED',
            lastSync: syncStatus.created_at,
            lastVerified: syncStatus.created_at
          };
        } else {
          // No sync logs exist - show placeholder until first manual sync
          console.log('⚠️ No BoxHero sync logs found - showing placeholder until first manual sync');
          boxHeroSync = {
            uniqueProducts: 0,
            totalQuantity: 0,
            syncStatus: 'NEVER_SYNCED',
            lastSync: null,
            lastVerified: null
          };
        }
      }
    } catch (error) {
      console.error('❌ Error fetching BoxHero sync info from manual sync logs:', error);
      // Don't fail the entire dashboard if sync logs are unavailable
      boxHeroSync = {
        uniqueProducts: 0,
        totalQuantity: 0,
        syncStatus: 'ERROR',
        lastSync: null,
        lastVerified: null
      };
    }

    // Get recent orders with user information
    console.log('📋 Fetching recent orders...');
    const { data: recentOrders, error: recentOrdersError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        total_amount,
        payment_status,
        fulfillment_status,
        created_at,
        users!orders_user_id_fkey(
          first_name,
          last_name,
          email
        )
      `)
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentOrdersError) {
      console.error('❌ Error fetching recent orders:', recentOrdersError);
    }

    // Get top products (featured products as a proxy for top products)
    console.log('🏆 Fetching top products...');
    const { data: topProducts, error: topProductsError } = await supabase
      .from('products')
      .select('id, name_en, price, images, stock_quantity')
      .eq('is_active', true)
      .eq('is_featured', true)
      .limit(5);

    if (topProductsError) {
      console.error('❌ Error fetching top products:', topProductsError);
    }

    const stats = {
      totalOrders: totalOrders || 0,
      totalRevenue: totalRevenue || 0,
      totalProducts: totalProducts || 0,
      totalUsers: totalUsers || 0,
      pendingOrders: pendingOrders || 0,
      lowStockProducts: lowStockProducts || 0,
      recentOrders: recentOrders || [],
      topProducts: topProducts || [],
      boxHeroSync: boxHeroSync
    };

    console.log('✅ REAL-TIME Dashboard stats compiled:', {
      totalOrders: stats.totalOrders,
      totalRevenue: stats.totalRevenue,
      totalProducts: stats.totalProducts,
      totalUsers: stats.totalUsers,
      pendingOrders: stats.pendingOrders,
      lowStockProducts: stats.lowStockProducts,
      recentOrdersCount: stats.recentOrders.length,
      topProductsCount: stats.topProducts.length,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    }, { headers });

  } catch (error) {
    return handleGenericError(error, {
      operation: 'fetch_dashboard_stats',
      userId: user.id
    });
  }
});
