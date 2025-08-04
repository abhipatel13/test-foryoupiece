'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useSSRSafeAuth } from '@/lib/hooks/use-ssr-safe-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

import { GoogleLogin } from '@/components/auth/google-login'
import { toast } from 'sonner'
import { Mail, Lock, User, Phone, Eye, EyeOff } from 'lucide-react'

interface AuthFormProps {
  mode: 'login' | 'signup'
  onSuccess?: () => void
}

export function AuthForm({ mode, onSuccess }: AuthFormProps) {
  const t = useTranslations('auth')
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useSSRSafeAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (mode === 'signup') {
        if (formData.password !== formData.confirmPassword) {
          throw new Error('Passwords do not match')
        }

        await signUpWithEmail(formData.email, formData.password, {
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone: formData.phone
        })
        toast.success(t('signupSuccess'))
      } else {
        await signInWithEmail(formData.email, formData.password)
        toast.success(t('loginSuccess'))
      }

      onSuccess?.()
    } catch (err: any) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }



  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full mx-auto">
        {/* Social Login Buttons */}
        <div className="space-y-2 sm:space-y-3">
          {/* Google Login Button */}
          <GoogleLogin
            onSuccess={onSuccess}
            className="w-full min-h-[44px]"
            size="lg"
          />


        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or continue with email</span>
          </div>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          {mode === 'signup' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{t('firstName')}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      id="firstName"
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="!pl-12 min-h-[44px]"
                      placeholder="First name"
                      disabled={loading}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">{t('lastName')}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      id="lastName"
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="!pl-12 min-h-[44px]"
                      placeholder="Last name"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{t('phone')}</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="!pl-12 min-h-[44px]"
                    placeholder="Phone number"
                    disabled={loading}
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">{t('email')}</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="!pl-12 min-h-[44px]"
                placeholder="Enter your email"
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('password')}</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="!pl-12 !pr-12 min-h-[44px]"
                placeholder={mode === 'login' ? 'Enter your password' : 'Create a password'}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-muted/50 flex items-center justify-center min-w-[44px] min-h-[44px]"
                disabled={loading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {mode === 'signup' && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="!pl-12 !pr-12 min-h-[44px]"
                  placeholder="Confirm your password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-muted/50 flex items-center justify-center min-w-[44px] min-h-[44px]"
                  disabled={loading}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive text-center">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px]"
            size="lg"
          >
            {loading ? 'Loading...' : (mode === 'login' ? t('login') : t('signup'))}
          </Button>
        </form>

      <div className="text-center text-sm text-muted-foreground">
        {mode === 'login' ? t('dontHaveAccount') : t('alreadyHaveAccount')}
      </div>
    </div>
  )
}
