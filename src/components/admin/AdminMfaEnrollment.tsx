'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Shield, Smartphone, QrCode } from 'lucide-react'
import { toast } from 'sonner'

interface AdminMfaEnrollmentProps {
  user: any
  onEnrollmentSuccess: () => void
  onBack: () => void
}

export default function AdminMfaEnrollment({ user, onEnrollmentSuccess, onBack }: AdminMfaEnrollmentProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'setup' | 'verify'>('setup')
  const [enrollmentData, setEnrollmentData] = useState<any>(null)
  const [verificationCode, setVerificationCode] = useState('')

  const handleEnrollment = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/mfa/enroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        setError(result.error || 'Failed to set up MFA')
        return
      }

      setEnrollmentData(result)
      setStep('verify')
      toast.success('MFA setup initiated. Please scan the QR code.')

    } catch (err: any) {
      setError(err.message || 'Failed to set up MFA')
    } finally {
      setLoading(false)
    }
  }

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // First create a challenge
      const challengeResponse = await fetch('/api/admin/mfa/challenge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          factorId: enrollmentData.factorId
        })
      })

      const challengeResult = await challengeResponse.json()

      if (!challengeResponse.ok || !challengeResult.success) {
        setError(challengeResult.error || 'Failed to create challenge')
        return
      }

      // Then verify the code
      const verifyResponse = await fetch('/api/admin/mfa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          factorId: enrollmentData.factorId,
          challengeId: challengeResult.challengeId,
          code: verificationCode
        })
      })

      const verifyResult = await verifyResponse.json()

      if (!verifyResponse.ok || !verifyResult.success) {
        setError(verifyResult.error || 'Invalid verification code')
        return
      }

      toast.success('MFA setup completed successfully!')
      onEnrollmentSuccess()

    } catch (err: any) {
      setError(err.message || 'Failed to verify code')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'setup') {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <Shield className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle>Set Up Multi-Factor Authentication</CardTitle>
          <CardDescription>
            Secure your admin account with an additional layer of protection
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-4 border rounded-lg">
              <Smartphone className="h-5 w-5 text-gray-500" />
              <div>
                <p className="font-medium">Authenticator App</p>
                <p className="text-sm text-gray-500">
                  Use Google Authenticator, Authy, or similar apps
                </p>
              </div>
            </div>

            <div className="text-sm text-gray-600">
              <p className="mb-2">You'll need to:</p>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>Install an authenticator app on your phone</li>
                <li>Scan the QR code that will be displayed</li>
                <li>Enter the 6-digit code from your app</li>
              </ol>
            </div>
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
              onClick={handleEnrollment}
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Setting up...' : 'Set Up MFA'}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
          <QrCode className="h-6 w-6 text-blue-600" />
        </div>
        <CardTitle>Scan QR Code</CardTitle>
        <CardDescription>
          Scan this QR code with your authenticator app
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {enrollmentData?.qrCode && (
          <div className="flex justify-center">
            <div className="p-4 bg-white border rounded-lg">
              <Image
                src={enrollmentData.qrCode}
                alt="MFA QR Code"
                width={200}
                height={200}
                className="mx-auto"
                unoptimized={true} // QR codes should not be optimized
              />
            </div>
          </div>
        )}

        <div className="text-center">
          <p className="text-sm text-gray-600 mb-2">
            Can't scan? Enter this code manually:
          </p>
          <code className="text-xs bg-gray-100 px-2 py-1 rounded break-all">
            {enrollmentData?.secret}
          </code>
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
              required
            />
          </div>

          <div className="flex space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep('setup')}
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
              {loading ? 'Verifying...' : 'Verify & Complete'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
