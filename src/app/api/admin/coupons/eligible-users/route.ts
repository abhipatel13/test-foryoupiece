import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth/admin-middleware'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

// POST /api/admin/coupons/eligible-users
// Body: {
//   page?: number, limit?: number,
//   couponId?: string,
//   targeting?: {
//     tiers?: ('silver'|'gold'|'platinum'|'diamond')[],
//     recentlySignedUpDays?: number,
//     mostPurchasedTopN?: number,
//     mostPurchasedMinTotalSpent?: number,
//     recentlyPurchasedDays?: number
//   }
// }
export const POST = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    const serviceClient = createServiceRoleClient()
    if (!serviceClient) {
      return NextResponse.json({ success: false, error: 'Service configuration error' }, { status: 500 })
    }

    const body = await request.json()
    const page = Math.max(1, parseInt(String(body.page || '1'), 10))
    const limit = Math.min(100, Math.max(1, parseInt(String(body.limit || '40'), 10))) // default 40

    let targeting = body.targeting as any | undefined

    // If couponId provided, load coupon to get its targeting
    if (body.couponId) {
      const { data: coupon, error: couponErr } = await serviceClient
        .from('coupons')
        .select('id, metadata, is_tier_specific, tier_restrictions')
        .eq('id', body.couponId)
        .single()
      if (couponErr) {
        return NextResponse.json({ success: false, error: 'Coupon not found' }, { status: 404 })
      }
      const metaT = (coupon.metadata as any)?.targeting || {}
      targeting = {
        ...(Array.isArray(coupon.tier_restrictions) && coupon.is_tier_specific ? { tiers: coupon.tier_restrictions } : {}),
        ...(metaT.recently_signed_up_days ? { recentlySignedUpDays: metaT.recently_signed_up_days } : {}),
        ...(metaT.most_purchased_top_n ? { mostPurchasedTopN: metaT.most_purchased_top_n } : {}),
        ...(metaT.most_purchased_min_total_spent ? { mostPurchasedMinTotalSpent: metaT.most_purchased_min_total_spent } : {}),
        ...(metaT.recently_purchased_days ? { recentlyPurchasedDays: metaT.recently_purchased_days } : {})
      }
    }

    const tiers: string[] | undefined = targeting?.tiers
    const recentlySignedUpDays: number | undefined = targeting?.recentlySignedUpDays
    const mostPurchasedTopN: number | undefined = targeting?.mostPurchasedTopN
    const mostPurchasedMinTotalSpent: number | undefined = targeting?.mostPurchasedMinTotalSpent
    const recentlyPurchasedDays: number | undefined = targeting?.recentlyPurchasedDays

    // Base users query
    let usersQuery = serviceClient
      .from('users')
      .select('id, first_name, last_name, email, tier_level, created_at, total_spent', { count: 'exact' })

    if (tiers && tiers.length > 0) {
      usersQuery = usersQuery.in('tier_level', tiers)
    }

    if (recentlySignedUpDays && recentlySignedUpDays > 0) {
      const since = new Date(); since.setDate(since.getDate() - recentlySignedUpDays)
      usersQuery = usersQuery.gte('created_at', since.toISOString())
    }

    if (mostPurchasedMinTotalSpent && mostPurchasedMinTotalSpent > 0) {
      usersQuery = usersQuery.gte('total_spent', mostPurchasedMinTotalSpent)
    }

    // Order by spend desc by default when spend filters present
    const shouldOrderBySpend = Boolean(mostPurchasedMinTotalSpent || mostPurchasedTopN)
    if (shouldOrderBySpend) {
      usersQuery = usersQuery.order('total_spent', { ascending: false, nullsFirst: false })
    } else {
      usersQuery = usersQuery.order('created_at', { ascending: false })
    }

    // Apply pagination range; if topN is set, clamp to that window
    const offset = (page - 1) * limit
    let rangeEnd = offset + limit - 1
    let total = 0

    if (mostPurchasedTopN && mostPurchasedTopN > 0) {
      // Clamp the range to topN window
      if (offset >= mostPurchasedTopN) {
        // No results on this page
        return NextResponse.json({
          success: true,
          users: [],
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(mostPurchasedTopN / limit),
            totalUsers: mostPurchasedTopN,
            usersPerPage: limit
          },
          count: 0
        })
      }
      rangeEnd = Math.min(rangeEnd, mostPurchasedTopN - 1)
    }

    const { data: users, error: usersErr, count } = await usersQuery.range(offset, rangeEnd)
    if (usersErr) {
      console.error('eligible-users users query error:', usersErr)
      return NextResponse.json({ success: false, error: 'Failed to fetch eligible users' }, { status: 500 })
    }

    // Compute last purchase date map if needed (recentlyPurchasedDays or display requirement)
    const userIds = (users || []).map(u => u.id)
    let lastPurchaseMap: Record<string, string | null> = {}
    if (userIds.length > 0) {
      let ordersQuery = serviceClient
        .from('orders')
        .select('user_id, created_at, payment_status')
        .in('user_id', userIds)
        .eq('payment_status', 'verified')
      if (recentlyPurchasedDays && recentlyPurchasedDays > 0) {
        const since = new Date(); since.setDate(since.getDate() - recentlyPurchasedDays)
        ordersQuery = ordersQuery.gte('created_at', since.toISOString())
      }
      const { data: orders, error: ordersErr } = await ordersQuery
      if (!ordersErr && orders) {
        for (const o of orders) {
          const prev = lastPurchaseMap[o.user_id]
          if (!prev || new Date(o.created_at) > new Date(prev)) {
            lastPurchaseMap[o.user_id] = o.created_at
          }
        }
      }
    }

    // If recentlyPurchasedDays filtering was requested, ensure users had recent orders
    let filteredUsers = users || []
    if (recentlyPurchasedDays && recentlyPurchasedDays > 0) {
      filteredUsers = filteredUsers.filter(u => !!lastPurchaseMap[u.id])
    }

    // Derive accurate total count. When recentlyPurchasedDays is active, we must count
    // only users who have a verified order within the window, in addition to base filters.
    if (recentlyPurchasedDays && recentlyPurchasedDays > 0) {
      const since = new Date(); since.setDate(since.getDate() - recentlyPurchasedDays)
      const { data: recentOrders, error: recentErr } = await serviceClient
        .from('orders')
        .select('user_id')
        .eq('payment_status', 'verified')
        .gte('created_at', since.toISOString())

      if (!recentErr && recentOrders) {
        const ids = Array.from(new Set(recentOrders.map(o => o.user_id).filter(Boolean)))
        if (ids.length > 0) {
          let usersCountQuery = serviceClient
            .from('users')
            .select('id', { head: true, count: 'exact' })
            .in('id', ids)
          if (tiers && tiers.length > 0) usersCountQuery = usersCountQuery.in('tier_level', tiers)
          if (recentlySignedUpDays && recentlySignedUpDays > 0) {
            const sinceSignup = new Date(); sinceSignup.setDate(sinceSignup.getDate() - recentlySignedUpDays)
            usersCountQuery = usersCountQuery.gte('created_at', sinceSignup.toISOString())
          }
          if (mostPurchasedMinTotalSpent && mostPurchasedMinTotalSpent > 0) {
            usersCountQuery = usersCountQuery.gte('total_spent', mostPurchasedMinTotalSpent)
          }
          const { count: eligibleCount } = await usersCountQuery
          total = typeof eligibleCount === 'number' ? eligibleCount : filteredUsers.length
        } else {
          total = 0
        }
      } else {
        total = filteredUsers.length
      }
    } else {
      total = typeof count === 'number' ? count : filteredUsers.length
    }

    if (mostPurchasedTopN && mostPurchasedTopN > 0) {
      total = Math.min(total, mostPurchasedTopN)
    }

    // Map response data
    const resultUsers = filteredUsers.map(u => ({
      id: u.id,
      name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email,
      email: u.email,
      rank: u.tier_level,
      registrationDate: u.created_at,
      totalPurchases: u.total_spent ?? 0,
      lastPurchaseDate: lastPurchaseMap[u.id] || null
    }))

    return NextResponse.json({
      success: true,
      users: resultUsers,
      total,
      pagination: {
        currentPage: page,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        totalUsers: total,
        usersPerPage: limit
      },
      count: resultUsers.length
    })
  } catch (e: any) {
    console.error('eligible-users error:', e)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}, { rateLimitType: 'admin_bulk_operations' })

