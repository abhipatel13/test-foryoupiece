import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export async function GET() {
  try {
    console.log('🧪 Testing service role client...');
    
    const serviceRoleClient = createServiceRoleClient();
    
    // Test 1: Basic connection
    console.log('🔗 Testing basic connection...');
    const { data: testData, error: testError } = await serviceRoleClient
      .from('products')
      .select('id, name_en')
      .limit(1);
    
    if (testError) {
      console.error('❌ Basic connection test failed:', testError);
      return NextResponse.json({ 
        success: false, 
        error: 'Basic connection failed',
        details: testError 
      });
    }
    
    console.log('✅ Basic connection successful, found products:', testData?.length || 0);
    
    // Test 2: Try to create a test product
    console.log('🏗️ Testing product creation...');
    const testProduct = {
      id: '00000000-0000-0000-0000-000000000001',
      sku: 'TEST-SKU-001',
      name_en: 'Test Product',
      name_ja: 'Test Product',
      description_en: 'Test Description',
      description_ja: 'Test Description',
      price: 10.00,
      stock_quantity: 1,
      low_stock_threshold: 5,
      category_id: null,
      images: [],
      is_featured: false,
      is_active: true,
      tags: ['test'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { data: createData, error: createError } = await serviceRoleClient
      .from('products')
      .insert(testProduct)
      .select()
      .single();
    
    if (createError) {
      console.error('❌ Product creation test failed:', createError);
      return NextResponse.json({ 
        success: false, 
        error: 'Product creation failed',
        details: createError,
        basicConnectionWorked: true
      });
    }
    
    console.log('✅ Product creation successful:', createData?.id);
    
    // Test 3: Clean up - delete the test product
    console.log('🧹 Cleaning up test product...');
    const { error: deleteError } = await serviceRoleClient
      .from('products')
      .delete()
      .eq('id', testProduct.id);
    
    if (deleteError) {
      console.warn('⚠️ Failed to clean up test product:', deleteError);
    } else {
      console.log('✅ Test product cleaned up successfully');
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Service role client is working correctly',
      tests: {
        basicConnection: true,
        productCreation: true,
        cleanup: !deleteError
      }
    });
    
  } catch (error) {
    console.error('❌ Service role test failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Unexpected error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
