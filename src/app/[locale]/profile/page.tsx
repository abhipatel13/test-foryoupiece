'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useSSRSafeAuth } from '@/lib/hooks/use-ssr-safe-auth'
import { orderQueries } from '@/lib/supabase/queries'
import { authFetch } from '@/lib/utils/auth-interceptor'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, Bell } from 'lucide-react'
import { toast } from 'sonner';

// Import the refactored child components
import { ProfileInfoCard } from './_components/ProfileInfoCard'
import { RecentOrdersList } from './_components/RecentOrdersList'
import { ProfileNotifications } from './_components/ProfileNotifications'

import { RedesignedPointsWrapper } from '@/components/user/redesigned-points-wrapper'
import { RewardsCouponsSection } from '@/components/user/rewards-coupons-section'
import { ChangePasswordDialog } from '@/components/auth/ChangePasswordDialog'

// Type definitions
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
  const t = useTranslations('profile');
  const { user, profile, isAuthenticated, loading: authLoading, updateProfile } = useSSRSafeAuth();
  const searchParams = useSearchParams();

  // State for data fetched in parallel
  const [initialData, setInitialData]   = useState<{ orders: Order[]; notifications: any } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // --- PERFORMANCE: Parallel Data Fetching ---
  // REASONING: Fetches all essential data for the page in a single batch,
  // preventing a network waterfall and speeding up the perceived load time.
  const loadProfileData = useCallback(async () => {
    if (!user?.id) {
        setIsLoading(false);
        return;
    }

    setIsLoading(true);
    try {
      const [userOrders, notificationsData] = await Promise.all([
        orderQueries.getUserOrders(user.id, 5),
        authFetch(`/api/user/notifications?limit=7&offset=0`).then(res => res.json()).catch(() => null)
      ]);
      setInitialData({ orders: userOrders, notifications: notificationsData });
    } catch (error) {
      Sentry.captureException(error);
      toast.error("Failed to load your profile data.");
      setInitialData({ orders: [], notifications: null });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);
  
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
        loadProfileData();
    } else if (!authLoading && !isAuthenticated) {
        setIsLoading(false);
    }
  }, [authLoading, isAuthenticated, loadProfileData]);
  
  // Effect for scrolling to #notifications hash
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.location.hash === '#notifications') {
      setTimeout(() => {
        const el = document.getElementById('notifications')
        if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' })
      }, 0)
    }
  }, []);

  // ... (Other effects like Telegram login can remain here if they are page-specific)


  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-8 w-48" /><div className="grid grid-cols-1 md:grid-cols-3 gap-6"><Skeleton className="h-64" /><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight mb-4">Please log in to view your profile</h1>
          <Link href="/en/auth/login"><Button className="min-h-[44px]">Login</Button></Link>
        </div>
      </div>
    );
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
          {/* Child Component for Profile Info */}
          <ProfileInfoCard profile={profile} updateProfile={updateProfile} />
          
          <div className="lg:col-span-2 space-y-4">
            <RedesignedPointsWrapper userId={user?.id} />
            <RewardsCouponsSection userId={user?.id} userProfile={profile} />
            
            {/* Child Component for Recent Orders */}
            <RecentOrdersList orders={initialData?.orders || []} isLoading={isLoading} />

            {/* Child Component for Notifications */}
            <ProfileNotifications initialData={initialData?.notifications} userId={user?.id} />
            
            <Card role="region" aria-label="Account Security">
              <CardHeader className="pb-4 h-[120px] sm:h-auto">
                <CardTitle className="text-lg flex items-center"><Shield className="h-5 w-5 mr-2" />Account Security</CardTitle>
                <CardDescription>Manage your security settings and preferences</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <ChangePasswordDialog><Button className="min-h-[44px] flex-1 sm:flex-none"><Shield className="h-4 w-4 mr-2" />Change Password</Button></ChangePasswordDialog>
                    <Link href="/en/auth/sessions"><Button variant="outline" className="min-h-[44px] w-full sm:w-auto"><Bell className="h-4 w-4 mr-2" />Active Sessions</Button></Link>
                  </div>
                  <div className="text-sm text-gray-600"><p>Keep your account secure by using a strong password and monitoring active sessions.</p></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}