'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  TestTube, 
  Plus, 
  RotateCcw, 
  Target, 
  Award, 
  Gift, 
  Truck, 
  Star,
  Crown,
  Gem,
  AlertTriangle,
  CheckCircle,
  Loader2
} from 'lucide-react'
import { authFetch } from '@/lib/utils/auth-interceptor'
import { toast } from 'sonner'
import { getTierStyling } from '@/lib/utils'

interface TierProgressionTesterProps {
  currentUser?: any
  onProgressUpdate?: () => void
}

export function TierProgressionTester({ currentUser, onProgressUpdate }: TierProgressionTesterProps) {
  const [loading, setLoading] = useState(false)
  const [pointsToAdd, setPointsToAdd] = useState('')
  const [targetTier, setTargetTier] = useState('')
  const [lastResult, setLastResult] = useState<any>(null)

  // Only show in development
  if (process.env.NODE_ENV === 'production') {
    return null
  }

  const handleAddPoints = async () => {
    const points = parseInt(pointsToAdd)
    if (!points || points <= 0) {
      toast.error('Please enter a valid number of points')
      return
    }

    setLoading(true)
    try {
      const response = await authFetch('/api/test/tier-progression', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'add_points',
          points
        })
      })

      const data = await response.json()
      
      if (data.success) {
        setLastResult(data.result)
        setPointsToAdd('')
        toast.success(`Added ${points} points successfully!`)
        
        if (data.result.tier_upgraded) {
          toast.success(`🎉 Tier upgraded from ${data.result.old_tier} to ${data.result.new_tier}!`)
        }
        
        onProgressUpdate?.()
      } else {
        toast.error(data.error || 'Failed to add points')
      }
    } catch (error) {
      console.error('Error adding points:', error)
      toast.error('Failed to add points')
    } finally {
      setLoading(false)
    }
  }

  const handleSetTier = async () => {
    if (!targetTier) {
      toast.error('Please select a target tier')
      return
    }

    setLoading(true)
    try {
      const response = await authFetch('/api/test/tier-progression', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'set_tier',
          targetTier
        })
      })

      const data = await response.json()
      
      if (data.success) {
        setLastResult(data.result)
        setTargetTier('')
        toast.success(`Set tier to ${data.result.target_tier} successfully!`)
        onProgressUpdate?.()
      } else {
        toast.error(data.error || 'Failed to set tier')
      }
    } catch (error) {
      console.error('Error setting tier:', error)
      toast.error('Failed to set tier')
    } finally {
      setLoading(false)
    }
  }

  const handleResetProgress = async () => {
    if (!confirm('Are you sure you want to reset all tier progress? This will delete all test rewards and reset to bronze tier.')) {
      return
    }

    setLoading(true)
    try {
      const response = await authFetch('/api/test/tier-progression', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'reset_progress'
        })
      })

      const data = await response.json()
      
      if (data.success) {
        setLastResult(data.result)
        toast.success('Progress reset successfully!')
        onProgressUpdate?.()
      } else {
        toast.error(data.error || 'Failed to reset progress')
      }
    } catch (error) {
      console.error('Error resetting progress:', error)
      toast.error('Failed to reset progress')
    } finally {
      setLoading(false)
    }
  }

  const getTierIcon = (tier: string) => {
    const icons = {
      bronze: <Award className="h-4 w-4 text-amber-600" />,
      silver: <Star className="h-4 w-4 text-gray-500" />,
      gold: <Crown className="h-4 w-4 text-yellow-500" />,
      platinum: <Gem className="h-4 w-4 text-purple-500" />,
      diamond: <Gem className="h-4 w-4 text-blue-500" />
    }
    return icons[tier as keyof typeof icons] || icons.bronze
  }

  const quickAddOptions = [
    { label: 'To Silver (5k)', points: 5000 },
    { label: 'To Gold (15k)', points: 15000 },
    { label: 'To Platinum (35k)', points: 35000 },
    { label: 'To Diamond (50k)', points: 50000 },
    { label: '+1k points', points: 1000 },
    { label: '+5k points', points: 5000 },
    { label: '+10k points', points: 10000 }
  ]

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-orange-800">
          <TestTube className="h-5 w-5" />
          <span>Tier Progression Tester</span>
          <Badge variant="outline" className="text-orange-600 border-orange-300">
            DEV ONLY
          </Badge>
        </CardTitle>
        <CardDescription className="text-orange-700">
          Test tier progression, rewards, and notifications in development environment
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <Alert className="border-orange-300 bg-orange-100">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            This testing interface is only available in development mode and will not appear in production.
          </AlertDescription>
        </Alert>

        {/* Current Status */}
        {currentUser && (
          <div className="p-4 bg-white rounded-lg border">
            <h4 className="font-medium mb-3">Current Status</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Current Tier:</span>
                <div className="flex items-center space-x-2 mt-1">
                  {getTierIcon(currentUser.tier_level || 'bronze')}
                  <Badge className={getTierStyling(currentUser.tier_level || 'bronze').badgeClass}>
                    {(currentUser.tier_level || 'bronze').toUpperCase()}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="text-gray-600">Total Points Earned:</span>
                <p className="font-medium">{(currentUser.total_points_earned || 0).toLocaleString()}</p>
              </div>
              <div>
                <span className="text-gray-600">Points Balance:</span>
                <p className="font-medium">{(currentUser.points_balance || 0).toLocaleString()}</p>
              </div>
              <div>
                <span className="text-gray-600">User ID:</span>
                <p className="font-mono text-xs">{currentUser.id}</p>
              </div>
            </div>
          </div>
        )}

        {/* Add Points */}
        <div className="space-y-4">
          <h4 className="font-medium flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Add Points</span>
          </h4>
          
          <div className="flex space-x-2">
            <div className="flex-1">
              <Label htmlFor="points">Points to Add</Label>
              <Input
                id="points"
                type="number"
                value={pointsToAdd}
                onChange={(e) => setPointsToAdd(e.target.value)}
                placeholder="Enter points amount"
                min="1"
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleAddPoints} 
                disabled={loading || !pointsToAdd}
                className="bg-green-600 hover:bg-green-700"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add Points
              </Button>
            </div>
          </div>

          {/* Quick Add Buttons */}
          <div className="flex flex-wrap gap-2">
            {quickAddOptions.map((option) => (
              <Button
                key={`${option.label}-${option.points}`}
                variant="outline"
                size="sm"
                onClick={() => setPointsToAdd(option.points.toString())}
                className="text-xs"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Set Tier Directly */}
        <div className="space-y-4">
          <h4 className="font-medium flex items-center space-x-2">
            <Target className="h-4 w-4" />
            <span>Set Tier Directly</span>
          </h4>
          
          <div className="flex space-x-2">
            <div className="flex-1">
              <Label htmlFor="tier">Target Tier</Label>
              <Select value={targetTier} onValueChange={setTargetTier}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bronze">Bronze (0 points)</SelectItem>
                  <SelectItem value="silver">Silver (5,000 points)</SelectItem>
                  <SelectItem value="gold">Gold (15,000 points)</SelectItem>
                  <SelectItem value="platinum">Platinum (35,000 points)</SelectItem>
                  <SelectItem value="diamond">Diamond (50,000 points)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleSetTier} 
                disabled={loading || !targetTier}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
                Set Tier
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        {/* Reset Progress */}
        <div className="space-y-4">
          <h4 className="font-medium flex items-center space-x-2">
            <RotateCcw className="h-4 w-4" />
            <span>Reset Progress</span>
          </h4>
          
          <Button 
            onClick={handleResetProgress} 
            disabled={loading}
            variant="destructive"
            className="w-full"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
            Reset to Bronze (Delete All Test Data)
          </Button>
        </div>

        {/* Last Result */}
        {lastResult && (
          <div className="p-4 bg-white rounded-lg border">
            <h4 className="font-medium mb-3 flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Last Action Result</span>
            </h4>
            <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto">
              {JSON.stringify(lastResult, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
