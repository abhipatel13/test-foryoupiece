'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Search,
  Filter,
  RefreshCw,
  Gift,
  Bell,
  Users,
  TrendingUp,
  Eye,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Award,
  Package,
  Truck,
  Star
} from 'lucide-react'
import { toast } from 'sonner'

interface TierRewardHistory {
  id: string
  user_id: string
  tier_level: string
  reward_type: string
  reward_value: number
  reward_description: string
  status: string
  coupon_id?: string
  coupon_code?: string
  point_transaction_id?: string
  awarded_at: string
  expires_at?: string
  user?: {
    first_name: string
    last_name: string
    email: string
    avatar_url?: string
  }
}

interface UserNotification {
  id: string
  user_id: string
  title: string
  message: string
  type: string
  read: boolean
  created_at: string
  metadata?: any
  user?: {
    first_name: string
    last_name: string
    email: string
    avatar_url?: string
  }
}

interface TierRewardStats {
  totalRewardsAwarded: number
  totalPointsAwarded: number
  totalCouponsGenerated: number
  totalNotificationsSent: number
  rewardsByTier: Record<string, number>
  rewardsByType: Record<string, number>
}

export default function TierRewardsPage() {
  const [loading, setLoading] = useState(true)
  const [rewardHistory, setRewardHistory] = useState<TierRewardHistory[]>([])
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [stats, setStats] = useState<TierRewardStats | null>(null)
  
  // Filters and pagination
  const [searchTerm, setSearchTerm] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [rewardTypeFilter, setRewardTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  
  // Dialog states
  const [selectedReward, setSelectedReward] = useState<TierRewardHistory | null>(null)
  const [rewardDetailsOpen, setRewardDetailsOpen] = useState(false)
  const [selectedNotification, setSelectedNotification] = useState<UserNotification | null>(null)
  const [notificationDetailsOpen, setNotificationDetailsOpen] = useState(false)

  const itemsPerPage = 20

  useEffect(() => {
    fetchData()
  }, [currentPage, searchTerm, tierFilter, rewardTypeFilter, statusFilter])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch reward history, notifications, and stats in parallel
      const [rewardsResponse, notificationsResponse, statsResponse] = await Promise.all([
        fetch(`/api/admin/tier-rewards/history?page=${currentPage}&limit=${itemsPerPage}&search=${encodeURIComponent(searchTerm)}&tier=${tierFilter}&type=${rewardTypeFilter}&status=${statusFilter}`),
        fetch(`/api/admin/tier-rewards/notifications?page=${currentPage}&limit=${itemsPerPage}&search=${encodeURIComponent(searchTerm)}`),
        fetch('/api/admin/tier-rewards/stats')
      ])

      if (rewardsResponse.ok) {
        const rewardsData = await rewardsResponse.json()
        if (rewardsData.success) {
          setRewardHistory(rewardsData.data.rewards)
          setTotalPages(rewardsData.data.totalPages)
          setTotalRecords(rewardsData.data.totalRecords)
        }
      }

      if (notificationsResponse.ok) {
        const notificationsData = await notificationsResponse.json()
        if (notificationsData.success) {
          setNotifications(notificationsData.data.notifications)
        }
      }

      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        if (statsData.success) {
          setStats(statsData.data)
        }
      }

    } catch (error) {
      console.error('Error fetching tier rewards data:', error)
      toast.error('Failed to load tier rewards data')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1)
  }

  const handleFilterChange = (filterType: string, value: string) => {
    // Convert "all" to empty string for API filtering
    const filterValue = value === 'all' ? '' : value

    switch (filterType) {
      case 'tier':
        setTierFilter(filterValue)
        break
      case 'type':
        setRewardTypeFilter(filterValue)
        break
      case 'status':
        setStatusFilter(filterValue)
        break
    }
    setCurrentPage(1)
  }

  const openRewardDetails = (reward: TierRewardHistory) => {
    setSelectedReward(reward)
    setRewardDetailsOpen(true)
  }

  const openNotificationDetails = (notification: UserNotification) => {
    setSelectedNotification(notification)
    setNotificationDetailsOpen(true)
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

  const getInitials = (user: any) => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    }
    return user?.email?.[0]?.toUpperCase() || '?'
  }

  const tierColors = {
    bronze: 'bg-amber-100 text-amber-800 border-amber-200',
    silver: 'bg-gray-100 text-gray-800 border-gray-200',
    gold: 'bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 border-yellow-300 shadow-sm',
    platinum: 'bg-gradient-to-r from-slate-100 to-slate-200 text-slate-800 border-slate-300 shadow-md',
    diamond: 'bg-gradient-to-r from-blue-100 via-cyan-100 to-blue-100 text-blue-900 border-blue-300 shadow-lg ring-2 ring-blue-200 ring-opacity-50'
  }

  const tierIcons = {
    bronze: '🥉',
    silver: '🥈',
    gold: '🥇',
    platinum: '🏆',
    diamond: '💎'
  }

  const rewardTypeIcons = {
    points_bonus: '💰',
    free_shipping_coupon: '🚚',
    gift_notification: '🎁',
    permanent_free_shipping: '🚛',
    exclusive_access: '⭐'
  }

  const rewardTypeNames = {
    points_bonus: 'Points Bonus',
    free_shipping_coupon: 'Free Shipping Coupon',
    gift_notification: 'Gift Notification',
    permanent_free_shipping: 'Permanent Free Shipping',
    exclusive_access: 'Exclusive Access'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading tier rewards data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tier Rewards Management</h1>
          <p className="text-gray-600 mt-1">Monitor and manage tier-based rewards and notifications</p>
        </div>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Gift className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Rewards</p>
                  <p className="text-2xl font-bold">{stats.totalRewardsAwarded.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Award className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Points Awarded</p>
                  <p className="text-2xl font-bold">{stats.totalPointsAwarded.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Truck className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Coupons Generated</p>
                  <p className="text-2xl font-bold">{stats.totalCouponsGenerated.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Bell className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Notifications Sent</p>
                  <p className="text-2xl font-bold">{stats.totalNotificationsSent.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="rewards" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rewards">Reward History</TabsTrigger>
          <TabsTrigger value="notifications">Tier Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="rewards" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-64">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by user email or reward description..."
                      value={searchTerm}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <Select value={tierFilter || 'all'} onValueChange={(value) => handleFilterChange('tier', value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Tiers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tiers</SelectItem>
                    <SelectItem value="silver">🥈 Silver</SelectItem>
                    <SelectItem value="gold">🥇 Gold</SelectItem>
                    <SelectItem value="platinum">💎 Platinum</SelectItem>
                    <SelectItem value="diamond">💠 Diamond</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={rewardTypeFilter || 'all'} onValueChange={(value) => handleFilterChange('type', value)}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Reward Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Reward Types</SelectItem>
                    <SelectItem value="points_bonus">💰 Points Bonus</SelectItem>
                    <SelectItem value="free_shipping_coupon">🚚 Free Shipping</SelectItem>
                    <SelectItem value="gift_notification">🎁 Gift Notification</SelectItem>
                    <SelectItem value="permanent_free_shipping">🚛 Permanent Shipping</SelectItem>
                    <SelectItem value="exclusive_access">⭐ Exclusive Access</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={statusFilter || 'all'} onValueChange={(value) => handleFilterChange('status', value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="awarded">Awarded</SelectItem>
                    <SelectItem value="claimed">Claimed</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Reward History List */}
          <Card>
            <CardHeader>
              <CardTitle>Reward History</CardTitle>
              <CardDescription>
                {totalRecords} total rewards • Page {currentPage} of {totalPages}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rewardHistory.length === 0 ? (
                <div className="text-center py-8">
                  <Gift className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No tier rewards found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {rewardHistory.map((reward) => (
                    <div key={reward.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={reward.user?.avatar_url} />
                            <AvatarFallback>{getInitials(reward.user)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {reward.user?.first_name} {reward.user?.last_name}
                            </p>
                            <p className="text-sm text-gray-600">{reward.user?.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Badge className={tierColors[reward.tier_level as keyof typeof tierColors]}>
                            {tierIcons[reward.tier_level as keyof typeof tierIcons]} {reward.tier_level}
                          </Badge>
                          <Badge variant="outline">
                            {rewardTypeIcons[reward.reward_type as keyof typeof rewardTypeIcons]} {rewardTypeNames[reward.reward_type as keyof typeof rewardTypeNames]}
                          </Badge>
                          <Badge variant={reward.status === 'awarded' ? 'default' : 'secondary'}>
                            {reward.status}
                          </Badge>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-700">{reward.reward_description}</p>
                          {reward.reward_value > 0 && (
                            <p className="text-sm font-medium text-green-600">
                              Value: {reward.reward_type === 'points_bonus' ? formatPoints(reward.reward_value) + ' points' : '$' + reward.reward_value}
                            </p>
                          )}
                          {reward.coupon_code && (
                            <p className="text-sm font-mono text-blue-600">Coupon: {reward.coupon_code}</p>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">{formatDate(reward.awarded_at)}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openRewardDetails(reward)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Details
                          </Button>
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
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalRecords)} of {totalRecords} rewards
                  </p>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
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
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
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
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          {/* Notifications List */}
          <Card>
            <CardHeader>
              <CardTitle>Tier Promotion Notifications</CardTitle>
              <CardDescription>
                Recent notifications sent to users about tier promotions and rewards
              </CardDescription>
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <div className="text-center py-8">
                  <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No tier notifications found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {notifications.map((notification) => (
                    <div key={notification.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={notification.user?.avatar_url} />
                            <AvatarFallback>{getInitials(notification.user)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {notification.user?.first_name} {notification.user?.last_name}
                            </p>
                            <p className="text-sm text-gray-600">{notification.user?.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Badge variant={notification.read ? 'secondary' : 'default'}>
                            {notification.read ? 'Read' : 'Unread'}
                          </Badge>
                          <Badge variant="outline" className={
                            notification.type === 'success' ? 'text-green-600 border-green-200' :
                            notification.type === 'info' ? 'text-blue-600 border-blue-200' :
                            'text-gray-600 border-gray-200'
                          }>
                            {notification.type}
                          </Badge>
                        </div>
                      </div>

                      <div className="mt-3">
                        <p className="font-medium text-gray-900">{notification.title}</p>
                        <p className="text-sm text-gray-700 mt-1 line-clamp-2">{notification.message}</p>

                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>{formatDate(notification.created_at)}</span>
                            {notification.metadata?.tier_promotion && (
                              <span className="flex items-center">
                                <TrendingUp className="h-3 w-3 mr-1" />
                                Tier Promotion: {notification.metadata.old_tier} → {notification.metadata.new_tier}
                              </span>
                            )}
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openNotificationDetails(notification)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reward Details Dialog */}
      <Dialog open={rewardDetailsOpen} onOpenChange={setRewardDetailsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reward Details</DialogTitle>
            <DialogDescription>
              Detailed information about this tier reward
            </DialogDescription>
          </DialogHeader>

          {selectedReward && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center space-x-3 mb-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={selectedReward.user?.avatar_url} />
                    <AvatarFallback>{getInitials(selectedReward.user)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {selectedReward.user?.first_name} {selectedReward.user?.last_name}
                    </p>
                    <p className="text-sm text-gray-600">{selectedReward.user?.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Tier Level</p>
                    <Badge className={tierColors[selectedReward.tier_level as keyof typeof tierColors]}>
                      {tierIcons[selectedReward.tier_level as keyof typeof tierIcons]} {selectedReward.tier_level}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-gray-600">Reward Type</p>
                    <Badge variant="outline">
                      {rewardTypeIcons[selectedReward.reward_type as keyof typeof rewardTypeIcons]} {rewardTypeNames[selectedReward.reward_type as keyof typeof rewardTypeNames]}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-gray-600">Status</p>
                    <Badge variant={selectedReward.status === 'awarded' ? 'default' : 'secondary'}>
                      {selectedReward.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-gray-600">Awarded At</p>
                    <p className="font-medium">{formatDate(selectedReward.awarded_at)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-600">Description</p>
                  <p className="text-sm">{selectedReward.reward_description}</p>
                </div>

                {selectedReward.reward_value > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-600">Value</p>
                    <p className="text-sm font-medium text-green-600">
                      {selectedReward.reward_type === 'points_bonus'
                        ? formatPoints(selectedReward.reward_value) + ' points'
                        : '$' + selectedReward.reward_value
                      }
                    </p>
                  </div>
                )}

                {selectedReward.coupon_code && (
                  <div>
                    <p className="text-sm font-medium text-gray-600">Coupon Code</p>
                    <p className="text-sm font-mono text-blue-600">{selectedReward.coupon_code}</p>
                  </div>
                )}

                {selectedReward.expires_at && (
                  <div>
                    <p className="text-sm font-medium text-gray-600">Expires At</p>
                    <p className="text-sm">{formatDate(selectedReward.expires_at)}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Notification Details Dialog */}
      <Dialog open={notificationDetailsOpen} onOpenChange={setNotificationDetailsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Notification Details</DialogTitle>
            <DialogDescription>
              Full notification content and metadata
            </DialogDescription>
          </DialogHeader>

          {selectedNotification && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center space-x-3 mb-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={selectedNotification.user?.avatar_url} />
                    <AvatarFallback>{getInitials(selectedNotification.user)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {selectedNotification.user?.first_name} {selectedNotification.user?.last_name}
                    </p>
                    <p className="text-sm text-gray-600">{selectedNotification.user?.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Type</p>
                    <Badge variant="outline" className={
                      selectedNotification.type === 'success' ? 'text-green-600 border-green-200' :
                      selectedNotification.type === 'info' ? 'text-blue-600 border-blue-200' :
                      'text-gray-600 border-gray-200'
                    }>
                      {selectedNotification.type}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-gray-600">Status</p>
                    <Badge variant={selectedNotification.read ? 'secondary' : 'default'}>
                      {selectedNotification.read ? 'Read' : 'Unread'}
                    </Badge>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-600">Sent At</p>
                    <p className="font-medium">{formatDate(selectedNotification.created_at)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-600">Title</p>
                  <p className="font-medium">{selectedNotification.title}</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-600">Message</p>
                  <div className="bg-white border rounded p-3 text-sm whitespace-pre-wrap">
                    {selectedNotification.message}
                  </div>
                </div>

                {selectedNotification.metadata && (
                  <div>
                    <p className="text-sm font-medium text-gray-600">Metadata</p>
                    <div className="bg-gray-100 rounded p-3 text-xs font-mono">
                      <pre>{JSON.stringify(selectedNotification.metadata, null, 2)}</pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
