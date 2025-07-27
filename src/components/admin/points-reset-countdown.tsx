'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Clock, 
  AlertTriangle, 
  RefreshCw, 
  Calendar,
  Users,
  TrendingDown,
  History,
  Crown,
  CheckCircle
} from 'lucide-react'
import { toast } from 'sonner'

interface ResetInfo {
  nextResetDate: string
  timeUntilReset: string
  timeComponents: {
    days: number
    hours: number
    minutes: number
    seconds: number
    totalSeconds: number
  } | null
  currentYearReset: any
  resetHistory: any[]
  canPerformManualReset: boolean
  resetStats: {
    totalResets: number
    lastResetDate: string | null
    lastResetUsersAffected: number
    lastResetPointsReset: number
  }
}

export default function PointsResetCountdown() {
  const [resetInfo, setResetInfo] = useState<ResetInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [countdown, setCountdown] = useState<{
    days: number
    hours: number
    minutes: number
    seconds: number
  } | null>(null)
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [isRankLifetimeResetDialogOpen, setIsRankLifetimeResetDialogOpen] = useState(false)
  const [isRankLifetimeResetting, setIsRankLifetimeResetting] = useState(false)

  // Load reset information
  const loadResetInfo = async () => {
    try {
      const response = await fetch('/api/admin/points/reset')
      const data = await response.json()
      
      if (data.success) {
        setResetInfo(data.data)
      } else {
        toast.error('Failed to load reset information')
      }
    } catch (error) {
      console.error('Reset info load error:', error)
      toast.error('Failed to load reset information')
    } finally {
      setIsLoading(false)
    }
  }

  // Perform manual reset
  const performManualReset = async () => {
    setIsResetting(true)
    try {
      const response = await fetch('/api/admin/points/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          confirmReset: true,
          resetType: 'manual'
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success(
          `Points reset successful! ${data.data.usersAffected} users affected, ${data.data.totalPointsReset.toLocaleString()} points reset.`
        )
        setIsResetDialogOpen(false)
        loadResetInfo() // Reload info
      } else {
        toast.error(data.error || 'Failed to reset points')
      }
    } catch (error) {
      console.error('Reset error:', error)
      toast.error('Failed to reset points')
    } finally {
      setIsResetting(false)
    }
  }

  // Perform rank and lifetime points reset
  const performRankLifetimeReset = async () => {
    setIsRankLifetimeResetting(true)
    try {
      const response = await fetch('/api/admin/points/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          confirmReset: true,
          resetType: 'admin_rank'
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success(
          `Rank & Lifetime Points reset successful! ${data.data.usersAffected} users affected, ${data.data.totalPointsReset.toLocaleString()} lifetime points reset. Usable points preserved.`
        )
        setIsRankLifetimeResetDialogOpen(false)
        loadResetInfo() // Reload info
      } else {
        toast.error(data.error || 'Failed to reset ranks and lifetime points')
      }
    } catch (error) {
      console.error('Rank lifetime reset error:', error)
      toast.error('Failed to reset ranks and lifetime points')
    } finally {
      setIsRankLifetimeResetting(false)
    }
  }

  // Update countdown every second
  useEffect(() => {
    if (!resetInfo?.timeComponents) return

    const updateCountdown = () => {
      const now = new Date().getTime()
      const resetDate = new Date(resetInfo.nextResetDate).getTime()
      const timeLeft = resetDate - now

      if (timeLeft > 0) {
        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24))
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000)

        setCountdown({ days, hours, minutes, seconds })
      } else {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 })
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)

    return () => clearInterval(interval)
  }, [resetInfo])

  // Load initial data
  useEffect(() => {
    loadResetInfo()
  }, [])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getCountdownColor = () => {
    if (!countdown) return 'text-gray-600'
    
    const totalDays = countdown.days
    if (totalDays <= 7) return 'text-red-600'
    if (totalDays <= 30) return 'text-amber-600'
    return 'text-green-600'
  }

  const getCountdownBgColor = () => {
    if (!countdown) return 'bg-gray-50'
    
    const totalDays = countdown.days
    if (totalDays <= 7) return 'bg-red-50 border-red-200'
    if (totalDays <= 30) return 'bg-amber-50 border-amber-200'
    return 'bg-green-50 border-green-200'
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Clock className="h-6 w-6 animate-spin mr-2" />
            Loading reset information...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!resetInfo) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            Failed to load reset information
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Countdown Timer */}
      <Card className={`border-2 ${getCountdownBgColor()}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Annual Points Reset Countdown
          </CardTitle>
          <CardDescription>
            All user points will be reset to 0 on January 1st, {new Date().getFullYear() + 1}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {countdown && (
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Days', value: countdown.days },
                { label: 'Hours', value: countdown.hours },
                { label: 'Minutes', value: countdown.minutes },
                { label: 'Seconds', value: countdown.seconds }
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <div className={`text-3xl font-bold ${getCountdownColor()}`}>
                    {item.value.toString().padStart(2, '0')}
                  </div>
                  <div className="text-sm text-gray-600">{item.label}</div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>Next Reset: {formatDate(resetInfo.nextResetDate)}</span>
            </div>
            {resetInfo.currentYearReset && (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-green-600">
                  Points already reset this year on {formatDate(resetInfo.currentYearReset.reset_date)}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reset Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <History className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{resetInfo.resetStats.totalResets}</p>
                <p className="text-sm text-gray-600">Total Resets</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {resetInfo.resetStats.lastResetUsersAffected.toLocaleString()}
                </p>
                <p className="text-sm text-gray-600">Users Affected (Last)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {resetInfo.resetStats.lastResetPointsReset.toLocaleString()}
                </p>
                <p className="text-sm text-gray-600">Points Reset (Last)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Manual Reset */}
      {resetInfo.canPerformManualReset && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <Crown className="h-5 w-5" />
              Manual Reset (Super Admin Only)
            </CardTitle>
            <CardDescription className="text-amber-700">
              Perform an immediate points reset for all users. This action cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-100">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Perform Manual Reset
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-5 w-5" />
                    Confirm Manual Points Reset
                  </DialogTitle>
                  <DialogDescription>
                    This will immediately reset ALL user points to 0 and set all user tiers to Bronze.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <Alert className="border-red-200 bg-red-50">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      <strong>WARNING:</strong> This action is irreversible and will affect all users immediately.
                      All points balances will be set to 0 and user ranks will be reset to Bronze.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2 text-sm">
                    <p><strong>This action will:</strong></p>
                    <ul className="list-disc list-inside space-y-1 text-gray-600">
                      <li>Reset all user points balances to 0</li>
                      <li>Set all user tiers to Bronze</li>
                      <li>Create a reset history record</li>
                      <li>Log the action for audit purposes</li>
                      <li>Cannot be undone</li>
                    </ul>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsResetDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={performManualReset} 
                    disabled={isResetting}
                  >
                    {isResetting ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Confirm Reset
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}

      {/* Admin Rank & Lifetime Points Reset */}
      {resetInfo.canPerformManualReset && (
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-800">
              <Crown className="h-5 w-5" />
              Reset All User Ranks & Lifetime Points Tracking
            </CardTitle>
            <CardDescription className="text-purple-700">
              Reset all user ranks to Bronze and reset lifetime points tracking to 0.
              <strong className="text-purple-900"> Usable points balances are preserved.</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={isRankLifetimeResetDialogOpen} onOpenChange={setIsRankLifetimeResetDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-purple-300 text-purple-800 hover:bg-purple-100">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reset All User Ranks & Lifetime Points Tracking (and change the name to Annually accumulated points)
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-purple-600">
                    <AlertTriangle className="h-5 w-5" />
                    Confirm Rank & Lifetime Points Reset
                  </DialogTitle>
                  <DialogDescription>
                    This will reset all user ranks to Bronze and reset lifetime points tracking to 0, while preserving usable points balances.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <Alert className="border-purple-200 bg-purple-50">
                    <AlertTriangle className="h-4 w-4 text-purple-600" />
                    <AlertDescription className="text-purple-800">
                      <strong>IMPORTANT:</strong> This action resets rank progression but preserves user spending power.
                      Users keep their usable points but lose their tier status and lifetime accumulation tracking.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2 text-sm">
                    <p><strong>This action will:</strong></p>
                    <ul className="list-disc list-inside space-y-1 text-gray-600">
                      <li>Reset all user tiers to Bronze</li>
                      <li>Reset all lifetime points earned tracking to 0</li>
                      <li><strong className="text-green-600">PRESERVE all usable points balances</strong></li>
                      <li>Create a reset history record for audit</li>
                      <li>Log the action with admin details</li>
                      <li>Cannot be undone</li>
                    </ul>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-green-800">
                      <strong>✓ Safe for users:</strong> This reset preserves all usable points that users can spend,
                      only resetting their rank progression and lifetime accumulation tracking.
                    </p>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsRankLifetimeResetDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="default"
                    onClick={performRankLifetimeReset}
                    disabled={isRankLifetimeResetting}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {isRankLifetimeResetting ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      <>
                        <Crown className="h-4 w-4 mr-2" />
                        Confirm Reset
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}

      {/* Reset History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Reset History
          </CardTitle>
          <CardDescription>
            Previous points reset events
          </CardDescription>
        </CardHeader>
        <CardContent>
          {resetInfo.resetHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No reset history found
            </div>
          ) : (
            <div className="space-y-4">
              {resetInfo.resetHistory.map((reset) => (
                <div key={reset.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={reset.reset_type === 'manual' ? 'destructive' : 'secondary'}>
                        {reset.reset_type === 'manual' ? 'Manual' : 'Annual'}
                      </Badge>
                      <span className="font-medium">Year {reset.reset_year}</span>
                    </div>
                    <span className="text-sm text-gray-600">
                      {formatDate(reset.reset_date)}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Users Affected:</span>
                      <span className="ml-2 font-medium">
                        {reset.total_users_affected.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Points Reset:</span>
                      <span className="ml-2 font-medium">
                        {reset.total_points_reset.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {reset.admin && (
                    <div className="mt-2 text-sm text-gray-600">
                      Reset by: {reset.admin.first_name} {reset.admin.last_name} ({reset.admin.email})
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
