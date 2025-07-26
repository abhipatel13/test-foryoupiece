'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Mail, 
  Instagram, 
  Facebook, 
  Send, 
  MessageCircle, 
  Briefcase, 
  Users, 
  TrendingUp,
  Handshake,
  ArrowRight,
  ExternalLink,
  Building,
  DollarSign,
  Star,
  CheckCircle,
  Phone,
  Globe
} from 'lucide-react'
import Link from 'next/link'

export default function ContactUsPage() {
  const businessContacts = [
    {
      name: 'Foryoupiece Telegram',
      icon: Send,
      url: 'https://t.me/foryoupiececreator',
      description: 'Exclusive business channel for partnerships, bulk orders, and professional inquiries',
      color: 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800',
      badge: 'Business Exclusive',
      priority: 'Primary business contact',
      type: 'business'
    },
    {
      name: 'Business Email',
      icon: Mail,
      url: 'mailto:support@foryoupiece.com',
      description: 'Professional email contact for formal business communications and partnerships',
      color: 'bg-gradient-to-r from-gray-700 to-gray-800 text-white hover:from-gray-800 hover:to-gray-900',
      badge: 'Professional',
      priority: 'Formal business approach',
      type: 'business'
    }
  ]

  const generalSupportChannels = [
    {
      name: 'Instagram',
      icon: Instagram,
      url: 'https://www.instagram.com/foryoupiece.select/',
      description: 'Customer support, product inquiries, and general assistance',
      color: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600',
      badge: 'Recommended',
      priority: 'Fastest customer support'
    },
    {
      name: 'Facebook',
      icon: Facebook,
      url: 'https://www.facebook.com/foryoupiece.select',
      description: 'Community support, product discussions, and customer service',
      color: 'bg-blue-600 text-white hover:bg-blue-700',
      badge: 'Community',
      priority: 'Community support'
    },
    {
      name: 'General Support Telegram',
      icon: Send,
      url: 'https://t.me/foryoupiece_support',
      description: 'Customer support and general inquiries (not for business matters)',
      color: 'bg-blue-500 text-white hover:bg-blue-600',
      badge: 'Customer Support',
      priority: 'Direct customer support'
    }
  ]

  const businessOpportunities = [
    {
      title: 'Bulk Purchases & Wholesale',
      icon: Building,
      description: 'Special pricing for bulk orders with 5-20% discounts based on volume and products',
      benefits: ['Volume discounts up to 20%', 'Priority processing', 'Dedicated account manager', 'Custom packaging options']
    },
    {
      title: 'Customer Partnerships',
      icon: Handshake,
      description: 'Long-term partnerships with businesses and organizations for regular supply needs',
      benefits: ['Exclusive partnership rates', 'Flexible payment terms', 'Custom product sourcing', 'Regular supply agreements']
    },
    {
      title: 'Influencer Collaborations',
      icon: Star,
      description: 'Partnership opportunities for content creators and influencers in beauty and lifestyle',
      benefits: ['Product collaboration deals', 'Exclusive discount codes', 'Content partnership', 'Commission opportunities']
    },
    {
      title: 'Business Development',
      icon: TrendingUp,
      description: 'Open to all business opportunities, partnerships, and collaborative ventures',
      benefits: ['Custom business solutions', 'Market expansion opportunities', 'Joint ventures', 'Strategic partnerships']
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
                <MessageCircle className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Contact Us
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Connect with us for business opportunities or general support. We're here to help with partnerships, 
              bulk orders, and all your customer service needs.
            </p>
          </div>

          {/* Business vs General Support Message */}
          <Card className="mb-12 border-2 border-primary/20 bg-primary/5">
            <CardContent className="p-8 text-center">
              <div className="flex items-center justify-center mb-4">
                <div className="flex space-x-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Briefcase className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Users className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </div>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                Choose the Right Contact Method
              </h2>
              <p className="text-muted-foreground text-lg mb-6 max-w-2xl mx-auto">
                We've separated our contact channels to provide you with the best possible service. 
                Use business contacts for partnerships and bulk orders, or general support for customer service.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center justify-center space-x-2">
                  <Briefcase className="h-4 w-4 text-blue-600" />
                  <span><strong>Business:</strong> Partnerships & Bulk Orders</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <Users className="h-4 w-4 text-green-600" />
                  <span><strong>General:</strong> Customer Support & Inquiries</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Business Inquiries Section */}
          <div className="mb-12">
            <div className="text-center mb-8">
              <div className="flex items-center justify-center mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                  <Briefcase className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Business Inquiries & Partnerships
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Ready to partner with us? Contact our business team for bulk orders, wholesale opportunities, 
                and professional collaborations.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {businessContacts.map((contact) => {
                const IconComponent = contact.icon
                return (
                  <Card key={contact.name} className="group hover:shadow-lg transition-all duration-300 border-2 hover:border-blue-300">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${contact.color} transition-all duration-300`}>
                            <IconComponent className="h-6 w-6" />
                          </div>
                          <div>
                            <CardTitle className="text-xl">{contact.name}</CardTitle>
                            <Badge variant="secondary" className="text-xs mt-1 bg-blue-100 text-blue-700">
                              {contact.badge}
                            </Badge>
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-blue-600 group-hover:translate-x-1 transition-all duration-300" />
                      </div>
                      <div className="text-sm text-blue-600 font-medium mb-2">
                        {contact.priority}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <CardDescription className="text-base mb-6 leading-relaxed">
                        {contact.description}
                      </CardDescription>
                      <Button 
                        asChild 
                        className="w-full group-hover:scale-105 transition-transform duration-300 bg-blue-600 hover:bg-blue-700"
                        size="lg"
                      >
                        <Link 
                          href={contact.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center justify-center space-x-2"
                        >
                          <span>Contact for Business</span>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Business Exclusive Notice */}
            <Card className="border-2 border-blue-200 bg-blue-50/50">
              <CardContent className="p-6 text-center">
                <div className="flex items-center justify-center mb-3">
                  <Building className="h-6 w-6 text-blue-600 mr-2" />
                  <span className="font-semibold text-blue-800">Business Exclusive Channels</span>
                </div>
                <p className="text-blue-700 text-sm">
                  Our business Telegram and email are exclusively for professional inquiries, partnerships,
                  and bulk orders. For general customer support, please use our social media channels below.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Business Opportunities Section */}
          <div className="mb-12">
            <div className="text-center mb-8">
              <div className="flex items-center justify-center mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Business Opportunities
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Discover partnership opportunities with Foryoupiece. We're open to collaborations,
                bulk purchases, and innovative business ventures.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {businessOpportunities.map((opportunity) => {
                const IconComponent = opportunity.icon
                return (
                  <Card key={opportunity.title} className="group hover:shadow-lg transition-all duration-300 border-2 hover:border-green-300">
                    <CardHeader className="pb-4">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                          <IconComponent className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{opportunity.title}</CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <CardDescription className="text-base mb-4 leading-relaxed">
                        {opportunity.description}
                      </CardDescription>
                      <ul className="space-y-2">
                        {opportunity.benefits.map((benefit, index) => (
                          <li key={index} className="flex items-center space-x-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                            <span>{benefit}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Business Opportunities CTA */}
            <Card className="border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
              <CardContent className="p-8 text-center">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center">
                    <Handshake className="h-8 w-8 text-white" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4">
                  Ready to Partner with Us?
                </h3>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-6">
                  We're always looking for new business opportunities and partnerships.
                  Contact our business team to discuss how we can work together.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button asChild size="lg" className="bg-green-600 hover:bg-green-700">
                    <Link href="https://t.me/foryoupiececreator" target="_blank" rel="noopener noreferrer">
                      <Send className="h-4 w-4 mr-2" />
                      Contact via Telegram
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="border-green-600 text-green-600 hover:bg-green-50">
                    <Link href="mailto:support@foryoupiece.com" target="_blank" rel="noopener noreferrer">
                      <Mail className="h-4 w-4 mr-2" />
                      Send Business Email
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator className="my-12" />

          {/* General Support Section */}
          <div className="mb-12">
            <div className="text-center mb-8">
              <div className="flex items-center justify-center mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                General Customer Support
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Need help with your order, have product questions, or need general assistance?
                Our customer support team is here to help through these channels.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {generalSupportChannels.map((channel) => {
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
                            <CardTitle className="text-lg">{channel.name}</CardTitle>
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
                          <span>Get Support</span>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Important Notice */}
          <Card className="mb-12 border-2 border-orange-200 bg-orange-50/50">
            <CardContent className="p-6 text-center">
              <div className="flex items-center justify-center mb-3">
                <MessageCircle className="h-6 w-6 text-orange-600 mr-2" />
                <span className="font-semibold text-orange-800">Important Notice</span>
              </div>
              <p className="text-orange-700 text-sm">
                <strong>Business inquiries sent to general support channels may experience delays.</strong>
                For fastest response on partnerships and bulk orders, please use our dedicated business contacts above.
              </p>
            </CardContent>
          </Card>

          {/* Contact Summary */}
          <Card className="bg-gradient-to-r from-primary/5 to-secondary/5 border-2 border-dashed border-primary/20">
            <CardContent className="p-8 text-center">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-primary to-secondary rounded-2xl flex items-center justify-center">
                  <Globe className="h-8 w-8 text-white" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-4">
                We're Here to Help
              </h3>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed mb-6">
                Whether you're looking to partner with us, place bulk orders, or need customer support,
                we're committed to providing excellent service and building lasting relationships.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center justify-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Professional Service</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Fast Response Times</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Flexible Partnerships</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
