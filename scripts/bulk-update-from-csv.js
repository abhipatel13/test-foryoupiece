#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Clean HTML content and extract plain text for descriptions
 */
function cleanHtmlContent(htmlContent) {
  if (!htmlContent) return null;
  
  // Remove HTML tags and decode HTML entities
  let cleaned = htmlContent
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n\s*\n/g, '\n') // Remove multiple newlines
    .trim();
    
  return cleaned || null;
}

/**
 * Parse CSV file and return array of product data
 */
async function parseCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];

    fs.createReadStream(filePath)
      .pipe(csv({
        skipEmptyLines: true,
        skipLinesWithError: true
      }))
      .on('data', (data) => {
        try {
          // Handle BOM character in column names
          const skuKey = Object.keys(data).find(key => key.includes('SKU')) || 'SKU';

          // Clean and process the data
          const product = {
            sku: data[skuKey]?.trim(),
            name: data.Name?.trim(),
            shortDescription: data['Short description']?.trim(),
            imageUrl: data.Images?.trim()
          };

          // Debug logging for first few products
          if (results.length < 3) {
            console.log('🔍 Debug - Raw CSV row:', data);
            console.log('🔍 Debug - Processed product:', product);
          }

          if (product.sku && product.name) {
            results.push(product);
          } else {
            console.log(`⚠️  Skipping invalid product: SKU=${product.sku}, Name=${product.name}`);
          }
        } catch (error) {
          console.log(`⚠️  Error processing CSV row:`, error.message);
        }
      })
      .on('end', () => {
        console.log(`📊 Parsed ${results.length} products from CSV`);
        resolve(results);
      })
      .on('error', (error) => {
        console.error('CSV parsing error:', error);
        reject(error);
      });
  });
}

/**
 * Update a single product in the database
 */
async function updateProduct(csvProduct) {
  try {
    // First, check if product exists by SKU (try with SKU- prefix)
    const skuToSearch = csvProduct.sku.startsWith('SKU-') ? csvProduct.sku : `SKU-${csvProduct.sku}`;

    const { data: existingProduct, error: findError } = await supabase
      .from('products')
      .select('id, sku, name_en, short_description_en, images')
      .eq('sku', skuToSearch)
      .single();

    if (findError) {
      if (findError.code === 'PGRST116') {
        return {
          success: false,
          sku: csvProduct.sku,
          error: 'Product not found in database'
        };
      }
      throw findError;
    }

    // Prepare update data
    const updateData = {
      updated_at: new Date().toISOString()
    };

    // Update name if provided
    if (csvProduct.name) {
      updateData.name_en = csvProduct.name;
      // Also update Japanese name to same value if not already set
      if (!existingProduct.name_ja) {
        updateData.name_ja = csvProduct.name;
      }
    }

    // Update short description if provided
    if (csvProduct.shortDescription) {
      const cleanDescription = cleanHtmlContent(csvProduct.shortDescription);
      if (cleanDescription) {
        updateData.short_description_en = cleanDescription;
        // Also update Japanese short description if not already set
        if (!existingProduct.short_description_ja) {
          updateData.short_description_ja = cleanDescription;
        }
      }
    }

    // Update image if provided and not already present
    if (csvProduct.imageUrl) {
      const currentImages = existingProduct.images || [];
      if (!currentImages.includes(csvProduct.imageUrl)) {
        updateData.images = [csvProduct.imageUrl, ...currentImages];
      }
    }

    // Perform the update
    const { data: updatedProduct, error: updateError } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', existingProduct.id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return {
      success: true,
      sku: csvProduct.sku,
      productId: existingProduct.id,
      updatedFields: Object.keys(updateData).filter(key => key !== 'updated_at')
    };

  } catch (error) {
    return {
      success: false,
      sku: csvProduct.sku,
      error: error.message
    };
  }
}

/**
 * Main bulk update function
 */
async function bulkUpdateFromCsv(csvFilePath, options = {}) {
  const { dryRun = false, batchSize = 10 } = options;
  
  console.log('🚀 Starting bulk update from CSV...');
  console.log(`📁 CSV File: ${csvFilePath}`);
  console.log(`🔧 Dry Run: ${dryRun ? 'Yes' : 'No'}`);
  console.log(`📦 Batch Size: ${batchSize}`);
  console.log('');

  try {
    // Parse CSV file
    const csvProducts = await parseCsvFile(csvFilePath);
    
    if (csvProducts.length === 0) {
      console.log('❌ No valid products found in CSV file');
      return;
    }

    // Initialize counters
    let processed = 0;
    let updated = 0;
    let errors = 0;
    const errorDetails = [];

    console.log(`📊 Processing ${csvProducts.length} products...`);
    console.log('');

    // Process in batches
    for (let i = 0; i < csvProducts.length; i += batchSize) {
      const batch = csvProducts.slice(i, i + batchSize);
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(csvProducts.length / batchSize)}...`);

      if (!dryRun) {
        // Process batch
        const batchPromises = batch.map(product => updateProduct(product));
        const batchResults = await Promise.all(batchPromises);

        // Process results
        for (const result of batchResults) {
          processed++;
          
          if (result.success) {
            updated++;
            console.log(`✅ ${result.sku}: Updated ${result.updatedFields.join(', ')}`);
          } else {
            errors++;
            errorDetails.push(result);
            console.log(`❌ ${result.sku}: ${result.error}`);
          }
        }
      } else {
        // Dry run - just log what would be updated
        for (const product of batch) {
          processed++;
          console.log(`🔍 ${product.sku}: Would update name, short_description, images`);
        }
      }

      // Small delay between batches to avoid overwhelming the database
      if (i + batchSize < csvProducts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Final summary
    console.log('');
    console.log('📊 BULK UPDATE SUMMARY');
    console.log('========================');
    console.log(`📦 Total products processed: ${processed}`);
    console.log(`✅ Successfully updated: ${updated}`);
    console.log(`❌ Errors: ${errors}`);
    
    if (errorDetails.length > 0) {
      console.log('');
      console.log('❌ ERROR DETAILS:');
      errorDetails.forEach(error => {
        console.log(`   ${error.sku}: ${error.error}`);
      });
    }

    console.log('');
    console.log(dryRun ? '🔍 Dry run completed!' : '🎉 Bulk update completed!');

  } catch (error) {
    console.error('💥 Fatal error during bulk update:', error);
    process.exit(1);
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const csvFile = args[0];
  const dryRun = args.includes('--dry-run');
  const batchSize = parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1]) || 10;

  if (!csvFile) {
    console.log('Usage: node bulk-update-from-csv.js <csv-file> [--dry-run] [--batch-size=10]');
    console.log('');
    console.log('Examples:');
    console.log('  node bulk-update-from-csv.js products.csv --dry-run');
    console.log('  node bulk-update-from-csv.js products.csv --batch-size=5');
    process.exit(1);
  }

  if (!fs.existsSync(csvFile)) {
    console.error(`❌ CSV file not found: ${csvFile}`);
    process.exit(1);
  }

  bulkUpdateFromCsv(csvFile, { dryRun, batchSize });
}

module.exports = { bulkUpdateFromCsv, cleanHtmlContent };
