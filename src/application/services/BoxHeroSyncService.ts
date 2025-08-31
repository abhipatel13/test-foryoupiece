import { Result, DomainError, ID } from '@/shared/types/common';
import { BoxHeroService, BoxHeroItem, BoxHeroSyncResult } from '@/infrastructure/services/BoxHeroService';
import { IProductRepository } from '@/domain/repositories/IProductRepository';
import { Product } from '@/domain/entities/Product';
import { SKU } from '@/domain/value-objects/SKU';
import { Price } from '@/domain/value-objects/Price';
import { CategoriesService } from '@/lib/categories-service';

export interface SyncOptions {
  locationIds?: number[];
  dryRun?: boolean;
  updateExisting?: boolean;
  addNew?: boolean;
  syncStock?: boolean;
}

export interface ProductMapping {
  boxHeroId: string;
  forYouPieceId?: string;
  sku: string;
  name: string;
  matched: boolean;
  action: 'create' | 'update' | 'skip';
  reason?: string;
}

export interface SyncReport {
  startTime: Date;
  endTime: Date;
  duration: number;
  totalBoxHeroItems: number;
  mappings: ProductMapping[];
  itemsCreated: number;
  itemsUpdated: number;
  itemsSkipped: number;
  errors: Array<{
    item: string;
    error: string;
    details?: any;
  }>;
  success: boolean;
}

/**
 * BoxHero Sync Service
 * Handles synchronization between BoxHero inventory and ForYouPiece products
 */
export class BoxHeroSyncService {
  private categoryMap: Map<string, string> = new Map();

  constructor(
    private boxHeroService: BoxHeroService,
    private productRepository: IProductRepository
  ) {}

  /**
   * Test BoxHero connection
   */
  async testConnection(): Promise<Result<boolean>> {
    return this.boxHeroService.testConnection();
  }

  /**
   * Get BoxHero locations for configuration
   */
  async getLocations() {
    return this.boxHeroService.getLocations();
  }

  /**
   * Get BoxHero categories for mapping
   */
  async getCategories() {
    return this.boxHeroService.getCategories();
  }

  /**
   * Initialize category mapping from local categories
   */
  private async initializeCategoryMapping(): Promise<void> {
    try {
      const categories = await CategoriesService.getCategories();
      this.categoryMap.clear();
      categories.forEach(category => {
        this.categoryMap.set(category.slug, category.id);
      });
      console.log(`📂 Initialized category mapping with ${this.categoryMap.size} categories`);
    } catch (error) {
      console.error('❌ Failed to initialize category mapping:', error);
    }
  }

  /**
   * Map BoxHero category attribute to local category ID
   */
  private mapBoxHeroCategoryToId(boxHeroItem: BoxHeroItem): string | null {
    const categoryAttr = boxHeroItem.attrs?.find(attr => attr.name === 'Category');
    if (!categoryAttr?.value) {
      return null;
    }

    const boxheroCategory = categoryAttr.value.toString().toLowerCase();

    // Map BoxHero categories to our category slugs
    switch (boxheroCategory) {
      case 'hair':
        return this.categoryMap.get('hair') || null;
      case 'bath & body':
        return this.categoryMap.get('bath-body') || null;
      case 'skincare':
        return this.categoryMap.get('skincare') || null;
      case 'health & personal care':
        return this.categoryMap.get('health-personal-care') || null;
      case 'food & beverage':
        return this.categoryMap.get('food-beverage') || null;
      case 'makeup':
        return this.categoryMap.get('makeup') || null;
      case 'home':
        return this.categoryMap.get('home') || null;
      default:
        // Try partial matching for edge cases
        if (boxheroCategory.includes('home')) {
          return this.categoryMap.get('home') || null;
        } else if (boxheroCategory.includes('food') || boxheroCategory.includes('beverage')) {
          return this.categoryMap.get('food-beverage') || null;
        }
        return null;
    }
  }

