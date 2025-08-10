'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { 
  Star, 
  TrendingUp, 
  TrendingDown, 
  Award, 
  Crown, 
  Gem, 
  History,
  Gift,
  Calendar,
  ArrowUp,
  ArrowDown,
  Plus,
  Minus
} from 'lucide-react'
import { PointsService, UserPointsSummary, PointTransaction } from '@/lib/services/points-service'
import { formatPrice, getCorrectUserTier } from '@/lib/utils'

interface PointsDashboardProps {
  userId: string
  userProfile?: any
}

interface PointsBreakdown {
  earnedFromPurchases: number
  bonusFromRewards: number
  totalAvailable: number
}

const getRankIcon = (rank: string) => {
  switch (rank) {
    case 'diamond': return <Gem className="h-5 w-5 text-blue-600" />
    case 'platinum': return <Crown className="h-5 w-5 text-purple-600" />
    case 'gold': return <Award className="h-5 w-5 text-yellow-600" />
    case 'silver': return <Star className="h-5 w-5 text-gray-500" />
    default: return <Star className="h-5 w-5 text-orange-600" />
  }
}

const getRankColor = (rank: string) => {
  switch (rank) {
    case 'diamond': return 'bg-gradient-to-r from-blue-100 via-cyan-100 to-blue-100 text-blue-900 border-blue-300 shadow-lg ring-2 ring-blue-200 ring-opacity-50'
    case 'platinum': return 'bg-gradient-to-r from-slate-100 to-slate-200 text-slate-800 border-slate-300 shadow-md'
    case 'gold': return 'bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 border-yellow-300 shadow-sm'
    case 'silver': return 'bg-gray-100 text-gray-800 border-gray-200'
    default: return 'bg-orange-100 text-orange-800 border-orange-200'
  }
}

const getTransactionIcon = (type: string) => {
  switch (type) {
    case 'earned': return <ArrowUp className="h-4 w-4 text-green-600" />
    case 'redeemed': return <ArrowDown className="h-4 w-4 text-red-600" />
    case 'bonus': return <Plus className="h-4 w-4 text-blue-600" />
    case 'admin_adjustment': return <Plus className="h-4 w-4 text-purple-600" />
    default: return <Minus className="h-4 w-4 text-gray-600" />
  }
}

