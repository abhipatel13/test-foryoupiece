#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Configuration
const BATCH_SIZE = 50 // Process 50 products at a time
const DELAY_BETWEEN_BATCHES = 500 // 500ms delay

// Function to clean up description text
function cleanupDescription(text) {
  if (!text || typeof text !== 'string') {
    return text
  }
  
  // Remove various escape sequences and formatting artifacts
  let cleaned = text
    // Remove \n sequences (with or without spaces)
    .replace(/\\n\s*/g, ' ')
    // Remove /n sequences
    .replace(/\/n\s*/g, ' ')
    // Remove multiple consecutive newlines
    .replace(/\n\s*\n\s*/g, '\n')
    // Remove leading/trailing whitespace and newlines
    .trim()
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    // Remove leading/trailing quotes if they wrap the entire text
    .replace(/^["']\s*/, '')
    .replace(/\s*["']$/, '')
    // Remove any remaining escape sequences
    .replace(/\\[rnt]/g, ' ')
    // Clean up any remaining multiple spaces
    .replace(/\s+/g, ' ')
    .trim()
  
  return cleaned
}

// Function to process a single product
async function processProduct(product) {
  const updates = {}
  let hasChanges = false
  
  // Clean up short descriptions
  if (product.short_description_en) {
    const cleaned = cleanupDescription(product.short_description_en)
    if (cleaned !== product.short_description_en) {
      updates.short_description_en = cleaned
      hasChanges = true
    }
  }
  
  if (product.short_description_ja) {
    const cleaned = cleanupDescription(product.short_description_ja)
    if (cleaned !== product.short_description_ja) {
      updates.short_description_ja = cleaned
      hasChanges = true
    }
  }
  
  // Clean up full descriptions
  if (product.description_en) {
    const cleaned = cleanupDescription(product.description_en)
    if (cleaned !== product.description_en) {
      updates.description_en = cleaned
      hasChanges = true
    }
  }
  
  if (product.description_ja) {
    const cleaned = cleanupDescription(product.description_ja)
    if (cleaned !== product.description_ja) {
      updates.description_ja = cleaned
      hasChanges = true
    }
  }
  
  return { hasChanges, updates }
}

// Function to update product in database
async function updateProduct(productId, updates) {
  const { error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', productId)
  
  if (error) {
    throw new Error(`Failed to update product ${productId}: ${error.message}`)
  }
}

// Main function
async function main() {
  console.log('🧹 STARTING PRODUCT DESCRIPTIONS CLEANUP')
  console.log('========================================')
  
  try {
    // Get all products with descriptions
    console.log('📊 Fetching products with descriptions...')
    const { data: products, error } = await supabase
      .from('products')
      .select('id, sku, name_en, short_description_en, short_description_ja, description_en, description_ja')
      .or('short_description_en.neq.null,short_description_ja.neq.null,description_en.neq.null,description_ja.neq.null')
      .order('sku')
    
    if (error) {
      throw new Error(`Failed to fetch products: ${error.message}`)
    }
    
    console.log(`📦 Found ${products.length} products with descriptions`)
    
    // Process products in batches
    const results = {
      total: products.length,
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: []
    }
    
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE)
      console.log(`\n🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(products.length / BATCH_SIZE)}`)
      
      for (const product of batch) {
        try {
          const { hasChanges, updates } = await processProduct(product)
          results.processed++
          
          if (hasChanges) {
            await updateProduct(product.id, updates)
            results.updated++
            
            console.log(`  ✅ Updated: ${product.sku} (${product.name_en})`)
            
            // Show what was changed
            Object.keys(updates).forEach(field => {
              const original = product[field]
              const cleaned = updates[field]
              if (original !== cleaned) {
                console.log(`    📝 ${field}:`)
                console.log(`      Before: "${original.substring(0, 100)}${original.length > 100 ? '...' : ''}"`)
                console.log(`      After:  "${cleaned.substring(0, 100)}${cleaned.length > 100 ? '...' : ''}"`)
              }
            })
          } else {
            results.skipped++
            console.log(`  ⏭️  Skipped: ${product.sku} (no changes needed)`)
          }
          
        } catch (error) {
          results.errors.push({
            sku: product.sku,
            error: error.message
          })
          console.log(`  ❌ Failed: ${product.sku} - ${error.message}`)
        }
      }
      
      // Delay between batches
      if (i + BATCH_SIZE < products.length) {
        console.log(`⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`)
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES))
      }
    }
    
    // Final report
    console.log('\n🎉 CLEANUP COMPLETE!')
    console.log('====================')
    console.log(`📊 Products processed: ${results.processed}/${results.total}`)
    console.log(`✅ Products updated: ${results.updated}`)
    console.log(`⏭️  Products skipped: ${results.skipped}`)
    console.log(`❌ Errors: ${results.errors.length}`)
    
    if (results.errors.length > 0) {
      console.log(`\n⚠️  ERRORS (${results.errors.length}):`)
      results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.sku}: ${error.error}`)
      })
    }
    
    console.log('\n✨ All product descriptions have been cleaned up!')
    
  } catch (error) {
    console.error('💥 Fatal error:', error.message)
    process.exit(1)
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error)
}

module.exports = { main, cleanupDescription, processProduct }