  /**
   * Perform full sync between BoxHero and ForYouPiece
   */
  async performSync(options: SyncOptions = {}): Promise<Result<SyncReport>> {
    const startTime = new Date();
    const report: SyncReport = {
      startTime,
      endTime: startTime,
      duration: 0,
      totalBoxHeroItems: 0,
      mappings: [],
      itemsCreated: 0,
      itemsUpdated: 0,
      itemsSkipped: 0,
      errors: [],
      success: false,
    };

    try {
      // Step 0: Initialize category mapping
      console.log('📂 Initializing category mapping...');
      await this.initializeCategoryMapping();

      // Step 1: Fetch all BoxHero items
      console.log('🔄 Fetching BoxHero items...');
      console.log('🔍 Sync options received:', options);
      const boxHeroItemsResult = await this.boxHeroService.getAllItems(options.locationIds);
      
      if (!boxHeroItemsResult.success) {
        report.errors.push({
          item: 'BoxHero API',
          error: 'Failed to fetch BoxHero items',
          details: boxHeroItemsResult.error
        });
        return { success: false, error: boxHeroItemsResult.error };
      }

      const boxHeroItems = boxHeroItemsResult.data;
      report.totalBoxHeroItems = boxHeroItems.length;
      console.log(`📦 Found ${boxHeroItems.length} items in BoxHero`);

      // Step 2: Fetch existing ForYouPiece products
      console.log('🔄 Fetching existing products...');
      const existingProductsResult = await this.productRepository.findMany({
        limit: 1000, // Get all products
        offset: 0,
      });

      if (!existingProductsResult.success) {
        report.errors.push({
          item: 'ForYouPiece Database',
          error: 'Failed to fetch existing products',
          details: existingProductsResult.error
        });
        return { success: false, error: existingProductsResult.error };
      }

      const existingProducts = existingProductsResult.data.data;
      console.log(`🏪 Found ${existingProducts.length} existing products`);

      // Step 3: Create product mappings
      console.log('🔄 Creating product mappings...');
      const mappings = await this.createProductMappings(boxHeroItems, existingProducts);
      report.mappings = mappings;

      // Step 4: Process each mapping
      console.log('🔄 Processing product mappings...');
      console.log(`📊 Total mappings to process: ${mappings.length}`);

      // Debug: Show first few mappings
      console.log('🔍 First 3 mappings:', mappings.slice(0, 3).map(m => ({ name: m.name, action: m.action, matched: m.matched })));

      for (const mapping of mappings) {
        console.log(`🔍 Loop iteration for: ${mapping.name} (action: ${mapping.action})`);
        try {
          if (options.dryRun) {
            console.log(`[DRY RUN] Would ${mapping.action} product: ${mapping.name}`);
            continue;
          }

          console.log(`🔍 After dry run check for: ${mapping.name}`);
          console.log(`🔍 Looking for BoxHero ID: ${mapping.boxHeroId} (type: ${typeof mapping.boxHeroId})`);
          console.log(`🔍 First BoxHero item ID: ${boxHeroItems[0]?.id} (type: ${typeof boxHeroItems[0]?.id})`);
          const boxHeroItem = boxHeroItems.find(item => item.id.toString() === mapping.boxHeroId);
          if (!boxHeroItem) {
            console.log(`❌ BoxHero item not found: ${mapping.boxHeroId} for ${mapping.name}`);
            report.errors.push({
              item: mapping.name,
              error: 'BoxHero item not found',
            });
            continue;
          }
          console.log(`✅ Found BoxHero item for: ${mapping.name}`);

          console.log(`🔄 Processing ${mapping.action} for: ${mapping.name} (addNew: ${options.addNew}, updateExisting: ${options.updateExisting})`);

          try {
            if (mapping.action === 'create' && options.addNew !== false) {
              console.log(`✅ Creating product: ${mapping.name}`);
              await this.createProductFromBoxHero(boxHeroItem, mapping, report);
            } else if (mapping.action === 'update' && options.updateExisting !== false) {
              console.log(`🔄 Updating product: ${mapping.name}`);
              await this.updateProductFromBoxHero(boxHeroItem, mapping, report);
            } else {
              report.itemsSkipped++;
              console.log(`⏭️ Skipped ${mapping.name} (${mapping.action} disabled or conditions not met)`);
            }
          } catch (productError) {
            // Individual product processing errors are already handled in the methods above
            // This is a fallback in case of unexpected errors
            console.error(`❌ Unexpected error processing ${mapping.name}:`, productError);
            report.errors.push({
              item: mapping.name,
              error: 'Unexpected processing error',
              details: productError instanceof Error ? productError.message : String(productError)
            });
          }
        } catch (error) {
          report.errors.push({
            item: mapping.name,
            error: 'Processing failed',
            details: error
          });
          console.error(`❌ Error processing ${mapping.name}:`, error);
        }
      }

      // Step 5: Finalize report
      report.endTime = new Date();
      report.duration = report.endTime.getTime() - report.startTime.getTime();
      report.success = report.errors.length === 0;

      console.log('✅ Sync completed!');
      console.log(`📊 Summary: ${report.itemsCreated} created, ${report.itemsUpdated} updated, ${report.itemsSkipped} skipped`);
      console.log(`⏱️ Duration: ${report.duration}ms`);

      return { success: true, data: report };
    } catch (error) {
      report.endTime = new Date();
      report.duration = report.endTime.getTime() - report.startTime.getTime();
      report.errors.push({
        item: 'Sync Process',
        error: 'Unexpected error during sync',
        details: error
      });

      return {
        success: false,
        error: new DomainError('Sync process failed', 'SYNC_ERROR', { report, error })
      };
    }
  }

