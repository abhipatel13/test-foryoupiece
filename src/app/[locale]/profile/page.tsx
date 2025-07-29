'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/hooks/use-auth'
import { userQueries, orderQueries } from '@/lib/supabase/queries'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Star, Trophy, Gift, Calendar, Mail, Phone, User, Edit, MapPin, CreditCard, Save, Trash2, Package, Clock, Eye, ShoppingBag, X, Award, Shield } from 'lucide-react'
import { formatDate, formatPrice, getCorrectUserTier, getTierStyling } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import Link from 'next/link'
import PointsDashboard from '@/components/user/points-dashboard'
import TierRewardsDisplay from '@/components/user/tier-rewards-display'
import { PointsBreakdownComponent } from '@/components/user/points-breakdown'
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
  const { user, profile, isAuthenticated, loading, updateProfile } = useAuth()

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

  const handleSaveAddress = async () => {
    setSavingAddress(true)
    try {
      await updateProfile({
        address_line_1: addressData.address_line_1 || null,
        address_line_2: addressData.address_line_2 || null,
        aba_bank_name: addressData.aba_bank_name || null
      })
      setIsEditingAddress(false)
      toast.success('Address information updated successfully!')
    } catch (error) {
      console.error('Error updating address:', error)
      toast.error('Failed to update address information')
    } finally {
      setSavingAddress(false)
    }
  }

  const handleCancelEdit = () => {
    // Reset to original values
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
    setSavingProfile(true)
    try {
      await updateProfile({
        first_name: profileData.first_name || null,
        last_name: profileData.last_name || null,
        phone: profileData.phone || null
        // Note: email updates might require special handling in auth systems
      })
      setIsEditingProfile(false)
      toast.success('Profile updated successfully!')
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error('Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleCancelProfileEdit = () => {
    // Reset to original values
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

  const handleDeleteAddress = async () => {
    if (!confirm('Are you sure you want to delete your saved address information?')) {
      return
    }

    setSavingAddress(true)
    try {
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
      console.error('Error deleting address:', error)
      toast.error('Failed to delete address information')
    } finally {
      setSavingAddress(false)
    }
  }



  const loadOrders = useCallback(async () => {
    if (!user) return

    try {
      setOrdersLoading(true)
      const userOrders = await orderQueries.getUserOrders(user.id, 5) // Load last 5 orders
      setOrders(userOrders)
      console.log('✅ Profile orders loaded successfully:', userOrders.length, 'orders')
    } catch (error) {
      console.error('❌ Error loading profile orders:', error)
      // Set empty array on error to prevent infinite retries
      setOrders([])
    } finally {
      setOrdersLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user && isAuthenticated && !loading) {
      loadOrders()
    }
  }, [user?.id, isAuthenticated, loading, loadOrders]) // Only depend on user.id to prevent unnecessary re-renders

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
          <h1 className="text-2xl font-bold mb-4">Please log in to view your profile</h1>
          <Button>Login</Button>
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
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">{t('title')}</h1>
          <p className="text-sm sm:text-base text-gray-600">Manage your account and view your loyalty status</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Profile Info - Mobile-First Responsive */}
          <Card>
            <CardHeader className="text-center pb-3 sm:pb-6">
              <Avatar className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-3 sm:mb-4">
                <AvatarImage src={profile?.avatar_url || ''} />
                <AvatarFallback className="text-base sm:text-lg">
                  {profile?.first_name?.[0] || profile?.telegram_username?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <CardTitle className="text-lg sm:text-xl">
                {profile?.first_name && profile?.last_name
                  ? `${profile.first_name} ${profile.last_name}`
                  : profile?.telegram_username || 'User'
                }
              </CardTitle>
              <CardDescription className="text-sm">
                {profile?.email || 'Telegram User'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              {isEditingProfile ? (
                <div className="space-y-3 sm:space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1 sm:space-y-2">
                      <Label htmlFor="edit-first-name" className="text-sm">First Name</Label>
                      <Input
                        id="edit-first-name"
                        className="h-10 sm:h-11"
                        value={profileData.first_name}
                        onChange={(e) => setProfileData({
                          ...profileData,
                          first_name: e.target.value
                        })}
                      />
                    </div>
                    <div className="space-y-1 sm:space-y-2">
                      <Label htmlFor="edit-last-name" className="text-sm">Last Name</Label>
                      <Input
                        id="edit-last-name"
                        className="h-10 sm:h-11"
                        value={profileData.last_name}
                        onChange={(e) => setProfileData({
                          ...profileData,
                          last_name: e.target.value
                        })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1 sm:space-y-2">
                    <Label htmlFor="edit-phone" className="text-sm">Phone Number</Label>
                    <Input
                      id="edit-phone"
                      type="tel"
                      className="h-10 sm:h-11"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({
                        ...profileData,
                        phone: e.target.value
                      })}
                    />
                  </div>
                  <div className="space-y-1 sm:space-y-2">
                    <Label htmlFor="edit-email" className="text-sm">Email (Read-only)</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      className="h-10 sm:h-11"
                      value={profileData.email}
                      disabled
                      className="bg-gray-50"
                    />
                    <p className="text-xs text-gray-500">Email cannot be changed here</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      onClick={handleSaveProfile}
                      disabled={savingProfile}
                      size="sm"
                      className="flex-1"
                    >
                      {savingProfile ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-1" />
                          Save
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleCancelProfileEdit}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{profile?.email || 'Not provided'}</span>
                  </div>
                  {profile?.phone && (
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">{profile.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">
                      Joined {formatDate(profile?.created_at)}
                    </span>
                  </div>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={handleEditProfile}
                    disabled={isEditingProfile}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Enhanced Loyalty Points Display */}
          <PointsBreakdownComponent
            userId={profile?.id || ''}
            variant="full"
            showTierProgress={true}
          />

          {/* Tier Rewards Display */}
          <TierRewardsDisplay userId={profile?.id} userProfile={profile} />

        </div>

        {/* Account Security */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-blue-500" />
              <span>Account Security</span>
            </CardTitle>
            <CardDescription>
              Manage your account security settings and password
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <h4 className="font-medium text-gray-900">Password</h4>
                <p className="text-sm text-gray-500">
                  Change your account password to keep your account secure
                </p>
              </div>
              <ChangePasswordDialog>
                <Button variant="outline" size="sm">
                  <Shield className="h-4 w-4 mr-2" />
                  Change Password
                </Button>
              </ChangePasswordDialog>
            </div>
          </CardContent>
        </Card>

        {/* Address & Payment Information */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MapPin className="h-5 w-5 text-blue-500" />
              <span>Address & Payment Information</span>
            </CardTitle>
            <CardDescription>
              Manage your saved address and ABA bank name for faster checkout
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Address Information */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900">Shipping Address</h4>
                {!isEditingAddress && (
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEditAddress}
                      disabled={savingAddress}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    {(profile?.address_line_1 || profile?.address_line_2 || profile?.aba_bank_name) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDeleteAddress}
                        disabled={savingAddress}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {isEditingAddress ? (
                <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                  <div className="space-y-2">
                    <Label htmlFor="edit-address1">Address Line 1 *</Label>
                    <Input
                      id="edit-address1"
                      value={addressData.address_line_1}
                      onChange={(e) => setAddressData({
                        ...addressData,
                        address_line_1: e.target.value
                      })}
                      placeholder="Enter your primary address"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-address2">Address Line 2 (Optional)</Label>
                    <Input
                      id="edit-address2"
                      value={addressData.address_line_2}
                      onChange={(e) => setAddressData({
                        ...addressData,
                        address_line_2: e.target.value
                      })}
                      placeholder="Apartment, suite, etc."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-aba-bank">ABA Bank Name *</Label>
                    <Input
                      id="edit-aba-bank"
                      value={addressData.aba_bank_name}
                      onChange={(e) => setAddressData({
                        ...addressData,
                        aba_bank_name: e.target.value
                      })}
                      placeholder="Taravatey Than"
                    />
                  </div>

                  <div className="flex space-x-2 pt-2">
                    <Button
                      onClick={handleSaveAddress}
                      disabled={savingAddress || !addressData.address_line_1 || !addressData.aba_bank_name}
                      size="sm"
                    >
                      {savingAddress ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-1" />
                          Save Changes
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleCancelEdit}
                      disabled={savingAddress}
                      size="sm"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {profile?.address_line_1 || profile?.address_line_2 ? (
                    <div className="p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="font-medium text-gray-900">
                          {profile.address_line_1}
                        </div>
                        {profile.address_line_2 && (
                          <div className="text-gray-600">
                            {profile.address_line_2}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 border-2 border-dashed border-gray-200 rounded-lg text-center text-gray-500">
                      <MapPin className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p>No address saved</p>
                      <p className="text-sm">Add your address for faster checkout</p>
                    </div>
                  )}

                  {profile?.aba_bank_name ? (
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center space-x-2">
                        <CreditCard className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium text-gray-700">ABA Bank Name:</span>
                        <span className="text-gray-900">{profile.aba_bank_name}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 border-2 border-dashed border-gray-200 rounded-lg text-center text-gray-500">
                      <CreditCard className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p>No ABA bank name saved</p>
                      <p className="text-sm">Add your ABA bank name for faster checkout</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <ShoppingBag className="h-5 w-5" />
                  <span>Recent Orders</span>
                </CardTitle>
                <CardDescription>Your latest order history</CardDescription>
              </div>
              <Link href="/orders">
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4 mr-2" />
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                    <Skeleton className="h-12 w-12 rounded" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))}
              </div>
            ) : orders.length > 0 ? (
              <div className="space-y-4">
                {orders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-blue-100 rounded flex items-center justify-center">
                        <Package className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">Order #{order.order_number}</p>
                        <p className="text-sm text-gray-500">
                          {order.items.length} item{order.items.length !== 1 ? 's' : ''} • {formatDate(order.created_at)}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge
                            variant={order.payment_status === 'paid' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {order.payment_status === 'pending' ? 'Payment Pending' :
                             order.payment_status === 'paid' ? 'Paid' : order.payment_status}
                          </Badge>
                          <Badge
                            variant={order.fulfillment_status === 'delivered' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {order.fulfillment_status === 'on_hold' ? 'On Hold' :
                             order.fulfillment_status === 'processing' ? 'Processing' :
                             order.fulfillment_status === 'shipped' ? 'Shipped' :
                             order.fulfillment_status === 'delivered' ? 'Delivered' : order.fulfillment_status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatPrice(order.total_amount)}</p>
                      <Link href={`/orders/${order.id}`}>
                        <Button variant="ghost" size="sm" className="mt-1">
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No orders yet</p>
                <p className="text-sm">Start shopping to see your orders here!</p>
                <Link href="/products">
                  <Button className="mt-4">
                    Start Shopping
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Comprehensive Points Dashboard */}
        {user && <PointsDashboard userId={user.id} userProfile={profile} />}
      </div>
    </div>
  )
}
