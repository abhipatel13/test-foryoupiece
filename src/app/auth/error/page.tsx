'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Suspense } from 'react'

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const message = searchParams.get('message')

  const getErrorDetails = () => {
    switch (error) {
      case 'otp_expired':
        return {
          title: 'Reset Link Expired',
          description: 'Your password reset link has expired.',
          message: 'Password reset links are only valid for 5 minutes for security reasons.',
          action: 'Request New Reset Link',
          actionUrl: '/auth/forgot-password'
        }
      case 'access_denied':
        return {
          title: 'Access Denied',
          description: 'The reset link was denied or cancelled.',
          message: 'This can happen if you cancelled the reset process or the link was already used.',
          action: 'Request New Reset Link',
          actionUrl: '/auth/forgot-password'
        }
      case 'exchange_failed':
        return {
          title: 'Authentication Failed',
          description: 'Failed to authenticate with the provided link.',
          message: message || 'The authentication process failed. This usually means the link is invalid or expired.',
          action: 'Request New Reset Link',
          actionUrl: '/auth/forgot-password'
        }
      case 'missing_code':
        return {
          title: 'Invalid Link',
          description: 'The authentication link is missing required information.',
          message: 'The link you clicked appears to be incomplete or corrupted.',
          action: 'Request New Reset Link',
          actionUrl: '/auth/forgot-password'
        }
      case 'no_session':
        return {
          title: 'Session Error',
          description: 'Failed to establish an authentication session.',
          message: 'The authentication was processed but no session could be created.',
          action: 'Try Again',
          actionUrl: '/auth/forgot-password'
        }
      default:
        return {
          title: 'Authentication Error',
          description: 'An error occurred during authentication.',
          message: message || 'An unexpected error occurred. Please try again.',
          action: 'Request New Reset Link',
          actionUrl: '/auth/forgot-password'
        }
    }
  }

  const errorDetails = getErrorDetails()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center justify-center space-x-2 text-foreground hover:text-primary transition-colors">
            <div className="flex items-center space-x-2">
              <Image
                src="/favicon.jpg"
                alt="Foryoupiece"
                width={32}
                height={32}
                className="rounded-lg shadow-sm object-contain flex-shrink-0"
                priority
              />
              <Image
                src="/logo.jpg"
                alt="Foryoupiece"
                width={80}
                height={24}
                className="object-contain flex-shrink-0"
                priority
              />
            </div>
          </Link>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">{errorDetails.title}</h2>
          <p className="mt-2 text-sm text-gray-600">{errorDetails.description}</p>
        </div>

        <Card className="mt-8">
          <CardHeader className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-lg font-medium text-gray-900">
              Authentication Failed
            </CardTitle>
            <CardDescription>
              {errorDetails.message}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Error Details */}
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Error:</strong> {error || 'unknown_error'}
                {message && (
                  <>
                    <br />
                    <strong>Details:</strong> {message}
                  </>
                )}
              </AlertDescription>
            </Alert>

            {/* Actions */}
            <div className="space-y-3">
              <Link href={errorDetails.actionUrl} className="block">
                <Button className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {errorDetails.action}
                </Button>
              </Link>
              
              <Link href="/auth/login" className="block">
                <Button variant="outline" className="w-full">
                  Back to Login
                </Button>
              </Link>
            </div>

            {/* Help Text */}
            <div className="text-center text-sm text-gray-500">
              <p>
                Still having trouble?{' '}
                <Link href="/contact" className="font-medium text-blue-600 hover:text-blue-500">
                  Contact Support
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-xs text-gray-500">
          <p>
            By using this service, you agree to our{' '}
            <Link href="/terms" className="font-medium text-blue-600 hover:text-blue-500">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="font-medium text-blue-600 hover:text-blue-500">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <Link href="/" className="inline-flex items-center justify-center space-x-2 text-foreground hover:text-primary transition-colors">
              <div className="flex items-center space-x-2">
                <Image
                  src="/favicon.jpg"
                  alt="Foryoupiece"
                  width={32}
                  height={32}
                  className="rounded-lg shadow-sm object-contain flex-shrink-0"
                  priority
                />
                <Image
                  src="/logo.jpg"
                  alt="Foryoupiece"
                  width={80}
                  height={24}
                  className="object-contain flex-shrink-0"
                  priority
                />
              </div>
            </Link>
            <h2 className="mt-6 text-3xl font-bold text-gray-900">Loading...</h2>
            <p className="mt-2 text-sm text-gray-600">Processing authentication error</p>
          </div>
        </div>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  )
}