  /**
   * Create product mappings between BoxHero items and ForYouPiece products
   */
  private async createProductMappings(
    boxHeroItems: BoxHeroItem[],
    existingProducts: Product[]
  ): Promise<ProductMapping[]> {
    const mappings: ProductMapping[] = [];

    for (const boxHeroItem of boxHeroItems) {
      const mapping: ProductMapping = {
        boxHeroId: boxHeroItem.id.toString(),
        sku: boxHeroItem.sku || `BH-${boxHeroItem.id}`,
        name: boxHeroItem.name,
        matched: false,
        action: 'create',
      };

      // Try to find existing product by SKU
      const existingProduct = existingProducts.find(product => 
        product.sku.value === mapping.sku ||
        product.nameEn.toLowerCase() === boxHeroItem.name.toLowerCase()
      );

      if (existingProduct) {
        mapping.matched = true;
        mapping.forYouPieceId = existingProduct.id;
        mapping.action = 'update';
        mapping.reason = 'Found matching product by SKU or name';
      } else {
        mapping.reason = 'No matching product found, will create new';
      }

      mappings.push(mapping);
    }

    return mappings;
  }

  /**
   * Create a new ForYouPiece product from BoxHero item
   */
  private async createProductFromBoxHero(
    boxHeroItem: BoxHeroItem,
    mapping: ProductMapping,
    report: SyncReport
  ): Promise<void> {
    try {
      console.log(`🏗️ Creating product in database: ${boxHeroItem.name}`);

      // Validate required fields before proceeding
      if (!boxHeroItem.name || boxHeroItem.name.trim() === '') {
        throw new Error(`BoxHero item ${boxHeroItem.id} has empty or null name`);
      }

      // Calculate total stock across all locations with validation
      const totalStock = (Array.isArray(boxHeroItem.quantities) ? boxHeroItem.quantities : []).reduce(
        (sum, location) => {
          const qty = Number((location as any)?.quantity)
          const safeQty = Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : 0
          return sum + safeQty
        },
        0
      );

      // Extract category from attributes
      const categoryAttr = boxHeroItem.attrs?.find(attr => attr.name === 'Category');
      const brandAttr = boxHeroItem.attrs?.find(attr => attr.name === 'Brand');
      const subCategoryAttr = boxHeroItem.attrs?.find(attr => attr.name === 'Sub-category');

      // Use USD price directly from BoxHero with validation
      const parsedPrice = Number((boxHeroItem as any).price)
      const usdPrice = Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : 0;

      // Map category from BoxHero attributes
      const categoryId = this.mapBoxHeroCategoryToId(boxHeroItem);

      // Ensure names are valid (required for database NOT NULL constraints)
      const safeName = boxHeroItem.name.trim();
      const safeDescription = `${brandAttr?.value || ''} ${safeName}`.trim();

      // Create product entity with correct field names
      const product = Product.create({
        name_en: safeName,
        name_ja: safeName, // Use same name for now, can be updated later (required by DB)
        description_en: safeDescription,
        description_ja: safeDescription,
        sku: mapping.sku,
        price: usdPrice,
        // Removed invalid 'currency' field - not part of ProductProps
        stock_quantity: totalStock,
        low_stock_threshold: 5, // Default threshold
        is_active: true,
        is_featured: false,
        category_id: categoryId, // Mapped from BoxHero category
        // image_urls intentionally excluded for BoxHero-created products. Images must be uploaded manually via admin.
        tags: [
          categoryAttr?.value?.toString() || '',
          subCategoryAttr?.value?.toString() || '',
          brandAttr?.value?.toString() || ''
        ].filter(Boolean),
        metadata: {
          boxhero_id: boxHeroItem.id,
          boxhero_synced_at: new Date().toISOString(),
          boxhero_quantities: boxHeroItem.quantities,
          boxhero_attrs: boxHeroItem.attrs,
          boxhero_cost: boxHeroItem.cost,
          boxhero_barcode: boxHeroItem.barcode,
        },
      });

      const result = await this.productRepository.create(product);

      if (result.success) {
        mapping.forYouPieceId = result.data.id;
        report.itemsCreated++;
        console.log(`✅ Created product: ${safeName} (Stock: ${totalStock})`);
      } else {
        console.error(`❌ Failed to create product ${safeName}:`, result.error);
        report.errors.push({
          item: safeName,
          error: 'Database creation failed',
          details: result.error
        });
        // Don't throw here - continue processing other products
        return;
      }
    } catch (error) {
      const itemName = boxHeroItem.name || `BoxHero ID: ${boxHeroItem.id}`;
      console.error(`❌ Error creating product ${itemName}:`, error);
      report.errors.push({
        item: itemName,
        error: 'Failed to create product',
        details: error instanceof Error ? error.message : String(error)
      });
      // Don't throw here - continue processing other products
      return;
    }
  }

