'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Filter, Mail, MessageCircle, User, Calendar, DollarSign, ShoppingBag, Star, Phone, Globe, Shield, Eye, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Pagination } from '@/components/ui/pagination'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { getCorrectUserTier } from '@/lib/utils'

interface User {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  telegram_id: number | null
  telegram_username: string | null
  avatar_url: string | null
  points_balance: number
  tier_level: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
  total_spent: number
  total_orders: number
  preferred_language: string
  marketing_consent: boolean
  metadata: any
  created_at: string
  updated_at: string
  is_active?: boolean
}

interface UserOrder {
  id: string
  order_number: string
  total_amount: number
  payment_status: string
  fulfillment_status: string
  created_at: string
}

const tierColors = {
  bronze: 'bg-amber-100 text-amber-800 border-amber-200',
  silver: 'bg-gray-100 text-gray-800 border-gray-200',
  gold: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  platinum: 'bg-purple-100 text-purple-800 border-purple-200',
  diamond: 'bg-blue-100 text-blue-800 border-blue-200'
}

const tierIcons = {
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇',
  platinum: '💎',
  diamond: '💠'
}

export default function UsersPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const locale = params.locale as string || 'en'

  // User data state
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  // Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [filterTier, setFilterTier] = useState<string>('all')
  const [filterLanguage, setFilterLanguage] = useState<string>('all')
  const [filterRecent, setFilterRecent] = useState<string>('all') // '7' | '30' | '90' | 'all'
  const [filterStatus, setFilterStatus] = useState<string>('all') // 'active' | 'inactive' | 'all'
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [totalUsers, setTotalUsers] = useState(0)
  const [itemsPerPage] = useState(40) // Fixed at 40 users per page

  // Dialog state
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userOrders, setUserOrders] = useState<UserOrder[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [messageDialogOpen, setMessageDialogOpen] = useState(false)
  const [messageSubject, setMessageSubject] = useState('')
  const [messageContent, setMessageContent] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)

  const supabase = createClient()

  // Handle URL parameters on component mount
  useEffect(() => {
    const pageParam = searchParams.get('page')
    const searchParam = searchParams.get('search')
    const tierParam = searchParams.get('tier')
    const languageParam = searchParams.get('language')
    const recentParam = searchParams.get('recent')
    const statusParam = searchParams.get('status')
    const startParam = searchParams.get('start')
    const endParam = searchParams.get('end')

    if (pageParam) {
      setCurrentPage(parseInt(pageParam) || 1)
    }
    if (searchParam) {
      setSearchTerm(searchParam)
    }
    if (tierParam) {
      setFilterTier(tierParam)
    }
    if (languageParam) {
      setFilterLanguage(languageParam)
    }
    if (recentParam) {
      setFilterRecent(recentParam)
    }
    if (statusParam) {
      setFilterStatus(statusParam)
    }
    if (startParam) {
      setStartDate(startParam)
    }
    if (endParam) {
      setEndDate(endParam)
    }
  }, [searchParams])

  // Fetch users when filters or page changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchUsers()
    }, searchTerm ? 300 : 0) // 300ms debounce for search, immediate for other changes

    return () => clearTimeout(timeoutId)
  }, [currentPage, searchTerm, filterTier, filterLanguage, filterRecent, filterStatus, startDate, endDate])

  // Reset to first page when filters change and always reflect filters in URL
  useEffect(() => {
    const nextPage = 1
    if (currentPage !== 1) {
      setCurrentPage(1)
    }
    updateURL(
      nextPage,
      searchTerm,
      filterTier,
      filterLanguage,
      filterRecent,
      filterStatus,
      startDate,
      endDate
    )
  }, [searchTerm, filterTier, filterLanguage, filterRecent, filterStatus, startDate, endDate])

  // Update URL with current filter and pagination state
  const updateURL = (
    page: number,
    search: string,
    tier: string,
    language: string,
    recent: string,
    status: string,
    start: string,
    end: string,
  ) => {
    const params = new URLSearchParams()

    if (page > 1) params.set('page', page.toString())
    if (search.trim()) params.set('search', search.trim())
    if (tier !== 'all') params.set('tier', tier)
    if (language !== 'all') params.set('language', language)
    if (recent && recent !== 'all') params.set('recent', recent)
    if (status && status !== 'all') params.set('status', status)
    if (start) params.set('start', start)
    if (end) params.set('end', end)

    const newURL = params.toString() ? `?${params.toString()}` : ''
    router.replace(newURL, { scroll: false })
  }

  const fetchUsers = async () => {
    try {
      setLoading(true)

      // Build API URL with pagination and filters
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString()
      })

      if (searchTerm.trim()) params.set('search', searchTerm.trim())
      if (filterTier !== 'all') params.set('tier', filterTier)
      if (filterLanguage !== 'all') params.set('language', filterLanguage)
      if (filterRecent !== 'all') params.set('recent', filterRecent)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (startDate) params.set('start', startDate)
      if (endDate) params.set('end', endDate)

      const response = await fetch(`/api/admin/users/list?${params.toString()}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch users')
      }

      if (data.success) {
        setUsers(data.users || [])
        setTotalPages(data.pagination.totalPages)
        setTotalUsers(data.pagination.totalUsers)
      } else {
        throw new Error(data.error || 'Failed to fetch users')
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('Failed to load users')
      setUsers([])
      setTotalPages(0)
      setTotalUsers(0)
    } finally {
      setLoading(false)
    }
  }

  const fetchUserOrders = async (userId: string) => {
    try {
      setLoadingOrders(true)
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, total_amount, payment_status, fulfillment_status, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      setUserOrders(data || [])
    } catch (error) {
      console.error('Error fetching user orders:', error)
      toast.error('Failed to load user orders')
    } finally {
      setLoadingOrders(false)
    }
  }

  const handleUserClick = async (user: User) => {
    setSelectedUser(user)
    await fetchUserOrders(user.id)
  }

  const sendMessage = async () => {
    if (!selectedUser || !messageSubject.trim() || !messageContent.trim()) {
      toast.error('Please fill in all message fields')
      return
    }

    try {
      setSendingMessage(true)

      // Here you would implement the actual messaging logic
      // For now, we'll just simulate sending a message
      await new Promise(resolve => setTimeout(resolve, 1000))

      toast.success(`Message sent to ${selectedUser.first_name || selectedUser.email}`)
      setMessageDialogOpen(false)
      setMessageSubject('')
      setMessageContent('')
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
    } finally {
      setSendingMessage(false)
    }
  }

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    updateURL(page, searchTerm, filterTier, filterLanguage, filterRecent, filterStatus, startDate, endDate)
    // Scroll to top when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Filter handlers that update URL
  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    // URL will be updated by useEffect when searchTerm changes
  }

  const handleTierFilterChange = (value: string) => {
    setFilterTier(value)
    // URL will be updated by useEffect when filterTier changes
  }

  const handleLanguageFilterChange = (value: string) => {
    setFilterLanguage(value)
    // URL will be updated by useEffect when filterLanguage changes
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getFullName = (user: User) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`
    }
    if (user.first_name) return user.first_name
    if (user.last_name) return user.last_name
    return user.email || 'Unknown User'
  }

  const getInitials = (user: User) => {
    const name = getFullName(user)
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-600">Manage and view user accounts and their information</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">
            {totalUsers} total users
          </Badge>
          {totalPages > 1 && (
            <Badge variant="outline" className="text-sm">
              Page {currentPage} of {totalPages}
            </Badge>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by email, name, or telegram username..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterTier} onValueChange={handleTierFilterChange}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Filter by tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="bronze">Bronze</SelectItem>
                  <SelectItem value="silver">Silver</SelectItem>
                  <SelectItem value="gold">Gold</SelectItem>
                  <SelectItem value="platinum">Platinum</SelectItem>
                  <SelectItem value="diamond">Diamond</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterLanguage} onValueChange={handleLanguageFilterChange}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Filter by language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Languages</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ja">Japanese</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterRecent} onValueChange={setFilterRecent}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Recent sign-ups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="User status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Label className="whitespace-nowrap text-gray-600">Start date</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="whitespace-nowrap text-gray-600">End date</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('')
                    setFilterTier('all')
                    setFilterLanguage('all')
                    setFilterRecent('all')
                    setFilterStatus('all')
                    setStartDate('')
                    setEndDate('')
                  }}
                >
                  Reset filters
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <div className="grid gap-4">
        {users.map((user) => (
          <Card key={user.id} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback>{getInitials(user)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {getFullName(user)}
                      </h3>
                      <Badge className={tierColors[getCorrectUserTier(user)]}>
                        {tierIcons[getCorrectUserTier(user)]} {getCorrectUserTier(user)}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                      {user.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{user.email}</span>
                        </div>
                      )}
                      {user.telegram_username && (
                        <div className="flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          <span>@{user.telegram_username}</span>
                        </div>
                      )}
                      {user.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          <span>{user.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-center">
                    <div className="font-semibold text-gray-900">{user.total_orders}</div>
                    <div className="text-gray-600">Orders</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-gray-900">{formatCurrency(user.total_spent)}</div>
                    <div className="text-gray-600">Spent</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-gray-900">
                      {user.total_orders > 0 ? formatCurrency(user.total_spent / user.total_orders) : '$0.00'}
                    </div>
                    <div className="text-gray-600">Avg Order</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-gray-900">{user.points_balance}</div>
                    <div className="text-gray-600">Points</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUserClick(user)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && users.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No users found</h3>
            <p className="text-gray-600">
              {searchTerm || filterTier !== 'all' || filterLanguage !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Users will appear here when they register'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalUsers}
          itemsPerPage={itemsPerPage}
          onPageChange={handlePageChange}
          className="mt-6"
        />
      )}

      {/* User Details Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={selectedUser?.avatar_url || undefined} />
                <AvatarFallback>{selectedUser ? getInitials(selectedUser) : 'U'}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  {selectedUser && getFullName(selectedUser)}
                  {selectedUser && (
                    <Badge className={tierColors[getCorrectUserTier(selectedUser)]}>
                      {tierIcons[getCorrectUserTier(selectedUser)]} {getCorrectUserTier(selectedUser)}
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-gray-600 font-normal">
                  User ID: {selectedUser?.id}
                </div>
              </div>
            </DialogTitle>
            <DialogDescription>
              Complete user profile and order history
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="orders">Orders ({userOrders.length})</TabsTrigger>
                <TabsTrigger value="actions">Actions</TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Basic Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Basic Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Email</Label>
                        <div className="text-sm">{selectedUser.email || 'Not provided'}</div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Phone</Label>
                        <div className="text-sm">{selectedUser.phone || 'Not provided'}</div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Preferred Language</Label>
                        <div className="text-sm flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {selectedUser.preferred_language === 'en' ? 'English' : 'Japanese'}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Marketing Consent</Label>
                        <div className="text-sm">
                          {selectedUser.marketing_consent ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              ✓ Consented
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-red-100 text-red-800">
                              ✗ Not consented
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Telegram Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4" />
                        Telegram Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Telegram ID</Label>
                        <div className="text-sm font-mono">
                          {selectedUser.telegram_id || 'Not connected'}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Telegram Username</Label>
                        <div className="text-sm">
                          {selectedUser.telegram_username ? `@${selectedUser.telegram_username}` : 'Not set'}
                        </div>
                      </div>
                      {selectedUser.telegram_id && (
                        <div className="pt-2">
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                            <MessageCircle className="h-3 w-3 mr-1" />
                            Telegram Connected
                          </Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Account Statistics */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Account Statistics
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Total Orders</Label>
                          <div className="text-2xl font-bold text-gray-900">{selectedUser.total_orders}</div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Total Spent</Label>
                          <div className="text-2xl font-bold text-gray-900">
                            {formatCurrency(selectedUser.total_spent)}
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Average Order Value</Label>
                          <div className="text-xl font-bold text-blue-600">
                            {selectedUser.total_orders > 0
                              ? formatCurrency(selectedUser.total_spent / selectedUser.total_orders)
                              : '$0.00'
                            }
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Points Balance</Label>
                          <div className="text-xl font-bold text-yellow-600">{selectedUser.points_balance}</div>
                        </div>
                      </div>

                      <div className="pt-2 border-t">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-medium text-gray-600">Customer Tier</Label>
                            <div className="text-lg font-semibold">
                              {tierIcons[selectedUser.tier_level]} {selectedUser.tier_level}
                            </div>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-gray-600">Customer Since</Label>
                            <div className="text-sm font-medium">
                              {formatDate(selectedUser.created_at)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Customer Lifetime Value Indicator */}
                      <div className="pt-2 border-t">
                        <Label className="text-sm font-medium text-gray-600">Customer Lifetime Value</Label>
                        <div className="mt-1">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span>CLV Score</span>
                            <span className="font-medium">
                              {selectedUser.total_spent > 100 ? 'High' :
                               selectedUser.total_spent > 50 ? 'Medium' : 'Low'}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                selectedUser.total_spent > 100 ? 'bg-green-500' :
                                selectedUser.total_spent > 50 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{
                                width: `${Math.min((selectedUser.total_spent / 200) * 100, 100)}%`
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Account Dates */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Account Dates
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Created</Label>
                        <div className="text-sm">{formatDate(selectedUser.created_at)}</div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Last Updated</Label>
                        <div className="text-sm">{formatDate(selectedUser.updated_at)}</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="orders" className="space-y-4">
                {loadingOrders ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                    <p className="text-gray-600 mt-2">Loading orders...</p>
                  </div>
                ) : userOrders.length > 0 ? (
                  <div className="space-y-4">
                    {/* Order Statistics Summary */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Order History Summary</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                          <div>
                            <div className="text-2xl font-bold text-blue-600">{userOrders.length}</div>
                            <div className="text-sm text-gray-600">Recent Orders</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-green-600">
                              {formatCurrency(userOrders.reduce((sum, order) => sum + order.total_amount, 0))}
                            </div>
                            <div className="text-sm text-gray-600">Recent Total</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-purple-600">
                              {userOrders.length > 0
                                ? formatCurrency(userOrders.reduce((sum, order) => sum + order.total_amount, 0) / userOrders.length)
                                : '$0.00'
                              }
                            </div>
                            <div className="text-sm text-gray-600">Avg Recent Order</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-orange-600">
                              {userOrders.filter(order => order.fulfillment_status === 'delivered').length}
                            </div>
                            <div className="text-sm text-gray-600">Completed</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Recent Orders List */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Recent Orders (Last 10)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {userOrders.map((order) => (
                            <div key={order.id} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold text-gray-900">
                                      Order #{order.order_number}
                                    </span>
                                    <Badge variant="secondary" className="text-xs">
                                      {order.payment_status}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      {order.fulfillment_status}
                                    </Badge>
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    {formatDate(order.created_at)}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-semibold text-gray-900">
                                    {formatCurrency(order.total_amount)}
                                  </div>
                                  <Button asChild variant="ghost" size="sm" className="mt-1">
                                    <Link href={`/en/fyponly-admin/orders/${order.id}`}>
                                      <Eye className="h-3 w-3 mr-1" />
                                      View
                                    </Link>
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <ShoppingBag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No orders yet</h3>
                      <p className="text-gray-600">This user hasn't placed any orders</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="actions" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Send className="h-4 w-4" />
                      Send Message
                    </CardTitle>
                    <CardDescription>
                      Send a notification message to this user
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={() => setMessageDialogOpen(true)}
                      className="w-full"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Compose Message
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Message Dialog */}
      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Message</DialogTitle>
            <DialogDescription>
              Send a notification to {selectedUser && getFullName(selectedUser)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="Message subject"
                value={messageSubject}
                onChange={(e) => setMessageSubject(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Type your message here..."
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setMessageDialogOpen(false)}
                disabled={sendingMessage}
              >
                Cancel
              </Button>
              <Button
                onClick={sendMessage}
                disabled={sendingMessage || !messageSubject.trim() || !messageContent.trim()}
              >
                {sendingMessage ? 'Sending...' : 'Send Message'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
