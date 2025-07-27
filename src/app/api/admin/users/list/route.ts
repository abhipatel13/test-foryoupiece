import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { withAdminAuth } from '@/lib/auth/admin-middleware';
import { getTierFromPoints } from '@/lib/utils';

/**
 * Admin User List API with Pagination and Search
 * GET /api/admin/users/list?page=1&limit=20&search=query
 */
export const GET = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('📋 Admin user list request received');

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
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    console.log('📋 Query params:', { page, limit, search, offset });

    // Build base query
    let query = serviceClient
      .from('users')
      .select(`
        id,
        first_name,
        last_name,
        email,
        points_balance,
        tier_level,
        total_points_earned,
        avatar_url,
        total_spent,
        total_orders,
        created_at,
        updated_at
      `, { count: 'exact' });

    // Add search filter if provided
    if (search.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      query = query.or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm}`);
    }

    // Add pagination and ordering
    const { data: users, error: usersError, count } = await query
      .order('points_balance', { ascending: false })
      .range(offset, offset + limit - 1);

    if (usersError) {
      console.error('❌ User list query failed:', usersError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch users: ' + usersError.message
      }, { status: 500 });
    }

    console.log(`✅ Retrieved ${users.length} users (${count} total)`);

    // Format users with additional computed fields
    const formattedUsers = users.map(user => {
      // Calculate correct tier based on total_points_earned
      const totalPointsEarned = user.total_points_earned || 0;
      const calculatedTier = getTierFromPoints(totalPointsEarned);

      return {
        ...user,
        fullName: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email.split('@')[0],
        pointsValue: (user.points_balance / 1000).toFixed(2),
        tierInfo: getTierInfo(calculatedTier), // Use calculated tier instead of stored tier
        calculatedTier,
        storedTier: user.tier_level,
        tierMismatch: user.tier_level !== calculatedTier,
        searchRelevance: search.trim() ? calculateSearchRelevance(user, search.trim().toLowerCase()) : 0
      };
    });

    // Sort by search relevance if searching, otherwise keep points order
    if (search.trim()) {
      formattedUsers.sort((a, b) => b.searchRelevance - a.searchRelevance);
    }

    // Calculate pagination info
    const totalPages = Math.ceil((count || 0) / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      success: true,
      users: formattedUsers,
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers: count || 0,
        usersPerPage: limit,
        hasNextPage,
        hasPrevPage,
        startIndex: offset + 1,
        endIndex: Math.min(offset + limit, count || 0)
      },
      search: search.trim(),
      count: formattedUsers.length
    });

  } catch (error: any) {
    console.error('❌ Admin user list error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});

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
  if (user.email.toLowerCase() === term) {
    relevance += 100;
  } else if (user.email.toLowerCase().includes(term)) {
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
  
  return relevance;
}
