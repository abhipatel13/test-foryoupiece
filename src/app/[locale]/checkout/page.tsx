'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/hooks/use-auth'
import { useCartStore } from '@/lib/store/cart-store'
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
  const { user, profile, isAuthenticated, updateProfile } = useAuth()
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
  } = useCartStore()
  const [loading, setLoading] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  const [shippingAddress, setShippingAddress] = useState({
    firstName: profile?.first_name || '',
    lastName: profile?.last_name || '',
    email: profile?.email || '',
    phone: profile?.phone || '',
    address1: profile?.address_line_1 || '',
    address2: profile?.address_line_2 || '',
    abaBankName: profile?.aba_bank_name || '',
    country: 'Cambodia'
  })

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
          <Button onClick={() => router.push('/auth/login')}>Login</Button>
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
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4 sm:mb-8">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">{t('title')}</h1>
          <p className="text-sm sm:text-base text-gray-600">Complete your order information</p>
        </div>

        <form onSubmit={handleSubmitOrder}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
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
                      <Label htmlFor="firstName" className="text-sm">First Name</Label>
                      <Input
                        id="firstName"
                        required
                        className="h-10 sm:h-11"
                        value={shippingAddress.firstName}
                        onChange={(e) => setShippingAddress({
                          ...shippingAddress,
                          firstName: e.target.value
                        })}
                      />
                    </div>
                    <div className="space-y-1 sm:space-y-2">
                      <Label htmlFor="lastName" className="text-sm">Last Name</Label>
                      <Input
                        id="lastName"
                        required
                        className="h-10 sm:h-11"
                        value={shippingAddress.lastName}
                        onChange={(e) => setShippingAddress({
                          ...shippingAddress,
                          lastName: e.target.value
                        })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1 sm:space-y-2">
                      <Label htmlFor="email" className="text-sm">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        className="h-10 sm:h-11"
                        value={shippingAddress.email}
                        onChange={(e) => setShippingAddress({
                          ...shippingAddress,
                          email: e.target.value
                        })}
                      />
                    </div>
                    <div className="space-y-1 sm:space-y-2">
                      <Label htmlFor="phone" className="text-sm">Phone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        required
                        className="h-10 sm:h-11"
                        value={shippingAddress.phone}
                        onChange={(e) => setShippingAddress({
                          ...shippingAddress,
                          phone: e.target.value
                        })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1 sm:space-y-2">
                    <Label htmlFor="address1" className="text-sm">Address Line 1</Label>
                    <Input
                      id="address1"
                      required
                      className="h-10 sm:h-11"
                      value={shippingAddress.address1}
                      onChange={(e) => setShippingAddress({
                        ...shippingAddress,
                        address1: e.target.value
                      })}
                    />
                  </div>

                  <div className="space-y-1 sm:space-y-2">
                    <Label htmlFor="address2" className="text-sm">Address Line 2 (Optional)</Label>
                    <Input
                      id="address2"
                      className="h-10 sm:h-11"
                      value={shippingAddress.address2}
                      onChange={(e) => setShippingAddress({
                        ...shippingAddress,
                        address2: e.target.value
                      })}
                    />
                  </div>

                  <div className="space-y-1 sm:space-y-2">
                    <Label htmlFor="abaBankName" className="text-sm">ABA Bank Name *</Label>
                    <Input
                      id="abaBankName"
                      required
                      className="h-10 sm:h-11"
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
                    className="text-sm sm:text-base resize-none"
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

            {/* Order Summary - Mobile-First Responsive */}
            <div className="lg:col-span-1">
              <Card className="lg:sticky lg:top-4">
                <CardHeader className="pb-3 sm:pb-6">
                  <CardTitle className="text-base sm:text-lg">{t('orderSummary')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4">
                  {/* Order Items - Mobile Responsive */}
                  <div className="space-y-2 sm:space-y-3">
                    {items.map((item) => (
                      <div key={generateCartItemKey(item.id, item.variant)} className="flex justify-between text-xs sm:text-sm">
                        <div className="flex-1 pr-2">
                          <p className="font-medium line-clamp-2">{item.name}</p>
                          {item.variant && (
                            <p className="text-gray-500 text-xs">{item.variant}</p>
                          )}
                          <p className="text-gray-500 text-xs">Qty: {item.quantity}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-medium">{formatPrice(item.price * item.quantity)}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {/* Totals - Mobile Responsive */}
                  <div className="space-y-1 sm:space-y-2">
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span>Subtotal ({itemCount} items)</span>
                      <span>{formatPrice(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span>Shipping & handling</span>
                      <span>
                        {shippingFee === 0 ? (
                          <span className="text-green-700">FREE</span>
                        ) : (
                          formatPrice(shippingFee)
                        )}
                      </span>
                    </div>
                    {totalSavings > 0 && (
                      <div className="flex justify-between text-green-700 text-xs sm:text-sm">
                        <span>Total Savings</span>
                        <span>-{formatPrice(totalSavings)}</span>
                      </div>
                    )}
                    {pointsDiscount > 0 && (
                      <div className="flex justify-between text-orange-600 text-xs sm:text-sm">
                        <span>Points Discount ({pointsToRedeem} pts)</span>
                        <span>-{formatPrice(pointsDiscount)}</span>
                      </div>
                    )}
                    {appliedCoupon && couponDiscount > 0 && (
                      <div className="flex justify-between text-blue-600 text-xs sm:text-sm">
                        <span>Coupon Discount ({appliedCoupon.code})</span>
                        <span>-{formatPrice(couponDiscount)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between text-base sm:text-lg font-bold text-red-600">
                      <span>Order Total</span>
                      <span>
                        {formatPrice(
                          (appliedCoupon && couponDiscount > 0) || pointsDiscount > 0
                            ? finalTotalWithCouponAndPoints
                            : finalTotal
                        )}
                      </span>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-10 sm:h-12 text-sm sm:text-base"
                    disabled={loading}
                  >
                    {loading ? 'Processing...' : 'Place Order'}
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
