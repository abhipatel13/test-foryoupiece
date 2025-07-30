'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ImageIcon, ExternalLink, Eye, EyeOff, Upload, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'

interface ProductImagesDisplayProps {
  images: string[]
  productSku: string
  className?: string
  onImagesChange?: (images: string[]) => void
  isEditable?: boolean
}

export function ProductImagesDisplay({
  images,
  productSku,
  className,
  onImagesChange,
  isEditable = false
}: ProductImagesDisplayProps) {
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set())
  const [showAllImages, setShowAllImages] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageError = (index: number) => {
    setImageErrors(prev => new Set(prev).add(index))
  }

  const handleImageLoad = (index: number) => {
    setImageErrors(prev => {
      const newSet = new Set(prev)
      newSet.delete(index)
      return newSet
    })
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0 || !isEditable || !onImagesChange) {
      console.log('Upload cancelled:', { files: !!files, filesLength: files?.length, isEditable, onImagesChange: !!onImagesChange })
      return
    }

    console.log('Starting upload process:', { filesCount: files.length, productSku })
    setIsUploading(true)
    const newImages: string[] = []

    try {
      for (const file of Array.from(files)) {
        console.log('Processing file:', { name: file.name, size: file.size, type: file.type })

        // Validate file type
        if (!file.type.startsWith('image/')) {
          console.warn('Invalid file type:', file.type)
          toast.error(`${file.name} is not a valid image file`)
          continue
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          console.warn('File too large:', file.size)
          toast.error(`${file.name} is too large. Maximum size is 5MB`)
          continue
        }

        // Create FormData for upload
        const formData = new FormData()
        formData.append('file', file)
        formData.append('productSku', productSku)

        console.log('Sending upload request for:', file.name)

        // Upload to API
        const response = await fetch('/api/admin/products/upload-image', {
          method: 'POST',
          body: formData,
        })

        console.log('Upload response:', { status: response.status, ok: response.ok })

        if (!response.ok) {
          const error = await response.text()
          console.error('Upload failed:', error)
          throw new Error(error || 'Upload failed')
        }

        const result = await response.json()
        console.log('Upload successful:', result)
        newImages.push(result.imageUrl)
      }

      if (newImages.length > 0) {
        const updatedImages = [...images, ...newImages]
        console.log('Updating images:', { oldCount: images.length, newCount: updatedImages.length })
        onImagesChange(updatedImages)
        toast.success(`Successfully uploaded ${newImages.length} image(s)`)
      } else {
        console.log('No images were uploaded')
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to upload images')
    } finally {
      setIsUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      console.log('Upload process completed')
    }
  }

  const handleRemoveImage = async (index: number) => {
    if (!isEditable || !onImagesChange) {
      console.log('Remove cancelled:', { isEditable, onImagesChange: !!onImagesChange })
      return
    }

    const imageUrl = images[index]
    console.log('Removing image:', { index, imageUrl, productSku })

    try {
      // Call API to remove image file
      const response = await fetch('/api/admin/products/remove-image', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl,
          productSku,
        }),
      })

      console.log('Remove response:', { status: response.status, ok: response.ok })

      if (!response.ok) {
        const error = await response.text()
        console.error('Remove failed:', error)
        throw new Error(error || 'Failed to remove image')
      }

      // Update images array
      const updatedImages = images.filter((_, i) => i !== index)
      console.log('Images updated:', { oldCount: images.length, newCount: updatedImages.length })
      onImagesChange(updatedImages)
      toast.success('Image removed successfully')
    } catch (error) {
      console.error('Remove error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to remove image')
    }
  }

  const handleUploadClick = () => {
    console.log('Upload button clicked', {
      fileInputRef: !!fileInputRef.current,
      isEditable,
      isUploading
    })

    if (!fileInputRef.current) {
      console.error('File input ref is null')
      return
    }

    if (!isEditable) {
      console.error('Component is not editable')
      return
    }

    if (isUploading) {
      console.error('Upload already in progress')
      return
    }

    try {
      fileInputRef.current.click()
      console.log('File input clicked successfully')
    } catch (error) {
      console.error('Error clicking file input:', error)
    }
  }

  const displayImages = showAllImages ? images : images.slice(0, 4)

  // Hidden file input for uploads
  const fileInput = isEditable ? (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      multiple
      onChange={handleFileUpload}
      className="hidden"
    />
  ) : null

  if (!images || images.length === 0) {
    return (
      <Card className={className}>
        {fileInput}
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Product Images
              </CardTitle>
              <CardDescription>
                No images available for this product
              </CardDescription>
            </div>
            {isEditable && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleUploadClick}
                disabled={isUploading}
                className="flex items-center gap-2 cursor-pointer"
              >
                {isUploading ? (
                  <>
                    <Upload className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Add Images
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <div className="text-center">
              <ImageIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No images found</p>
              {isEditable && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleUploadClick}
                  disabled={isUploading}
                  className="mt-2 cursor-pointer"
                >
                  Click to upload images
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      {fileInput}
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Product Images
            </CardTitle>
            <CardDescription>
              {images.length} image{images.length !== 1 ? 's' : ''} available for {productSku}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isEditable && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleUploadClick}
                disabled={isUploading}
                className="flex items-center gap-2 cursor-pointer"
              >
                {isUploading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Add Images
                  </>
                )}
              </Button>
            )}
            {images.length > 4 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAllImages(!showAllImages)}
                className="flex items-center gap-2 cursor-pointer"
              >
                {showAllImages ? (
                  <>
                    <EyeOff className="h-4 w-4" />
                    Show Less
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    Show All ({images.length})
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {displayImages.map((imageUrl, index) => (
            <div key={index} className="relative group">
              <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 border">
                {imageErrors.has(index) ? (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <ImageIcon className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-xs">Failed to load</p>
                    </div>
                  </div>
                ) : (
                  <Image
                    src={imageUrl}
                    alt={`${productSku} - Image ${index + 1}`}
                    fill
                    className="object-contain p-2 transition-transform group-hover:scale-105"
                    sizes="(max-width: 768px) 50vw, 25vw"
                    onError={() => handleImageError(index)}
                    onLoad={() => handleImageLoad(index)}
                  />
                )}
              </div>
              
              {/* Image overlay with actions */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="bg-white/90 hover:bg-white cursor-pointer"
                    onClick={() => window.open(imageUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  {isEditable && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="bg-red-500/90 hover:bg-red-600 cursor-pointer"
                      onClick={() => handleRemoveImage(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Image badge */}
              <Badge 
                variant={index === 0 ? "default" : "secondary"} 
                className="absolute bottom-2 left-2 text-xs"
              >
                {index === 0 ? 'Primary' : `Image ${index + 1}`}
              </Badge>
              
              {/* Image URL display on hover */}
              <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Badge variant="outline" className="text-xs bg-white/90">
                  {imageUrl.split('/').pop()}
                </Badge>
              </div>
            </div>
          ))}
        </div>
        
        {!showAllImages && images.length > 4 && (
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-500">
              Showing 4 of {images.length} images
            </p>
          </div>
        )}
        
        {/* Image URLs for debugging */}
        <details className="mt-4">
          <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
            View Image URLs ({images.length})
          </summary>
          <div className="mt-2 space-y-1">
            {images.map((url, index) => (
              <div key={index} className="text-xs font-mono bg-gray-50 p-2 rounded border">
                <span className="text-gray-500">{index + 1}.</span> {url}
              </div>
            ))}
          </div>
        </details>
      </CardContent>
    </Card>
  )
}
