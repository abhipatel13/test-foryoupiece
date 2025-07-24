'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { QrCode, Smartphone, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { formatPrice } from '@/lib/utils'

interface QRCodePaymentProps {
  amount: number
  onPaymentComplete?: () => void
  onPaymentCancel?: () => void
}

export function QRCodePayment({ amount, onPaymentComplete, onPaymentCancel }: QRCodePaymentProps) {
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'scanning' | 'processing' | 'completed' | 'failed'>('pending')
  const [qrCodeGenerated, setQrCodeGenerated] = useState(false)

  const handleGenerateQR = () => {
    setPaymentStatus('scanning')
    setQrCodeGenerated(true)
    
    // Simulate QR code generation and payment processing
    // In a real implementation, this would integrate with a payment gateway
    setTimeout(() => {
      setPaymentStatus('processing')
      
      // Simulate payment completion after 3 seconds
      setTimeout(() => {
        setPaymentStatus('completed')
        onPaymentComplete?.()
      }, 3000)
    }, 1000)
  }

  const handleCancel = () => {
    setPaymentStatus('pending')
    setQrCodeGenerated(false)
    onPaymentCancel?.()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <QrCode className="h-5 w-5" />
          <span>QR Code Payment</span>
        </CardTitle>
        <CardDescription>
          Scan the QR code with your banking app to complete payment
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Payment Amount */}
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-900">
            {formatPrice(amount)}
          </div>
          <div className="text-sm text-gray-600">Total Amount</div>
        </div>

        {/* Payment Status */}
        <div className="flex items-center justify-center space-x-2">
          {paymentStatus === 'pending' && (
            <>
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">Ready to generate QR code</span>
            </>
          )}
          {paymentStatus === 'scanning' && (
            <>
              <Smartphone className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-blue-600">Scan QR code with your banking app</span>
            </>
          )}
          {paymentStatus === 'processing' && (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
              <span className="text-sm text-orange-600">Processing payment...</span>
            </>
          )}
          {paymentStatus === 'completed' && (
            <>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-600">Payment completed successfully!</span>
            </>
          )}
          {paymentStatus === 'failed' && (
            <>
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-red-600">Payment failed. Please try again.</span>
            </>
          )}
        </div>

        {/* QR Code Display Area */}
        {qrCodeGenerated && paymentStatus !== 'completed' && (
          <div className="flex flex-col items-center space-y-4">
            <div className="w-48 h-48 bg-white border-2 border-gray-200 rounded-lg flex items-center justify-center">
              {paymentStatus === 'scanning' ? (
                <div className="text-center">
                  <QrCode className="h-24 w-24 text-gray-400 mx-auto mb-2" />
                  <div className="text-xs text-gray-500">QR Code</div>
                  <div className="text-xs text-gray-400">Scan with banking app</div>
                </div>
              ) : (
                <div className="animate-pulse">
                  <div className="w-24 h-24 bg-gray-200 rounded"></div>
                </div>
              )}
            </div>
            
            <div className="text-center space-y-2">
              <Badge variant="outline" className="text-xs">
                <Smartphone className="h-3 w-3 mr-1" />
                Mobile Banking Required
              </Badge>
              <p className="text-xs text-gray-600 max-w-sm">
                Open your mobile banking app and scan this QR code to complete the payment of {formatPrice(amount)}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3">
          {paymentStatus === 'pending' && (
            <Button onClick={handleGenerateQR} className="flex-1">
              <QrCode className="h-4 w-4 mr-2" />
              Generate QR Code
            </Button>
          )}
          
          {(paymentStatus === 'scanning' || paymentStatus === 'processing') && (
            <Button onClick={handleCancel} variant="outline" className="flex-1">
              Cancel Payment
            </Button>
          )}
          
          {paymentStatus === 'completed' && (
            <Button disabled className="flex-1 bg-green-600 hover:bg-green-600">
              <CheckCircle className="h-4 w-4 mr-2" />
              Payment Completed
            </Button>
          )}
          
          {paymentStatus === 'failed' && (
            <Button onClick={handleGenerateQR} variant="destructive" className="flex-1">
              Try Again
            </Button>
          )}
        </div>

        {/* Payment Instructions */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Payment Instructions:</h4>
          <ol className="text-sm text-blue-800 space-y-1">
            <li>1. Click "Generate QR Code" to create your payment QR code</li>
            <li>2. Open your mobile banking app</li>
            <li>3. Select "QR Payment" or "Scan to Pay" feature</li>
            <li>4. Scan the QR code displayed above</li>
            <li>5. Confirm the payment amount and complete the transaction</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}
