'use client';

import { useRouter } from 'next/navigation';
import { PointsHero } from './points-hero';
import { EarningBenefits } from './earning-benefits';
import { PointsDetailsDisclosure } from './points-details-disclosure';

interface RedesignedPointsSectionProps {
  pointsBreakdown: {
    available_points: number;
    total_earned: number;
    weekly_used: number;
    current_tier: string;
    tier_icon: string;
    earned_points: number;
    tier_reward_points: number;
    other_points: number;
    available_by_type?: {
      earned: number;
      tier_rewards: number;
    };
  };
  recentTransactions: Array<{
    id: string;
    description: string;
    points: number;
    created_at: string;
    type: 'earned' | 'redeemed' | 'bonus' | 'adjustment';
  }>;
}

const tierBenefitsMap = {
  bronze: [
    '10 points per $1 spent'
  ],
  silver: [
    '10 points per $1 spent',
    'Birthday bonus points'
  ],
  gold: [
    '10 points per $1 spent',
    'Birthday bonus points',
    'Priority customer support'
  ],
  platinum: [
    '10 points per $1 spent',
    'Free shipping on all orders',
    'Priority customer support',
    '$50 gift credit reward'
  ],
  diamond: [
    '10 points per $1 spent',
    'Permanent free shipping',
    '$100 end-of-year bundle pack',
    'Exclusive early access',
    'Priority customer support',
    'VIP customer status'
  ]
};

export function RedesignedPointsSection({ 
  pointsBreakdown, 
  recentTransactions 
}: RedesignedPointsSectionProps) {
  const router = useRouter();
  
  const currentTier = pointsBreakdown.current_tier || 'Bronze';
  const tierKey = currentTier.toLowerCase() as keyof typeof tierBenefitsMap;
  const tierBenefits = tierBenefitsMap[tierKey] || tierBenefitsMap.bronze;
  
  const handleUsePoints = () => {
    // Navigate to cart or products page where points can be used
    router.push('/en/cart');
  };
  
  const handleLearnMore = () => {
    // Scroll to the earning benefits section or show more info
    const element = document.getElementById('earning-benefits');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 lg:space-y-10 max-w-4xl mx-auto">
      {/* Hero Section - Primary Focus - Enhanced Spacing */}
      <div className="px-2 sm:px-4 lg:px-0">
        <PointsHero
          availablePoints={pointsBreakdown.available_points}
          currentTier={currentTier}
          tierIcon={pointsBreakdown.tier_icon || '🥉'}
          onUsePoints={handleUsePoints}
          onLearnMore={handleLearnMore}
        />
      </div>

      {/* Earning & Benefits - Secondary Focus - Enhanced Layout */}
      <div id="earning-benefits" className="px-2 sm:px-4 lg:px-0">
        <EarningBenefits
          currentTier={currentTier}
          tierIcon={pointsBreakdown.tier_icon || '🥉'}
          tierBenefits={tierBenefits}
          earnRate={10} // 10 points per $1
        />
      </div>

      {/* Details - Progressive Disclosure - Enhanced Spacing */}
      <div className="px-2 sm:px-4 lg:px-0">
        <PointsDetailsDisclosure
          availablePoints={pointsBreakdown.available_points}
          totalEarned={pointsBreakdown.total_earned}
          weeklyUsed={pointsBreakdown.weekly_used}
          pointsSources={{
            orders: pointsBreakdown.earned_points,
            tierRewards: pointsBreakdown.tier_reward_points,
            other: pointsBreakdown.other_points
          }}
          recentTransactions={recentTransactions}
        />
      </div>
    </div>
  );
}
