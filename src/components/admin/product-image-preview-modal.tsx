'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, X, ExternalLink } from 'lucide-react'

interface ProductImagePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  images: string[]
  productName: string
  initialImageIndex?: number
}

export function ProductImagePreviewModal({
  isOpen,
  onClose,
  images,
  productName,
  initialImageIndex = 0
}: ProductImagePreviewModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(initialImageIndex)

  if (!images || images.length === 0) {
    return null
  }

  const currentImage = images[currentImageIndex]
  const hasMultipleImages = images.length > 1

  const goToPrevious = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }

  const goToNext = () => {
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }

  const openInNewTab = () => {
    window.open(currentImage, '_blank')
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center justify-between">
            <span className="truncate">{productName}</span>
            <div className="flex items-center gap-2 ml-4">
              {hasMultipleImages && (
                <span className="text-sm text-muted-foreground">
                  {currentImageIndex + 1} of {images.length}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={openInNewTab}
                className="flex items-center gap-1"
              >
                <ExternalLink className="h-4 w-4" />
                Open
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="relative flex items-center justify-center p-6 pt-0">
          {/* Navigation buttons */}
          {hasMultipleImages && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={goToPrevious}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 h-10 w-10 p-0 bg-black/20 hover:bg-black/40 text-white"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={goToNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 h-10 w-10 p-0 bg-black/20 hover:bg-black/40 text-white"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </>
          )}

          {/* Main image */}
          <div className="relative w-full max-w-3xl aspect-square">
            <Image
              src={currentImage}
              alt={`${productName} - Image ${currentImageIndex + 1}`}
              fill
              className="object-contain rounded-lg"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
              priority
            />
          </div>
        </div>

        {/* Thumbnail navigation for multiple images */}
        {hasMultipleImages && (
          <div className="px-6 pb-6">
            <div className="flex gap-2 justify-center overflow-x-auto">
              {images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`relative flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-colors ${
                    index === currentImageIndex
                      ? 'border-primary'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Image
                    src={image}
                    alt={`${productName} thumbnail ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
