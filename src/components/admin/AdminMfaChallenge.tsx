'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Shield, Smartphone } from 'lucide-react'
import { toast } from 'sonner'

interface AdminMfaChallengeProps {
  user: any
  factors: any
  onChallengeSuccess: () => void
  onBack: () => void
}

export default function AdminMfaChallenge({ user, factors, onChallengeSuccess, onBack }: AdminMfaChallengeProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [challengeId, setChallengeId] = useState<string | null>(null)

  // Get the first TOTP factor
  const totpFactor = factors?.totp?.[0]

  const handleCreateChallenge = async () => {
    if (!totpFactor) {
      setError('No MFA factor found')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/mfa/challenge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          factorId: totpFactor.id
        })
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        setError(result.error || 'Failed to create challenge')
        return
      }

      setChallengeId(result.challengeId)
      toast.success('Please enter your 6-digit code')

    } catch (err: any) {
      setError(err.message || 'Failed to create challenge')
    } finally {
      setLoading(false)
    }
  }

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!challengeId) {
      await handleCreateChallenge()
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/mfa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          factorId: totpFactor.id,
          challengeId: challengeId,
          code: verificationCode
        })
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        setError(result.error || 'Invalid verification code')
        return
      }

      toast.success('Authentication successful!')
      onChallengeSuccess()

    } catch (err: any) {
      setError(err.message || 'Failed to verify code')
    } finally {
      setLoading(false)
    }
  }

  // Auto-create challenge on component mount
  useState(() => {
    if (totpFactor && !challengeId) {
      handleCreateChallenge()
    }
  })

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
          <Shield className="h-6 w-6 text-blue-600" />
        </div>
        <CardTitle>Multi-Factor Authentication</CardTitle>
        <CardDescription>
          Enter the 6-digit code from your authenticator app
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center space-x-3 p-4 border rounded-lg bg-gray-50">
          <Smartphone className="h-5 w-5 text-gray-500" />
          <div>
            <p className="font-medium">Authenticator App</p>
            <p className="text-sm text-gray-500">
              {totpFactor?.friendly_name || 'Admin Authenticator'}
            </p>
          </div>
        </div>

        <form onSubmit={handleVerification} className="space-y-4">
          <div>
            <Label htmlFor="code">Verification Code</Label>
            <Input
              id="code"
              type="text"
              placeholder="Enter 6-digit code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              maxLength={6}
              pattern="[0-9]{6}"
              className="text-center text-lg tracking-widest"
              required
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">
              Open your authenticator app and enter the current 6-digit code
            </p>
          </div>

          <div className="flex space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              className="flex-1"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              type="submit"
              disabled={loading || verificationCode.length !== 6}
              className="flex-1"
            >
              {loading ? 'Verifying...' : 'Verify Code'}
            </Button>
          </div>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={handleCreateChallenge}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
            disabled={loading}
          >
            Refresh challenge
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
