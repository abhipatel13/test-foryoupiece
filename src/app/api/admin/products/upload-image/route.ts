import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { withAdminAuth } from '@/lib/auth/admin-middleware'
import { validateFile } from '@/lib/security/file-validator'
import {
  handleDatabaseError,
  handleValidationError,
  handleGenericError
} from '@/lib/security/error-sanitizer'

/**
 * Upload product image (Admin only)
 * POST /api/admin/products/upload-image
 */
export const POST = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('📸 Admin Image Upload: Request received from user:', user.id, 'admin role:', adminUser.role)

    const serviceRoleSupabase = createServiceRoleClient()

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const productSku = formData.get('productSku') as string

    if (!file || !productSku) {
      return handleValidationError(
        new Error('File and product SKU are required'),
        { operation: 'file_upload_validation', userId: user.id }
      )
    }

    // Enhanced file validation with content verification
    console.log('🔍 Performing enhanced file validation for:', file.name, 'Size:', file.size, 'Type:', file.type)

    const validationResult = await validateFile(file, {
      maxSize: 5 * 1024 * 1024, // 5MB
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'],
      allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'],
      requireContentValidation: true,
      sanitizeSvg: true,
      checkForMaliciousPatterns: true
    })

    if (!validationResult.isValid) {
      console.error('❌ File validation failed:', validationResult.errors)
      return handleValidationError(
        new Error(`File validation failed: ${validationResult.errors.join(', ')}`),
        {
          operation: 'file_upload_validation',
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          detectedType: validationResult.detectedType,
          errors: validationResult.errors,
          userId: user.id
        }
      )
    }

    // Log validation warnings if any
    if (validationResult.warnings.length > 0) {
      console.warn('⚠️ File validation warnings:', validationResult.warnings)
    }

    console.log('✅ File validation passed:', {
      originalType: file.type,
      detectedType: validationResult.detectedType,
      detectedExtension: validationResult.detectedExtension,
      warnings: validationResult.warnings
    })

    // Generate unique filename
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2)
    const fileExtension = file.name.split('.').pop()
    const fileName = `${productSku}_${timestamp}_${randomId}.${fileExtension}`
    const filePath = `product-images/${fileName}`

    // Use sanitized content from validation (important for SVG files)
    const buffer = validationResult.sanitizedContent || Buffer.from(await file.arrayBuffer())

    // Use detected file type for more accurate content type
    const contentType = validationResult.detectedType || file.type

    // Upload to Supabase Storage with validated content type
    const { data: uploadData, error: uploadError } = await serviceRoleSupabase.storage
      .from('product-images')
      .upload(filePath, buffer, {
        contentType: contentType,
        upsert: false
      })

    if (uploadError) {
      return handleDatabaseError(uploadError, {
        operation: 'storage_upload',
        fileName: file.name,
        filePath,
        productSku,
        userId: user.id
      }, 'storage upload');
    }

    // Get public URL
    const { data: urlData } = serviceRoleSupabase.storage
      .from('product-images')
      .getPublicUrl(filePath)

    const imageUrl = urlData.publicUrl

    // Get current product to update images array
    const { data: product, error: fetchError } = await serviceRoleSupabase
      .from('products')
      .select('images')
      .eq('sku', productSku)
      .single()

    if (fetchError) {
      return handleDatabaseError(fetchError, {
        operation: 'product_fetch',
        productSku,
        userId: user.id
      }, 'product fetch');
    }

    // Update product images in database
    const currentImages = product.images || []
    const updatedImages = [...currentImages, imageUrl]

    const { error: updateError } = await serviceRoleSupabase
      .from('products')
      .update({ images: updatedImages })
      .eq('sku', productSku)

    if (updateError) {
      return handleDatabaseError(updateError, {
        operation: 'product_update',
        productSku,
        imageUrl,
        userId: user.id
      }, 'product update');
    }

    console.log('✅ Admin Image Upload: Successfully uploaded image for product:', productSku, 'URL:', imageUrl)

    return NextResponse.json({
      success: true,
      imageUrl,
      message: 'Image uploaded successfully',
      validationInfo: {
        detectedType: validationResult.detectedType,
        detectedExtension: validationResult.detectedExtension,
        warnings: validationResult.warnings
      }
    })

  } catch (error) {
    return handleGenericError(error, {
      operation: 'image_upload',
      productSku,
      fileName: file?.name,
      userId: user.id
    });
  }
})
