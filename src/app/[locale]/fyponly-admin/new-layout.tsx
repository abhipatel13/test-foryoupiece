'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useSSRSafeAuth } from '@/lib/hooks/use-ssr-safe-auth'
import { adminQueries } from '@/lib/supabase/admin-queries'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Eye, EyeOff, ArrowLeft, Shield, Mail, Smartphone, QrCode } from 'lucide-react'
import { toast } from 'sonner'

interface AdminLayoutProps {
  children: React.ReactNode
}

// MFA Enrollment Component
function MfaEnrollmentForm({ user, onSuccess, onBack }: any) {
  const [loading, setLoading] = useState(false)
  const [enrollmentType, setEnrollmentType] = useState<'phone' | 'totp' | null>(null)
  const [phone, setPhone] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [factorId, setFactorId] = useState('')
  const [challengeId, setChallengeId] = useState('')

  const handleEnrollPhone = async () => {
    if (!phone) {
      toast.error('Please enter a phone number')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/auth/mfa/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factorType: 'phone', phone })
      })

      const result = await response.json()
      if (result.success) {
        setFactorId(result.factor.id)
        toast.success(result.message)
        // Create challenge to send SMS
        await createChallenge(result.factor.id)
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      toast.error('Failed to enroll phone factor')
    } finally {
      setLoading(false)
    }
  }

  const handleEnrollTotp = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/auth/mfa/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factorType: 'totp' })
      })

      const result = await response.json()
      if (result.success) {
        setFactorId(result.factor.id)
        setQrCode(result.qrCode)
        setSecret(result.secret)
        toast.success(result.message)
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      toast.error('Failed to enroll TOTP factor')
    } finally {
      setLoading(false)
    }
  }

  const createChallenge = async (fId: string) => {
    try {
      const response = await fetch('/api/admin/auth/mfa/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factorId: fId })
      })

      const result = await response.json()
      if (result.success) {
        setChallengeId(result.challengeId)
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      toast.error('Failed to create MFA challenge')
    }
  }

  const handleVerifyCode = async () => {
    if (!verificationCode || !factorId || !challengeId) {
      toast.error('Please enter the verification code')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factorId, challengeId, code: verificationCode })
      })

      const result = await response.json()
      if (result.success) {
        toast.success(result.message)
        onSuccess(result.user)
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      toast.error('Failed to verify code')
    } finally {
      setLoading(false)
    }
  }

  if (!enrollmentType) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <Shield className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle>Setup Multi-Factor Authentication</CardTitle>
          <CardDescription>
            Admin accounts require MFA for enhanced security. Choose your preferred method:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => setEnrollmentType('phone')}
            className="w-full justify-start"
            variant="outline"
          >
            <Smartphone className="mr-2 h-4 w-4" />
            Phone SMS
          </Button>
          <Button
            onClick={() => setEnrollmentType('totp')}
            className="w-full justify-start"
            variant="outline"
          >
            <QrCode className="mr-2 h-4 w-4" />
            Authenticator App
          </Button>
          <Button onClick={onBack} variant="ghost" className="w-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Login
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (enrollmentType === 'phone') {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle>Phone SMS Setup</CardTitle>
          <CardDescription>
            {!factorId ? 'Enter your phone number to receive SMS codes' : 'Enter the code sent to your phone'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!factorId ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1234567890"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <Button onClick={handleEnrollPhone} disabled={loading} className="w-full">
                {loading ? 'Setting up...' : 'Send SMS Code'}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="123456"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                />
              </div>
              <Button onClick={handleVerifyCode} disabled={loading} className="w-full">
                {loading ? 'Verifying...' : 'Verify Code'}
              </Button>
            </>
          )}
          <Button onClick={() => setEnrollmentType(null)} variant="ghost" className="w-full">
            Back
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (enrollmentType === 'totp') {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle>Authenticator App Setup</CardTitle>
          <CardDescription>
            {!factorId ? 'Setting up authenticator app...' : 'Scan the QR code with your authenticator app'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!factorId ? (
            <Button onClick={handleEnrollTotp} disabled={loading} className="w-full">
              {loading ? 'Generating...' : 'Generate QR Code'}
            </Button>
          ) : (
            <>
              {qrCode && (
                <div className="text-center">
                  <img src={qrCode} alt="QR Code" className="mx-auto" />
                  <p className="text-sm text-gray-600 mt-2">Secret: {secret}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="123456"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                />
              </div>
              <Button onClick={handleVerifyCode} disabled={loading} className="w-full">
                {loading ? 'Verifying...' : 'Verify Code'}
              </Button>
            </>
          )}
          <Button onClick={() => setEnrollmentType(null)} variant="ghost" className="w-full">
            Back
          </Button>
        </CardContent>
      </Card>
    )
  }

  return null
}