export default function PointsDashboard({ userId, userProfile }: PointsDashboardProps) {
  const [pointsSummary, setPointsSummary] = useState<UserPointsSummary | null>(null)
  const [transactions, setTransactions] = useState<PointTransaction[]>([])
  const [pointsBreakdown, setPointsBreakdown] = useState<PointsBreakdown | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const pointsService = new PointsService(false) // Don't use service role on client

  useEffect(() => {
    loadPointsData()
  }, [userId])

  // Remove the incorrect frontend calculation - we'll use the backend service instead

  const loadPointsData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load points summary
      const { summary, error: summaryError } = await pointsService.getUserPointsSummary(userId)
      if (summaryError) throw new Error(summaryError)
      setPointsSummary(summary)

      // Load transaction history
      const { transactions, error: transactionError } = await pointsService.getUserPointHistory(userId, 20)
      if (transactionError) throw new Error(transactionError)
      setTransactions(transactions)

      // Load points breakdown using the correct backend service
      const { breakdown, error: breakdownError } = await pointsService.getPointsBreakdown(userId)
      if (breakdownError) throw new Error(breakdownError)

      // Convert backend breakdown to frontend format
      const frontendBreakdown = {
        earnedFromPurchases: breakdown.breakdown_by_source.orders,
        bonusFromRewards: breakdown.breakdown_by_source.tier_rewards,
        totalAvailable: breakdown.total_available
      }
      setPointsBreakdown(frontendBreakdown)

    } catch (err: any) {
      console.error('Error loading points data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !pointsSummary) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <p>Error loading points data: {error}</p>
            <Button onClick={loadPointsData} className="mt-4">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Prominent Available Balance */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Points & Rewards</h2>
            <p className="text-gray-600">Track your loyalty points and ranking progress</p>
          </div>
        </div>

        {/* Prominent Available Balance Display */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Star className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Available Points Balance</h3>
                  <p className="text-sm text-gray-600">Ready to redeem for discounts</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-blue-600 mb-1">
                  {pointsSummary.points_balance.toLocaleString()}
                </div>
                <p className="text-sm text-gray-600">
                  Worth {formatPrice(pointsSummary.points_balance / 1000)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Points Breakdown */}
      {pointsBreakdown && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Gift className="h-5 w-5 text-purple-500" />
              <span>Points Breakdown</span>
            </CardTitle>
            <CardDescription>
              Understanding your points sources
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Earned from Purchases */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-800">Earned from Purchases</h4>
                    <p className="text-sm text-green-600">10 points per $1 spent</p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold text-green-700">
                    {pointsBreakdown.earnedFromPurchases.toLocaleString()}
                  </div>
                  <p className="text-sm text-green-600">
                    Worth {formatPrice(pointsBreakdown.earnedFromPurchases / 1000)}
                  </p>
                </div>
              </div>

              {/* Bonus from Tier Rewards */}
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <Gift className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-purple-800">Bonus from Tier Rewards</h4>
                    <p className="text-sm text-purple-600">Tier achievement bonuses</p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold text-purple-700">
                    {pointsBreakdown.bonusFromRewards.toLocaleString()}
                  </div>
                  <p className="text-sm text-purple-600">
                    Worth {formatPrice(pointsBreakdown.bonusFromRewards / 1000)}
                  </p>
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Important:</strong> Only purchase points count toward tier ranking
              </p>
              <p className="text-xs text-gray-500">
                Bonus reward points are added to your balance but don't affect your tier progression
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unified Rank Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Award className="h-5 w-5 text-purple-500" />
            <span>Loyalty Rank Status</span>
          </CardTitle>
          <CardDescription>
            Your current tier and progress to the next level
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${getRankColor(pointsSummary.current_rank).replace('text-', 'bg-').replace('800', '100')}`}>
                <div className="text-2xl">
                  {getRankIcon(pointsSummary.current_rank)}
                </div>
              </div>
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <Badge className={`${getRankColor(pointsSummary.current_rank)} text-sm px-3 py-1`}>
                    <span className="capitalize font-semibold">{pointsSummary.current_rank} Tier</span>
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">
                  {pointsSummary.total_points_earned.toLocaleString()} lifetime points earned
                </p>
              </div>
            </div>
            {pointsSummary.next_rank && (
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">Next: {pointsSummary.next_rank}</p>
                <p className="text-xs text-gray-600">
                  {pointsSummary.points_to_next_rank?.toLocaleString()} points to go
                </p>
              </div>
            )}
          </div>

          {pointsSummary.next_rank && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress to {pointsSummary.next_rank}</span>
                <span className="font-medium">{pointsSummary.rank_progress_percentage}%</span>
              </div>
              <Progress value={pointsSummary.rank_progress_percentage} className="h-3" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Points Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Total Points Earned */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2 text-sm">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span>Total Points Earned</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Lifetime accumulated points
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 mb-1">
              {pointsSummary.total_points_earned.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500">
              Worth {formatPrice(pointsSummary.total_points_earned / 1000)}
            </p>
          </CardContent>
        </Card>

        {/* Points Used */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2 text-sm">
              <TrendingDown className="h-4 w-4 text-orange-500" />
              <span>Weekly Points Used</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Points redeemed this week
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 mb-1">
              {pointsSummary.weekly_points_used.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500">
              Saved {formatPrice(pointsSummary.weekly_points_used / 1000)} this week
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Points History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <History className="h-5 w-5 text-gray-500" />
            <span>Points History</span>
          </CardTitle>
          <CardDescription>
            Recent points transactions and activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No points transactions yet</p>
              <p className="text-sm">Start shopping to earn points!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.slice(0, 10).map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      transaction.transaction_type === 'earned' ? 'bg-green-100' : 
                      transaction.transaction_type === 'redeemed' ? 'bg-red-100' : 'bg-blue-100'
                    }`}>
                      {getTransactionIcon(transaction.transaction_type)}
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {transaction.description || `Points ${transaction.transaction_type}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(transaction.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className={`font-bold text-sm ${
                    transaction.points > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {transaction.points > 0 ? '+' : ''}{transaction.points.toLocaleString()}
                  </div>
                </div>
              ))}
              
              {transactions.length > 10 && (
                <div className="text-center pt-4">
                  <Button variant="outline" size="sm">
                    View All Transactions
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
