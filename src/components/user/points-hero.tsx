'use client';

import { useState, memo, useMemo, useCallback } from 'react';
import { Wallet, ShoppingCart, Gift, ChevronRight, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PointsHeroProps {
  availablePoints: number;
  currentTier: string;
  tierIcon: string;
  onUsePoints?: () => void;
  onLearnMore?: () => void;
}

const tierColors = {
  bronze: 'bg-amber-100 text-amber-800 border-amber-200',
  silver: 'bg-gray-100 text-gray-800 border-gray-200', 
  gold: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  platinum: 'bg-purple-100 text-purple-800 border-purple-200',
  diamond: 'bg-blue-100 text-blue-800 border-blue-200'
};

const tierGradients = {
  bronze: 'from-amber-500 to-amber-600',
  silver: 'from-gray-400 to-gray-500',
  gold: 'from-yellow-400 to-yellow-500', 
  platinum: 'from-purple-500 to-purple-600',
  diamond: 'from-blue-500 to-blue-600'
};

const PointsHeroComponent = function PointsHero({
  availablePoints,
  currentTier,
  tierIcon,
  onUsePoints,
  onLearnMore
}: PointsHeroProps) {
  // Memoize expensive calculations
  const dollarValue = useMemo(() => (availablePoints / 1000).toFixed(2), [availablePoints]);
  const tierKey = useMemo(() => currentTier.toLowerCase() as keyof typeof tierColors, [currentTier]);

  // Memoize event handlers to prevent unnecessary re-renders
  const handleUsePoints = useCallback(() => {
    onUsePoints?.();
  }, [onUsePoints]);

  const handleLearnMore = useCallback(() => {
    onLearnMore?.();
  }, [onLearnMore]);

  return (
    <Card className="relative overflow-hidden border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg">
      <CardContent className="p-4 sm:p-6 lg:p-8">
        {/* Header - Improved Mobile Layout */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-3 sm:mb-0">
            <div className="p-3 bg-blue-100 rounded-xl shadow-sm">
              <Wallet className="h-6 w-6 sm:h-7 sm:w-7 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Your Points Balance</h3>
              <p className="text-base sm:text-lg text-gray-600 font-medium">Ready to spend at checkout</p>
            </div>
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="self-start sm:self-center">
                <div className="p-2 hover:bg-blue-100 rounded-full transition-colors">
                  <Info className="h-5 w-5 text-gray-400" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-sm">Points you can use for discounts right now</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Main Balance Display - Enhanced Typography */}
        <div className="text-center mb-8 sm:mb-10">
          <div className="mb-4">
            <div className="flex items-baseline justify-center gap-2 sm:gap-3">
              <span className="text-4xl sm:text-6xl lg:text-7xl font-black text-blue-600 tracking-tight">
                {availablePoints.toLocaleString()}
              </span>
              <span className="text-lg sm:text-2xl lg:text-3xl font-bold text-gray-600">
                POINTS
              </span>
            </div>
          </div>
          <div className="text-lg sm:text-xl lg:text-2xl text-gray-700 font-semibold">
            Worth <span className="text-green-600 font-black text-xl sm:text-2xl lg:text-3xl">${dollarValue}</span> in savings
          </div>
        </div>

        {/* Tier Badge - Enhanced Design */}
        <div className="flex justify-center mb-6 sm:mb-8">
          <Badge
            variant="outline"
            className={`px-6 py-3 text-base sm:text-lg font-bold ${tierColors[tierKey]} border-2 shadow-sm`}
          >
            <span className="mr-3 text-xl sm:text-2xl">{tierIcon}</span>
            {currentTier.toUpperCase()} MEMBER
          </Badge>
        </div>

        {/* Action Buttons - Enhanced Touch Targets */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6 sm:mb-8">
          <Button
            onClick={handleUsePoints}
            className={`flex-1 bg-gradient-to-r ${tierGradients[tierKey]} hover:opacity-90 text-white font-bold py-4 px-8 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl text-base sm:text-lg min-h-[56px]`}
          >
            <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6 mr-3" />
            Use at Checkout
          </Button>

          <Button
            variant="outline"
            onClick={handleLearnMore}
            className="flex-1 border-2 border-blue-200 text-blue-600 hover:bg-blue-50 font-bold py-4 px-8 rounded-xl transition-all duration-200 text-base sm:text-lg min-h-[56px]"
          >
            <Gift className="h-5 w-5 sm:h-6 sm:w-6 mr-3" />
            Learn More
            <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 ml-3" />
          </Button>
        </div>

        {/* Quick Stats - Enhanced Layout */}
        <div className="pt-6 border-t-2 border-blue-200">
          <div className="grid grid-cols-2 gap-6 text-center">
            <div className="p-4 bg-white rounded-xl border border-blue-100 shadow-sm">
              <div className="text-sm sm:text-base text-gray-600 font-medium mb-1">This Week Saved</div>
              <div className="text-xl sm:text-2xl font-bold text-green-600">$0.00</div>
            </div>
            <div className="p-4 bg-white rounded-xl border border-blue-100 shadow-sm">
              <div className="text-sm sm:text-base text-gray-600 font-medium mb-1">Next Tier</div>
              <div className="text-xl sm:text-2xl font-bold text-gray-900">
                {currentTier === 'Diamond' ? 'Max Level!' : 'Coming Soon'}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Export memoized component for performance optimization
export const PointsHero = memo(PointsHeroComponent);
