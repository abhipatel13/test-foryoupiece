'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import PointsManagement from '@/components/admin/points-management'
import PointsResetCountdown from '@/components/admin/points-reset-countdown'
import { 
  Crown, 
  Clock, 
  Settings, 
  TrendingUp,
  Users,
  Award
} from 'lucide-react'

export default function AdminPointsPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Crown className="h-8 w-8 text-yellow-600" />
            Points Management System
          </h1>
          <p className="text-gray-600 mt-2">
            Comprehensive loyalty points administration and annual reset management
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Award className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Points System</p>
                <p className="text-lg font-semibold">1000 pts = $1</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Earning Rate</p>
                <p className="text-lg font-semibold">10 pts/$1</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Tier System</p>
                <p className="text-lg font-semibold">5 Levels</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Clock className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Reset Cycle</p>
                <p className="text-lg font-semibold">Annual</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tier Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Loyalty Tier System
          </CardTitle>
          <CardDescription>
            User ranking tiers based on lifetime points earned
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { name: 'Bronze', icon: '🥉', points: '0+', color: 'bg-amber-50 border-amber-200' },
              { name: 'Silver', icon: '🥈', points: '5,000+', color: 'bg-gray-50 border-gray-200' },
              { name: 'Gold', icon: '🥇', points: '15,000+', color: 'bg-yellow-50 border-yellow-200' },
              { name: 'Platinum', icon: '💎', points: '35,000+', color: 'bg-purple-50 border-purple-200' },
              { name: 'Diamond', icon: '💠', points: '50,000+', color: 'bg-blue-50 border-blue-200' }
            ].map((tier) => (
              <div key={tier.name} className={`p-4 rounded-lg border-2 ${tier.color}`}>
                <div className="text-center">
                  <div className="text-2xl mb-2">{tier.icon}</div>
                  <h3 className="font-semibold">{tier.name}</h3>
                  <p className="text-sm text-gray-600">{tier.points} points</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="management" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="management" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Points Management
          </TabsTrigger>
          <TabsTrigger value="reset" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Annual Reset
          </TabsTrigger>
        </TabsList>

        <TabsContent value="management">
          <PointsManagement />
        </TabsContent>

        <TabsContent value="reset">
          <PointsResetCountdown />
        </TabsContent>
      </Tabs>
    </div>
  )
}
