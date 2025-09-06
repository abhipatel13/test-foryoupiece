'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Truck, 
  Instagram, 
  Facebook, 
  Send, 
  Package, 
  Plane, 
  Ship, 
  Clock, 
  DollarSign,
  MessageCircle,
  ArrowRight,
  ExternalLink,
  Zap,
  Calendar,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import Link from 'next/link'

export default function ShippingInfoPage() {
  const deliveryOptions = [
    {
      name: 'Express Delivery',
      icon: Zap,
      timeframe: '1-2 days',
      description: 'Much cheaper and faster than pre-order options! Express delivery directly from Japan for all in-stock items',
      availability: 'ONLY available on our website for items marked as "In Stock" or "Fast delivery"',
      color: 'bg-green-500 text-white',
      badge: 'Best Value',
      features: [
        '$1.50 fixed shipping fee',
        'FREE shipping for 4+ items',
        'Much cheaper than pre-orders',
        'Fastest delivery option',
        'Direct from Japan',
        'Real-time tracking',
        'Secure packaging',
        'Website exclusive'
      ]
    },
    {
      name: 'Air Shipping (Pre-order)',
      icon: Plane,
      timeframe: '1-2 weeks maximum',
      description: 'Premium air shipping for pre-order items not currently in stock',
      availability: 'Additional cost: $1-5 depending on size and weight',
      color: 'bg-blue-500 text-white',
      badge: 'Premium',
      features: [
        'Faster than sea shipping',
        'Secure air transport',
        'Custom product requests',
        'Priority handling'
      ]
    },
    {
      name: 'Sea Shipping (Pre-order)',
      icon: Ship,
      timeframe: 'Usually 1 month',
      description: 'Standard sea shipping for pre-order items with longer delivery time',
      availability: 'Most economical option for pre-order items',
      color: 'bg-blue-600 text-white',
      badge: 'Economical',
      features: [
        'Cost-effective shipping',
        'Bulk order friendly',
        'Reliable delivery',
        'Standard packaging'
      ]
    }
  ]

  const contactChannels = [
    {
      name: 'Instagram',
      icon: Instagram,
      url: 'https://www.instagram.com/foryoupiece.select/',
      description: 'Primary contact for pre-orders and custom requests',
      color: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600',
      badge: 'Recommended',
      priority: 'Fastest response for pre-orders'
    },
    {
      name: 'Facebook',
      icon: Facebook,
      url: 'https://www.facebook.com/foryoupiece.select',
      description: 'Alternative contact for shipping inquiries and support',
      color: 'bg-blue-600 text-white hover:bg-blue-700',
      badge: 'Alternative',
      priority: 'Community support'
    },
    {
      name: 'Telegram',
      icon: Send,
      url: 'https://t.me/m/zDsQTcg4MDJl',
      description: 'Direct messaging for shipping questions and order updates',
      color: 'bg-blue-500 text-white hover:bg-blue-600',
      badge: 'Direct',
      priority: 'Real-time support'
    }
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header Section */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
                <Truck className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Shipping Information
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Fast, reliable delivery from Japan to Cambodia. Choose from express delivery for in-stock items or pre-order options for special requests.
            </p>
          </div>

          {/* Main Shipping Message */}
          <Card className="mb-12 border-2 border-primary/20 bg-primary/5">
            <CardContent className="p-8 text-center">
              <div className="flex items-center justify-center mb-4">
                <Package className="h-12 w-12 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                Multiple Shipping Options Available
              </h2>
              <p className="text-muted-foreground text-lg mb-6 max-w-2xl mx-auto">
                <strong className="text-primary">Website exclusive:</strong> Get the cheapest and fastest shipping with our express delivery!
                Only $1.50 fixed shipping fee (FREE for 4+ items) vs. much higher costs for pre-orders through social media.
              </p>
              <div className="flex items-center justify-center space-x-6 text-sm text-muted-foreground">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Direct from Japan</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Secure Packaging</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Custom Requests</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Options Grid */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-6 text-center">
              Delivery Options & Timeframes
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {deliveryOptions.map((option) => {
                const IconComponent = option.icon
                return (
                  <Card key={option.name} className="group hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/30">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${option.color} transition-all duration-300`}>
                            <IconComponent className="h-6 w-6" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{option.name}</CardTitle>
                            <Badge variant="secondary" className="text-xs mt-1">
                              {option.badge}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 mb-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-primary">{option.timeframe}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <CardDescription className="text-base mb-4 leading-relaxed">
                        {option.description}
                      </CardDescription>
                      <div className="mb-4 p-3 bg-secondary/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          <strong>Availability:</strong> {option.availability}
                        </p>
                      </div>
                      <ul className="space-y-2">
                        {option.features.map((feature, index) => (
                          <li key={index} className="flex items-center space-x-2 text-sm">
                            <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Pre-order Process Section */}
          <Card className="mb-12 border-2 border-orange-200 bg-orange-50/50">
            <CardContent className="p-8">
              <div className="flex items-center justify-center mb-6">
                <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center">
                  <MessageCircle className="h-8 w-8 text-orange-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-4 text-center">
                Pre-order Process
              </h2>
              <div className="max-w-2xl mx-auto text-center mb-6">
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Can't find what you're looking for on our website? No problem! Contact us through social media 
                  to place pre-orders for items not currently in stock or request custom products.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-orange-600 font-bold text-sm">1</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Contact via Social Media</h4>
                    <p className="text-sm text-muted-foreground">
                      Reach out through Instagram (preferred), Facebook, or Telegram with your product request
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-orange-600 font-bold text-sm">2</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Choose Shipping Method</h4>
                    <p className="text-sm text-muted-foreground">
                      Select between sea shipping (1 month) or air shipping (1-2 weeks, $1-5 extra)
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-orange-600 font-bold text-sm">3</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Receive Confirmation</h4>
                    <p className="text-sm text-muted-foreground">
                      Get order details, pricing, and estimated delivery timeframe
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-orange-600 font-bold text-sm">4</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Fast Processing</h4>
                    <p className="text-sm text-muted-foreground">
                      We're committed to sending your items as soon as possible
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-lg p-6 text-center">
                <div className="flex items-center justify-center space-x-2 mb-3">
                  <Zap className="h-6 w-6 text-green-600" />
                  <span className="font-bold text-green-800 text-lg">💡 Smart Shopping Tip</span>
                </div>
                <p className="text-green-800 font-semibold mb-2">
                  Save money and time by checking our website regularly!
                </p>
                <p className="text-green-700 text-sm">
                  Express delivery is <strong>much cheaper and faster</strong> than pre-orders.
                  Items get restocked frequently, so keep checking for the best deals and fastest shipping!
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information Section */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-6 text-center">
              Contact Us for Shipping Inquiries
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {contactChannels.map((channel) => {
                const IconComponent = channel.icon
                return (
                  <Card key={channel.name} className="group hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/30">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${channel.color} transition-all duration-300`}>
                            <IconComponent className="h-6 w-6" />
                          </div>
                          <div>
                            <CardTitle className="text-xl">{channel.name}</CardTitle>
                            <Badge variant="secondary" className="text-xs mt-1">
                              {channel.badge}
                            </Badge>
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">
                        <strong>{channel.priority}</strong>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <CardDescription className="text-base mb-6 leading-relaxed">
                        {channel.description}
                      </CardDescription>
                      <Button
                        asChild
                        className="w-full group-hover:scale-105 transition-transform duration-300"
                        size="lg"
                      >
                        <Link
                          href={channel.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center space-x-2"
                        >
                          <span>Contact via {channel.name}</span>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Additional Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <DollarSign className="h-5 w-5 text-green-500" />
                  <span>Shipping Costs</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Express Delivery (Website)</span>
                  <Badge variant="outline" className="text-green-600 border-green-200 font-semibold">
                    $1.50 Fixed
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Free Shipping (4+ items)</span>
                  <Badge variant="outline" className="text-green-600 border-green-200 font-semibold">
                    FREE ✨
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Sea Shipping (Pre-order)</span>
                  <Badge variant="outline" className="text-blue-600 border-blue-200">
                    Higher Cost
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Air Shipping (Pre-order)</span>
                  <Badge variant="outline" className="text-orange-600 border-orange-200">
                    Much Higher (+$1-5)
                  </Badge>
                </div>
                <Separator />
                <div className="text-xs text-muted-foreground bg-green-50 p-2 rounded">
                  <p className="font-semibold text-green-700">💰 Best Value: $1.50 fixed shipping, FREE for 4+ items!</p>
                  <p>* Pre-order shipping costs significantly more</p>
                  <p>* Check website regularly for better deals</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5 text-blue-500" />
                  <span>Delivery Timeframes</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    <span><strong>Express:</strong> 1-2 days (in-stock items)</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    <span><strong>Air Shipping:</strong> 1-2 weeks maximum</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                    <span><strong>Sea Shipping:</strong> Usually 1 month</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                    <span><strong>Custom Requests:</strong> Processing + shipping time</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                    <span><strong>Pre-orders:</strong> Depends on availability</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <Separator className="my-12" />

          {/* Website Advantage Section */}
          <Card className="mb-12 border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
            <CardContent className="p-8 text-center">
              <div className="flex items-center justify-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center">
                  <Zap className="h-8 w-8 text-white" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Why Shop on Our Website?
              </h2>
              <div className="max-w-2xl mx-auto text-center mb-6">
                <p className="text-muted-foreground text-lg leading-relaxed mb-4">
                  Our website offers the <strong className="text-green-600">best value and fastest delivery</strong> for all available items.
                  We regularly restock popular products, so checking our website frequently means better deals and quicker delivery!
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <DollarSign className="h-6 w-6 text-green-600" />
                  </div>
                  <h4 className="font-semibold text-foreground mb-2">Much Cheaper</h4>
                  <p className="text-sm text-muted-foreground">
                    $1.50 fixed shipping (FREE for 4+ items) vs. $1-5+ extra for pre-orders
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Clock className="h-6 w-6 text-blue-600" />
                  </div>
                  <h4 className="font-semibold text-foreground mb-2">Much Faster</h4>
                  <p className="text-sm text-muted-foreground">
                    1-2 days vs. 1-4 weeks for pre-order shipping
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Package className="h-6 w-6 text-purple-600" />
                  </div>
                  <h4 className="font-semibold text-foreground mb-2">Regular Restocks</h4>
                  <p className="text-sm text-muted-foreground">
                    New inventory added frequently - check back often!
                  </p>
                </div>
              </div>

              <div className="bg-white border border-green-200 rounded-lg p-4 text-center">
                <p className="text-green-700 font-semibold text-lg mb-2">
                  🔄 Bookmark our website and check regularly for the best deals!
                </p>
                <p className="text-green-600 text-sm">
                  Save money, get faster delivery, and discover new products as soon as they arrive.
                </p>
              </div>
            </CardContent>
          </Card>

          <Separator className="my-12" />

          {/* Service Commitment Section */}
          <Card className="bg-gradient-to-r from-primary/5 to-secondary/5 border-2 border-dashed border-primary/20">
            <CardContent className="p-8 text-center">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-primary to-secondary rounded-2xl flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-white" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-4">
                Our Shipping Commitment
              </h3>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed mb-6">
                We're committed to getting your authentic Japanese products to you as quickly and safely as possible.
                Whether you choose express delivery or pre-order through social media, we prioritize quality and speed.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center justify-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Authentic Products</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Secure Packaging</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Fast Processing</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
