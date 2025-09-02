import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { withAdminAuth } from '@/lib/auth/admin-middleware';
import { getTierFromPoints } from '@/lib/utils';

/**
 * Admin User List API with Pagination and Search
 * GET /api/admin/users/list?page=1&limit=40&search=query&tier=silver&language=en
 */
export const GET = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    const isDev = process.env.NODE_ENV !== 'production';
    if (isDev) console.log('📋 Admin user list request received');

    // Use service role client for admin operations (authentication handled by middleware)
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
    const limit = parseInt(searchParams.get('limit') || '40'); // Default to 40 users per page
    const search = searchParams.get('search') || '';
    const tierFilter = searchParams.get('tier') || '';
    const languageFilter = searchParams.get('language') || '';
    const recent = searchParams.get('recent') || '';
    const startDate = searchParams.get('start') || '';
    const endDate = searchParams.get('end') || '';
    const status = (searchParams.get('status') || 'all').toLowerCase();
    const offset = (page - 1) * limit;

    if (isDev) console.log('📋 Query params:', { page, limit, search, tierFilter, languageFilter, recent, startDate, endDate, status, offset });

    // Build base query with additional fields needed for filtering
    let query = serviceClient
      .from('users')
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone,
        points_balance,
        tier_level,
        total_points_earned,
        avatar_url,
        total_spent,
        total_orders,
        preferred_language,
        telegram_username,
        created_at,
        updated_at,
        is_active
      `, { count: 'exact' });

    // Add search filter if provided
    if (search.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      query = query.or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm},telegram_username.ilike.${searchTerm}`);
    }

    // Add tier filter if provided
    if (tierFilter && tierFilter !== 'all') {
      query = query.eq('tier_level', tierFilter);
    }

    // Add language filter if provided
    if (languageFilter && languageFilter !== 'all') {
      query = query.eq('preferred_language', languageFilter);
    }

    // Add recent signup or date range filters
    if (recent && ['7','30','90'].includes(recent)) {
      const days = parseInt(recent, 10);
      const since = new Date();
      since.setDate(since.getDate() - days);
      query = query.gte('created_at', since.toISOString());
    } else {
      if (startDate) {
        query = query.gte('created_at', new Date(startDate).toISOString());
      }
      if (endDate) {
        // Include the end date entire day by adding 1 day and using lt
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1);
        query = query.lt('created_at', end.toISOString());
      }
    }

    // Add status filter if provided
    if (status && status !== 'all') {
      const isActive = status === 'active';
      query = query.eq('is_active', isActive);
    }

    // Add pagination and ordering: rank (Diamond->Bronze) then most recent signup
    let usersRes = await query
      .order('tier_level', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Fallback if is_active column doesn't exist (development schemas)
    if (usersRes.error && usersRes.error.code === '42703') {
      console.warn('is_active column not found on users table, retrying without selecting/filtering it');
      // Rebuild query without is_active selection or status filter
      query = serviceClient
        .from('users')
        .select(`
          id,
          first_name,
          last_name,
          email,
          phone,
          points_balance,
          tier_level,
          total_points_earned,
          avatar_url,
          total_spent,
          total_orders,
          preferred_language,
          telegram_username,
          created_at,
          updated_at
        `, { count: 'exact' });

      if (search.trim()) {
        const searchTerm = `%${search.trim().toLowerCase()}%`;
        query = query.or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm},telegram_username.ilike.${searchTerm}`);
      }
      if (tierFilter && tierFilter !== 'all') query = query.eq('tier_level', tierFilter);
      if (languageFilter && languageFilter !== 'all') query = query.eq('preferred_language', languageFilter);
      if (recent && ['7','30','90'].includes(recent)) {
        const days = parseInt(recent, 10);
        const since = new Date();
        since.setDate(since.getDate() - days);
        query = query.gte('created_at', since.toISOString());
      } else {
        if (startDate) query = query.gte('created_at', new Date(startDate).toISOString());
        if (endDate) {
          const end = new Date(endDate);
          end.setDate(end.getDate() + 1);
          query = query.lt('created_at', end.toISOString());
        }
      }

      usersRes = await query
        .order('tier_level', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
    }

    const { data: users, error: usersError, count } = usersRes;

    if (usersError) {
      if (isDev) console.error('❌ User list query failed:', usersError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch users'
      }, { status: 500 });
    }

    if (isDev) console.log(`✅ Retrieved ${users.length} users (${count} total from profiles)`);

    // When no filters are applied, compute total users from Auth (all providers)
    const isUnfilteredRequest = !search.trim() && (!tierFilter || tierFilter === 'all') && (!languageFilter || languageFilter === 'all') && (!recent || recent === 'all') && !startDate && !endDate && (status === 'all');

    let authTotalUsers: number | null = null;
    if (isUnfilteredRequest) {
      try {
        const adminApi = (serviceClient as any)?.auth?.admin;
        if (adminApi?.listUsers) {
          const perPage = 1000;
          let pageIdx = 1;
          let fetched = 0;
          while (true) {
            const { data, error } = await adminApi.listUsers({ page: pageIdx, perPage });
            if (error) {
              console.error('❌ Error from auth.admin.listUsers (users/list):', error);
              break;
            }
            const arr = (data?.users as any[]) || [];
            fetched += arr.length;
            if (arr.length < perPage) break;
            pageIdx += 1;
            if (pageIdx > 50) { console.warn('⚠️ listUsers pagination safety cap reached (users/list)'); break; }
          }
          authTotalUsers = fetched;
        }
      } catch (e) {
        console.error('❌ Exception while counting auth users (users/list):', e);
      }
    }

    const totalUsersFinal = (isUnfilteredRequest && authTotalUsers && !Number.isNaN(authTotalUsers)) ? authTotalUsers : (count || 0);

    // Format users with additional computed fields
    const formattedUsers = users.map(user => {
      // Calculate correct tier based on total_points_earned
      const totalPointsEarned = user.total_points_earned || 0;
      const calculatedTier = getTierFromPoints(totalPointsEarned);

      return {
        ...user,
        fullName: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email?.split('@')[0] || 'Unknown User',
        pointsValue: (user.points_balance / 1000).toFixed(2),
        tierInfo: getTierInfo(calculatedTier), // Use calculated tier instead of stored tier
        calculatedTier,
        storedTier: user.tier_level,
        tierMismatch: user.tier_level !== calculatedTier,
        searchRelevance: search.trim() ? calculateSearchRelevance(user, search.trim().toLowerCase()) : 0
      };
    });

    // Sort by search relevance if searching
    if (search.trim()) {
      formattedUsers.sort((a, b) => b.searchRelevance - a.searchRelevance);
    }

    // Calculate pagination info (use final total for pages when unfiltered)
    const totalPages = Math.ceil((totalUsersFinal) / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      success: true,
      users: formattedUsers,
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers: totalUsersFinal,
        usersPerPage: limit,
        hasNextPage,
        hasPrevPage,
        startIndex: offset + 1,
        endIndex: Math.min(offset + limit, totalUsersFinal)
      },
      filters: {
        search: search.trim(),
        tier: tierFilter,
        language: languageFilter,
        recent,
        startDate,
        endDate,
        status
      },
      count: formattedUsers.length
    });

  } catch (error: any) {
    console.error('❌ Admin user list error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}, { rateLimitType: 'admin_bulk_operations' });

// Helper function to get tier information
function getTierInfo(tier: string) {
  const tierMap = {
    bronze: { icon: '🥉', color: '#CD7F32', name: 'Bronze' },
    silver: { icon: '🥈', color: '#C0C0C0', name: 'Silver' },
    gold: { icon: '🥇', color: '#FFD700', name: 'Gold' },
    platinum: { icon: '💎', color: '#E5E4E2', name: 'Platinum' },
    diamond: { icon: '💠', color: '#B9F2FF', name: 'Diamond' }
  };
  return tierMap[tier as keyof typeof tierMap] || tierMap.bronze;
}

// Helper function to calculate search relevance
function calculateSearchRelevance(user: any, searchTerm: string): number {
  let relevance = 0;
  const term = searchTerm.toLowerCase();

  // Exact email match gets highest score
  if (user.email && user.email.toLowerCase() === term) {
    relevance += 100;
  } else if (user.email && user.email.toLowerCase().includes(term)) {
    relevance += 50;
  }

  // Name matches
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').toLowerCase();
  if (fullName === term) {
    relevance += 90;
  } else if (fullName.includes(term)) {
    relevance += 40;
  }

  // First name exact match
  if (user.first_name && user.first_name.toLowerCase() === term) {
    relevance += 80;
  } else if (user.first_name && user.first_name.toLowerCase().includes(term)) {
    relevance += 30;
  }

  // Last name exact match
  if (user.last_name && user.last_name.toLowerCase() === term) {
    relevance += 80;
  } else if (user.last_name && user.last_name.toLowerCase().includes(term)) {
    relevance += 30;
  }

  // Telegram username matches
  if (user.telegram_username && user.telegram_username.toLowerCase() === term) {
    relevance += 70;
  } else if (user.telegram_username && user.telegram_username.toLowerCase().includes(term)) {
    relevance += 25;
  }

  return relevance;
}
