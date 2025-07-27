import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { withAdminAuth } from '@/lib/auth/admin-middleware';

/**
 * Admin Tier Rewards Notifications API
 * GET /api/admin/tier-rewards/notifications
 */
export const GET = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('🔔 Admin tier rewards notifications request received');

    const serviceClient = createServiceRoleClient();
    if (!serviceClient) {
      console.error('❌ Failed to create service role client');
      return NextResponse.json({
        success: false,
        error: 'Service configuration error'
      }, { status: 500 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const search = searchParams.get('search') || '';

    const offset = (page - 1) * limit;

    console.log('📋 Tier notifications params:', {
      page,
      limit,
      search: search.substring(0, 50),
      adminId: adminUser.id
    });

    // Build query for tier-related notifications
    let query = serviceClient
      .from('notifications')
      .select(`
        id,
        user_id,
        title,
        message,
        type,
        read,
        created_at,
        metadata,
        users!inner(
          first_name,
          last_name,
          email,
          avatar_url
        )
      `, { count: 'exact' });

    // Filter for tier-related notifications
    query = query.or('metadata->>tier_promotion.eq.true,metadata->>gift_notification.eq.true,metadata->>exclusive_access.eq.true');

    // Apply search filter
    if (search.trim()) {
      query = query.or(`users.email.ilike.%${search}%,title.ilike.%${search}%,message.ilike.%${search}%`);
    }

    // Apply pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: notifications, error: notificationsError, count } = await query;

    if (notificationsError) {
      console.error('❌ Error fetching tier notifications:', notificationsError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch tier notifications: ' + notificationsError.message
      }, { status: 500 });
    }

    const totalRecords = count || 0;
    const totalPages = Math.ceil(totalRecords / limit);

    // Format the notifications data
    const formattedNotifications = notifications?.map(notification => ({
      ...notification,
      user: notification.users
    })) || [];

    console.log('✅ Tier notifications fetched successfully:', {
      totalRecords,
      currentPage: page,
      totalPages,
      notificationsCount: formattedNotifications.length
    });

    return NextResponse.json({
      success: true,
      data: {
        notifications: formattedNotifications,
        totalRecords,
        totalPages,
        currentPage: page,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    });

  } catch (error) {
    console.error('❌ Admin tier notifications error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});
