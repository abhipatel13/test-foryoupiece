import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export async function POST(request: NextRequest) {
  try {
    // For now, we'll skip user authentication and rely on the admin panel's client-side auth
    // In a production environment, you'd want to implement proper server-side auth
    // TODO: Implement proper server-side authentication

    const serviceRoleSupabase = createServiceRoleClient()

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const productSku = formData.get('productSku') as string

    if (!file || !productSku) {
      return NextResponse.json({ error: 'File and product SKU are required' }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 })
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2)
    const fileExtension = file.name.split('.').pop()
    const fileName = `${productSku}_${timestamp}_${randomId}.${fileExtension}`
    const filePath = `product-images/${fileName}`

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await serviceRoleSupabase.storage
      .from('product-images')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to upload image to storage' }, { status: 500 })
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
      console.error('Product fetch error:', fetchError)
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Update product images in database
    const currentImages = product.images || []
    const updatedImages = [...currentImages, imageUrl]

    const { error: updateError } = await serviceRoleSupabase
      .from('products')
      .update({ images: updatedImages })
      .eq('sku', productSku)

    if (updateError) {
      console.error('Product update error:', updateError)
      return NextResponse.json({ error: 'Failed to update product images' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      imageUrl,
      message: 'Image uploaded successfully'
    })

  } catch (error) {
    console.error('Image upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
