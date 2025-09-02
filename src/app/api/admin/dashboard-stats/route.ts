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
    const isDev = process.env.NODE_ENV !== 'production';
    if (isDev) console.log('📊 Fetching REAL-TIME admin dashboard statistics...');

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
    if (isDev) console.log('📦 Fetching total orders...');
    const { count: totalOrders, error: ordersError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });

    if (ordersError) {
      if (isDev) console.error('❌ Error fetching total orders:', ordersError);
    }

    // Get total revenue from verified orders
    if (isDev) console.log('💰 Fetching total revenue...');
    const { data: revenueData, error: revenueError } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('payment_status', 'verified');

    if (revenueError) {
      if (isDev) console.error('❌ Error fetching revenue data:', revenueError);
    }

    const totalRevenue = revenueData?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;

    // Get total products
    if (isDev) console.log('📦 Fetching total products (all active/inactive, excluding deleted)...');
    // Count all products excluding soft-deleted ones if column exists
    let totalProducts = 0
    let productsError: any = null
    try {
      const { count, error } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
      if (error) throw error
      totalProducts = count || 0
    } catch (err: any) {
      productsError = err
    }

    if (productsError) {
      if (isDev) console.error('❌ Error fetching total products:', productsError);
    }

    // Get total users from Auth (includes Google OAuth, email/password, Telegram)
    if (isDev) console.log('👥 Fetching total users from Auth (all providers)...');
    let totalUsersAll = 0;
    try {
      const adminApi = (supabase as any)?.auth?.admin;
      if (adminApi?.listUsers) {
        const perPage = 1000; // high page size to avoid many requests
        let page = 1;
        let fetched = 0;
        // Loop through pages until fewer than perPage users are returned (or safety cap)
        while (true) {
          const { data, error } = await adminApi.listUsers({ page, perPage });
          if (error) {
            if (isDev) console.error('❌ Error from auth.admin.listUsers:', error);
            break;
          }
          const usersArr = (data?.users as any[]) || [];
          fetched += usersArr.length;
          if (usersArr.length < perPage) break; // last page reached
          page += 1;
          if (page > 50) { // safety guard to prevent runaway loops
            if (isDev) console.warn('⚠️ listUsers pagination safety cap reached (50 pages).');
            break;
          }
        }
        totalUsersAll = fetched;
      } else {
        if (isDev) console.warn('⚠️ auth.admin.listUsers not available; falling back to profiles count');
      }
    } catch (e) {
      if (isDev) console.error('❌ Exception while counting auth users:', e);
    }

    // Fallback: if auth count failed or returned 0, use profiles table count
    if (!totalUsersAll || Number.isNaN(totalUsersAll)) {
      if (isDev) console.log('↩️ Falling back to profiles table count from public.users...');
      const { count: profilesCount, error: usersError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });
      if (usersError) {
        if (isDev) console.error('❌ Error fetching total users from profiles (fallback):', usersError);
      }
      totalUsersAll = profilesCount || 0;
    }

    // Get pending orders
    if (isDev) console.log('⏳ Fetching pending orders...');
    const { count: pendingOrders, error: pendingError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('payment_status', 'pending');

    if (pendingError) {
      if (isDev) console.error('❌ Error fetching pending orders:', pendingError);
    }

    // Get low stock products
    if (isDev) console.log('⚠️ Fetching low stock products...');
    const { count: lowStockProducts, error: lowStockError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .or('stock_status.eq.low_stock,stock_status.eq.out_of_stock');

    if (lowStockError) {
      if (isDev) console.error('❌ Error fetching low stock products:', lowStockError);
    }

    // Get BoxHero sync information from MANUAL SYNC REPORTS ONLY (NO AUTO-CALCULATION)
    if (isDev) console.log('📊 Fetching BoxHero sync info from manual sync reports ONLY...');
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
          if (isDev) console.log('✅ Using BoxHero sync metrics from basic sync log (fallback):', {
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
          if (isDev) console.log('⚠️ No BoxHero sync logs found - showing placeholder until first manual sync');
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
      if (isDev) console.error('❌ Error fetching BoxHero sync info from manual sync logs:', error);
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
    if (isDev) console.log('📋 Fetching recent orders...');
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
      if (isDev) console.error('❌ Error fetching recent orders:', recentOrdersError);
    }

    // Get top products (featured products as a proxy for top products)
    if (isDev) console.log('🏆 Fetching top products...');
    const { data: topProducts, error: topProductsError } = await supabase
      .from('products')
      .select('id, name_en, price, images, stock_quantity')
      .eq('is_active', true)
      .eq('is_featured', true)
      .limit(5);

    if (topProductsError) {
      if (isDev) console.error('❌ Error fetching top products:', topProductsError);
    }

    const stats = {
      totalOrders: totalOrders || 0,
      totalRevenue: totalRevenue || 0,
      totalProducts: totalProducts || 0,
      totalUsers: totalUsersAll || 0,
      pendingOrders: pendingOrders || 0,
      lowStockProducts: lowStockProducts || 0,
      recentOrders: recentOrders || [],
      topProducts: topProducts || [],
      boxHeroSync: boxHeroSync
    };

    if (isDev) console.log('✅ REAL-TIME Dashboard stats compiled:', {
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