// MFA Challenge Component
function MfaChallengeForm({ user, factors, onSuccess, onBack }: any) {
  const [loading, setLoading] = useState(false)
  const [selectedFactor, setSelectedFactor] = useState<any>(null)
  const [challengeId, setChallengeId] = useState('')
  const [verificationCode, setVerificationCode] = useState('')

  const createChallenge = async (factor: any) => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/auth/mfa/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factorId: factor.id })
      })

      const result = await response.json()
      if (result.success) {
        setChallengeId(result.challengeId)
        setSelectedFactor(factor)
        toast.success(result.message)
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      toast.error('Failed to create MFA challenge')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async () => {
    if (!verificationCode || !selectedFactor || !challengeId) {
      toast.error('Please enter the verification code')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          factorId: selectedFactor.id, 
          challengeId, 
          code: verificationCode 
        })
      })

      const result = await response.json()
      if (result.success) {
        toast.success(result.message)
        onSuccess(result.user)
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      toast.error('Failed to verify code')
    } finally {
      setLoading(false)
    }
  }

  if (!selectedFactor) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <Shield className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle>Multi-Factor Authentication</CardTitle>
          <CardDescription>
            Choose a verification method to continue:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {factors.phone?.map((factor: any) => (
            <Button
              key={factor.id}
              onClick={() => createChallenge(factor)}
              disabled={loading}
              className="w-full justify-start"
              variant="outline"
            >
              <Smartphone className="mr-2 h-4 w-4" />
              SMS to {factor.phone}
            </Button>
          ))}
          {factors.totp?.map((factor: any) => (
            <Button
              key={factor.id}
              onClick={() => createChallenge(factor)}
              disabled={loading}
              className="w-full justify-start"
              variant="outline"
            >
              <QrCode className="mr-2 h-4 w-4" />
              Authenticator App
            </Button>
          ))}
          <Button onClick={onBack} variant="ghost" className="w-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Login
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle>Enter Verification Code</CardTitle>
        <CardDescription>
          {selectedFactor.factor_type === 'phone' 
            ? `Enter the code sent to ${selectedFactor.phone}`
            : 'Enter the code from your authenticator app'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="code">Verification Code</Label>
          <Input
            id="code"
            type="text"
            placeholder="123456"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
          />
        </div>
        <Button onClick={handleVerifyCode} disabled={loading} className="w-full">
          {loading ? 'Verifying...' : 'Verify Code'}
        </Button>
        <Button onClick={() => setSelectedFactor(null)} variant="ghost" className="w-full">
          Back
        </Button>
      </CardContent>
    </Card>
  )
}

