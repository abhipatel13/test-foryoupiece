'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { useTranslations } from 'next-intl'
import { useSSRSafeAuth } from '@/lib/hooks/use-ssr-safe-auth'
import { createClient } from '@/lib/supabase/client'
import { userQueries, orderQueries } from '@/lib/supabase/queries'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Star, Trophy, Gift, Calendar, Mail, Phone, User, Edit, MapPin, CreditCard, Save, Trash2, Package, Clock, Eye, ShoppingBag, X, Award, Shield, Bell } from 'lucide-react'
import { formatDate, formatPrice, getCorrectUserTier, getTierStyling } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import Link from 'next/link'

import TierRewardsDisplay from '@/components/user/tier-rewards-display'
import { PointsBreakdownComponent } from '@/components/user/points-breakdown'
import { RedesignedPointsWrapper } from '@/components/user/redesigned-points-wrapper'
import { RewardsCouponsSection } from '@/components/user/rewards-coupons-section'
import { ChangePasswordDialog } from '@/components/auth/ChangePasswordDialog'

interface Order {
  id: string
  order_number: string
  total_amount: number
  payment_status: string
  fulfillment_status: string
  created_at: string
  items: Array<{
    id: string
    title: string
    quantity: number
    price: number
    total: number
  }>
}

export default function ProfilePage() {
  const t = useTranslations('profile')
  const { user, profile, isAuthenticated, loading, updateProfile } = useSSRSafeAuth()
  const searchParams = useSearchParams()

  const [orders, setOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)

  // Address and ABA bank name editing states
  const [isEditingAddress, setIsEditingAddress] = useState(false)
  const [addressData, setAddressData] = useState({
    address_line_1: '',
    address_line_2: '',
    aba_bank_name: ''
  })
  const [savingAddress, setSavingAddress] = useState(false)

  // Profile editing states
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [profileData, setProfileData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: ''
  })
  const [savingProfile, setSavingProfile] = useState(false)

  // Initialize address data when profile loads
  useEffect(() => {
    if (profile) {
      setAddressData({
        address_line_1: profile.address_line_1 || '',
        address_line_2: profile.address_line_2 || '',
        aba_bank_name: profile.aba_bank_name || ''
      })
      setProfileData({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        phone: profile.phone || '',
        email: profile.email || ''
      })
    }
  }, [profile])

  const handleEditAddress = () => {
    setIsEditingAddress(true)
  }

  const handleDeleteAddress = async () => {
    if (!confirm('Are you sure you want to delete your saved address and ABA bank information?')) {
      return
    }

    try {
      setSavingAddress(true)
      await updateProfile({
        address_line_1: null,
        address_line_2: null,
        aba_bank_name: null
      })
      setAddressData({
        address_line_1: '',
        address_line_2: '',
        aba_bank_name: ''
      })
      toast.success('Address information deleted successfully!')
    } catch (error) {
      Sentry.captureException(error)
      toast.error('Failed to delete address information')
    } finally {
      setSavingAddress(false)
    }
  }

  const handleSaveAddress = async () => {
    if (!addressData.address_line_1 || !addressData.aba_bank_name) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      setSavingAddress(true)
      await updateProfile({
        address_line_1: addressData.address_line_1,
        address_line_2: addressData.address_line_2 || null,
        aba_bank_name: addressData.aba_bank_name || null
      })
      setIsEditingAddress(false)
      toast.success('Address information updated successfully!')
    } catch (error) {
      Sentry.captureException(error)
      toast.error('Failed to update address information')
    } finally {
      setSavingAddress(false)
    }
  }

  const handleCancelEdit = () => {
    if (profile) {
      setAddressData({
        address_line_1: profile.address_line_1 || '',
        address_line_2: profile.address_line_2 || '',
        aba_bank_name: profile.aba_bank_name || ''
      })
    }
    setIsEditingAddress(false)
  }

  const handleEditProfile = () => {
    setIsEditingProfile(true)
  }

  const handleSaveProfile = async () => {
    try {
      setSavingProfile(true)
      await updateProfile({
        first_name: profileData.first_name || null,
        last_name: profileData.last_name || null,
        phone: profileData.phone || null
      })
      setIsEditingProfile(false)
      toast.success('Profile updated successfully!')
    } catch (error) {
      Sentry.captureException(error)
      toast.error('Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleCancelProfileEdit = () => {
    if (profile) {
      setProfileData({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        phone: profile.phone || '',
        email: profile.email || ''
      })
    }
    setIsEditingProfile(false)
  }

  // Optimized parallel data loading
  const loadProfileData = useCallback(async () => {
    if (!user?.id || !isAuthenticated || loading) return

    try {
      setOrdersLoading(true)

      // Load orders and any other profile data in parallel for better performance
      const [userOrders] = await Promise.all([
        orderQueries.getUserOrders(user.id, 5),
        // Add other parallel data loading here if needed
      ])

      setOrders(userOrders)
    } catch (error) {
      Sentry.captureException(error)
      setOrders([])
    } finally {
      setOrdersLoading(false)
    }
  }, [user?.id, isAuthenticated, loading])

  useEffect(() => {
    loadProfileData().catch((error) => {
      Sentry.captureException(error)
      setOrders([])
      setOrdersLoading(false)
    })
  }, [loadProfileData])

  // Handle Telegram authentication success with session bridge
  useEffect(() => {
    const authParam = searchParams.get('auth')
    const sessionBridge = searchParams.get('session_bridge')

    if (authParam === 'telegram_success' && sessionBridge) {
      console.log('🔗 Processing Telegram session bridge...')

      try {
        // Decode the session bridge token
        const sessionData = JSON.parse(Buffer.from(sessionBridge, 'base64').toString())

        // Validate the session data
        if (sessionData.access_token && sessionData.refresh_token && sessionData.user_id) {
          const supabase = createClient()

          // Set the session in the client
          supabase.auth.setSession({
            access_token: sessionData.access_token,
            refresh_token: sessionData.refresh_token,
            expires_at: sessionData.expires_at
          }).then(({ data, error }) => {
            if (error) {
              console.error('❌ Failed to set session from bridge:', error)
            } else {
              console.log('✅ Session bridge successful, user authenticated')
              toast.success('Successfully logged in with Telegram!')

              // Clean up URL parameters
              const url = new URL(window.location.href)
              url.searchParams.delete('auth')
              url.searchParams.delete('session_bridge')
              window.history.replaceState({}, '', url.toString())
            }
          }).catch((error) => {
            console.error('❌ Session bridge error:', error)
          })
        } else {
          console.error('❌ Invalid session bridge data')
        }
      } catch (error) {
        console.error('❌ Failed to decode session bridge:', error)
      }
    } else if (authParam === 'telegram_success') {
      // Handle success without session bridge (fallback)
      console.log('✅ Telegram authentication success (no bridge)')
      toast.success('Successfully logged in with Telegram!')

      // Clean up URL parameters
      const url = new URL(window.location.href)
      url.searchParams.delete('auth')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight mb-4">Please log in to view your profile</h1>
          <Link href="/en/auth/login">
            <Button className="min-h-[44px]">Login</Button>
          </Link>
        </div>
      </div>
    )
  }

  const getTierColor = (tier: string) => {
    const tierStyling = getTierStyling(tier)
    return tierStyling.premiumBadgeClass || tierStyling.badgeClass
  }

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'diamond': return '💎'
      case 'platinum': return '🏆'
      case 'gold': return '🥇'
      case 'silver': return '🥈'
      default: return '🥉'
    }
  }

  return (
    <div role="main" aria-labelledby="page-title" className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 sm:mb-8 lg:mb-10 text-center sm:text-left">
          <h1 id="page-title" className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 mb-2 sm:mb-3">
            {t('title')}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground font-medium">
            Manage your account and view your loyalty status
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Profile card */}
          <Card role="region" aria-labelledby="profile-info-title" className="lg:col-span-1">
            <CardHeader className="text-center pb-4 sm:pb-6 pt-6">
              <Avatar className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-5 ring-4 ring-blue-100">
                <AvatarImage 
                  src={profile?.avatar_url || ''} 
                  alt={profile?.first_name ? `${profile.first_name} ${profile.last_name}` : 'User avatar'} 
                />
                <AvatarFallback className="text-lg sm:text-xl font-bold bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                  {profile?.first_name?.[0] || profile?.telegram_username?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <CardTitle id="profile-info-title" className="text-lg sm:text-xl">
                {profile?.first_name && profile?.last_name
                  ? `${profile.first_name} ${profile.last_name}`
                  : profile?.telegram_username || 'User'
                }
              </CardTitle>
              <CardDescription className="text-sm">
                {profile?.email || 'Telegram User'}
              </CardDescription>

              {/* Tier Display */}
              {profile && (
                <div className="mt-3 flex justify-center">
                  <Badge className={`px-4 py-2 text-sm font-bold border-2 ${getTierColor(getCorrectUserTier(profile))}`}>
                    <span className="mr-2 text-base">{getTierIcon(getCorrectUserTier(profile))}</span>
                    {getCorrectUserTier(profile).toUpperCase()} MEMBER
                  </Badge>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              {/* Profile Information */}
              {!isEditingProfile ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-700">Profile Information</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleEditProfile}
                      className="h-8 px-2 text-xs"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center">
                      <User className="h-4 w-4 mr-2 text-gray-400" />
                      <span>{profile?.first_name || 'Not set'} {profile?.last_name || ''}</span>
                    </div>
                    <div className="flex items-center">
                      <Mail className="h-4 w-4 mr-2 text-gray-400" />
                      <span>{profile?.email || 'Not set'}</span>
                    </div>
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 mr-2 text-gray-400" />
                      <span>{profile?.phone || 'Not set'}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-700">Edit Profile</h3>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="first_name" className="text-xs">First Name</Label>
                      <Input
                        id="first_name"
                        value={profileData.first_name}
                        onChange={(e) => setProfileData(prev => ({ ...prev, first_name: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="last_name" className="text-xs">Last Name</Label>
                      <Input
                        id="last_name"
                        value={profileData.last_name}
                        onChange={(e) => setProfileData(prev => ({ ...prev, last_name: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone" className="text-xs">Phone</Label>
                      <Input
                        id="phone"
                        value={profileData.phone}
                        onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email" className="text-xs">Email (Read-only)</Label>
                      <Input
                        id="email"
                        value={profileData.email}
                        disabled
                        className="mt-1 bg-gray-50"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveProfile}
                      disabled={savingProfile}
                      size="sm"
                      className="min-h-[44px] flex-1"
                    >
                      {savingProfile ? (
                        <>
                          <Save className="h-3 w-3 mr-1 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-3 w-3 mr-1" />
                          Save
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleCancelProfileEdit}
                      size="sm"
                      className="min-h-[44px]"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              <Separator />

              {/* Address Information */}
              {!isEditingAddress ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-700">Delivery Address</h3>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleEditAddress}
                        className="h-8 px-2 text-xs"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      {(profile?.address_line_1 || profile?.aba_bank_name) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleDeleteAddress}
                          disabled={savingAddress}
                          className="h-8 px-2 text-xs text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start">
                      <MapPin className="h-4 w-4 mr-2 text-gray-400 mt-0.5" />
                      <div>
                        <div>{profile?.address_line_1 || 'No address saved'}</div>
                        {profile?.address_line_2 && <div>{profile.address_line_2}</div>}
                      </div>
                    </div>
                    <div className="flex items-center">
                      <CreditCard className="h-4 w-4 mr-2 text-gray-400" />
                      <span>{profile?.aba_bank_name || 'No ABA bank saved'}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-700">Edit Address</h3>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="address_line_1" className="text-xs">Address Line 1 *</Label>
                      <Input
                        id="address_line_1"
                        value={addressData.address_line_1}
                        onChange={(e) => setAddressData(prev => ({ ...prev, address_line_1: e.target.value }))}
                        placeholder="Enter your address"
                        className="mt-1"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="address_line_2" className="text-xs">Address Line 2</Label>
                      <Input
                        id="address_line_2"
                        value={addressData.address_line_2}
                        onChange={(e) => setAddressData(prev => ({ ...prev, address_line_2: e.target.value }))}
                        placeholder="Apartment, suite, etc. (optional)"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="aba_bank_name" className="text-xs">ABA Bank Name *</Label>
                      <Input
                        id="aba_bank_name"
                        value={addressData.aba_bank_name}
                        onChange={(e) => setAddressData(prev => ({ ...prev, aba_bank_name: e.target.value }))}
                        placeholder="Taravatey Than"
                        className="mt-1"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveAddress}
                      disabled={savingAddress}
                      size="sm"
                      className="min-h-[44px] flex-1"
                    >
                      {savingAddress ? (
                        <>
                          <Save className="h-3 w-3 mr-1 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-3 w-3 mr-1" />
                          Save
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleCancelEdit}
                      size="sm"
                      className="min-h-[44px]"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Points and Orders sections */}
          <div className="lg:col-span-2 space-y-4">
            {/* Points Section */}
            <RedesignedPointsWrapper userId={user?.id} />

            {/* Rewards & Coupons */}
            <RewardsCouponsSection userId={user?.id} userProfile={profile} />

            {/* Recent Orders */}
            <Card role="region" aria-labelledby="orders-title">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle id="orders-title" className="text-lg">Recent Orders</CardTitle>
                    <CardDescription>Your latest purchases</CardDescription>
                  </div>
                  <Link href="/en/orders">
                    <Button variant="outline" size="sm" className="min-h-[44px]">
                      <Eye className="h-4 w-4 mr-2" />
                      View All
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {ordersLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex items-center space-x-4">
                        <Skeleton className="h-12 w-12 rounded" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-[250px]" />
                          <Skeleton className="h-4 w-[200px]" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingBag className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No orders yet</h3>
                    <p className="text-gray-500 mb-4">Start shopping to see your orders here</p>
                    <Link href="/en">
                      <Button className="min-h-[44px]">
                        Start Shopping
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <div key={order.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Package className="h-4 w-4 text-gray-400" />
                            <span className="font-medium text-sm">#{order.order_number}</span>
                            <Badge variant={
                              order.fulfillment_status === 'completed' ? 'default' :
                              order.fulfillment_status === 'processing' ? 'secondary' :
                              'outline'
                            }>
                              {order.fulfillment_status}
                            </Badge>
                          </div>
                          <span className="text-sm font-medium">{formatPrice(order.total_amount)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-gray-500">
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(order.created_at)}</span>
                          </div>
                          <span>{order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}</span>
                        </div>
                        {order.items && order.items.length > 0 && (
                          <div className="mt-2 text-xs text-gray-600">
                            {order.items.slice(0, 2).map((item, index) => (
                              <div key={index}>
                                {item.title} × {item.quantity}
                              </div>
                            ))}
                            {order.items.length > 2 && (
                              <div className="text-gray-400">
                                +{order.items.length - 2} more item{order.items.length - 2 !== 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Account Security */}
            <Card role="region" aria-label="Account Security">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center">
                  <Shield className="h-5 w-5 mr-2" />
                  Account Security
                </CardTitle>
                <CardDescription>Manage your security settings and preferences</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <ChangePasswordDialog>
                      <Button className="min-h-[44px] flex-1 sm:flex-none">
                        <Shield className="h-4 w-4 mr-2" />
                        Change Password
                      </Button>
                    </ChangePasswordDialog>
                    <Link href="/en/auth/sessions">
                      <Button variant="outline" className="min-h-[44px] w-full sm:w-auto">
                        <Bell className="h-4 w-4 mr-2" />
                        Active Sessions
                      </Button>
                    </Link>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>Keep your account secure by using a strong password and monitoring active sessions.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}