'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Pagination } from '@/components/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Search,
  Plus,
  Minus,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  TrendingUp,
  TrendingDown,
  History,
  Crown,
  Star,
  Award,
  Gem,
  X,
  Loader2,
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'
import { getCorrectUserTier } from '@/lib/utils'

interface User {
  id: string
  first_name?: string
  last_name?: string
  email: string
  points_balance: number
  tier_level: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
  avatar_url?: string
}

interface PointsAdjustment {
  id: string
  user_id: string
  admin_user_id: string
  points_before: number
  points_after: number
  points_changed: number
  reason: string
  created_at: string
  user: User
  admin: User
  dollarValueBefore: string
  dollarValueAfter: string
  dollarValueChanged: string
}

const tierIcons = {
  bronze: '🥉',
  silver: '🥈', 
  gold: '🥇',
  platinum: '💎',
  diamond: '💠'
}

const tierColors = {
  bronze: 'bg-amber-100 text-amber-800',
  silver: 'bg-gray-100 text-gray-800',
  gold: 'bg-yellow-100 text-yellow-800',
  platinum: 'bg-purple-100 text-purple-800',
  diamond: 'bg-blue-100 text-blue-800'
}

export default function PointsManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [pointsAdjustment, setPointsAdjustment] = useState<number>(0)
  const [reason, setReason] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [adjustmentHistory, setAdjustmentHistory] = useState<PointsAdjustment[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalUsers, setTotalUsers] = useState(0)
  const [usersPerPage, setUsersPerPage] = useState(20)
  const [usersLoading, setUsersLoading] = useState(false)

  // Load users with pagination and search
  const loadUsers = async (page: number = 1, search: string = '', limit: number = usersPerPage) => {
    try {
      setUsersLoading(true)

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      })

      if (search.trim()) {
        params.append('search', search.trim())
      }

      const response = await fetch(`/api/admin/users/list?${params}`)
      const data = await response.json()

      if (data.success) {
        setUsers(data.users)
        setCurrentPage(data.pagination.currentPage)
        setTotalPages(data.pagination.totalPages)
        setTotalUsers(data.pagination.totalUsers)
        setUsersPerPage(data.pagination.usersPerPage)
      } else {
        toast.error('Failed to load users')
        setUsers([])
      }
    } catch (error) {
      console.error('Load users error:', error)
      toast.error('Failed to load users')
      setUsers([])
    } finally {
      setUsersLoading(false)
    }
  }

  // Load adjustment history
  const loadAdjustmentHistory = async (userId?: string) => {
    setIsLoadingHistory(true)
    try {
      const url = userId 
        ? `/api/admin/points/adjust?userId=${userId}&limit=50`
        : '/api/admin/points/adjust?limit=50'
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.success) {
        setAdjustmentHistory(data.data.adjustments)
      } else {
        toast.error('Failed to load adjustment history')
      }
    } catch (error) {
      console.error('History load error:', error)
      toast.error('Failed to load history')
    } finally {
      setIsLoadingHistory(false)
    }
  }

  // Adjust user points
  const adjustUserPoints = async () => {
    if (!selectedUser || pointsAdjustment === 0 || !reason.trim()) {
      toast.error('Please fill in all required fields')
      return
    }

    if (Math.abs(pointsAdjustment) > 100000) {
      toast.error('Points adjustment cannot exceed ±100,000 points')
      return
    }

    if (reason.trim().length < 5) {
      toast.error('Reason must be at least 5 characters long')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/points/adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          pointsAdjustment,
          reason: reason.trim()
        })
      })

      const data = await response.json()
      
      if (data.success) {
        toast.success(
          `Successfully ${pointsAdjustment > 0 ? 'added' : 'deducted'} ${Math.abs(pointsAdjustment)} points`
        )
        
        // Update selected user with new data
        setSelectedUser(data.data.user)
        
        // Reset form
        setPointsAdjustment(0)
        setReason('')
        setIsDialogOpen(false)
        
        // Reload history
        loadAdjustmentHistory()
      } else {
        toast.error(data.error || 'Failed to adjust points')
      }
    } catch (error) {
      console.error('Adjustment error:', error)
      toast.error('Failed to adjust points')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle search input change with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadUsers(1, searchTerm, usersPerPage)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchTerm, usersPerPage])

  // Load initial data
  useEffect(() => {
    loadUsers(1, '', usersPerPage)
    loadAdjustmentHistory()
  }, [])

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    loadUsers(page, searchTerm, usersPerPage)
  }

  const handleUsersPerPageChange = (newUsersPerPage: number) => {
    setUsersPerPage(newUsersPerPage)
    setCurrentPage(1)
    loadUsers(1, searchTerm, newUsersPerPage)
  }

  const handleClearSearch = () => {
    setSearchTerm('')
    setCurrentPage(1)
    loadUsers(1, '', usersPerPage)
  }

  const getFullName = (user: User) => {
    if (user.first_name || user.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim()
    }
    return user.email.split('@')[0]
  }

  const getInitials = (user: User) => {
    const name = getFullName(user)
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Points Management</h2>
          <p className="text-gray-600">Manage user loyalty points and view transaction history</p>
        </div>
      </div>

      <Tabs defaultValue="adjust" className="space-y-6">
        <TabsList>
          <TabsTrigger value="adjust">Adjust Points</TabsTrigger>
          <TabsTrigger value="history">Transaction History</TabsTrigger>
        </TabsList>

        <TabsContent value="adjust" className="space-y-6">
          {/* User Search and List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                User Management
              </CardTitle>
              <CardDescription>
                Browse all users or search to find specific users for points adjustment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search and Controls */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-10"
                  />
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 h-8 w-8 p-0"
                      onClick={handleClearSearch}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Show</span>
                  <Select
                    value={usersPerPage.toString()}
                    onValueChange={(value) => handleUsersPerPageChange(parseInt(value))}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-gray-600">per page</span>
                </div>
              </div>

              {/* User Count Info */}
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>
                  {searchTerm ? `Search results: ${users.length} users` : `Total users: ${totalUsers}`}
                </span>
                {usersLoading && (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading...</span>
                  </div>
                )}
              </div>

              {/* User List */}
              {users.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedUser?.id === user.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedUser(user)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={user.avatar_url} />
                            <AvatarFallback>{getInitials(user)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{getFullName(user)}</span>
                              <Badge className={tierColors[getCorrectUserTier(user)]}>
                                {tierIcons[getCorrectUserTier(user)]} {getCorrectUserTier(user)}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600">{user.email}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{user.points_balance.toLocaleString()} pts</p>
                          <p className="text-sm text-gray-600">
                            ${(user.points_balance / 1000).toFixed(2)} value
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {searchTerm ? 'No users found' : 'No users available'}
                  </h3>
                  <p className="text-gray-600">
                    {searchTerm
                      ? 'Try adjusting your search terms'
                      : 'Users will appear here when they register'
                    }
                  </p>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalUsers}
                  itemsPerPage={usersPerPage}
                  onPageChange={handlePageChange}
                  showInfo={false}
                  className="mt-4"
                />
              )}
            </CardContent>
          </Card>

          {/* Points Adjustment */}
          {selectedUser && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Adjust Points for {getFullName(selectedUser)}
                </CardTitle>
                <CardDescription>
                  Current balance: {selectedUser.points_balance.toLocaleString()} points 
                  (${(selectedUser.points_balance / 1000).toFixed(2)} value)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="points">Points Adjustment</Label>
                    <Input
                      id="points"
                      type="number"
                      placeholder="Enter points (positive to add, negative to subtract)"
                      value={pointsAdjustment || ''}
                      onChange={(e) => setPointsAdjustment(parseInt(e.target.value) || 0)}
                      min="-100000"
                      max="100000"
                    />
                    <p className="text-sm text-gray-600">
                      Dollar value: ${(Math.abs(pointsAdjustment) / 1000).toFixed(2)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>New Balance Preview</Label>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="font-semibold">
                        {Math.max(0, selectedUser.points_balance + pointsAdjustment).toLocaleString()} points
                      </p>
                      <p className="text-sm text-gray-600">
                        ${(Math.max(0, selectedUser.points_balance + pointsAdjustment) / 1000).toFixed(2)} value
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">Reason for Adjustment</Label>
                  <Textarea
                    id="reason"
                    placeholder="Enter the reason for this points adjustment..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                  />
                  <p className="text-sm text-gray-600">
                    {reason.length}/500 characters (minimum 5 required)
                  </p>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      className="w-full"
                      disabled={pointsAdjustment === 0 || !reason.trim() || reason.trim().length < 5}
                    >
                      {pointsAdjustment > 0 ? (
                        <Plus className="h-4 w-4 mr-2" />
                      ) : (
                        <Minus className="h-4 w-4 mr-2" />
                      )}
                      {pointsAdjustment > 0 ? 'Add' : 'Subtract'} {Math.abs(pointsAdjustment)} Points
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        Confirm Points Adjustment
                      </DialogTitle>
                      <DialogDescription>
                        Please review the details before confirming this points adjustment.
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          This action cannot be undone. The adjustment will be logged for audit purposes.
                        </AlertDescription>
                      </Alert>

                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="font-medium">User:</span>
                          <span>{getFullName(selectedUser)} ({selectedUser.email})</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium">Current Points:</span>
                          <span>{selectedUser.points_balance.toLocaleString()} pts</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium">Adjustment:</span>
                          <span className={pointsAdjustment > 0 ? 'text-green-600' : 'text-red-600'}>
                            {pointsAdjustment > 0 ? '+' : ''}{pointsAdjustment.toLocaleString()} pts
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium">New Balance:</span>
                          <span className="font-semibold">
                            {Math.max(0, selectedUser.points_balance + pointsAdjustment).toLocaleString()} pts
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium">Reason:</span>
                          <span className="text-right max-w-xs">{reason}</span>
                        </div>
                      </div>
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={adjustUserPoints} disabled={isLoading}>
                        {isLoading ? (
                          <>
                            <Clock className="h-4 w-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Confirm Adjustment
                          </>
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Points Adjustment History
              </CardTitle>
              <CardDescription>
                Recent manual points adjustments made by administrators
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Clock className="h-6 w-6 animate-spin mr-2" />
                  Loading history...
                </div>
              ) : adjustmentHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No adjustment history found
                </div>
              ) : (
                <div className="space-y-4">
                  {adjustmentHistory.map((adjustment) => (
                    <div key={adjustment.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={adjustment.user.avatar_url} />
                            <AvatarFallback>{getInitials(adjustment.user)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{getFullName(adjustment.user)}</span>
                              <Badge className={tierColors[adjustment.user.tier_level]}>
                                {tierIcons[adjustment.user.tier_level]} {adjustment.user.tier_level}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{adjustment.user.email}</p>
                            <p className="text-sm">{adjustment.reason}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`flex items-center gap-1 ${
                            adjustment.points_changed > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {adjustment.points_changed > 0 ? (
                              <TrendingUp className="h-4 w-4" />
                            ) : (
                              <TrendingDown className="h-4 w-4" />
                            )}
                            <span className="font-semibold">
                              {adjustment.points_changed > 0 ? '+' : ''}{adjustment.points_changed.toLocaleString()} pts
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">
                            ${adjustment.dollarValueChanged} value
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDate(adjustment.created_at)}
                          </p>
                          <p className="text-xs text-gray-500">
                            by {getFullName(adjustment.admin)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex justify-between text-sm">
                          <span>Before: {adjustment.points_before.toLocaleString()} pts</span>
                          <span>After: {adjustment.points_after.toLocaleString()} pts</span>
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
    </div>
  )
}
