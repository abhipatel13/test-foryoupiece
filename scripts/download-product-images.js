#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
const https = require('https')
const http = require('http')
require('dotenv').config({ path: '.env.local' })

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Configuration
const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images', 'products')
const BATCH_SIZE = 5 // Download 5 images at a time
const DELAY_BETWEEN_BATCHES = 1000 // 1 second delay

// Ensure images directory exists
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
    console.log(`📁 Created directory: ${dirPath}`)
  }
}

// Download a single image
function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http
    
    const request = protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        console.log(`🔄 Redirecting: ${url} -> ${response.headers.location}`)
        return downloadImage(response.headers.location, filepath).then(resolve).catch(reject)
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`))
        return
      }
      
      const fileStream = fs.createWriteStream(filepath)
      response.pipe(fileStream)
      
      fileStream.on('finish', () => {
        fileStream.close()
        resolve(filepath)
      })
      
      fileStream.on('error', (err) => {
        fs.unlink(filepath, () => {}) // Delete partial file
        reject(err)
      })
    })
    
    request.on('error', reject)
    request.setTimeout(30000, () => {
      request.destroy()
      reject(new Error('Request timeout'))
    })
  })
}

// Get file extension from URL
function getFileExtension(url) {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const ext = path.extname(pathname).toLowerCase()
    
    // Common image extensions
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
      return ext
    }
    
    // Default to .jpg if no extension found
    return '.jpg'
  } catch (error) {
    return '.jpg'
  }
}

// Sanitize filename
function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

// Process a single product
async function processProduct(product) {
  const results = {
    productId: product.id,
    sku: product.sku,
    originalImages: product.images,
    downloadedImages: [],
    errors: []
  }
  
  console.log(`\n📦 Processing: ${product.sku} (${product.images.length} images)`)
  
  // Create product directory
  const productDir = path.join(IMAGES_DIR, sanitizeFilename(product.sku))
  ensureDirectoryExists(productDir)
  
  for (let i = 0; i < product.images.length; i++) {
    const imageUrl = product.images[i]
    const extension = getFileExtension(imageUrl)
    const filename = `image_${i + 1}${extension}`
    const filepath = path.join(productDir, filename)
    const relativePath = `/images/products/${sanitizeFilename(product.sku)}/${filename}`
    
    try {
      console.log(`  📥 Downloading: ${imageUrl}`)
      await downloadImage(imageUrl, filepath)
      
      // Verify file was created and has content
      const stats = fs.statSync(filepath)
      if (stats.size === 0) {
        throw new Error('Downloaded file is empty')
      }
      
      results.downloadedImages.push(relativePath)
      console.log(`  ✅ Downloaded: ${filename} (${Math.round(stats.size / 1024)}KB)`)
      
    } catch (error) {
      console.log(`  ❌ Failed: ${error.message}`)
      results.errors.push({
        url: imageUrl,
        error: error.message
      })
    }
  }
  
  return results
}

// Update product images in database
async function updateProductImages(productId, newImages) {
  const { error } = await supabase
    .from('products')
    .update({ images: newImages })
    .eq('id', productId)
  
  if (error) {
    throw new Error(`Database update failed: ${error.message}`)
  }
}

// Main function
async function main() {
  console.log('🚀 STARTING PRODUCT IMAGES DOWNLOAD')
  console.log('===================================')
  
  // Ensure base directory exists
  ensureDirectoryExists(IMAGES_DIR)
  
  try {
    // Get all products with images
    console.log('📊 Fetching products with images...')
    const { data: products, error } = await supabase
      .from('products')
      .select('id, sku, name_en, images')
      .not('images', 'is', null)
      .order('sku')
    
    if (error) {
      throw new Error(`Failed to fetch products: ${error.message}`)
    }
    
    console.log(`📦 Found ${products.length} products with images`)
    
    // Process products in batches
    const results = {
      total: products.length,
      processed: 0,
      successful: 0,
      failed: 0,
      totalImages: 0,
      downloadedImages: 0,
      errors: []
    }
    
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE)
      console.log(`\n🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(products.length / BATCH_SIZE)}`)
      
      for (const product of batch) {
        try {
          const result = await processProduct(product)
          results.processed++
          results.totalImages += result.originalImages.length
          results.downloadedImages += result.downloadedImages.length
          
          if (result.downloadedImages.length > 0) {
            // Update database with new image paths
            await updateProductImages(product.id, result.downloadedImages)
            results.successful++
            console.log(`  💾 Updated database for ${product.sku}`)
          } else {
            results.failed++
            console.log(`  ⚠️  No images downloaded for ${product.sku}`)
          }
          
          if (result.errors.length > 0) {
            results.errors.push(...result.errors.map(err => ({
              sku: product.sku,
              ...err
            })))
          }
          
        } catch (error) {
          results.processed++
          results.failed++
          console.log(`  ❌ Failed to process ${product.sku}: ${error.message}`)
          results.errors.push({
            sku: product.sku,
            error: error.message
          })
        }
      }
      
      // Delay between batches to avoid overwhelming the servers
      if (i + BATCH_SIZE < products.length) {
        console.log(`⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`)
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES))
      }
    }
    
    // Final report
    console.log('\n🎉 DOWNLOAD COMPLETE!')
    console.log('====================')
    console.log(`📊 Products processed: ${results.processed}/${results.total}`)
    console.log(`✅ Successful: ${results.successful}`)
    console.log(`❌ Failed: ${results.failed}`)
    console.log(`🖼️  Total images: ${results.totalImages}`)
    console.log(`📥 Downloaded: ${results.downloadedImages}`)
    console.log(`💾 Images saved to: ${IMAGES_DIR}`)
    
    if (results.errors.length > 0) {
      console.log(`\n⚠️  ERRORS (${results.errors.length}):`)
      results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.sku}: ${error.error}`)
      })
    }
    
  } catch (error) {
    console.error('💥 Fatal error:', error.message)
    process.exit(1)
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error)
}

module.exports = { main, processProduct, downloadImage }
