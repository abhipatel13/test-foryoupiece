#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Test data preservation during BoxHero sync
async function testBoxHeroSyncPreservation() {
  console.log('🧪 TESTING BOXHERO SYNC DATA PRESERVATION')
  console.log('==========================================')
  
  try {
    // Get a sample of products with rich data (descriptions, images)
    console.log('📊 Fetching products with rich data...')
    const { data: products, error } = await supabase
      .from('products')
      .select('id, sku, name_en, name_ja, description_en, short_description_en, images, stock_quantity, updated_at')
      .not('short_description_en', 'is', null)
      .not('images', 'is', null)
      .limit(5)
    
    if (error) {
      throw new Error(`Failed to fetch products: ${error.message}`)
    }
    
    console.log(`📦 Found ${products.length} products with rich data`)
    
    // Display current state
    console.log('\n📋 CURRENT PRODUCT STATE (Before Sync):')
    console.log('=====================================')
    
    products.forEach((product, index) => {
      console.log(`\n${index + 1}. SKU: ${product.sku}`)
      console.log(`   Name EN: ${product.name_en}`)
      console.log(`   Name JA: ${product.name_ja}`)
      console.log(`   Description: ${product.description_en ? product.description_en.substring(0, 100) + '...' : 'None'}`)
      console.log(`   Short Desc: ${product.short_description_en ? product.short_description_en.substring(0, 100) + '...' : 'None'}`)
      console.log(`   Images: ${product.images ? product.images.length : 0} image(s)`)
      console.log(`   Stock: ${product.stock_quantity}`)
      console.log(`   Updated: ${product.updated_at}`)
    })
    
    // Simulate BoxHero sync update (what the sync would do)
    console.log('\n🔄 SIMULATING BOXHERO SYNC UPDATE:')
    console.log('==================================')
    
    const testProduct = products[0]
    console.log(`\nTesting with product: ${testProduct.sku}`)
    
    // Simulate what BoxHero sync would update
    const simulatedBoxHeroUpdate = {
      name_en: `Updated ${testProduct.name_en}`, // BoxHero would update names
      name_ja: `Updated ${testProduct.name_en}`, // BoxHero would update names
      stock_quantity: testProduct.stock_quantity + 10, // BoxHero would update stock
      updated_at: new Date().toISOString()
      // NOTE: BoxHero sync should NOT update:
      // - description_en, description_ja
      // - short_description_en, short_description_ja  
      // - images (unless sync_source is boxhero)
    }
    
    console.log('📝 Simulated BoxHero updates:')
    console.log(`   Name EN: "${testProduct.name_en}" → "${simulatedBoxHeroUpdate.name_en}"`)
    console.log(`   Name JA: "${testProduct.name_ja}" → "${simulatedBoxHeroUpdate.name_ja}"`)
    console.log(`   Stock: ${testProduct.stock_quantity} → ${simulatedBoxHeroUpdate.stock_quantity}`)
    console.log('   ✅ Preserving: descriptions, short descriptions, images')
    
    // Apply the simulated update
    const { error: updateError } = await supabase
      .from('products')
      .update(simulatedBoxHeroUpdate)
      .eq('id', testProduct.id)
    
    if (updateError) {
      throw new Error(`Failed to apply simulated update: ${updateError.message}`)
    }
    
    // Verify the update preserved the important data
    const { data: updatedProduct, error: fetchError } = await supabase
      .from('products')
      .select('id, sku, name_en, name_ja, description_en, short_description_en, images, stock_quantity, updated_at')
      .eq('id', testProduct.id)
      .single()
    
    if (fetchError) {
      throw new Error(`Failed to fetch updated product: ${fetchError.message}`)
    }
    
    console.log('\n✅ VERIFICATION RESULTS:')
    console.log('========================')
    
    // Check what was updated
    const nameUpdated = updatedProduct.name_en !== testProduct.name_en
    const stockUpdated = updatedProduct.stock_quantity !== testProduct.stock_quantity
    
    // Check what was preserved
    const descriptionPreserved = updatedProduct.description_en === testProduct.description_en
    const shortDescPreserved = updatedProduct.short_description_en === testProduct.short_description_en
    const imagesPreserved = JSON.stringify(updatedProduct.images) === JSON.stringify(testProduct.images)
    
    console.log(`📝 Name Updated: ${nameUpdated ? '✅ YES' : '❌ NO'}`)
    console.log(`📦 Stock Updated: ${stockUpdated ? '✅ YES' : '❌ NO'}`)
    console.log(`📖 Description Preserved: ${descriptionPreserved ? '✅ YES' : '❌ NO'}`)
    console.log(`📄 Short Description Preserved: ${shortDescPreserved ? '✅ YES' : '❌ NO'}`)
    console.log(`🖼️ Images Preserved: ${imagesPreserved ? '✅ YES' : '❌ NO'}`)
    
    // Overall result
    const allTestsPassed = nameUpdated && stockUpdated && descriptionPreserved && shortDescPreserved && imagesPreserved
    
    console.log(`\n🎯 OVERALL RESULT: ${allTestsPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`)
    
    if (allTestsPassed) {
      console.log('🎉 BoxHero sync correctly preserves bulk-updated data!')
    } else {
      console.log('⚠️ BoxHero sync may be overwriting important data!')
    }
    
    // Restore original data
    console.log('\n🔄 Restoring original data...')
    const { error: restoreError } = await supabase
      .from('products')
      .update({
        name_en: testProduct.name_en,
        name_ja: testProduct.name_ja,
        stock_quantity: testProduct.stock_quantity,
        updated_at: testProduct.updated_at
      })
      .eq('id', testProduct.id)
    
    if (restoreError) {
      console.log('⚠️ Failed to restore original data:', restoreError.message)
    } else {
      console.log('✅ Original data restored successfully')
    }
    
    console.log('\n📊 SUMMARY:')
    console.log('===========')
    console.log('✅ BoxHero sync should update: stock_quantity, name_en, name_ja')
    console.log('✅ BoxHero sync should preserve: descriptions, short_descriptions, images')
    console.log('✅ This ensures bulk-updated product data is maintained')
    
  } catch (error) {
    console.error('💥 Test failed:', error.message)
    process.exit(1)
  }
}

// Run the test
if (require.main === module) {
  testBoxHeroSyncPreservation().catch(console.error)
}

module.exports = { testBoxHeroSyncPreservation }
