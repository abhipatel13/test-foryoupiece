'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useSSRSafeAuth } from '@/lib/hooks/use-ssr-safe-auth'
import { useSSRSafeCartStore } from '@/lib/store/ssr-safe-cart-store'
import { orderQueries } from '@/lib/supabase/queries'
import { formatPrice, generateCartItemKey } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { SaveInfoDialog } from '@/components/checkout/save-info-dialog'
import { CheckoutPointsDisplay } from '@/components/checkout/checkout-points-display'
import { MapPin, Package, Truck, ShoppingBag, QrCode } from 'lucide-react'
import { toast } from 'sonner'

export default function CheckoutPage() {
  const t = useTranslations('checkout')
  const router = useRouter()
  const { user, profile, isAuthenticated, updateProfile } = useSSRSafeAuth()
  const {
    items,
    getTotal,
    clearCart,
    getShippingFee,
    getTotalSavings,
    getFinalTotal,
    getItemCount,
    pointsToRedeem,
    getPointsDiscount,
    getFinalTotalWithPoints,
    clearPointsRedemption,
    appliedCoupon,
    getCouponDiscount,
    getFinalTotalWithCouponAndPoints
  } = useSSRSafeCartStore()
  const [loading, setLoading] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  const [shippingAddress, setShippingAddress] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address1: '',
    address2: '',
    abaBankName: '',
    country: 'Cambodia'
  })

  const [saveAddress, setSaveAddress] = useState(false)
  const [showSaveAddressDialog, setShowSaveAddressDialog] = useState(false)
  const [addressChanged, setAddressChanged] = useState(false)

  // Auto-populate form when profile data becomes available
  useEffect(() => {
    if (profile) {
      const newAddress = {
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        address1: profile.address_line_1 || '',
        address2: profile.address_line_2 || '',
        abaBankName: profile.aba_bank_name || '',
        country: 'Cambodia'
      }

      setShippingAddress(newAddress)

      // Check if this is a first-time user (no saved address data)
      const hasExistingAddress = profile.first_name || profile.last_name || profile.address_line_1 || profile.aba_bank_name
      if (!hasExistingAddress) {
        setSaveAddress(true) // Default to saving for first-time users
      }
    }
  }, [profile])

  // Track address changes for update prompt
  const handleAddressChange = (field: string, value: string) => {
    setShippingAddress(prev => ({ ...prev, [field]: value }))

    // Check if address has changed from saved profile data
    if (profile) {
      const originalValue = profile[field === 'firstName' ? 'first_name' :
                                   field === 'lastName' ? 'last_name' :
                                   field === 'address1' ? 'address_line_1' :
                                   field === 'address2' ? 'address_line_2' :
                                   field === 'abaBankName' ? 'aba_bank_name' :
                                   field] || ''

      if (value !== originalValue) {
        setAddressChanged(true)
      }
    }
  }

  const [orderNotes, setOrderNotes] = useState('')

  // New calculation logic - no tax, fixed shipping with free shipping threshold
  const subtotal = getTotal()
  const shippingFee = getShippingFee()
  const totalSavings = getTotalSavings()
  const finalTotal = getFinalTotal()
  const itemCount = getItemCount()
  const pointsDiscount = getPointsDiscount()
  const finalTotalWithPoints = getFinalTotalWithPoints()
  const couponDiscount = getCouponDiscount()
  const finalTotalWithCouponAndPoints = getFinalTotalWithCouponAndPoints()

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Please log in to checkout</h1>
          <Button onClick={() => router.push('/en/auth/login')}>Login</Button>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Your cart is empty</h1>
          <Button onClick={() => router.push('/en/products')}>Continue Shopping</Button>
        </div>
      </div>
    )
  }

  const hasInformationChanged = () => {
    if (!profile) return true // If no profile, consider it changed

    return (
      shippingAddress.firstName !== (profile.first_name || '') ||
      shippingAddress.lastName !== (profile.last_name || '') ||
      shippingAddress.phone !== (profile.phone || '') ||
      shippingAddress.address1 !== (profile.address_line_1 || '') ||
      shippingAddress.address2 !== (profile.address_line_2 || '') ||
      shippingAddress.abaBankName !== (profile.aba_bank_name || '')
    )
  }

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    // Only show save information dialog if information has changed
    if (hasInformationChanged()) {
      setShowSaveDialog(true)
    } else {
      // Process order directly if no changes
      handleSaveInfo(false)
    }
  }

  const handleSaveInfo = async (shouldSave: boolean) => {
    setLoading(true)
    try {
      // Save information to profile if requested
      if (shouldSave) {
        await updateProfile({
          first_name: shippingAddress.firstName,
          last_name: shippingAddress.lastName,
          phone: shippingAddress.phone,
          address_line_1: shippingAddress.address1,
          address_line_2: shippingAddress.address2 || null,
          aba_bank_name: shippingAddress.abaBankName
        })
        toast.success('Information saved to your profile!')
      }

      // Prepare order data
      const orderData = {
        user_id: user!.id,
        email: shippingAddress.email,
        phone: shippingAddress.phone,
        subtotal,
        shipping_cost: shippingFee,
        tax_amount: 0, // No tax calculation
        discount_amount: pointsDiscount + couponDiscount, // Combined discounts
        coupon_id: appliedCoupon?.id || null,
        coupon_code: appliedCoupon?.code || null,
        coupon_discount_amount: couponDiscount,
        points_used: pointsToRedeem, // Use existing points_used column
        total_amount: finalTotalWithCouponAndPoints,
        payment_method: 'qr_code',
        fulfillment_status: 'on_hold',
        shipping_address: {
          firstName: shippingAddress.firstName,
          lastName: shippingAddress.lastName,
          address1: shippingAddress.address1,
          address2: shippingAddress.address2,
          abaBankName: shippingAddress.abaBankName,
          country: shippingAddress.country
        },
        billing_address: null, // No separate billing address needed
        notes: orderNotes
      }

      // Prepare order items
      const orderItems = items.map(item => ({
        product_id: item.id,
        variant_id: item.variant || null,
        sku: `${item.id}-${item.variant || 'default'}`,
        title: item.name,
        variant_title: item.variant || null,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity
      }))

      // Create order via server-side API
      const response = await fetch('/api/orders/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderData,
          orderItems
        })
      })

      const result = await response.json()

      if (!result.success) {
        console.error('Order creation failed with details:', {
          error: result.error,
          details: result.details,
          status: response.status
        });
        throw new Error(result.error || 'Failed to create order')
      }

      const { order } = result

      // Clear cart and points redemption
      clearCart()
      clearPointsRedemption()

      toast.success('Order placed successfully!')
      router.push(`/en/thank-you?order=${order.id}`)

    } catch (error: any) {
      console.error('Order creation failed:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      })

      // Show more specific error message if available
      const errorMessage = error.message.includes('system conflict')
        ? 'Order creation conflict detected. Please try again in a moment.'
        : 'Failed to place order. Please try again.'

      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }



  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8 max-w-7xl">
        {/* Header Section - Mobile Optimized */}
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">
            {t('title')}
          </h1>
          <p className="text-sm sm:text-base lg:text-lg text-gray-600">
            Complete your order information
          </p>
        </div>

        <form onSubmit={handleSubmitOrder} className="w-full">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 w-full overflow-hidden">
            {/* Checkout Form - Mobile-First Responsive */}
            <div className="lg:col-span-2 space-y-4 sm:space-y-6">
              {/* Shipping Address */}
              <Card>
                <CardHeader className="pb-3 sm:pb-6">
                  <CardTitle className="flex items-center space-x-2 text-base sm:text-lg">
                    <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span>{t('shippingAddress')}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1 sm:space-y-2">
                      <Label htmlFor="firstName" className="text-sm font-medium text-slate-700">First Name</Label>
                      <Input
                        id="firstName"
                        required
                        className="min-h-[44px] h-11 sm:h-12 text-sm sm:text-base px-3 sm:px-4 rounded-lg border-2 border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 focus:ring-offset-1 transition-all duration-200 bg-white hover:border-slate-300"
                        value={shippingAddress.firstName}
                        onChange={(e) => setShippingAddress({
                          ...shippingAddress,
                          firstName: e.target.value
                        })}
                        placeholder="Enter your first name"
                      />
                    </div>
                    <div className="space-y-1 sm:space-y-2">
                      <Label htmlFor="lastName" className="text-sm font-medium text-slate-700">Last Name</Label>
                      <Input
                        id="lastName"
                        required
                        className="min-h-[44px] h-11 sm:h-12 text-sm sm:text-base px-3 sm:px-4 rounded-lg border-2 border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 focus:ring-offset-1 transition-all duration-200 bg-white hover:border-slate-300"
                        value={shippingAddress.lastName}
                        onChange={(e) => setShippingAddress({
                          ...shippingAddress,
                          lastName: e.target.value
                        })}
                        placeholder="Enter your last name"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1 sm:space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium text-slate-700">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        className="min-h-[44px] h-11 sm:h-12 text-sm sm:text-base px-3 sm:px-4 rounded-lg border-2 border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 focus:ring-offset-1 transition-all duration-200 bg-white hover:border-slate-300"
                        value={shippingAddress.email}
                        onChange={(e) => setShippingAddress({
                          ...shippingAddress,
                          email: e.target.value
                        })}
                        placeholder="your.email@example.com"
                      />
                    </div>
                    <div className="space-y-1 sm:space-y-2">
                      <Label htmlFor="phone" className="text-sm font-medium text-slate-700">Phone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        required
                        className="min-h-[44px] h-11 sm:h-12 text-sm sm:text-base px-3 sm:px-4 rounded-lg border-2 border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 focus:ring-offset-1 transition-all duration-200 bg-white hover:border-slate-300"
                        value={shippingAddress.phone}
                        onChange={(e) => setShippingAddress({
                          ...shippingAddress,
                          phone: e.target.value
                        })}
                        placeholder="+855 12 345 678"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 sm:space-y-2">
                    <Label htmlFor="address1" className="text-sm font-medium">Address Line 1</Label>
                    <Input
                      id="address1"
                      required
                      className="min-h-[44px] h-11 sm:h-12 text-sm sm:text-base px-3 sm:px-4 rounded-lg border-2 border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 focus:ring-offset-1 transition-all duration-200 bg-white hover:border-slate-300"
                      value={shippingAddress.address1}
                      onChange={(e) => setShippingAddress({
                        ...shippingAddress,
                        address1: e.target.value
                      })}
                      placeholder="Street address, P.O. box, company name"
                    />
                  </div>

                  <div className="space-y-1 sm:space-y-2">
                    <Label htmlFor="address2" className="text-sm font-medium">Address Line 2 (Optional)</Label>
                    <Input
                      id="address2"
                      className="min-h-[44px] h-11 sm:h-12 text-sm sm:text-base px-3 sm:px-4 rounded-lg border-2 border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 focus:ring-offset-1 transition-all duration-200 bg-white hover:border-slate-300"
                      value={shippingAddress.address2}
                      onChange={(e) => setShippingAddress({
                        ...shippingAddress,
                        address2: e.target.value
                      })}
                      placeholder="Apartment, suite, unit, building, floor, etc."
                    />
                  </div>

                  <div className="space-y-1 sm:space-y-2">
                    <Label htmlFor="abaBankName" className="text-sm font-medium">ABA Bank Name *</Label>
                    <Input
                      id="abaBankName"
                      required
                      className="min-h-[44px] h-11 sm:h-12 text-sm sm:text-base px-3 sm:px-4 rounded-lg border-2 border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 focus:ring-offset-1 transition-all duration-200 bg-white hover:border-slate-300"
                      placeholder="Taravatey Than"
                      value={shippingAddress.abaBankName}
                      onChange={(e) => setShippingAddress({
                        ...shippingAddress,
                        abaBankName: e.target.value
                      })}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Payment Method - Mobile Responsive */}
              <Card>
                <CardHeader className="pb-3 sm:pb-6">
                  <CardTitle className="flex items-center space-x-2 text-base sm:text-lg">
                    <QrCode className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span>Payment Method</span>
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Your order will be placed and you'll receive payment instructions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2 sm:space-x-3 p-3 sm:p-4 border rounded-lg bg-blue-50">
                    <QrCode className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-blue-900 text-sm sm:text-base">QR Code Payment</div>
                      <div className="text-xs sm:text-sm text-blue-700">
                        Pay via QR code after order confirmation
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Order Notes - Mobile Responsive */}
              <Card>
                <CardHeader className="pb-3 sm:pb-6">
                  <CardTitle className="text-base sm:text-lg">Order Notes (Optional)</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Any special instructions for your order..."
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    rows={3}
                    className="min-h-[88px] text-sm sm:text-base px-3 sm:px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 focus:ring-offset-1 transition-all duration-200 bg-white hover:border-slate-300 resize-none"
                  />
                </CardContent>
              </Card>

              {/* Points Redemption */}
              {isAuthenticated && user && (
                <CheckoutPointsDisplay
                  userId={user.id}
                  orderTotal={finalTotalWithCouponAndPoints}
                  onPointsChange={(points) => {
                    // Points are automatically updated in the cart store
                    // This callback can be used for additional UI updates if needed
                  }}
                />
              )}
            </div>

            {/* Enhanced Order Summary - Mobile-First Responsive */}
            <div className="lg:col-span-1">
              <Card className="lg:sticky lg:top-4 shadow-lg border-2 border-gray-100">
                <CardHeader className="pb-4 sm:pb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 rounded-t-lg">
                  <CardTitle className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                    </div>
                    {t('orderSummary')}
                  </CardTitle>
                  <CardDescription className="text-sm text-slate-600 mt-2">
                    Review your order details before checkout
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
                  {/* Order Items - Enhanced Display */}
                  <div className="space-y-3 sm:space-y-4">
                    <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2">
                      Items ({itemCount})
                    </h3>
                    {items.map((item) => (
                      <div key={generateCartItemKey(item.id, item.variant)} className="flex justify-between items-start p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1 pr-3">
                          <p className="font-medium text-sm sm:text-base line-clamp-2 text-gray-900">{item.name}</p>
                          {item.variant && (
                            <p className="text-gray-600 text-xs mt-1 bg-gray-200 px-2 py-1 rounded-full inline-block">{item.variant}</p>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-500">Qty: {item.quantity}</span>
                            {item.originalPrice && item.originalPrice > item.price && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs line-through text-gray-400">{formatPrice(item.originalPrice)}</span>
                                <span className="text-xs text-red-600 font-medium">
                                  {Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)}% OFF
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-semibold text-sm sm:text-base text-gray-900">{formatPrice(item.price * item.quantity)}</p>
                          {item.originalPrice && item.originalPrice > item.price && (
                            <p className="text-xs text-gray-400 line-through">{formatPrice(item.originalPrice * item.quantity)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <Separator className="my-4" />

                  {/* Enhanced Order Summary - Mobile Responsive */}
                  <div className="space-y-2 sm:space-y-3">
                    {/* Subtotal */}
                    <div className="flex justify-between items-center text-sm sm:text-base">
                      <span className="text-gray-700">Subtotal ({itemCount} items)</span>
                      <span className="font-medium">{formatPrice(subtotal)}</span>
                    </div>

                    {/* Individual Item Discounts - Redesigned */}
                    {items.some(item => item.originalPrice && item.originalPrice > item.price) && (
                      <div className="bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200 p-4 rounded-xl">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-1.5 bg-rose-100 rounded-lg">
                            <svg className="h-4 w-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                          </div>
                          <span className="text-sm font-semibold text-rose-800">Item Discounts Applied</span>
                        </div>
                        <div className="space-y-2">
                          {items.filter(item => item.originalPrice && item.originalPrice > item.price).map((item) => {
                            const discountAmount = (item.originalPrice! - item.price) * item.quantity
                            const discountPercentage = Math.round(((item.originalPrice! - item.price) / item.originalPrice!) * 100)
                            return (
                              <div key={generateCartItemKey(item.id, item.variant)} className="flex justify-between items-center text-sm bg-white p-2 rounded-lg">
                                <span className="text-slate-700 flex items-center gap-2">
                                  <span className="w-2 h-2 bg-rose-400 rounded-full"></span>
                                  <span className="font-medium">{item.title}</span>
                                  <span className="text-xs bg-rose-100 text-rose-700 px-2 py-1 rounded-full font-medium">
                                    {discountPercentage}% OFF
                                  </span>
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="line-through text-slate-400 text-xs">{formatPrice(item.originalPrice!)}</span>
                                  <span className="text-rose-600 font-semibold">-{formatPrice(discountAmount)}</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Shipping */}
                    <div className="flex justify-between items-center text-sm sm:text-base">
                      <span className="text-gray-700">Shipping & handling</span>
                      <span className="font-medium">
                        {shippingFee === 0 ? (
                          <span className="text-green-700 font-semibold">FREE</span>
                        ) : (
                          formatPrice(shippingFee)
                        )}
                      </span>
                    </div>

                    {/* Free Shipping Indicator */}
                    {shippingFee === 0 && itemCount >= 4 && (
                      <div className="text-xs text-green-600 bg-green-50 p-2 rounded-md">
                        🎉 You saved {formatPrice(1.50)} with free shipping on 4+ items!
                      </div>
                    )}

                    {/* Points Discount - Redesigned */}
                    {pointsDiscount > 0 && (
                      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 p-4 rounded-xl">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-100 rounded-lg">
                              <svg className="h-5 w-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            </div>
                            <div>
                              <span className="text-slate-800 font-semibold text-sm">Points Discount</span>
                              <div className="text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded-full inline-block mt-1">
                                {pointsToRedeem.toLocaleString()} points redeemed
                              </div>
                            </div>
                          </div>
                          <span className="text-amber-700 font-bold text-lg">-{formatPrice(pointsDiscount)}</span>
                        </div>
                        <div className="text-xs text-amber-700 mt-2 bg-white p-2 rounded-lg">
                          🎉 You're saving with your loyalty points!
                        </div>
                      </div>
                    )}

                    {/* Coupon Discount - Redesigned */}
                    {appliedCoupon && couponDiscount > 0 && (
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-4 rounded-xl">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                              </svg>
                            </div>
                            <div>
                              <span className="text-slate-800 font-semibold text-sm">Coupon Applied</span>
                              <div className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded-full inline-block mt-1 font-mono">
                                {appliedCoupon.code}
                              </div>
                            </div>
                          </div>
                          <span className="text-blue-700 font-bold text-lg">-{formatPrice(couponDiscount)}</span>
                        </div>
                        <div className="text-xs text-blue-700 mt-2 bg-white p-2 rounded-lg">
                          ✅ Coupon discount applied successfully!
                        </div>
                      </div>
                    )}

                    {/* Total Savings Summary - Redesigned */}
                    {(totalSavings > 0 || pointsDiscount > 0 || couponDiscount > 0) && (
                      <div className="bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200 p-4 rounded-xl shadow-sm">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 rounded-lg">
                              <svg className="h-5 w-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div>
                              <span className="text-slate-800 font-bold text-base">Total Savings</span>
                              <div className="text-xs text-emerald-700 mt-1">
                                You saved on this order!
                              </div>
                            </div>
                          </div>
                          <span className="text-emerald-700 font-bold text-xl">
                            -{formatPrice(totalSavings + pointsDiscount + couponDiscount)}
                          </span>
                        </div>
                      </div>
                    )}

                    <Separator className="my-4" />

                    {/* Final Total - Redesigned */}
                    <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-2 border-slate-200 p-6 rounded-xl shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-lg font-bold text-slate-800 flex items-center gap-2">
                          <svg className="h-5 w-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          Order Total
                        </span>
                        <span className="text-2xl font-bold text-slate-900">
                          {formatPrice(finalTotalWithCouponAndPoints)}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600 flex items-center gap-1">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Final amount at checkout
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="group w-full min-h-[44px] h-12 sm:h-14 text-sm sm:text-base font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white border border-slate-700 hover:border-slate-600 shadow-sm hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:border-slate-400 disabled:shadow-none"
                    disabled={loading}
                    aria-label={loading ? 'Processing your order...' : 'Place your order'}
                  >
                    <div className="flex items-center justify-center gap-3 px-4">
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                          <span className="font-medium">Processing Order...</span>
                        </>
                      ) : (
                        <>
                          <svg className="h-5 w-5 text-white group-hover:text-slate-100 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                          <div className="flex flex-col items-center sm:flex-row sm:items-center sm:gap-2">
                            <span className="font-semibold">Place Order</span>
                            <span className="text-xs sm:text-sm text-slate-200 group-hover:text-white transition-colors duration-200">
                              {formatPrice(finalTotalWithCouponAndPoints)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </Button>

                  <div className="text-xs sm:text-sm text-blue-600 text-center bg-blue-50 p-2 rounded">
                    After placing your order, you'll receive payment instructions via QR code
                  </div>

                  <div className="text-xs text-gray-500 text-center">
                    <p>By placing your order, you agree to our Terms of Service</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>

        {/* Save Information Dialog */}
        <SaveInfoDialog
          open={showSaveDialog}
          onOpenChange={setShowSaveDialog}
          onSave={handleSaveInfo}
          firstName={shippingAddress.firstName}
          lastName={shippingAddress.lastName}
          phone={shippingAddress.phone}
          addressLine1={shippingAddress.address1}
          addressLine2={shippingAddress.address2}
          abaBankName={shippingAddress.abaBankName}
        />
      </div>
    </div>
  )
}
