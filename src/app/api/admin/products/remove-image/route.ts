import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export async function DELETE(request: NextRequest) {
  try {
    // Check admin authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('Authentication error:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin using service role client
    const serviceRoleSupabase = createServiceRoleClient()
    const { data: adminUser, error: adminError } = await serviceRoleSupabase
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (adminError || !adminUser) {
      console.error('Admin check error:', adminError)
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Parse request body
    const { imageUrl, productSku } = await request.json()

    if (!imageUrl || !productSku) {
      return NextResponse.json({ error: 'Image URL and product SKU are required' }, { status: 400 })
    }

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

    // Remove image from array
    const currentImages = product.images || []
    const updatedImages = currentImages.filter((img: string) => img !== imageUrl)

    // Update product images in database
    const { error: updateError } = await serviceRoleSupabase
      .from('products')
      .update({ images: updatedImages })
      .eq('sku', productSku)

    if (updateError) {
      console.error('Product update error:', updateError)
      return NextResponse.json({ error: 'Failed to update product images' }, { status: 500 })
    }

    // Delete from Supabase Storage
    try {
      // Extract file path from URL
      let filePath = ''
      // Match any Supabase storage public URL regardless of host
      if (imageUrl.includes('/storage/v1/object/public/product-images/')) {
        const urlParts = imageUrl.split('/storage/v1/object/public/product-images/')
        if (urlParts.length > 1) {
          filePath = urlParts[1]
        }
      } else if (imageUrl.startsWith('/images/products/')) {
        // Handle legacy local file paths
        const fileName = imageUrl.split('/').pop()
        filePath = `product-images/${fileName}`
      }

      if (filePath) {
        const { error: deleteError } = await serviceRoleSupabase.storage
          .from('product-images')
          .remove([filePath])

        if (deleteError) {
          console.warn('Failed to delete file from storage:', deleteError)
        }
      }
    } catch (fileError) {
      // Log but don't fail the request if file deletion fails
      console.warn('Failed to delete physical file:', fileError)
    }

    return NextResponse.json({
      success: true,
      message: 'Image removed successfully'
    })

  } catch (error) {
    console.error('Image removal error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
