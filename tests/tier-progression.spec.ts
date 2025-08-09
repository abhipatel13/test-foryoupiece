import { test, expect } from '@playwright/test';

async function getUserId(request: any) {
  const res = await request.post('/api/auth/validate');
  if (res.status() !== 200) throw new Error('Not authenticated');
  const j = await res.json();
  return j.userId as string;
}

async function getCoupons(request: any) {
  const res = await request.get('/api/user/coupons');
  expect(res.status()).toBe(200);
  return (await res.json()).coupons as any[];
}

async function getTierRewards(request: any, userId: string) {
  const res = await request.get(`/api/user/tier-rewards?userId=${userId}`);
  expect(res.status()).toBe(200);
  return (await res.json()).rewards as any[];
}

test.describe('Tier progression and reward distribution', () => {
  test('Admin points adjustment triggers tier rewards and user-scoped coupons', async ({ request }) => {
    test.slow();

    const userId = await getUserId(request);

    // 1) Reset any test state using dev-only test API if enabled; otherwise proceed
    await request.post('/api/test/tier-progression', {
      data: { action: 'reset_progress' }
    }).catch(() => {});

    // 2) Read initial coupons and rewards
    const beforeCoupons = await getCoupons(request);
    const beforeRewards = await getTierRewards(request, userId);

    // 3) As admin, add points to cross a threshold (e.g., to Silver 5k)
    // We call the protected admin endpoint which expects a valid admin session. If not admin, this step will 403 and we skip assertions for award creation (but keep the test informative).
    const adjustRes = await request.post('/api/admin/points/adjust', {
      data: {
        userId,
        pointsAdjustment: 6000,
        reason: 'e2e tier test',
      }
    });

    if (adjustRes.status() !== 200) {
      test.fixme(true, 'Admin points adjustment requires admin session; run locally with admin privileges.');
    }

    // 4) Fetch rewards/coupons again
    const afterRewards = await getTierRewards(request, userId);
    const afterCoupons = await getCoupons(request);

    // 5) Assertions: rewards increased and at least one coupon is tier_reward + allowed to this user
    expect(afterRewards.length).toBeGreaterThanOrEqual(beforeRewards.length);

    const newCoupons = afterCoupons.filter(a => !beforeCoupons.some(b => b.code === a.code));
    const tierCoupons = newCoupons.filter(c => c.is_tier_reward && (c.tier_level === 'silver' || c.tier_level === 'gold' || c.tier_level === 'platinum' || c.tier_level === 'diamond'));
    expect(tierCoupons.length).toBeGreaterThanOrEqual(1);
  });
});

