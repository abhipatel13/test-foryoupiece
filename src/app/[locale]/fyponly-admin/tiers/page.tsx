'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Search,
  Filter,
  RefreshCw,
  Crown,
  Star,
  Award,
  Gem,
  Diamond,
  Users,
  TrendingUp,
  Eye,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'

interface TierUser {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  avatarUrl?: string
  pointsBalance: number
  totalPointsEarned: number
  totalSpent: number
  totalOrders: number
  storedTier: string
  calculatedTier: string
  tierMismatch: boolean
  currentTierInfo: {
    tier: string
    minPoints: number
    maxPoints: number | null
    nextTier: string | null
    pointsToNext: number
    progressPercentage: number
  }
  tierAchievedAt: string
  permanentFreeShipping: boolean
  createdAt: string
  updatedAt: string
  fullName: string
}



const tierIcons = {
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇',
  platinum: '🏆',
  diamond: '💎'
}

const tierColors = {
  bronze: 'bg-amber-100 text-amber-800 border-amber-200',
  silver: 'bg-gray-100 text-gray-800 border-gray-200',
  gold: 'bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 border-yellow-300 shadow-sm',
  platinum: 'bg-gradient-to-r from-slate-100 to-slate-200 text-slate-800 border-slate-300 shadow-md',
  diamond: 'bg-gradient-to-r from-blue-100 via-cyan-100 to-blue-100 text-blue-900 border-blue-300 shadow-lg ring-2 ring-blue-200 ring-opacity-50'
}

const tierNames = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  diamond: 'Diamond'
}

export default function TierManagementPage() {
  const [users, setUsers] = useState<TierUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [tierFilter, setTierFilter] = useState('all')
  const [sortBy, setSortBy] = useState('points_desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalUsers, setTotalUsers] = useState(0)
  const [tierDistribution, setTierDistribution] = useState<Record<string, number>>({})
  
  // User details dialog state
  const [selectedUser, setSelectedUser] = useState<TierUser | null>(null)
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [currentPage, searchTerm, tierFilter, sortBy])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        search: searchTerm,
        tier: tierFilter,
        sort: sortBy
      })

      const response = await fetch(`/api/admin/tiers/users?${params}`)
      const result = await response.json()

      if (result.success) {
        setUsers(result.data.users)
        setTotalPages(result.data.pagination.totalPages)
        setTotalUsers(result.data.summary.totalUsers)
        setTierDistribution(result.data.summary.tierDistribution)
      } else {
        toast.error('Failed to fetch users: ' + result.error)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1)
  }

  const handleTierFilter = (value: string) => {
    setTierFilter(value)
    setCurrentPage(1)
  }

  const handleSort = (value: string) => {
    setSortBy(value)
    setCurrentPage(1)
  }

  const openDetailsDialog = (user: TierUser) => {
    setSelectedUser(user)
    setDetailsDialogOpen(true)
  }

  const getInitials = (user: TierUser) => {
    return [user.firstName, user.lastName]
      .filter(Boolean)
      .map(name => name.charAt(0).toUpperCase())
      .join('')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatPoints = (points: number) => {
    return points.toLocaleString()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tier Management</h1>
          <p className="text-gray-600">Manage user loyalty tiers and track tier progression</p>
        </div>
        <Button onClick={fetchUsers} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold">{totalUsers.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {Object.entries(tierDistribution).map(([tier, count]) => (
          <Card key={tier}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <span className="text-lg">{tierIcons[tier as keyof typeof tierIcons]}</span>
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {tierNames[tier as keyof typeof tierNames]}
                  </p>
                  <p className="text-2xl font-bold">{count.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, email..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={tierFilter} onValueChange={handleTierFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="bronze">🥉 Bronze</SelectItem>
                <SelectItem value="silver">🥈 Silver</SelectItem>
                <SelectItem value="gold">🥇 Gold</SelectItem>
                <SelectItem value="platinum">💎 Platinum</SelectItem>
                <SelectItem value="diamond">💠 Diamond</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={handleSort}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="points_desc">Points (High to Low)</SelectItem>
                <SelectItem value="points_asc">Points (Low to High)</SelectItem>
                <SelectItem value="tier_desc">Tier (High to Low)</SelectItem>
                <SelectItem value="tier_asc">Tier (Low to High)</SelectItem>
                <SelectItem value="name_asc">Name (A-Z)</SelectItem>
                <SelectItem value="created_desc">Newest First</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>User Tier Tracking</CardTitle>
          <CardDescription>
            Comprehensive view of all users with their tier status, points balance, and progression
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading users...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No users found matching your criteria</p>
            </div>
          ) : (
            <div className="space-y-4">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={user.avatarUrl} />
                        <AvatarFallback>{getInitials(user)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {user.fullName}
                          </h3>
                          <Badge className={tierColors[user.calculatedTier as keyof typeof tierColors]}>
                            {tierIcons[user.calculatedTier as keyof typeof tierIcons]} {tierNames[user.calculatedTier as keyof typeof tierNames]}
                          </Badge>
                          {user.tierMismatch && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Mismatch
                            </Badge>
                          )}
                          {user.permanentFreeShipping && (
                            <Badge variant="secondary" className="text-xs">
                              Free Shipping
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{user.email}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <span>Points: {formatPoints(user.pointsBalance)}</span>
                          <span>Total Earned: {formatPoints(user.totalPointsEarned)}</span>
                          <span>Spent: {formatCurrency(user.totalSpent)}</span>
                          <span>Orders: {user.totalOrders}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDetailsDialog(user)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                    </div>
                  </div>

                  {/* Tier Progress */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-600">
                        Progress to {user.currentTierInfo.nextTier ? tierNames[user.currentTierInfo.nextTier as keyof typeof tierNames] : 'Max Tier'}
                      </span>
                      <span className="text-gray-600">
                        {user.currentTierInfo.nextTier
                          ? `${formatPoints(user.currentTierInfo.pointsToNext)} points to go`
                          : 'Max tier achieved'
                        }
                      </span>
                    </div>
                    <Progress
                      value={user.currentTierInfo.progressPercentage}
                      className="h-2"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{formatPoints(user.currentTierInfo.minPoints)}</span>
                      {user.currentTierInfo.maxPoints && (
                        <span>{formatPoints(user.currentTierInfo.maxPoints)}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-600">
                Showing {((currentPage - 1) * 20) + 1} to {Math.min(currentPage * 20, totalUsers)} of {totalUsers} users
              </p>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>User Tier Details</DialogTitle>
            <DialogDescription>
              View tier information for {selectedUser?.fullName}
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center space-x-3 mb-2">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedUser.avatarUrl} />
                    <AvatarFallback>{getInitials(selectedUser)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{selectedUser.fullName}</p>
                    <p className="text-sm text-gray-600">{selectedUser.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Current Tier</p>
                    <Badge className={tierColors[selectedUser.calculatedTier as keyof typeof tierColors]}>
                      {tierIcons[selectedUser.calculatedTier as keyof typeof tierIcons]} {tierNames[selectedUser.calculatedTier as keyof typeof tierNames]}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-gray-600">Points Balance</p>
                    <p className="font-medium">{formatPoints(selectedUser.pointsBalance)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Total Points Earned</p>
                    <p className="font-medium">{formatPoints(selectedUser.totalPointsEarned)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Total Spent</p>
                    <p className="font-medium">${selectedUser.totalSpent.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Tier Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Tier Progress</span>
                  <span className="font-medium">{selectedUser.tierProgress}</span>
                </div>
                <Progress value={selectedUser.progressPercentage} className="h-2" />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDetailsDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
