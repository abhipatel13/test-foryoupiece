import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { createClient } from '@/lib/supabase/server';

/**
 * Admin User Search API
 * GET /api/admin/users/search?q=searchterm&limit=20
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Admin user search request received');

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
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!query || query.trim().length < 2) {
      return NextResponse.json({
        success: false,
        error: 'Search query must be at least 2 characters long'
      }, { status: 400 });
    }

    console.log('🔍 Searching users with query:', query);

    // SECURITY FIX: Sanitize search input to prevent PostgREST filter injection
    const sanitizedQuery = query
      .replace(/[,();'"\\]/g, '') // Remove dangerous punctuation
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .trim()
      .toLowerCase()
      .substring(0, 100); // Limit length

    if (!sanitizedQuery) {
      return NextResponse.json({
        success: true,
        users: [],
        query: '',
        count: 0
      });
    }

    // Search users by name or email
    const searchTerm = `%${sanitizedQuery}%`;

    const { data: users, error: searchError } = await serviceClient
      .from('users')
      .select(`
        id,
        first_name,
        last_name,
        email,
        points_balance,
        tier_level,
        avatar_url,
        total_spent,
        total_orders,
        created_at,
        updated_at
      `)
      .or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm}`)
      .order('points_balance', { ascending: false })
      .limit(limit);

    if (searchError) {
      console.error('❌ User search failed:', searchError);
      return NextResponse.json({
        success: false,
        error: 'Failed to search users: ' + searchError.message
      }, { status: 500 });
    }

    console.log(`✅ Found ${users.length} users matching query`);

    // Format users with additional computed fields
    const formattedUsers = users.map(user => ({
      ...user,
      fullName: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email.split('@')[0],
      pointsValue: (user.points_balance / 1000).toFixed(2),
      tierInfo: getTierInfo(user.tier_level),
      searchRelevance: calculateSearchRelevance(user, query.trim().toLowerCase())
    }));

    // Sort by search relevance
    formattedUsers.sort((a, b) => b.searchRelevance - a.searchRelevance);

    return NextResponse.json({
      success: true,
      users: formattedUsers,
      query: query.trim(),
      count: formattedUsers.length
    });

  } catch (error) {
    console.error('❌ Admin user search error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// Helper function to get tier information
function getTierInfo(tier: string) {
  const tierInfo = {
    bronze: { name: 'Bronze', minPoints: 0, color: 'amber', icon: '🥉' },
    silver: { name: 'Silver', minPoints: 5000, color: 'gray', icon: '🥈' },
    gold: { name: 'Gold', minPoints: 15000, color: 'yellow', icon: '🥇' },
    platinum: { name: 'Platinum', minPoints: 35000, color: 'purple', icon: '💎' },
    diamond: { name: 'Diamond', minPoints: 50000, color: 'blue', icon: '💠' }
  };

  return tierInfo[tier as keyof typeof tierInfo] || tierInfo.bronze;
}

// Helper function to calculate search relevance score
function calculateSearchRelevance(user: any, query: string): number {
  let score = 0;
  
  const firstName = (user.first_name || '').toLowerCase();
  const lastName = (user.last_name || '').toLowerCase();
  const email = user.email.toLowerCase();
  const fullName = `${firstName} ${lastName}`.trim();

  // Exact matches get highest score
  if (firstName === query || lastName === query || email === query) {
    score += 100;
  }

  // Full name exact match
  if (fullName === query) {
    score += 90;
  }

  // Starts with matches
  if (firstName.startsWith(query) || lastName.startsWith(query) || email.startsWith(query)) {
    score += 50;
  }

  // Contains matches
  if (firstName.includes(query) || lastName.includes(query) || email.includes(query)) {
    score += 25;
  }

  // Bonus for higher tier users (they might be searched more often)
  const tierBonus = {
    diamond: 10,
    platinum: 8,
    gold: 6,
    silver: 4,
    bronze: 2
  };
  score += tierBonus[user.tier_level as keyof typeof tierBonus] || 0;

  // Bonus for users with more points (active users)
  if (user.points_balance > 10000) score += 5;
  if (user.points_balance > 50000) score += 10;

  return score;
}
