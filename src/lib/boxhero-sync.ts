/**
 * BoxHero Manual Sync Service
 * Handles manual synchronization of categories from BoxHero to local database
 */

import { boxHeroApi, type BoxHeroCategory } from './boxhero-api';
import { CategoriesService, type Category } from './categories-service';

/**
 * Get the base URL for internal API calls
 * Uses NEXT_PUBLIC_SITE_URL in production or localhost in development
 */
function getBaseUrl(): string {
  // In production, use the public site URL
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  // In development, try to detect the current port from environment
  const port = process.env.PORT || '3000';
  return `http://localhost:${port}`;
}

/**
 * Map category names to appropriate emojis
 */
function getCategoryEmoji(categoryName: string): string {
  const name = categoryName.toLowerCase();
  
  // Based on the categories shown in your BoxHero image
  if (name.includes('bath') || name.includes('body')) return '🛁';
  if (name.includes('food') || name.includes('beverage')) return '🍽️';
  if (name.includes('hair')) return '💇';
  if (name.includes('health') || name.includes('personal care')) return '🏥';
  if (name.includes('home')) return '🏠';
  if (name.includes('makeup')) return '💄';
  if (name.includes('skincare') || name.includes('skin')) return '✨';
  
  // Fallback emojis for other categories
  if (name.includes('electronics') || name.includes('tech')) return '📱';
  if (name.includes('fashion') || name.includes('clothing')) return '👗';
  if (name.includes('beauty')) return '💄';
  if (name.includes('books') || name.includes('reading')) return '📚';
  if (name.includes('toys') || name.includes('games')) return '🎮';
  if (name.includes('sports') || name.includes('fitness')) return '⚽';
  if (name.includes('automotive') || name.includes('car')) return '🚗';
  if (name.includes('garden') || name.includes('outdoor')) return '🌱';
  
  // Default emoji
  return '📦';
}

/**
 * Create category slug from name
 */
function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * BoxHero Sync Service
 */
