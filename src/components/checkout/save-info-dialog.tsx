'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Save, Shield, Clock } from 'lucide-react'

interface SaveInfoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (shouldSave: boolean) => void
  firstName: string
  lastName: string
  phone: string
  addressLine1: string
  addressLine2?: string
  abaBankName: string
}

export function SaveInfoDialog({
  open,
  onOpenChange,
  onSave,
  firstName,
  lastName,
  phone,
  addressLine1,
  addressLine2,
  abaBankName
}: SaveInfoDialogProps) {
  const [shouldSave, setShouldSave] = useState(true)
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    try {
      await onSave(shouldSave)
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving information:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = () => {
    onSave(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Save className="h-5 w-5 text-blue-600" />
            <span>Save Information for Faster Checkout</span>
          </DialogTitle>
          <DialogDescription>
            Would you like to save this information for faster checkout next time?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Information Preview */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-3">
            <div>
              <div className="text-sm font-medium text-gray-700">Personal Information</div>
              <div className="text-sm text-gray-600">
                {firstName} {lastName}
                <br />
                {phone}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-700">Address Information</div>
              <div className="text-sm text-gray-600">
                {addressLine1}
                {addressLine2 && (
                  <>
                    <br />
                    {addressLine2}
                  </>
                )}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-700">ABA Bank Name</div>
              <div className="text-sm text-gray-600">{abaBankName}</div>
            </div>
          </div>

          {/* Save Option */}
          <div className="flex items-start space-x-3">
            <Checkbox
              id="save-info"
              checked={shouldSave}
              onCheckedChange={(checked) => setShouldSave(checked as boolean)}
            />
            <div className="grid gap-1.5 leading-none">
              <label
                htmlFor="save-info"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Save this information to my profile
              </label>
              <p className="text-xs text-muted-foreground">
                This will help you checkout faster in the future
              </p>
            </div>
          </div>

          {/* Benefits */}
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Shield className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Benefits of saving:</span>
            </div>
            <ul className="text-xs text-blue-800 space-y-1">
              <li className="flex items-center space-x-2">
                <Clock className="h-3 w-3" />
                <span>Faster checkout process</span>
              </li>
              <li className="flex items-center space-x-2">
                <Save className="h-3 w-3" />
                <span>Auto-fill forms with saved information</span>
              </li>
              <li className="flex items-center space-x-2">
                <Shield className="h-3 w-3" />
                <span>Secure storage in your profile</span>
              </li>
            </ul>
          </div>

          {/* Privacy Note */}
          <div className="text-xs text-gray-500 text-center">
            Your information is securely stored and can be updated or removed from your profile at any time.
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleSkip}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Skip for Now
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {shouldSave ? 'Saving...' : 'Continuing...'}
              </>
            ) : (
              <>
                {shouldSave ? (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save & Continue
                  </>
                ) : (
                  'Continue Without Saving'
                )}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
