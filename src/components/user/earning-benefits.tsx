'use client';

import { useState, memo, useMemo, useCallback } from 'react';
import { Target, Gift, Truck, Star, ChevronDown, ChevronUp, Crown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface EarningBenefitsProps {
  currentTier: string;
  tierIcon: string;
  tierBenefits: string[];
  earnRate: number; // points per dollar
}

const tierIcons = {
  bronze: '🥉',
  silver: '🥈', 
  gold: '🥇',
  platinum: '💎',
  diamond: '💎'
};

const tierColors = {
  bronze: 'text-amber-600',
  silver: 'text-gray-600',
  gold: 'text-yellow-600', 
  platinum: 'text-purple-600',
  diamond: 'text-blue-600'
};

const EarningBenefitsComponent = function EarningBenefits({
  currentTier,
  tierIcon,
  tierBenefits,
  earnRate
}: EarningBenefitsProps) {
  const [showAllBenefits, setShowAllBenefits] = useState(false);

  // Memoize toggle handler to prevent unnecessary re-renders
  const toggleExpanded = useCallback(() => {
    setShowAllBenefits(prev => !prev);
  }, []);

  // Memoize tier calculations
  const tierKey = useMemo(() => currentTier.toLowerCase() as keyof typeof tierColors, [currentTier]);
  const tierColorClass = useMemo(() => tierColors[tierKey] || tierColors.bronze, [tierKey]);

  // Memoize displayed benefits to prevent unnecessary recalculation
  const displayedBenefits = useMemo(() =>
    showAllBenefits ? tierBenefits : tierBenefits.slice(0, 3),
    [showAllBenefits, tierBenefits]
  );
  
  return (
    <div className="space-y-6">
      {/* Earning Points Card - Enhanced Design */}
      <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg">
        <CardHeader className="pb-4 sm:pb-6 h-[70px] sm:h-auto">
          <CardTitle className="flex items-center gap-4 text-green-700">
            <div className="p-3 bg-green-100 rounded-xl shadow-sm">
              <Target className="h-6 w-6 sm:h-7 sm:w-7 text-green-600" />
            </div>
            <span className="text-xl sm:text-2xl font-bold">Earn More Points</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 p-4 sm:p-5 bg-white rounded-xl border-2 border-green-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="p-3 bg-green-100 rounded-full">
              <Star className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
            </div>
            <div className="flex-1">
              <div className="text-lg sm:text-xl font-bold text-gray-900">{earnRate} points per $1 spent</div>
              <div className="text-base sm:text-lg text-gray-600 font-medium">On every purchase</div>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 sm:p-5 bg-white rounded-xl border-2 border-green-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="p-3 bg-green-100 rounded-full">
              <Crown className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
            </div>
            <div className="flex-1">
              <div className="text-lg sm:text-xl font-bold text-gray-900">Tier upgrade bonuses</div>
              <div className="text-base sm:text-lg text-gray-600 font-medium">Bonus points when you level up</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Tier Benefits Card - Enhanced Design */}
      <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 shadow-lg">
        <CardHeader className="pb-4 sm:pb-6 h-[170px] sm:h-auto">
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-4 text-purple-700">
              <div className="p-3 bg-purple-100 rounded-xl shadow-sm">
                <Gift className="h-6 w-6 sm:h-7 sm:w-7 text-purple-600" />
              </div>
              <span className="text-xl sm:text-2xl font-bold">Your {currentTier} Benefits</span>
            </div>
            <Badge variant="outline" className={`${tierColors[tierKey]} border-current px-4 py-2 text-base sm:text-lg font-bold self-start sm:self-center`}>
              <span className="mr-2 text-lg sm:text-xl">{tierIcon}</span>
              {currentTier.toUpperCase()}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {displayedBenefits.map((benefit, index) => (
            <div key={index} className="flex items-center gap-4 p-4 sm:p-5 bg-white rounded-xl border-2 border-purple-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="p-3 bg-purple-100 rounded-full">
                {index === 0 && <Star className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />}
                {index === 1 && <Truck className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />}
                {index === 2 && <Gift className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />}
                {index > 2 && <Crown className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />}
              </div>
              <div className="text-lg sm:text-xl font-bold text-gray-900">{benefit}</div>
            </div>
          ))}

          {tierBenefits.length > 3 && (
            <Button
              variant="ghost"
              onClick={toggleExpanded}
              className="w-full text-purple-600 hover:text-purple-700 hover:bg-purple-50 font-bold py-4 px-6 rounded-xl text-base sm:text-lg min-h-[56px]"
            >
              {showAllBenefits ? (
                <>
                  <ChevronUp className="h-5 w-5 sm:h-6 sm:w-6 mr-3" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-5 w-5 sm:h-6 sm:w-6 mr-3" />
                  Show All Benefits ({tierBenefits.length})
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Export memoized component for performance optimization
export const EarningBenefits = memo(EarningBenefitsComponent);