export class BoxHeroSyncService {
  /**
   * Comprehensive sync: categories + images + product counts
   */
  static async syncCategoriesComprehensive(triggeredBy: string = 'manual', syncImages: boolean = true): Promise<{
    success: boolean;
    categoriesSynced: number;
    totalItemsProcessed: number;
    imagesUpdated: number;
    duration: number;
    error?: string;
  }> {
    const startTime = Date.now();
    let logId: string | null = null;

    try {
      console.log('🔄 Starting comprehensive BoxHero sync (categories + images + counts)...');

      // Create sync log entry
      logId = await CategoriesService.createSyncLog({
        sync_type: 'boxhero_comprehensive',
        status: 'started',
        categories_synced: 0,
        total_items_processed: 0,
        triggered_by: triggeredBy
      });

      // Step 1: Sync categories
      console.log('📊 Step 1: Syncing categories...');
      const categoryResult = await this.syncCategories(triggeredBy);

      if (!categoryResult.success) {
        throw new Error(`Category sync failed: ${categoryResult.error}`);
      }

      // Step 2: Update category images (if enabled)
      let imagesUpdated = 0;
      if (syncImages) {
        console.log('🖼️ Step 2: Updating category images...');
        imagesUpdated = await this.syncCategoryImages();
      }

      // Step 3: Refresh product counts
      console.log('🔢 Step 3: Refreshing product counts...');
      await this.refreshProductCounts();

      const duration = Date.now() - startTime;

      // Update sync log with success
      if (logId) {
        await CategoriesService.updateSyncLog(logId, {
          status: 'completed',
          categories_synced: categoryResult.categoriesSynced,
          total_items_processed: categoryResult.totalItemsProcessed,
          sync_duration_ms: duration
        });
      }

      console.log(`✅ Comprehensive BoxHero sync completed successfully!`);
      console.log(`📊 Categories: ${categoryResult.categoriesSynced}, Images: ${imagesUpdated}, Duration: ${duration}ms`);

      return {
        success: true,
        categoriesSynced: categoryResult.categoriesSynced,
        totalItemsProcessed: categoryResult.totalItemsProcessed,
        imagesUpdated,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      console.error('❌ Comprehensive BoxHero sync failed:', errorMessage);

      // Update sync log with failure
      if (logId) {
        await CategoriesService.updateSyncLog(logId, {
          status: 'failed',
          error_message: errorMessage,
          sync_duration_ms: duration
        });
      }

      return {
        success: false,
        categoriesSynced: 0,
        totalItemsProcessed: 0,
        imagesUpdated: 0,
        duration,
        error: errorMessage
      };
    }
  }

  /**
   * Manually sync categories from BoxHero to local database
   */
  static async syncCategories(triggeredBy: string = 'manual'): Promise<{
    success: boolean;
    categoriesSynced: number;
    totalItemsProcessed: number;
    duration: number;
    error?: string;
  }> {
    const startTime = Date.now();
    let logId: string | null = null;
    
    try {
      console.log('🔄 Starting BoxHero categories sync...');
      
      // Create sync log entry
      logId = await CategoriesService.createSyncLog({
        sync_type: 'boxhero_categories',
        status: 'started',
        categories_synced: 0,
        total_items_processed: 0,
        triggered_by: triggeredBy
      });

      // Test BoxHero API connection
      const isConnected = await boxHeroApi.testConnection();
      if (!isConnected) {
        throw new Error('Failed to connect to BoxHero API');
      }

      // Fetch categories from BoxHero
      console.log('📡 Fetching categories from BoxHero...');
      const boxHeroCategories = await boxHeroApi.getCategories();
      
      if (!boxHeroCategories || boxHeroCategories.length === 0) {
        throw new Error('No categories received from BoxHero API');
      }

      console.log(`📊 Received ${boxHeroCategories.length} categories from BoxHero`);

      // Log all categories for debugging data discrepancy
      console.log('📋 All BoxHero categories:');
      boxHeroCategories.forEach(cat => {
        console.log(`  - ${cat.name}: ${cat.count} items`);
      });

      // Filter out only "Uncategorized" - include all other categories regardless of count
      // Based on BoxHero interface showing all categories have significant items
      const filteredCategories = boxHeroCategories.filter(
        category => category.name !== 'Uncategorized'
      );

      console.log(`🔍 Filtered to ${filteredCategories.length} valid categories`);
      console.log('✅ Categories to sync:');
      filteredCategories.forEach(cat => {
        console.log(`  - ${cat.name}: ${cat.count} items`);
      });

      // Transform BoxHero categories to local format
      const localCategories = filteredCategories.map((category, index) => ({
        name: category.name,
        slug: createSlug(category.name),
        description: `${category.name} products from BoxHero inventory`,
        item_count: category.count,
        sort_order: index + 1
      }));

      // Update local database with new categories
      console.log('💾 Updating local database...');

      // Deactivate existing BoxHero categories (safe method)
      await CategoriesService.clearBoxHeroCategories();

      // Insert/update new categories using BoxHero-specific method
      await CategoriesService.upsertBoxHeroCategories(localCategories);

      const duration = Date.now() - startTime;
      const totalItems = boxHeroCategories.reduce((sum, cat) => sum + cat.count, 0);

      // Update sync log with success
      if (logId) {
        await CategoriesService.updateSyncLog(logId, {
          status: 'completed',
          categories_synced: localCategories.length,
          total_items_processed: totalItems,
          sync_duration_ms: duration
        });
      }

      console.log(`✅ BoxHero sync completed successfully!`);
      console.log(`📊 Synced ${localCategories.length} categories with ${totalItems} total items`);
      console.log(`⏱️ Duration: ${duration}ms`);

      return {
        success: true,
        categoriesSynced: localCategories.length,
        totalItemsProcessed: totalItems,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error('❌ BoxHero sync failed:', errorMessage);

      // Update sync log with failure
      if (logId) {
        await CategoriesService.updateSyncLog(logId, {
          status: 'failed',
          error_message: errorMessage,
          sync_duration_ms: duration
        });
      }

      return {
        success: false,
        categoriesSynced: 0,
        totalItemsProcessed: 0,
        duration,
        error: errorMessage
      };
    }
  }

  /**
   * Get sync status and history
   */
  static async getSyncStatus(): Promise<{
    lastSync: any;
    recentLogs: any[];
    isHealthy: boolean;
  }> {
    try {
      const [lastSync, recentLogs] = await Promise.all([
        CategoriesService.getLastSuccessfulSync(),
        CategoriesService.getSyncLogs(5)
      ]);

      // Consider sync healthy if last successful sync was within 7 days
      const isHealthy = lastSync ? 
        (Date.now() - new Date(lastSync.created_at).getTime()) < (7 * 24 * 60 * 60 * 1000) : 
        false;

      return {
        lastSync,
        recentLogs,
        isHealthy
      };
    } catch (error) {
      console.error('❌ Error getting sync status:', error);
      return {
        lastSync: null,
        recentLogs: [],
        isHealthy: false
      };
    }
  }

  /**
   * Test BoxHero connection without syncing
   */
  static async testConnection(): Promise<boolean> {
    try {
      console.log('🧪 Testing BoxHero API connection...');
      const isConnected = await boxHeroApi.testConnection();
      console.log(isConnected ? '✅ BoxHero connection successful' : '❌ BoxHero connection failed');
      return isConnected;
    } catch (error) {
      console.error('❌ BoxHero connection test failed:', error);
      return false;
    }
  }

  /**
   * Sync category images by fetching random product images for each category
   */
  private static async syncCategoryImages(): Promise<number> {
    try {
      console.log('🖼️ Fetching fresh category images...');

      // Trigger the category images API to refresh cache
      const baseUrl = getBaseUrl();
      const response = await fetch(`${baseUrl}/api/categories/random-images?refresh=true`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        console.warn('⚠️ Failed to refresh category images, but continuing sync...');
        return 0;
      }

      const data = await response.json();
      const imageCount = data.images ? Object.keys(data.images).length : 0;

      console.log(`✅ Updated ${imageCount} category images`);
      return imageCount;

    } catch (error) {
      console.warn('⚠️ Category image sync failed, but continuing:', error);
      return 0;
    }
  }

  /**
   * Refresh product counts for all categories
   */
  private static async refreshProductCounts(): Promise<void> {
    try {
      console.log('🔢 Refreshing product counts for all categories...');

      // The categories API already calculates real-time product counts
      // So we just need to ensure the cache is fresh
      const baseUrl = getBaseUrl();
      const response = await fetch(`${baseUrl}/api/boxhero/categories?refresh=true`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Refreshed product counts for ${data.categories?.length || 0} categories`);
      } else {
        console.warn('⚠️ Failed to refresh product counts, but continuing sync...');
      }

    } catch (error) {
      console.warn('⚠️ Product count refresh failed, but continuing:', error);
    }
  }
}
