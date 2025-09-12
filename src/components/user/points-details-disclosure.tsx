'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, BarChart3, History, TrendingUp, Calendar, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';


interface PointsTransaction {
  id: string;
  description: string;
  points: number;
  created_at: string;
  type: 'earned' | 'redeemed' | 'bonus' | 'adjustment';
}

interface PointsDetailsDisclosureProps {
  availablePoints: number; // The actual available points to display
  totalEarned: number;
  weeklyUsed: number;
  pointsSources: {
    orders: number;
    tierRewards: number;
    other: number;
  };
  recentTransactions: PointsTransaction[];
}

export function PointsDetailsDisclosure({
  availablePoints,
  totalEarned,
  weeklyUsed,
  pointsSources,
  recentTransactions
}: PointsDetailsDisclosureProps) {
  const [isOpen, setIsOpen] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'earned': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'bonus': return <Calendar className="h-4 w-4 text-purple-600" />;
      case 'redeemed': return <BarChart3 className="h-4 w-4 text-red-600" />;
      default: return <History className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <Card className="border-2 border-gray-200 bg-gradient-to-br from-gray-50 to-slate-50 shadow-lg">
      <CardHeader
        className="cursor-pointer hover:bg-gray-100 transition-colors p-4 sm:p-6 min-h-[80px] h-[250px] sm:h-auto"
        onClick={() => setIsOpen(!isOpen)}
      >
        <CardTitle className="flex items-center justify-between text-gray-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gray-200 rounded-xl shadow-sm">
              <BarChart3 className="h-6 w-6 sm:h-7 sm:w-7 text-gray-600" />
            </div>
            <span className="text-xl sm:text-2xl font-bold">Points Details & History</span>
          </div>
          <div className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            {isOpen ? (
              <ChevronUp className="h-6 w-6 text-gray-500" />
            ) : (
              <ChevronDown className="h-6 w-6 text-gray-500" />
            )}
          </div>
        </CardTitle>
        <p className="text-base sm:text-lg text-gray-600 text-left font-medium mt-2">
          {isOpen ? 'Hide detailed breakdown and transaction history' : 'View detailed breakdown and transaction history'}
        </p>
      </CardHeader>

      {isOpen && (
        <CardContent className="pt-0 space-y-8 p-4 sm:p-6">
            {/* Statistics Grid - Enhanced Design */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              <div className="bg-white p-5 sm:p-6 rounded-xl border-2 border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                  </div>
                  <span className="text-base sm:text-lg font-bold text-gray-700">Total Earned</span>
                </div>
                <div className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 mb-2">{totalEarned.toLocaleString()}</div>
                <div className="text-base sm:text-lg text-gray-600 font-medium">Lifetime points</div>
              </div>

              <div className="bg-white p-5 sm:p-6 rounded-xl border-2 border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                  </div>
                  <span className="text-base sm:text-lg font-bold text-gray-700">This Week Used</span>
                </div>
                <div className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 mb-2">{weeklyUsed.toLocaleString()}</div>
                <div className="text-base sm:text-lg text-gray-600 font-medium">Saved ${(weeklyUsed / 1000).toFixed(2)}</div>
              </div>

              <div className="bg-white p-5 sm:p-6 rounded-xl border-2 border-blue-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                  </div>
                  <span className="text-base sm:text-lg font-bold text-gray-700">Available</span>
                </div>
                <div className="text-2xl sm:text-3xl lg:text-4xl font-black text-blue-600 mb-2">{availablePoints.toLocaleString()}</div>
                <div className="text-base sm:text-lg text-gray-600 font-medium">Ready to use</div>
              </div>
            </div>

            {/* Points Sources Breakdown - Enhanced Design */}
            <div className="bg-white p-5 sm:p-6 rounded-xl border-2 border-gray-200 shadow-sm">
              <h4 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600" />
                </div>
                Points Sources (Historical)
              </h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 sm:py-4 border-b-2 border-gray-100">
                  <span className="text-base sm:text-lg text-gray-700 font-medium">From Orders</span>
                  <span className="text-lg sm:text-xl font-bold text-gray-900">{pointsSources.orders.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-3 sm:py-4 border-b-2 border-gray-100">
                  <span className="text-base sm:text-lg text-gray-700 font-medium">Tier Rewards</span>
                  <span className="text-lg sm:text-xl font-bold text-purple-600">{pointsSources.tierRewards.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-3 sm:py-4">
                  <span className="text-base sm:text-lg text-gray-700 font-medium">Other</span>
                  <span className="text-lg sm:text-xl font-bold text-gray-900">{pointsSources.other.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Recent Transactions - Enhanced Design */}
            <div className="bg-white p-5 sm:p-6 rounded-xl border-2 border-gray-200 shadow-sm">
              <h4 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <History className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600" />
                </div>
                Recent Activity
              </h4>
              <div className="space-y-4 max-h-80 overflow-y-auto">
                {recentTransactions.slice(0, 5).map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between py-3 sm:py-4 border-b-2 border-gray-100 last:border-b-0">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-gray-100 rounded-full">
                        {getTransactionIcon(transaction.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-base sm:text-lg font-bold text-gray-900 line-clamp-2">
                          {transaction.description}
                        </div>
                        <div className="text-sm sm:text-base text-gray-600 font-medium">
                          {formatDate(transaction.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className={`text-lg sm:text-xl font-black ${
                      transaction.points > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.points > 0 ? '+' : ''}{transaction.points.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
              
              {recentTransactions.length > 5 && (
                <Button
                  variant="outline"
                  className="w-full mt-6 border-2 border-gray-200 text-gray-600 hover:text-gray-700 hover:bg-gray-50 font-bold py-4 px-6 rounded-xl text-base sm:text-lg min-h-[56px]"
                >
                  <Eye className="h-5 w-5 sm:h-6 sm:w-6 mr-3" />
                  View All Transactions
                </Button>
              )}
            </div>
        </CardContent>
      )}
    </Card>
  );
}

function getTransactionIcon(type: string) {
  switch (type) {
    case 'earned': return <TrendingUp className="h-4 w-4 text-green-600" />;
    case 'bonus': return <Calendar className="h-4 w-4 text-purple-600" />;
    case 'redeemed': return <BarChart3 className="h-4 w-4 text-red-600" />;
    default: return <History className="h-4 w-4 text-gray-600" />;
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}


