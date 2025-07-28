'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Shield, Mail, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface Admin2FAFormProps {
  sessionToken: string
  email: string
  onVerificationSuccess: (userData: any) => void
  onBack: () => void
}

export default function Admin2FAForm({ 
  sessionToken, 
  email, 
  onVerificationSuccess, 
  onBack 
}: Admin2FAFormProps) {
  const [verificationCode, setVerificationCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [timeLeft, setTimeLeft] = useState(600) // 10 minutes
  const [canResend, setCanResend] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Countdown timer
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timer)
    } else {
      setCanResend(true)
    }
  }, [timeLeft])

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Handle input change for verification code
  const handleInputChange = (index: number, value: string) => {
    if (value.length > 1) return // Only allow single digit

    const newCode = verificationCode.split('')
    newCode[index] = value
    const updatedCode = newCode.join('')
    
    setVerificationCode(updatedCode)
    setError('')

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all 6 digits are entered
    if (updatedCode.length === 6 && !updatedCode.includes('')) {
      handleVerification(updatedCode)
    }
  }

  // Handle backspace
  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  // Handle paste
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    setVerificationCode(pastedData)
    
    if (pastedData.length === 6) {
      handleVerification(pastedData)
    }
  }

  const handleVerification = async (code?: string) => {
    const codeToVerify = code || verificationCode
    
    if (codeToVerify.length !== 6) {
      setError('Please enter the complete 6-digit verification code')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/2fa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionToken,
          verificationCode: codeToVerify
        })
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        setError(result.error || 'Verification failed')
        toast.error(result.error || 'Verification failed')
        return
      }

      toast.success('Two-factor authentication successful!')
      onVerificationSuccess(result.user)
    } catch (error) {
      console.error('2FA verification error:', error)
      setError('An unexpected error occurred')
      toast.error('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    setResendLoading(true)
    setError('')

    try {
      // For resending, we would need to implement a resend endpoint
      // For now, we'll show a message to the user
      toast.info('Please contact your administrator to resend the verification code')
      setCanResend(false)
      setTimeLeft(600) // Reset timer
    } catch (error) {
      console.error('Resend code error:', error)
      setError('Failed to resend verification code')
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
          <Shield className="h-6 w-6 text-blue-600" />
        </div>
        <CardTitle className="text-2xl font-bold text-gray-900">Two-Factor Authentication</CardTitle>
        <CardDescription>
          We've sent a 6-digit verification code to your email address
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
            <Mail className="h-4 w-4" />
            <span>{email}</span>
          </div>
          <p className="text-xs text-gray-500">
            Check your inbox for the verification code
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <Label className="text-sm font-medium text-gray-700 block text-center">
            Enter Verification Code
          </Label>
          
          <div className="flex justify-center space-x-2">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <Input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                className="w-12 h-12 text-center text-lg font-semibold"
                value={verificationCode[index] || ''}
                onChange={(e) => handleInputChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                disabled={loading}
                autoComplete="off"
              />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <Button
            onClick={() => handleVerification()}
            className="w-full"
            disabled={loading || verificationCode.length !== 6}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Verifying...
              </>
            ) : (
              <>
                Verify Code
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>

          <div className="text-center space-y-2">
            <p className="text-sm text-gray-600">
              Code expires in: <span className="font-mono font-semibold">{formatTime(timeLeft)}</span>
            </p>
            
            {canResend ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResendCode}
                disabled={resendLoading}
                className="text-blue-600 hover:text-blue-700"
              >
                {resendLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Resending...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Resend Code
                  </>
                )}
              </Button>
            ) : (
              <p className="text-xs text-gray-500">
                Didn't receive the code? You can request a new one when the timer expires.
              </p>
            )}
          </div>

          <Button
            variant="ghost"
            onClick={onBack}
            className="w-full"
            disabled={loading}
          >
            Back to Login
          </Button>
        </div>

        {/* Security Notice */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <div className="flex">
            <Shield className="h-4 w-4 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
            <div className="text-xs text-yellow-700">
              <p className="font-medium">Security Notice</p>
              <p>This verification code is required for admin access from new IP addresses. Never share this code with anyone.</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
