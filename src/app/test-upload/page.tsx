'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export default function TestUploadPage() {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    const newImages: string[] = []

    try {
      for (const file of Array.from(files)) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} is not a valid image file`)
          continue
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} is too large. Maximum size is 5MB`)
          continue
        }

        console.log('Uploading file:', file.name, 'Size:', file.size, 'Type:', file.type)

        // Create FormData for upload
        const formData = new FormData()
        formData.append('file', file)
        formData.append('productSku', 'SKU-UK60GYVS') // Test SKU

        console.log('Sending request to /api/admin/products/upload-image')

        // Upload to API
        const response = await fetch('/api/admin/products/upload-image', {
          method: 'POST',
          body: formData,
        })

        console.log('Response status:', response.status)
        console.log('Response ok:', response.ok)

        if (!response.ok) {
          const error = await response.text()
          console.error('Upload error response:', error)
          throw new Error(error || 'Upload failed')
        }

        const result = await response.json()
        console.log('Upload result:', result)
        newImages.push(result.imageUrl)
      }

      if (newImages.length > 0) {
        const updatedImages = [...uploadedImages, ...newImages]
        setUploadedImages(updatedImages)
        toast.success(`Successfully uploaded ${newImages.length} image(s)`)
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
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="container mx-auto p-8">
      <Card>
        <CardHeader>
          <CardTitle>Image Upload Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
            
            <Button
              onClick={handleUploadClick}
              disabled={isUploading}
              className="w-full"
            >
              {isUploading ? 'Uploading...' : 'Select Images to Upload'}
            </Button>

            {uploadedImages.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold">Uploaded Images:</h3>
                {uploadedImages.map((url, index) => (
                  <div key={index} className="p-2 bg-gray-100 rounded">
                    <p className="text-sm font-mono break-all">{url}</p>
                    <img 
                      src={url} 
                      alt={`Upload ${index + 1}`} 
                      className="mt-2 max-w-xs h-auto rounded"
                      onLoad={() => console.log('Image loaded:', url)}
                      onError={() => console.error('Image failed to load:', url)}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 p-4 bg-gray-50 rounded">
              <h4 className="font-semibold mb-2">Debug Info:</h4>
              <p>Upload status: {isUploading ? 'Uploading...' : 'Ready'}</p>
              <p>Images uploaded: {uploadedImages.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
