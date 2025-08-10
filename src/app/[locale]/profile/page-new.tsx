'use client'

export const dynamic = 'force-dynamic'

import { useTranslations } from 'next-intl'
import { useSSRSafeAuth } from '@/lib/hooks/use-ssr-safe-auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getCorrectUserTier, getTierStyling } from '@/lib/utils'
import Link from 'next/link'

export default function ProfilePage() {
  const t = useTranslations('profile')
  const { user, profile, isAuthenticated, loading } = useSSRSafeAuth()

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading...</div>
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

        <Card role="region" aria-labelledby="profile-info-title" className="lg:max-w-2xl lg:mx-auto">
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
            <div className="text-center">
              <p>Profile page is working with tier display!</p>
              <p>Current tier: {profile ? getCorrectUserTier(profile) : 'N/A'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
