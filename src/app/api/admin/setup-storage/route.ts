import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export async function POST(request: NextRequest) {
  try {
    const serviceRoleSupabase = createServiceRoleClient()

    // Create the product-images bucket
    const { data, error } = await serviceRoleSupabase.storage.createBucket('product-images', {
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      fileSizeLimit: 5242880 // 5MB
    })

    if (error) {
      console.error('Bucket creation error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Storage bucket created successfully',
      data
    })

  } catch (error) {
    console.error('Setup storage error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
