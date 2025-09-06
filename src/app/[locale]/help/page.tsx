'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Video, 
  Instagram, 
  Facebook, 
  Send, 
  MessageCircle, 
  HeadphonesIcon, 
  Clock, 
  Users,
  Sparkles,
  ArrowRight,
  ExternalLink
} from 'lucide-react'
import Link from 'next/link'

export default function HelpCenterPage() {
  const socialMediaChannels = [
    {
      name: 'TikTok',
      icon: Video,
      url: 'https://www.tiktok.com/@foryoupiece.select',
      description: 'Follow us for product updates, tutorials, and exclusive content',
      color: 'bg-black text-white hover:bg-gray-800',
      badge: 'Video Content'
    },
    {
      name: 'Instagram',
      icon: Instagram,
      url: 'https://www.instagram.com/foryoupiece.select/',
      description: 'See our latest products, customer reviews, and behind-the-scenes content',
      color: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600',
      badge: 'Visual Updates'
    },
    {
      name: 'Facebook',
      icon: Facebook,
      url: 'https://www.facebook.com/foryoupiece.select',
      description: 'Join our community for discussions, support, and product announcements',
      color: 'bg-blue-600 text-white hover:bg-blue-700',
      badge: 'Community'
    },
    {
      name: 'Telegram',
      icon: Send,
      url: 'https://t.me/m/zDsQTcg4MDJl',
      description: 'Get instant support and real-time assistance from our team',
      color: 'bg-blue-500 text-white hover:bg-blue-600',
      badge: 'Live Support'
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
                <HeadphonesIcon className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Help Center
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              We're here to help you with any questions or concerns. Connect with us through your preferred social media platform for personalized support.
            </p>
          </div>

          {/* Main Support Message */}
          <Card className="mb-12 border-2 border-primary/20 bg-primary/5">
            <CardContent className="p-8 text-center">
              <div className="flex items-center justify-center mb-4">
                <MessageCircle className="h-12 w-12 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                Get Support Through Social Media
              </h2>
              <p className="text-muted-foreground text-lg mb-6 max-w-2xl mx-auto">
                Our dedicated support team is active across all our social media channels. 
                Choose your preferred platform below to get quick, personalized assistance with your orders, 
                product questions, or any other inquiries.
              </p>
              <div className="flex items-center justify-center space-x-6 text-sm text-muted-foreground">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4" />
                  <span>Fast Response</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4" />
                  <span>Expert Team</span>
                </div>
                <div className="flex items-center space-x-2">
                  <HeadphonesIcon className="h-4 w-4" />
                  <span>24/7 Available</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Social Media Channels Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {socialMediaChannels.map((channel) => {
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

          {/* Additional Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                  <span>Response Times</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Telegram</span>
                  <Badge variant="outline" className="text-green-600 border-green-200">
                    Instant
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Instagram DM</span>
                  <Badge variant="outline" className="text-blue-600 border-blue-200">
                    Within 1 hour
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Facebook</span>
                  <Badge variant="outline" className="text-purple-600 border-purple-200">
                    Within 2 hours
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">TikTok</span>
                  <Badge variant="outline" className="text-gray-600 border-gray-200">
                    Within 4 hours
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-green-500" />
                  <span>What We Can Help With</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    <span>Order status and tracking</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    <span>Product information and recommendations</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    <span>Account and profile assistance</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    <span>Loyalty points and rewards</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    <span>Shipping and delivery questions</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    <span>Returns and exchanges</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <Separator className="my-12" />

          {/* Coming Soon Section */}
          <Card className="bg-gradient-to-r from-primary/5 to-secondary/5 border-2 border-dashed border-primary/20">
            <CardContent className="p-8 text-center">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-primary to-secondary rounded-2xl flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-4">
                Coming Soon: Foryoupiece AI
              </h3>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
                We're developing an intelligent AI assistant that will provide instant, 24/7 support right here on our website. 
                Get ready for even faster responses and personalized help with your shopping experience.
              </p>
              <Badge variant="outline" className="mt-4 text-primary border-primary">
                In Development
              </Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
