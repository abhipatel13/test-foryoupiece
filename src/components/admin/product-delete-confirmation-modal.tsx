'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Trash2, X, ImageIcon } from 'lucide-react'
import { Product } from '@/domain/entities/Product'

interface ProductDeleteConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason?: string) => void
  product: Product | null
  isDeleting: boolean
}

export function ProductDeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  product,
  isDeleting
}: ProductDeleteConfirmationModalProps) {
  const [confirmationText, setConfirmationText] = useState('')
  const [deletionReason, setDeletionReason] = useState('')

  if (!product) return null

  const productImages = (product as any).images || []
  const productThumbnail = productImages.length > 0 ? productImages[0] : null
  const expectedConfirmation = product.sku.value
  const isConfirmationValid = confirmationText === expectedConfirmation

  const handleConfirm = () => {
    if (isConfirmationValid) {
      onConfirm(deletionReason.trim() || undefined)
    }
  }

  const handleClose = () => {
    if (!isDeleting) {
      setConfirmationText('')
      setDeletionReason('')
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Delete Product - Confirmation Required
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Product Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-start gap-4">
              {/* Product Image */}
              <div className="flex-shrink-0">
                {productThumbnail ? (
                  <div className="relative w-16 h-16 rounded-md overflow-hidden border border-gray-200">
                    <Image
                      src={productThumbnail}
                      alt={`${product.nameEn} thumbnail`}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-md border border-gray-200 bg-gray-100 flex items-center justify-center">
                    <ImageIcon className="h-6 w-6 text-gray-400" />
                  </div>
                )}
              </div>

              {/* Product Details */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg text-gray-900 truncate">
                  {product.nameEn}
                </h3>
                <div className="grid grid-cols-2 gap-4 mt-2 text-sm text-gray-600">
                  <div>
                    <p><strong>SKU:</strong> {product.sku.value}</p>
                    <p><strong>Price:</strong> {product.price.format()}</p>
                  </div>
                  <div>
                    <p><strong>Stock:</strong> {product.stockQuantity}</p>
                    <p><strong>Status:</strong> 
                      <Badge variant={product.isActive ? 'default' : 'secondary'} className="ml-1">
                        {product.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Warning Message */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">
                <p className="font-semibold mb-2">This action cannot be undone!</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>The product will be soft-deleted and hidden from customers</li>
                  <li>It will be removed from all customer carts and wishlists</li>
                  <li>Search suggestions will be deactivated</li>
                  <li>Trending and best-seller flags will be cleared</li>
                  <li>Only super administrators can restore deleted products</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Confirmation Input */}
          <div className="space-y-2">
            <Label htmlFor="confirmation" className="text-sm font-medium">
              Type the product SKU <code className="bg-gray-100 px-1 rounded text-red-600">{expectedConfirmation}</code> to confirm deletion:
            </Label>
            <Input
              id="confirmation"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder={`Enter ${expectedConfirmation} to confirm`}
              className={`${
                confirmationText && !isConfirmationValid 
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                  : ''
              }`}
              disabled={isDeleting}
            />
            {confirmationText && !isConfirmationValid && (
              <p className="text-sm text-red-600">
                SKU does not match. Please type "{expectedConfirmation}" exactly.
              </p>
            )}
          </div>

          {/* Optional Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-sm font-medium">
              Reason for deletion (optional):
            </Label>
            <Textarea
              id="reason"
              value={deletionReason}
              onChange={(e) => setDeletionReason(e.target.value)}
              placeholder="Enter reason for deleting this product..."
              rows={3}
              disabled={isDeleting}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isDeleting}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isConfirmationValid || isDeleting}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isDeleting ? 'Deleting...' : 'Delete Product'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