  /**
   * Update existing ForYouPiece product from BoxHero item
   */
  private async updateProductFromBoxHero(
    boxHeroItem: BoxHeroItem,
    mapping: ProductMapping,
    report: SyncReport
  ): Promise<void> {
    try {
      if (!mapping.forYouPieceId) {
        throw new Error('No ForYouPiece product ID for update');
      }

      // Get existing product
      const existingResult = await this.productRepository.findById(mapping.forYouPieceId);
      if (!existingResult.success || !existingResult.data) {
        throw new Error('Existing product not found');
      }

      const existingProduct = existingResult.data;

      // Calculate total stock across all locations with validation
      const totalStock = (Array.isArray(boxHeroItem.quantities) ? boxHeroItem.quantities : []).reduce(
        (sum, location) => {
          const qty = Number((location as any)?.quantity)
          const safeQty = Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : 0
          return sum + safeQty
        },
        0
      );

      // Extract price from BoxHero (ensure it's a valid number)
      const parsedPrice = Number((boxHeroItem as any).price)
      const usdPrice = Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : 0;

      // Map category from BoxHero attributes
      const categoryId = this.mapBoxHeroCategoryToId(boxHeroItem);

      // Update product with new data (preserving bulk-updated descriptions and images)
      const updatedProduct = Product.fromPersistence({
        ...existingProduct.toPlainObject(),
        // Core fields that BoxHero should update
        stock_quantity: totalStock,
        price: usdPrice, // Update price from BoxHero
        name_en: boxHeroItem.name, // Update product names from BoxHero
        name_ja: boxHeroItem.name, // Default to same name, can be manually updated later
        category_id: categoryId, // Update category from BoxHero attributes
        updated_at: new Date().toISOString(),
        metadata: {
          ...existingProduct.metadata,
          boxhero_id: boxHeroItem.id,
          boxhero_synced_at: new Date().toISOString(),
          boxhero_quantities: boxHeroItem.quantities,
          boxhero_attrs: boxHeroItem.attrs,
          boxhero_cost: boxHeroItem.cost, // Store cost for reference
          boxhero_barcode: boxHeroItem.barcode, // Store barcode for reference
        },
        // NOTE: Explicitly preserving these fields from bulk updates:
        // - description_en, description_ja (rich descriptions from CSV)
        // - short_description_en, short_description_ja (cleaned descriptions)
        // - images (downloaded product images)
        // - brand, seo_title, seo_description (manual updates)
        // - points_rate (preserve custom point configurations)
      });

      const result = await this.productRepository.update(updatedProduct);

      if (result.success) {
        report.itemsUpdated++;
        const categoryInfo = categoryId ? `Category: ${categoryId}` : 'No category';
        console.log(`🔄 Updated product: ${boxHeroItem.name} (Stock: ${totalStock}, Price: $${usdPrice}, ${categoryInfo})`);
      } else {
        throw result.error;
      }
    } catch (error) {
      report.errors.push({
        item: boxHeroItem.name,
        error: 'Failed to update product',
        details: error
      });
      throw error;
    }
  }

