'use client';

import { useState, useEffect } from 'react';
import { RedesignedPointsSection } from './redesigned-points-section';
import { PointsService, PointsBreakdown, PointTransaction } from '@/lib/services/points-service';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { requestUtils } from '@/lib/utils/request-deduplication';

interface RedesignedPointsWrapperProps {
  userId?: string;
}

export function RedesignedPointsWrapper({ userId }: RedesignedPointsWrapperProps) {
  const [pointsBreakdown, setPointsBreakdown] = useState<PointsBreakdown | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<PointTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    loadPointsData();
  }, [userId]);

  const loadPointsData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch points breakdown using the existing service
      const breakdown = await requestUtils.fetchPointsBreakdown(userId);
      setPointsBreakdown(breakdown);

      // Fetch recent transactions
      const pointsService = new PointsService();
      const transactionResult = await pointsService.getUserPointHistory(userId, 10); // Get last 10 transactions
      if (transactionResult.error) {
        console.error('Error fetching transactions:', transactionResult.error);
        setRecentTransactions([]);
      } else {
        setRecentTransactions(transactionResult.transactions);
      }

    } catch (err: any) {
      console.error('Error loading points data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Hero Skeleton */}
          <div className="text-center space-y-4">
            <Skeleton className="h-8 w-48 mx-auto" />
            <Skeleton className="h-16 w-64 mx-auto" />
            <Skeleton className="h-6 w-32 mx-auto" />
            <div className="flex gap-3 justify-center">
              <Skeleton className="h-12 w-32" />
              <Skeleton className="h-12 w-32" />
            </div>
          </div>
          
          {/* Benefits Skeleton */}
          <div className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6 text-center">
          <div className="text-red-600 font-medium">Failed to load points data</div>
          <div className="text-sm text-red-500 mt-1">{error}</div>
          <button 
            onClick={loadPointsData}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </CardContent>
      </Card>
    );
  }

  if (!pointsBreakdown) {
    return null;
  }

  // Transform the data for the new component
  const transformedData = {
    available_points: pointsBreakdown.total_available,
    total_earned: pointsBreakdown.earned_points + pointsBreakdown.tier_reward_points,
    weekly_used: 0, // This would need to be calculated from recent transactions
    current_tier: pointsBreakdown.tier_info.current_tier,
    tier_icon: getTierIcon(pointsBreakdown.tier_info.current_tier),
    earned_points: pointsBreakdown.breakdown_by_source.orders,
    tier_reward_points: pointsBreakdown.breakdown_by_source.tier_rewards,
    other_points: pointsBreakdown.breakdown_by_source.other + pointsBreakdown.breakdown_by_source.admin_adjustments,
    available_by_type: pointsBreakdown.available_by_type
  };

  // Transform transactions for the new component
  const transformedTransactions = recentTransactions.map(transaction => ({
    id: transaction.id,
    description: transaction.description || 'Points transaction',
    points: transaction.points,
    created_at: transaction.created_at,
    type: mapTransactionType(transaction.transaction_type)
  }));

  return (
    <RedesignedPointsSection 
      pointsBreakdown={transformedData}
      recentTransactions={transformedTransactions}
    />
  );
}

function getTierIcon(tier: string): string {
  const tierIcons = {
    bronze: '🥉',
    silver: '🥈', 
    gold: '🥇',
    platinum: '🏆',
    diamond: '💎'
  };
  return tierIcons[tier.toLowerCase() as keyof typeof tierIcons] || '🥉';
}

function mapTransactionType(type: string): 'earned' | 'redeemed' | 'bonus' | 'adjustment' {
  switch (type) {
    case 'earned': return 'earned';
    case 'redeemed': return 'redeemed';
    case 'bonus': return 'bonus';
    default: return 'adjustment';
  }
}
