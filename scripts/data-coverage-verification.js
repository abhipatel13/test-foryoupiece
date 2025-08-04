#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Data coverage verification for all 758 products
async function verifyDataCoverage() {
  console.log('📊 FORYOUPIECE DATA COVERAGE VERIFICATION')
  console.log('========================================')
  
  const results = {
    total: 0,
    withDescriptions: 0,
    withImages: 0,
    withBothDescAndImages: 0,
    withShortDescriptions: 0,
    withCleanDescriptions: 0,
    missingData: [],
    summary: {
      complete: 0,
      partiallyComplete: 0,
      minimal: 0
    }
  }
  
  try {
    // Get all products
    console.log('🔍 Fetching all products...')
    const { data: products, error } = await supabase
      .from('products')
      .select('id, sku, name_en, description_en, short_description_en, images, price, stock_quantity, is_active')
      .order('created_at', { ascending: false })
    
    if (error) {
      throw new Error(`Failed to fetch products: ${error.message}`)
    }
    
    results.total = products.length
    console.log(`📦 Total products found: ${results.total}`)
    
    // Analyze each product
    console.log('\n🔍 Analyzing product data coverage...')
    
    for (const product of products) {
      let completionScore = 0
      let issues = []
      
      // Check descriptions
      const hasDescription = product.description_en && product.description_en.trim().length > 0
      const hasShortDescription = product.short_description_en && product.short_description_en.trim().length > 0
      const hasCleanDescription = hasShortDescription && 
        !product.short_description_en.includes('\\n') && 
        !product.short_description_en.includes('/n') &&
        !product.short_description_en.match(/^\s*\n/) &&
        !product.short_description_en.match(/\n\s*$/)
      
      // Check images
      const hasImages = product.images && Array.isArray(product.images) && product.images.length > 0
      
      // Check essential fields
      const hasPrice = product.price && product.price > 0
      const hasStock = product.stock_quantity !== null && product.stock_quantity !== undefined
      
      // Calculate completion score
      if (hasDescription) completionScore += 2
      if (hasShortDescription) completionScore += 2
      if (hasCleanDescription) completionScore += 1
      if (hasImages) completionScore += 2
      if (hasPrice) completionScore += 1
      if (hasStock) completionScore += 1
      if (product.is_active) completionScore += 1
      
      // Track statistics
      if (hasDescription || hasShortDescription) results.withDescriptions++
      if (hasShortDescription) results.withShortDescriptions++
      if (hasCleanDescription) results.withCleanDescriptions++
      if (hasImages) results.withImages++
      if ((hasDescription || hasShortDescription) && hasImages) results.withBothDescAndImages++
      
      // Identify issues
      if (!hasDescription && !hasShortDescription) issues.push('No descriptions')
      if (!hasImages) issues.push('No images')
      if (!hasPrice) issues.push('No price')
      if (!hasStock && hasStock !== 0) issues.push('No stock info')
      if (!product.is_active) issues.push('Inactive')
      
      // Categorize completion level
      if (completionScore >= 8) {
        results.summary.complete++
      } else if (completionScore >= 5) {
        results.summary.partiallyComplete++
      } else {
        results.summary.minimal++
        
        // Track products with significant missing data
        if (issues.length > 0) {
          results.missingData.push({
            sku: product.sku,
            name: product.name_en,
            score: completionScore,
            issues: issues,
            hasDescription: hasDescription,
            hasShortDescription: hasShortDescription,
            hasImages: hasImages,
            hasPrice: hasPrice
          })
        }
      }
    }
    
    // Generate report
    console.log('\n📊 DATA COVERAGE ANALYSIS RESULTS')
    console.log('=================================')
    
    const descriptionCoverage = Math.round((results.withDescriptions / results.total) * 100)
    const shortDescCoverage = Math.round((results.withShortDescriptions / results.total) * 100)
    const cleanDescCoverage = Math.round((results.withCleanDescriptions / results.total) * 100)
    const imageCoverage = Math.round((results.withImages / results.total) * 100)
    const completeCoverage = Math.round((results.withBothDescAndImages / results.total) * 100)
    
    console.log(`\n📝 DESCRIPTION COVERAGE:`)
    console.log(`   Products with descriptions: ${results.withDescriptions}/${results.total} (${descriptionCoverage}%)`)
    console.log(`   Products with short descriptions: ${results.withShortDescriptions}/${results.total} (${shortDescCoverage}%)`)
    console.log(`   Products with clean descriptions: ${results.withCleanDescriptions}/${results.total} (${cleanDescCoverage}%)`)
    
    console.log(`\n🖼️ IMAGE COVERAGE:`)
    console.log(`   Products with images: ${results.withImages}/${results.total} (${imageCoverage}%)`)
    
    console.log(`\n🎯 COMPLETE DATA COVERAGE:`)
    console.log(`   Products with both descriptions & images: ${results.withBothDescAndImages}/${results.total} (${completeCoverage}%)`)
    
    console.log(`\n📈 COMPLETION LEVELS:`)
    console.log(`   Complete (8+ score): ${results.summary.complete} products (${Math.round((results.summary.complete / results.total) * 100)}%)`)
    console.log(`   Partially Complete (5-7 score): ${results.summary.partiallyComplete} products (${Math.round((results.summary.partiallyComplete / results.total) * 100)}%)`)
    console.log(`   Minimal (0-4 score): ${results.summary.minimal} products (${Math.round((results.summary.minimal / results.total) * 100)}%)`)
    
    // Show products with missing data
    if (results.missingData.length > 0) {
      console.log(`\n⚠️ PRODUCTS WITH MISSING DATA (${results.missingData.length} products):`)
      console.log('================================================')
      
      // Sort by completion score (lowest first)
      results.missingData.sort((a, b) => a.score - b.score)
      
      // Show first 20 products with most issues
      const showCount = Math.min(20, results.missingData.length)
      for (let i = 0; i < showCount; i++) {
        const product = results.missingData[i]
        console.log(`\n${i + 1}. SKU: ${product.sku}`)
        console.log(`   Name: ${product.name}`)
        console.log(`   Score: ${product.score}/10`)
        console.log(`   Issues: ${product.issues.join(', ')}`)
        console.log(`   Has Description: ${product.hasDescription ? '✅' : '❌'}`)
        console.log(`   Has Short Description: ${product.hasShortDescription ? '✅' : '❌'}`)
        console.log(`   Has Images: ${product.hasImages ? '✅' : '❌'}`)
        console.log(`   Has Price: ${product.hasPrice ? '✅' : '❌'}`)
      }
      
      if (results.missingData.length > showCount) {
        console.log(`\n... and ${results.missingData.length - showCount} more products with missing data`)
      }
    }
    
    // Overall assessment
    console.log(`\n🎯 OVERALL ASSESSMENT:`)
    console.log('======================')
    
    if (completeCoverage >= 90) {
      console.log('🎉 EXCELLENT! Over 90% of products have complete data coverage.')
    } else if (completeCoverage >= 75) {
      console.log('✅ GOOD! Most products have good data coverage.')
    } else if (completeCoverage >= 50) {
      console.log('⚠️ MODERATE! About half the products have complete data.')
    } else {
      console.log('❌ NEEDS IMPROVEMENT! Many products are missing essential data.')
    }
    
    console.log(`\n📋 RECOMMENDATIONS:`)
    console.log('===================')
    
    if (results.withDescriptions < results.total * 0.9) {
      console.log('• Consider bulk-updating more products with rich descriptions')
    }
    
    if (results.withImages < results.total * 0.9) {
      console.log('• Download and add images for products without them')
    }
    
    if (results.missingData.length > 50) {
      console.log('• Focus on completing the most incomplete products first')
    }
    
    console.log('• Use the admin interface to manually complete high-priority products')
    console.log('• Consider automated data enrichment for products with minimal information')
    
    // Save detailed report
    const reportPath = path.join(__dirname, 'data-coverage-report.json')
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: results,
      missingDataProducts: results.missingData
    }, null, 2))
    
    console.log(`\n💾 Detailed report saved to: ${reportPath}`)
    
  } catch (error) {
    console.error('💥 Verification failed:', error.message)
    process.exit(1)
  }
}

// Run the verification
if (require.main === module) {
  verifyDataCoverage().catch(console.error)
}

module.exports = { verifyDataCoverage }