  /**
   * Sync stock levels only (quick sync)
   */
  async syncStockOnly(locationIds?: number[]): Promise<Result<{ updated: number; errors: string[] }>> {
    try {
      console.log('🔄 Starting stock-only sync...');
      
      // Get all BoxHero items
      const boxHeroItemsResult = await this.boxHeroService.getAllItems(locationIds);
      if (!boxHeroItemsResult.success) {
        return { success: false, error: boxHeroItemsResult.error };
      }

      const boxHeroItems = boxHeroItemsResult.data;
      let updated = 0;
      const errors: string[] = [];

      for (const boxHeroItem of boxHeroItems) {
        try {
          if (!boxHeroItem.sku) continue;

          // Find product by SKU
          const sku = SKU.create(boxHeroItem.sku);
          const productResult = await this.productRepository.findBySku(sku);

          if (!productResult.success || !productResult.data) {
            continue; // Skip if product not found
          }

          // Skip deleted products during sync
          const product = productResult.data;
          if ((product as any).is_deleted === true) {
            console.log(`⏭️ Skipping deleted product: ${boxHeroItem.name} (SKU: ${boxHeroItem.sku})`);
            continue;
          }

          // Calculate total stock
          const totalStock = boxHeroItem.quantities.reduce(
            (sum, location) => sum + location.quantity,
            0
          );

          // Update stock
          const updateResult = await this.productRepository.updateStock(
            productResult.data.id,
            totalStock
          );

          if (updateResult.success) {
            updated++;
            console.log(`📦 Updated stock for ${boxHeroItem.name}: ${totalStock}`);
          } else {
            errors.push(`Failed to update stock for ${boxHeroItem.name}`);
          }
        } catch (error) {
          errors.push(`Error processing ${boxHeroItem.name}: ${error}`);
        }
      }

      console.log(`✅ Stock sync completed: ${updated} products updated`);
      return { success: true, data: { updated, errors } };
    } catch (error) {
      return {
        success: false,
        error: new DomainError('Stock sync failed', 'STOCK_SYNC_ERROR', error)
      };
    }
  }

  /**
   * Record sale in BoxHero when product is purchased
   */
  async recordSale(
    productId: ID,
    quantity: number,
    locationId?: string,
    reference?: string
  ): Promise<Result<void>> {
    try {
      // Get product to find BoxHero ID
      const productResult = await this.productRepository.findById(productId);
      if (!productResult.success || !productResult.data) {
        return {
          success: false,
          error: new DomainError('Product not found', 'PRODUCT_NOT_FOUND')
        };
      }

      const product = productResult.data;
      const boxHeroId = product.metadata?.boxhero_id;

      if (!boxHeroId) {
        return {
          success: false,
          error: new DomainError('Product not linked to BoxHero', 'NO_BOXHERO_LINK')
        };
      }

      // Use first location if not specified
      if (!locationId) {
        const locationsResult = await this.boxHeroService.getLocations();
        if (!locationsResult.success || locationsResult.data.length === 0) {
          return {
            success: false,
            error: new DomainError('No BoxHero locations available', 'NO_LOCATIONS')
          };
        }
        locationId = locationsResult.data[0].id;
      }

      // Record the sale as an 'out' transaction
      const result = await this.boxHeroService.recordStockMovement(
        'out',
        boxHeroId,
        locationId,
        quantity,
        product.price.value,
        'Sale from ForYouPiece',
        reference
      );

      if (!result.success) {
        return { success: false, error: result.error };
      }

      console.log(`📤 Recorded sale in BoxHero: ${product.nameEn} x${quantity}`);
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: new DomainError('Failed to record sale', 'RECORD_SALE_ERROR', error)
      };
    }
  }
}
