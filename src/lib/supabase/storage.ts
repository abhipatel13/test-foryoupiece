import { createClient } from './client'

const supabase = createClient()

export const storageService = {
  // Upload a single file to Supabase Storage
  async uploadFile(
    bucket: string,
    path: string,
    file: File,
    options?: {
      cacheControl?: string
      contentType?: string
      upsert?: boolean
    }
  ) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: options?.cacheControl || '2678400', // 31 days default cache
          contentType: options?.contentType || file.type,
          upsert: options?.upsert || false
        })

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error uploading file:', error)
      throw error
    }
  },

  // Upload multiple files
  async uploadFiles(
    bucket: string,
    files: { path: string; file: File }[],
    options?: {
      cacheControl?: string
      upsert?: boolean
    }
  ) {
    try {
      const uploadPromises = files.map(({ path, file }) =>
        this.uploadFile(bucket, path, file, {
          cacheControl: options?.cacheControl,
          contentType: file.type,
          upsert: options?.upsert
        })
      )

      const results = await Promise.all(uploadPromises)
      return results
    } catch (error) {
      console.error('Error uploading files:', error)
      throw error
    }
  },

  // Get public URL for a file
  getPublicUrl(bucket: string, path: string) {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path)
    
    return data.publicUrl
  },

  // Get signed URL for private files
  async getSignedUrl(
    bucket: string,
    path: string,
    expiresIn: number = 3600
  ) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn)

      if (error) throw error
      return data.signedUrl
    } catch (error) {
      console.error('Error creating signed URL:', error)
      throw error
    }
  },

  // Delete a file
  async deleteFile(bucket: string, path: string) {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([path])

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error deleting file:', error)
      throw error
    }
  },

  // Delete multiple files
  async deleteFiles(bucket: string, paths: string[]) {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove(paths)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error deleting files:', error)
      throw error
    }
  },

  // List files in a directory
  async listFiles(
    bucket: string,
    path?: string,
    options?: {
      limit?: number
      offset?: number
      sortBy?: { column: string; order: 'asc' | 'desc' }
    }
  ) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(path, {
          limit: options?.limit,
          offset: options?.offset,
          sortBy: options?.sortBy
        })

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error listing files:', error)
      throw error
    }
  },

  // Generate unique filename
  generateUniqueFilename(originalName: string, prefix?: string) {
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 8)
    const extension = originalName.split('.').pop()
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '')
    
    const cleanName = nameWithoutExt
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    return `${prefix ? prefix + '-' : ''}${cleanName}-${timestamp}-${randomStr}.${extension}`
  },

  // Validate file type and size
  validateFile(
    file: File,
    options: {
      maxSize?: number // in bytes
      allowedTypes?: string[]
    }
  ) {
    const errors: string[] = []

    // Check file size
    if (options.maxSize && file.size > options.maxSize) {
      const maxSizeMB = (options.maxSize / (1024 * 1024)).toFixed(1)
      errors.push(`File size must be less than ${maxSizeMB}MB`)
    }

    // Check file type
    if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
      errors.push(`File type ${file.type} is not allowed`)
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  },

  // Resize image (client-side)
  async resizeImage(
    file: File,
    maxWidth: number,
    maxHeight: number,
    quality: number = 0.8
  ): Promise<File> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img
        
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height
            height = maxHeight
          }
        }

        canvas.width = width
        canvas.height = height

        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height)
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const resizedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now()
              })
              resolve(resizedFile)
            } else {
              reject(new Error('Failed to resize image'))
            }
          },
          file.type,
          quality
        )
      }

      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = URL.createObjectURL(file)
    })
  }
}

// Product image specific functions
export const productImageService = {
  // Upload product images
  async uploadProductImages(
    productId: string,
    files: File[],
    options?: {
      resize?: boolean
      maxWidth?: number
      maxHeight?: number
    }
  ) {
    try {
      const uploadData = []
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        
        // Validate file
        const validation = storageService.validateFile(file, {
          maxSize: 5 * 1024 * 1024, // 5MB
          allowedTypes: ['image/jpeg', 'image/png', 'image/webp']
        })

        if (!validation.isValid) {
          throw new Error(validation.errors.join(', '))
        }

        // Resize if needed
        let processedFile = file
        if (options?.resize) {
          processedFile = await storageService.resizeImage(
            file,
            options.maxWidth || 1200,
            options.maxHeight || 1200,
            0.85
          )
        }

        // Generate unique filename
        const filename = storageService.generateUniqueFilename(
          file.name,
          `product-${productId}-${i}`
        )
        
        const path = `products/${productId}/${filename}`
        
        // Upload file
        const uploadResult = await storageService.uploadFile(
          'product-images',
          path,
          processedFile
        )

        // Get public URL
        const publicUrl = storageService.getPublicUrl('product-images', path)

        uploadData.push({
          path,
          filename,
          publicUrl,
          size: processedFile.size,
          type: processedFile.type
        })
      }

      return uploadData
    } catch (error) {
      console.error('Error uploading product images:', error)
      throw error
    }
  },

  // Delete product images
  async deleteProductImages(productId: string, imagePaths: string[]) {
    try {
      await storageService.deleteFiles('product-images', imagePaths)
      return true
    } catch (error) {
      console.error('Error deleting product images:', error)
      throw error
    }
  },

  // Get product image URLs
  getProductImageUrls(imagePaths: string[]) {
    return imagePaths.map(path => 
      storageService.getPublicUrl('product-images', path)
    )
  }
}
