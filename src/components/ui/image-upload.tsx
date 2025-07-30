'use client'

import { useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import { Button } from './button'
import { Card, CardContent } from './card'
import { Badge } from './badge'
import { Progress } from './progress'
import { Upload, X, Image as ImageIcon, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface ImageUploadProps {
  value?: string[]
  onChange: (urls: string[]) => void
  maxFiles?: number
  maxSize?: number // in MB
  accept?: string
  disabled?: boolean
  onUpload?: (files: File[]) => Promise<string[]>
  className?: string
}

interface FileWithPreview extends File {
  preview?: string
}

export function ImageUpload({
  value = [],
  onChange,
  maxFiles = 5,
  maxSize = 5,
  accept = 'image/*',
  disabled = false,
  onUpload,
  className
}: ImageUploadProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File) => {
    const errors: string[] = []
    
    // Check file size
    if (file.size > maxSize * 1024 * 1024) {
      errors.push(`File size must be less than ${maxSize}MB`)
    }
    
    // Check file type
    if (!file.type.startsWith('image/')) {
      errors.push('File must be an image')
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }

  const processFiles = useCallback((fileList: FileList) => {
    const newFiles: FileWithPreview[] = []
    const totalFiles = files.length + value.length + fileList.length

    if (totalFiles > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`)
      return
    }

    Array.from(fileList).forEach((file) => {
      const validation = validateFile(file)
      
      if (!validation.isValid) {
        toast.error(validation.errors.join(', '))
        return
      }

      const fileWithPreview = Object.assign(file, {
        preview: URL.createObjectURL(file)
      })
      
      newFiles.push(fileWithPreview)
    })

    setFiles(prev => [...prev, ...newFiles])
  }, [files.length, value.length, maxFiles, maxSize])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (disabled) return
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(e.dataTransfer.files)
    }
  }, [disabled, processFiles])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFiles(e.target.files)
    }
  }, [processFiles])

  const removeFile = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev]
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!)
      }
      newFiles.splice(index, 1)
      return newFiles
    })
  }

  const removeUploadedImage = (index: number) => {
    const newValue = [...value]
    newValue.splice(index, 1)
    onChange(newValue)
  }

  const handleUpload = async () => {
    if (!onUpload || files.length === 0) return

    setUploading(true)
    setUploadProgress(0)

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      const uploadedUrls = await onUpload(files)
      
      clearInterval(progressInterval)
      setUploadProgress(100)
      
      // Update value with new URLs
      onChange([...value, ...uploadedUrls])
      
      // Clear files
      files.forEach(file => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview)
        }
      })
      setFiles([])
      
      toast.success(`${uploadedUrls.length} image(s) uploaded successfully`)
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload images')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const openFileDialog = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.click()
    }
  }

  return (
    <div className={className}>
      {/* Upload Area */}
      <Card 
        className={`border-2 border-dashed transition-colors ${
          dragActive 
            ? 'border-indigo-500 bg-indigo-50' 
            : 'border-gray-300 hover:border-gray-400'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <CardContent className="p-6 text-center">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={accept}
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled}
          />
          
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-900 mb-2">
            Drop images here or click to upload
          </p>
          <p className="text-sm text-gray-500">
            PNG, JPG, WebP up to {maxSize}MB each (max {maxFiles} files)
          </p>
        </CardContent>
      </Card>

      {/* Upload Progress */}
      {uploading && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Uploading images...</span>
            <span className="text-sm text-gray-600">{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="w-full" />
        </div>
      )}

      {/* File Previews */}
      {files.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-900">
              Ready to upload ({files.length})
            </h4>
            <Button 
              onClick={handleUpload}
              disabled={uploading || disabled}
              size="sm"
            >
              Upload All
            </Button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {files.map((file, index) => (
              <div key={index} className="relative group">
                <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <Image
                    src={file.preview!}
                    alt={file.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
                </div>
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeFile(index)
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
                <div className="mt-1">
                  <p className="text-xs text-gray-600 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(1)}MB
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Uploaded Images */}
      {value.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            Uploaded images ({value.length})
          </h4>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {value.map((url, index) => (
              <div key={index} className="relative group">
                <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <Image
                    src={url}
                    alt={`Uploaded image ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
                </div>
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeUploadedImage(index)
                  }}
                  disabled={disabled}
                >
                  <X className="h-3 w-3" />
                </Button>
                <Badge 
                  variant="secondary" 
                  className="absolute bottom-2 left-2 text-xs"
                >
                  {index === 0 ? 'Primary' : `Image ${index + 1}`}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {value.length === 0 && files.length === 0 && (
        <div className="mt-4 text-center py-8 text-gray-500">
          <ImageIcon className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <p>No images uploaded yet</p>
        </div>
      )}
    </div>
  )
}