// Main Admin Login Form
function AdminLoginForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showMfaEnrollment, setShowMfaEnrollment] = useState(false)
  const [showMfaChallenge, setShowMfaChallenge] = useState(false)
  const [mfaFactors, setMfaFactors] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [formData, setFormData] = useState({
    email: '', // Will be populated via useAdminConfig hook
    password: ''
  })

  // Check for password reset success message
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.get('message') === 'password_reset_success') {
        toast.success('Password reset successful! Please log in with your new password.')
        // Clean up the URL
        window.history.replaceState({}, '', window.location.pathname)
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        })
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        setError(result.error || 'Login failed')
        toast.error(result.error || 'Login failed')
        return
      }

      if (result.requiresMfaEnrollment) {
        setCurrentUser(result.user)
        setShowMfaEnrollment(true)
        toast.info(result.message)
      } else if (result.requiresMfaChallenge) {
        setCurrentUser(result.user)
        setMfaFactors(result.factors)
        setShowMfaChallenge(true)
        toast.info(result.message)
      } else {
        toast.success(result.message)
        window.location.reload()
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to sign in'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleMfaSuccess = (userData: any) => {
    toast.success('Admin access granted!')
    window.location.reload()
  }

  const handleMfaBack = () => {
    setShowMfaEnrollment(false)
    setShowMfaChallenge(false)
    setCurrentUser(null)
    setMfaFactors(null)
    setError(null)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (error) setError(null)
  }

  // Show MFA enrollment form
  if (showMfaEnrollment) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <Link href="/" className="flex items-center justify-center mb-8">
            <Image src="/logo.jpg" alt="Foryoupiece" width={120} height={40} className="h-10 w-auto" />
          </Link>
        </div>
        <MfaEnrollmentForm
          user={currentUser}
          onSuccess={handleMfaSuccess}
          onBack={handleMfaBack}
        />
      </div>
    )
  }

  // Show MFA challenge form
  if (showMfaChallenge) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <Link href="/" className="flex items-center justify-center mb-8">
            <Image src="/logo.jpg" alt="Foryoupiece" width={120} height={40} className="h-10 w-auto" />
          </Link>
        </div>
        <MfaChallengeForm
          user={currentUser}
          factors={mfaFactors}
          onSuccess={handleMfaSuccess}
          onBack={handleMfaBack}
        />
      </div>
    )
  }

  // Main login form
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex items-center justify-center mb-8">
          <Image src="/logo.jpg" alt="Foryoupiece" width={120} height={40} className="h-10 w-auto" />
        </Link>
      </div>

      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <Shield className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle>Admin Access</CardTitle>
          <CardDescription>Secure administrator login portal</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center">
              <Shield className="h-5 w-5 text-blue-600 mr-2" />
              <span className="text-sm font-medium text-blue-800">Administrator Login</span>
            </div>
            <p className="text-sm text-blue-700 mt-1">
              This area is restricted to authorized administrators only
            </p>
          </div>

          {error && (
            <Alert className="mb-4" variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Administrator Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                placeholder="admin@foryoupiece.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Authenticating...' : 'Access Admin Panel'}
            </Button>
          </form>

          <div className="mt-6">
            <Link
              href="/en/auth/admin-forgot-password"
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              Forgot your admin password?
            </Link>
          </div>

          <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-center">
              <Shield className="h-4 w-4 text-yellow-600 mr-2" />
              <span className="text-sm font-medium text-yellow-800">Security Notice</span>
            </div>
            <p className="text-sm text-yellow-700 mt-1">
              All admin access attempts are logged and monitored. Unauthorized access is prohibited.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Main Layout Component
export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, loading } = useSSRSafeAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setCheckingAdmin(false)
        return
      }

      try {
        // Check if user is admin
        const adminUser = await adminQueries.getAdminUser(user.id)
        setIsAdmin(!!adminUser)
      } catch (error) {
        console.error('Error checking admin status:', error)
        setIsAdmin(false)
      } finally {
        setCheckingAdmin(false)
      }
    }

    checkAdminStatus()
  }, [user])

  if (loading || checkingAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Checking permissions...</p>
        </div>
      </div>
    )
  }

  if (!user || !isAdmin) {
    return <AdminLoginForm />
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {children}
    </div>
  )
}
