'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  TrendingUp, 
  Package, 
  ShoppingCart, 
  Users, 
  DollarSign,
  Eye,
  AlertCircle,
  CheckCircle
} from 'lucide-react'

export default function AdminDashboard() {
  const router = useRouter()
  const params = useParams()
  const locale = (params as any).locale || 'en'

  useEffect(() => {
    // Redirect to the secured admin path
    router.replace(`/${locale}/fyponly-admin`)
  }, [router, locale])

  return null
}
}
