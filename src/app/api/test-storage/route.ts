import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export async function GET(request: NextRequest) {
  try {
    const serviceRoleSupabase = createServiceRoleClient()

    // Test 1: List buckets
    console.log('Testing Supabase storage configuration...')
    
    const { data: buckets, error: bucketsError } = await serviceRoleSupabase.storage.listBuckets()
    
    if (bucketsError) {
      console.error('Error listing buckets:', bucketsError)
      return NextResponse.json({
        success: false,
        error: 'Failed to list buckets',
        details: bucketsError
      }, { status: 500 })
    }

    console.log('Available buckets:', buckets)

    // Test 2: Check if product-images bucket exists
    const productImagesBucket = buckets?.find(bucket => bucket.name === 'product-images')
    
    if (!productImagesBucket) {
      console.error('product-images bucket not found')
      return NextResponse.json({
        success: false,
        error: 'product-images bucket not found',
        availableBuckets: buckets?.map(b => b.name) || []
      }, { status: 404 })
    }

    // Test 3: List files in product-images bucket
    const { data: files, error: filesError } = await serviceRoleSupabase.storage
      .from('product-images')
      .list('product-images', {
        limit: 10,
        sortBy: { column: 'created_at', order: 'desc' }
      })

    if (filesError) {
      console.error('Error listing files:', filesError)
      return NextResponse.json({
        success: false,
        error: 'Failed to list files in bucket',
        details: filesError
      }, { status: 500 })
    }

    console.log('Files in bucket:', files)

    // Test 4: Test upload permissions by creating a small test image file
    const testFileName = `test-${Date.now()}.jpg`
    const testFilePath = `product-images/${testFileName}`
    // Create a minimal 1x1 pixel JPEG image (base64 encoded)
    const testImageBase64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A'
    const testImageBuffer = Buffer.from(testImageBase64, 'base64')

    const { data: uploadData, error: uploadError } = await serviceRoleSupabase.storage
      .from('product-images')
      .upload(testFilePath, testImageBuffer, {
        contentType: 'image/jpeg',
        upsert: false
      })

    if (uploadError) {
      console.error('Error testing upload:', uploadError)
      return NextResponse.json({
        success: false,
        error: 'Failed to test upload permissions',
        details: uploadError
      }, { status: 500 })
    }

    console.log('Test upload successful:', uploadData)

    // Test 5: Get public URL for the test file
    const { data: urlData } = serviceRoleSupabase.storage
      .from('product-images')
      .getPublicUrl(testFilePath)

    console.log('Test file public URL:', urlData.publicUrl)

    // Test 6: Clean up test file
    const { error: deleteError } = await serviceRoleSupabase.storage
      .from('product-images')
      .remove([testFilePath])

    if (deleteError) {
      console.warn('Warning: Failed to clean up test file:', deleteError)
    }

    return NextResponse.json({
      success: true,
      message: 'Supabase storage is properly configured',
      details: {
        bucketsCount: buckets?.length || 0,
        productImagesBucket: {
          name: productImagesBucket.name,
          id: productImagesBucket.id,
          public: productImagesBucket.public,
          created_at: productImagesBucket.created_at
        },
        filesInBucket: files?.length || 0,
        recentFiles: files?.slice(0, 5).map(f => ({
          name: f.name,
          size: f.metadata?.size,
          created_at: f.created_at
        })) || [],
        testUploadSuccessful: true,
        testFileUrl: urlData.publicUrl
      }
    })

  } catch (error) {
    console.error('Storage test error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error during storage test',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
